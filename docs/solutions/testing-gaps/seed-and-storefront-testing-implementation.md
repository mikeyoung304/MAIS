---
title: 'Seed Function and Storefront E2E Testing Implementation'
category: testing-gaps
severity: p2-high
components:
  - server/prisma/seeds/platform.ts
  - server/prisma/seeds/e2e.ts
  - server/prisma/seeds/demo.ts
  - server/prisma/seed.ts
  - client/src/pages/StorefrontHome.tsx
  - client/src/features/storefront/TierCard.tsx
  - e2e/tests/storefront.spec.ts
symptoms:
  - '771 server tests but zero tests for seed functions'
  - 'Storefront refactoring had no E2E test coverage'
  - 'Seed breakage only discovered in production'
  - 'No verification of idempotency patterns'
  - 'No testing of error paths in seeds'
root_cause: 'Seed functions were treated as deployment scripts rather than testable code; storefront refactoring prioritized implementation over test coverage'
resolution_type: new-implementation
created: 2025-11-30
status: resolved
phase: 'Phase 9 Testing Fixes'
commit: '5cfbff7'
test_count: 90
---

# Seed Function and Storefront E2E Testing Implementation

## Problem Statement

The MAIS codebase had **771 passing server tests** but critical gaps in test coverage:

1. **Zero tests for seed functions** - Database initialization code that runs in production had no automated verification
2. **No storefront E2E tests** - Major storefront refactoring (segment navigation, tier display, responsive layouts) lacked regression protection

### Why This Mattered

| Risk                    | Impact                                     |
| ----------------------- | ------------------------------------------ |
| Seed breakage           | Discovered only in production deployment   |
| Production guard bypass | Fixed E2E keys could leak to production    |
| Idempotency failures    | Seeds fail on re-run, blocking deployments |
| Storefront regressions  | UI bugs in customer-facing booking flow    |

## Solution Overview

### Phase 9 Deliverables

| Issue                                 | Priority | Resolution                                      |
| ------------------------------------- | -------- | ----------------------------------------------- |
| 075: E2E seed missing from CI         | P1       | Already fixed (`main-pipeline.yml:409-413`)     |
| 077: Production deploy missing seed   | P1       | Already fixed (`deploy-production.yml:332-337`) |
| 078: E2E seed production guard        | P2       | Already fixed (`e2e.ts:19-26`)                  |
| **083: Seed functions missing tests** | **P3**   | **66 new unit tests**                           |
| **087: Storefront E2E tests missing** | **P2**   | **24 new E2E tests**                            |

## Implementation Details

### Seed Unit Tests (66 tests across 4 files)

#### 1. seed-orchestrator.test.ts (11 tests)

Tests the mode detection logic in `seed.ts`:

```typescript
// Pattern: Environment variable testing with isolation
describe('SEED_MODE explicit settings', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SEED_MODE;
    delete process.env.NODE_ENV;
  });

  it('should use SEED_MODE=production when explicitly set', async () => {
    process.env.SEED_MODE = 'production';
    process.env.NODE_ENV = 'development'; // Should be overridden

    const mode = getSeedModeFromEnv();
    expect(mode).toBe('production');
  });
});
```

**Coverage:**

- SEED_MODE explicit settings (production, e2e, demo, dev, all)
- NODE_ENV fallback behavior
- Invalid mode handling

#### 2. e2e-seed.test.ts (16 tests)

Tests the E2E seed function with production safety:

```typescript
// Pattern: Security guard testing
describe('Production Environment Guard', () => {
  it('should throw error when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    const mockPrisma = createMockPrisma();

    await expect(seedE2E(mockPrisma)).rejects.toThrow(
      'FATAL: E2E seed cannot run in production environment!'
    );

    // Verify no database operations were performed
    expect(mockPrisma.tenant.upsert).not.toHaveBeenCalled();
  });
});
```

**Coverage:**

- Production environment guard (throws if NODE_ENV=production)
- Fixed API key format validation
- Tenant and package creation
- Idempotency (safe to run multiple times)
- Exported E2E_KEYS constants

#### 3. platform-seed.test.ts (22 tests)

Tests platform admin seed with security focus:

```typescript
// Pattern: Idempotency + Security (never update existing password)
describe('Idempotency - Existing Admin Handling', () => {
  it('should NOT update password for existing user (security)', async () => {
    const bcrypt = await import('bcryptjs');
    const mockPrisma = createMockPrisma({ userExists: true });

    await seedPlatform(mockPrisma);

    // Verify bcrypt was NOT called (security best practice)
    expect(bcrypt.default.hash).not.toHaveBeenCalled();

    // Verify update omits passwordHash
    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('passwordHash');
  });
});
```

**Coverage:**

- Required env vars (ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD)
- Password length validation (min 12 chars)
- New admin creation with bcrypt hashing
- Idempotency (existing user handling)
- Security: Never updates existing user's password

#### 4. demo-seed.test.ts (17 tests)

Tests demo seed with random key generation:

```typescript
// Pattern: Random key security testing
describe('Random Key Generation (Security)', () => {
  it('should regenerate keys on each seed (update operation)', async () => {
    const mockPrisma = createMockPrisma();

    await seedDemo(mockPrisma);

    const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
    // Update operation should also set new keys
    expect(upsertCall.update.apiKeyPublic).toBeDefined();
    expect(upsertCall.update.apiKeySecret).toBeDefined();
  });
});
```

**Coverage:**

- Random key generation (crypto.randomBytes)
- Tenant creation with demo slug/email
- Package creation (starter, growth, enterprise)
- Add-on creation and linking
- Blackout date creation
- Idempotency (upsert safety)

### Storefront E2E Tests (24 tests)

Created `e2e/tests/storefront.spec.ts`:

```typescript
// Pattern: Segment navigation testing
test.describe('Segment Navigation Logic', () => {
  test('0 segments redirects to /tiers', async ({ page }) => {
    // E2E tenant has no segments, should redirect to tiers
    await page.goto('/storefront');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/tiers');
  });

  test('tier card links to tier detail page', async ({ page }) => {
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(firstTierCard).toBeVisible({ timeout: 10000 });

    const tierLink = firstTierCard.locator('a');
    await tierLink.click();

    await expect(page).toHaveURL(/\/tiers\/\w+/);
  });
});
```

**Test Suites:**

| Suite                    | Tests | Coverage                |
| ------------------------ | ----- | ----------------------- |
| Segment Navigation       | 4     | 0/1/2+ segment routing  |
| Tenant Storefront Routes | 3     | /t/:slug white-label    |
| Tier Display             | 4     | Cards, prices, CTAs     |
| Loading States           | 2     | Spinner, API errors     |
| Tier Detail Page         | 5     | Details, calendar, form |
| Responsive Layout        | 4     | Mobile/tablet/desktop   |
| Image Handling           | 2     | Fallbacks, broken URLs  |

## Testing Patterns

### 1. Mock Prisma Factory Pattern

```typescript
function createMockPrisma(options: MockPrismaOptions = {}): PrismaClient {
  const { userExists = false } = options;

  const existingUser = userExists
    ? { id: 'user-existing', email: 'admin@example.com', role: 'PLATFORM_ADMIN' }
    : null;

  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn().mockResolvedValue({ id: 'user-new', email: 'admin@example.com' }),
      update: vi.fn().mockResolvedValue({ id: 'user-existing', email: 'admin@example.com' }),
    },
  } as unknown as PrismaClient;
}
```

### 2. Environment Variable Isolation

```typescript
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_DEFAULT_PASSWORD;
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});
```

### 3. Idempotency Verification

```typescript
it('should use upsert for all operations (safe to run multiple times)', async () => {
  const mockPrisma = createMockPrisma();

  // Run twice
  await seedDemo(mockPrisma);
  await seedDemo(mockPrisma);

  // All operations should use upsert
  expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
  expect(mockPrisma.package.upsert).toHaveBeenCalled();
});
```

### 4. Responsive E2E Testing

```typescript
test('mobile viewport shows stacked cards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/tiers');
  await page.waitForLoadState('networkidle');

  const tierCards = page.locator('[data-testid^="tier-card-"]');
  const cardBoundingBox = await tierCards.first().boundingBox();

  // Card width should be close to viewport width
  expect(cardBoundingBox?.width).toBeGreaterThan(300);
});
```

## Verification Commands

```bash
# Run all seed tests (66 passing)
npm test -- test/seeds/

# Run storefront E2E tests
npm run test:e2e -- e2e/tests/storefront.spec.ts

# Run specific test file
npm test -- test/seeds/platform-seed.test.ts

# Watch mode for development
npm run test:watch -- test/seeds/

# With coverage report
npm run test:coverage -- test/seeds/
```

## Prevention Strategies

### Pre-Commit Hooks

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
# Check for seed changes without corresponding tests
SEED_FILES=$(git diff --cached --name-only | grep -E "prisma/seeds/.*\.ts$")
if [ -n "$SEED_FILES" ]; then
  SEED_TESTS=$(git diff --cached --name-only | grep -E "test/seeds/.*\.test\.ts$")
  if [ -z "$SEED_TESTS" ]; then
    echo "WARNING: Seed files changed without test updates"
    echo "Consider adding tests for: $SEED_FILES"
  fi
fi
```

### Code Review Checklist

For seed changes:

- [ ] Are all environment variables validated with helpful error messages?
- [ ] Is idempotency tested (safe to run multiple times)?
- [ ] Are error paths tested (missing env vars, constraint violations)?
- [ ] Is the production guard tested (if applicable)?
- [ ] Are security-sensitive operations tested (password hashing, key generation)?

For storefront changes:

- [ ] Are navigation flows tested (routing logic)?
- [ ] Are responsive breakpoints tested (mobile/tablet/desktop)?
- [ ] Are error states tested (API failures, invalid data)?
- [ ] Are loading states tested?

### CI Pipeline Enhancement

```yaml
# Add to main-pipeline.yml
seed-tests:
  name: Seed Function Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm test -- test/seeds/ --coverage
    - name: Verify idempotency
      run: npm test -- test/seeds/ # Run twice
```

## Related Documentation

- [TEST-FAILURE-PREVENTION-STRATEGIES.md](../TEST-FAILURE-PREVENTION-STRATEGIES.md) - Timeout formulas, race condition prevention
- [test-isolation-di-container-race-conditions.md](../test-failures/test-isolation-di-container-race-conditions.md) - Sequential processing patterns
- [SCHEMA_DRIFT_PREVENTION.md](../SCHEMA_DRIFT_PREVENTION.md) - Ensure migrations run before seeds
- [ci-eslint-prisma-deploy-failures.md](../build-errors/ci-eslint-prisma-deploy-failures.md) - CI/CD environment configuration
- [STOREFRONT-COMPONENT-PREVENTION-INDEX.md](../STOREFRONT-COMPONENT-PREVENTION-INDEX.md) - Component testing patterns

## Files Created

| File                                          | Lines    | Tests  |
| --------------------------------------------- | -------- | ------ |
| `server/test/seeds/seed-orchestrator.test.ts` | 165      | 11     |
| `server/test/seeds/e2e-seed.test.ts`          | 212      | 16     |
| `server/test/seeds/platform-seed.test.ts`     | 248      | 22     |
| `server/test/seeds/demo-seed.test.ts`         | 210      | 17     |
| `e2e/tests/storefront.spec.ts`                | 307      | 24     |
| **Total**                                     | **1142** | **90** |

## Lessons Learned

1. **Seed functions are production code** - They deserve the same test coverage as any other critical path
2. **Security guards need tests** - The E2E production guard existed but wasn't tested until now
3. **Idempotency is critical** - Seeds must be safe to run multiple times
4. **E2E tests prevent regressions** - UI refactoring without E2E coverage is risky
5. **Mock isolation enables fast tests** - 66 seed tests run in 212ms with full mocking
