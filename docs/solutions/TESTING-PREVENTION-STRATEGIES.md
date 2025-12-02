# Testing Prevention Strategies

Prevention strategies to catch testing gaps and ensure critical functions remain covered. This document addresses the testing gap discovered with seed functions and storefront refactoring.

## Overview

**Problem Context:** The codebase had 771 server tests but zero tests for critical seed functions. The new storefront refactoring also had no E2E coverage. This created risk of:
- Seed breakage discovered only in production
- No verification of idempotency
- No testing of error paths
- Regressions in storefront navigation logic

**Solutions Implemented:**
- 66 seed unit tests covering mode detection, security guards, idempotency
- Storefront E2E tests covering navigation, display, responsive layout

---

## 1. Pre-Commit Hooks

### Current Setup
Location: `.husky/pre-commit`

Current checks:
```bash
# Documentation validation
./scripts/validate-docs.sh

# Unit tests (fast tests only)
npm run test:unit

# TypeScript type checking
npm run typecheck
```

### Enhanced Pre-Commit Hooks

#### 1.1 Test Coverage Validation Hook
**Purpose:** Prevent commits that reduce test coverage for critical modules.

```bash
#!/bin/bash
# .husky/test-coverage-check

set -e

echo "Checking test coverage thresholds..."

# Run coverage on changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$CHANGED_FILES" ]; then
  exit 0  # No TypeScript changes
fi

# Critical paths that must maintain 80%+ coverage
CRITICAL_PATHS=(
  "server/src/services/booking.service.ts"
  "server/src/services/availability.service.ts"
  "server/src/middleware/tenant.ts"
  "server/prisma/seed.ts"
  "server/prisma/seeds/"
  "client/src/features/storefront/"
)

for CRITICAL_PATH in "${CRITICAL_PATHS[@]}"; do
  for CHANGED_FILE in $CHANGED_FILES; do
    if [[ "$CHANGED_FILE" == "$CRITICAL_PATH"* ]]; then
      echo "Critical module changed: $CHANGED_FILE"
      echo "Running full test suite to verify coverage..."

      # Run tests with coverage
      npm run test:coverage > /dev/null 2>&1 || {
        echo "❌ Test coverage validation failed"
        echo "Critical paths must maintain 80%+ coverage."
        echo "Run: npm run test:coverage"
        exit 1
      }

      break
    fi
  done
done

echo "✅ Test coverage check passed"
```

#### 1.2 Seed Function Validation Hook
**Purpose:** Ensure seed files have corresponding tests and maintain idempotency guarantees.

```bash
#!/bin/bash
# .husky/seed-validation

set -e

echo "Validating seed function tests..."

CHANGED_FILES=$(git diff --cached --name-only | grep -E 'server/prisma/seeds/.*\.ts$' || true)

if [ -z "$CHANGED_FILES" ]; then
  exit 0  # No seed changes
fi

for SEED_FILE in $CHANGED_FILES; do
  SEED_NAME=$(basename "$SEED_FILE" .ts)
  TEST_FILE="server/test/seeds/${SEED_NAME}.test.ts"

  if [ ! -f "$TEST_FILE" ]; then
    echo "❌ Missing test file for seed: $SEED_FILE"
    echo "Create test file: $TEST_FILE"
    echo ""
    echo "Test file must include:"
    echo "  - Environment variable validation (if applicable)"
    echo "  - Idempotency verification"
    echo "  - Error path testing"
    echo "  - Security guard testing"
    exit 1
  fi
done

echo "✅ Seed function validation passed"
```

#### 1.3 E2E Coverage for Critical Paths Hook
**Purpose:** Ensure critical UI flows have E2E test coverage.

```bash
#!/bin/bash
# .husky/e2e-coverage-check

set -e

echo "Checking E2E coverage for critical flows..."

CRITICAL_ROUTES=(
  "pages/SignupPage.tsx"
  "features/storefront/"
  "features/booking/"
)

CHANGED_FILES=$(git diff --cached --name-only | grep -E '\.(tsx|ts)$' || true)

HAS_CRITICAL_CHANGES=0
for CRITICAL_ROUTE in "${CRITICAL_ROUTES[@]}"; do
  for CHANGED_FILE in $CHANGED_FILES; do
    if [[ "$CHANGED_FILE" == *"$CRITICAL_ROUTE"* ]]; then
      HAS_CRITICAL_CHANGES=1
      break
    fi
  done
done

if [ "$HAS_CRITICAL_CHANGES" -eq 1 ]; then
  echo "Critical UI changes detected. Running quick E2E smoke test..."

  # Optional: Run a quick E2E check (can be slow, so make it optional)
  # npm run test:e2e -- --grep "smoke" || {
  #   echo "⚠️  E2E smoke tests failed"
  #   echo "Consider running: npm run test:e2e"
  #   exit 1
  # }

  echo "ℹ️  Remember to run full E2E tests before pushing: npm run test:e2e"
fi

echo "✅ E2E coverage check passed"
```

#### 1.4 Composite Pre-Commit Script
**Purpose:** Orchestrate all checks in the right order.

**Update `.husky/pre-commit`:**
```bash
#!/bin/bash

set -e

# Fast checks first
echo "Running pre-commit checks..."
echo ""

# 1. Documentation validation (fast)
echo "Step 1/5: Documentation validation..."
./scripts/validate-docs.sh || exit 1

# 2. Pattern validation (fast)
echo "Step 2/5: Multi-tenant pattern validation..."
./.claude/hooks/validate-patterns.sh || exit 1

# 3. Seed function validation (fast)
echo "Step 3/5: Seed function tests..."
./.husky/seed-validation || exit 1

# 4. TypeScript type checking (medium)
echo "Step 4/5: TypeScript type checking..."
npm run typecheck || exit 1

# 5. Unit tests (medium)
echo "Step 5/5: Running unit tests..."
npm run test:unit || exit 1

echo ""
echo "✅ All pre-commit checks passed!"
```

---

## 2. Code Review Checklist Items

Add to PR description template or review guidelines:

### 2.1 Seed Function Changes

When reviewing changes to `server/prisma/seeds/`:

**Mandatory Questions:**
- [ ] Does the seed have a corresponding test file (`server/test/seeds/{name}.test.ts`)?
- [ ] Are environment variable guards tested (missing vars throw clear errors)?
- [ ] Is idempotency verified (running twice doesn't create duplicates)?
- [ ] Are error paths tested (invalid inputs, database errors)?
- [ ] Does the seed use `upsert` instead of `create` to ensure idempotency?
- [ ] Are security-sensitive values (API keys, passwords) handled securely?
- [ ] Is the seed mode reflected in `server/prisma/seed.ts` orchestration?

**Test Coverage Expectations:**
```typescript
// For each seed function, verify these test categories:

describe('EnvironmentValidation') {
  // Missing required env vars
  // Invalid values for env vars
  // Help messages in error text
}

describe('Idempotency') {
  // Running twice creates no duplicates
  // Existing records are preserved
  // Updates don't overwrite sensitive values
}

describe('DataCreation') {
  // Correct tenant/user/resource created
  // All relationships properly set
  // Default values applied correctly
}

describe('ErrorHandling') {
  // Database constraint violations handled
  // Invalid data rejected with clear messages
  // Prisma errors wrapped appropriately
}
```

### 2.2 Storefront / UI Feature Changes

When reviewing `client/src/features/storefront/` or similar critical UI:

**Mandatory Questions:**
- [ ] Is there an E2E test for this feature/route (`e2e/tests/*.spec.ts`)?
- [ ] Does the E2E test cover the happy path AND error states?
- [ ] Are responsive breakpoints tested (mobile, tablet, desktop)?
- [ ] Does the test verify data fetching (loading, success, error states)?
- [ ] Are navigation flows tested (from → to pages)?
- [ ] Is accessibility considered (keyboard navigation, ARIA labels)?

**E2E Test Expectations:**
```typescript
// For each critical UI feature, verify these test categories:

test.describe('Navigation') {
  // Links route to correct pages
  // Back/forward button works
  // Deep linking works
}

test.describe('DataDisplay') {
  // Data loads and displays
  // Empty state shown when appropriate
  // Fallbacks work (missing images, etc)
}

test.describe('UserInteraction') {
  // Forms accept/reject input
  // Buttons trigger correct actions
  // Modals/dialogs open/close
}

test.describe('ResponsiveLayout') {
  // Mobile layout correct
  // Tablet layout correct
  // Desktop layout correct
}

test.describe('ErrorHandling') {
  // Network errors shown
  // 404/500 errors shown
  // Retry mechanisms work
}
```

### 2.3 Critical Service Changes

When reviewing changes to `server/src/services/`:

**Mandatory Questions:**
- [ ] Does the service have unit tests (mocked dependencies)?
- [ ] Does the service have integration tests (real database)?
- [ ] Are multi-tenant queries scoped by `tenantId`?
- [ ] Are error paths tested (throw custom domain errors)?
- [ ] Are race conditions considered (pessimistic locks, transactions)?
- [ ] Is the service tested in mock mode and real mode?

---

## 3. CI Pipeline Enhancements

### 3.1 Current Pipeline
Location: `.github/workflows/main-pipeline.yml`

Jobs included:
- Documentation validation
- Pattern validation
- Lint & format check
- TypeScript check
- Security audit
- Unit tests (with coverage)
- Integration tests (with PostgreSQL)
- Migration validation
- E2E tests (Playwright)
- Build validation

### 3.2 Proposed Enhancements

#### 3.2.1 Seed Function Test Coverage Gate
**Add new CI job:**

```yaml
  # Job X: Seed Function Tests
  seed-tests:
    name: Seed Function Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_seed_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npm run --workspace=server prisma:generate

      - name: Run database migrations
        run: npx prisma migrate deploy --schema=./server/prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_seed_test

      - name: Run seed function tests
        run: npm test -- server/test/seeds/
        env:
          NODE_ENV: test

      - name: Test seed idempotency (production mode)
        run: |
          npm run --workspace=server db:seed:production || true
          npm run --workspace=server db:seed:production
          echo "✅ Idempotency test passed (no errors on second run)"
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_seed_test
          ADMIN_EMAIL: test@example.com
          ADMIN_DEFAULT_PASSWORD: test-password-12345

      - name: Comment PR on failure
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ **Seed function tests failed**\n\nPlease verify seed functions:\n```bash\nnpm test -- server/test/seeds/\n```'
            })
```

#### 3.2.2 E2E Coverage Analysis
**Add optional coverage reporting:**

```yaml
  # Job X: E2E Coverage Report
  e2e-coverage:
    name: E2E Test Coverage Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 5
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Get base branch E2E tests
        run: |
          git fetch origin ${{ github.base_ref }}
          BASE_TESTS=$(git diff origin/${{ github.base_ref }}...HEAD --name-only -- e2e/tests/ | wc -l)
          echo "BASE_TESTS=$BASE_TESTS" >> $GITHUB_ENV

      - name: Check for E2E coverage of critical files
        run: |
          CRITICAL_PATHS="client/src/features/storefront client/src/pages"
          CRITICAL_CHANGED=$(git diff origin/${{ github.base_ref }} --name-only -- $CRITICAL_PATHS | wc -l)

          if [ "$CRITICAL_CHANGED" -gt 0 ]; then
            E2E_TESTS=$(git diff origin/${{ github.base_ref }} --name-only -- e2e/tests/ | wc -l)
            if [ "$E2E_TESTS" -eq 0 ]; then
              echo "⚠️  Warning: Critical UI changes without new E2E tests"
              echo "Consider adding E2E tests to verify storefront/booking flows"
            fi
          fi

      - name: Comment PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const criticalChanges = ${{ env.CRITICAL_CHANGED || 0 }};
            const e2eTests = ${{ env.E2E_TESTS || 0 }};

            if (criticalChanges > 0 && e2eTests === 0) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: '⚠️  **E2E Coverage**: Critical UI changes detected without new E2E tests. Consider adding tests for user-facing changes.'
              })
            }
```

#### 3.2.3 Test Mutation Validation (Advanced)
**Optional stryker mutation testing:**

```yaml
  # Job X: Mutation Testing (Optional, nightly only)
  mutation-tests:
    name: Mutation Testing (Stryker)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run mutation tests on critical services
        run: |
          npx stryker run \
            --testRunner=vitest \
            --files="server/src/services/booking.service.ts,server/src/services/availability.service.ts" \
            --mutators="StringLiteral,BooleanLiteral,UpdateOperator"

      - name: Upload mutation report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report-${{ github.run_id }}
          path: reports/
          retention-days: 30
```

#### 3.2.4 Update Pipeline Complete Job
**Add seed-tests to requirements:**

```yaml
  pipeline-complete:
    name: Pipeline Complete
    runs-on: ubuntu-latest
    needs: [
      docs-validation,
      pattern-validation,
      lint,
      typecheck,
      unit-tests,
      integration-tests,
      seed-tests,  # ADD THIS
      e2e-tests,
      build
    ]
    if: always()

    steps:
      - name: Check all jobs status
        run: |
          if [ "${{ needs.seed-tests.result }}" != "success" ]; then
            echo "❌ Seed function tests failed"
            exit 1
          fi
          # ... other checks ...
```

---

## 4. Best Practices

### 4.1 When to Add Seed Tests

**ALWAYS add tests when:**
- Creating a new seed function (e.g., `seedPlatform`, `seedDemo`)
- Modifying seed environment variable requirements
- Adding security guards or validation
- Changing idempotency guarantees

**Test checklist for seed functions:**

```typescript
describe('New Seed Function', () => {
  // 1. Environment Variable Validation
  describe('Environment Variable Validation', () => {
    it('should throw when required env var is missing');
    it('should include helpful error message with generation instructions');
    it('should validate format/length of env vars');
  });

  // 2. Idempotency
  describe('Idempotency', () => {
    it('should use upsert, not create');
    it('should not modify existing records on second run');
    it('should not update sensitive values if record exists');
  });

  // 3. Data Creation
  describe('Data Creation', () => {
    it('should create tenant with correct slug');
    it('should create users with correct associations');
    it('should generate secure random keys');
  });

  // 4. Error Handling
  describe('Error Handling', () => {
    it('should handle database constraint violations');
    it('should wrap Prisma errors appropriately');
    it('should not leak sensitive information in errors');
  });

  // 5. Security
  describe('Security', () => {
    it('should hash passwords before storing');
    it('should generate cryptographically random keys');
    it('should not log sensitive values');
  });
});
```

### 4.2 When to Add E2E Tests

**ALWAYS add tests when:**
- Creating new user-facing routes/pages
- Adding critical workflows (signup, booking, payment)
- Modifying storefront/catalog display logic
- Refactoring navigation or routing

**OPTIONAL but recommended:**
- Responsive layout changes (add responsive test)
- Form validation changes (add form test)
- Error state handling (add error path test)

**Test checklist for E2E features:**

```typescript
test.describe('New Feature', () => {
  // 1. Happy Path
  test.describe('Happy Path', () => {
    test('should navigate to feature');
    test('should display data correctly');
    test('should complete primary action');
  });

  // 2. Data States
  test.describe('Data States', () => {
    test('should show loading state');
    test('should show empty state');
    test('should show error state');
  });

  // 3. User Interaction
  test.describe('User Interaction', () => {
    test('should handle form submission');
    test('should validate input');
    test('should show validation errors');
  });

  // 4. Responsive Layout
  test.describe('Responsive Layout', () => {
    test('should work on mobile');
    test('should work on tablet');
    test('should work on desktop');
  });

  // 5. Error Handling
  test.describe('Error Handling', () => {
    test('should handle network errors');
    test('should handle 404 responses');
    test('should handle 500 responses');
  });

  // 6. Navigation
  test.describe('Navigation', () => {
    test('should navigate to detail page');
    test('should navigate back');
    test('should support deep linking');
  });
});
```

---

## 5. Testing Patterns to Follow

### 5.1 Idempotency Testing Pattern

**For seed functions:**

```typescript
/**
 * Tests that seed can be run multiple times without creating duplicates
 */
describe('Seed Idempotency', () => {
  it('should not create duplicate records on second run', async () => {
    const mockPrisma = createMockPrisma();

    // First run
    await seedPlatform(mockPrisma);
    const firstCallCount = mockPrisma.user.create.mock.calls.length;

    // Second run - should use upsert, not create
    mockPrisma.user.create.mockClear();
    await seedPlatform(mockPrisma);
    const secondCallCount = mockPrisma.user.create.mock.calls.length;

    // Second run should not create new records
    expect(secondCallCount).toBe(0);
  });

  it('should preserve existing data on re-seed', async () => {
    const mockPrisma = createMockPrisma();

    // Setup: user exists
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: 'original-hash'
    });

    // Run seed
    await seedPlatform(mockPrisma);

    // Verify: update didn't change password
    const updateCall = mockPrisma.user.update.mock.calls[0];
    expect(updateCall[0].data).not.toHaveProperty('passwordHash');
  });

  it('should use upsert pattern, not raw create', async () => {
    const source = fs.readFileSync('./server/prisma/seeds/platform.ts', 'utf8');

    // Verify file uses prisma.user.upsert or findUnique
    expect(source).toMatch(/\.upsert\(|findUnique/);

    // Verify file does NOT use create without checking existence
    expect(source).not.toMatch(/\.create\s*\({/);
  });
});
```

### 5.2 Environment Guard Testing Pattern

**For functions with required env vars:**

```typescript
/**
 * Tests that environment variables are properly validated
 */
describe('Environment Variable Guards', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all seed-related vars
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_DEFAULT_PASSWORD;
    delete process.env.ADMIN_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should require ADMIN_EMAIL for production seed', async () => {
    process.env.ADMIN_DEFAULT_PASSWORD = 'valid-password-123';
    // ADMIN_EMAIL not set

    const mockPrisma = createMockPrisma();

    await expect(seedPlatform(mockPrisma))
      .rejects
      .toThrow(/ADMIN_EMAIL.*required/i);
  });

  it('should provide helpful error message with instructions', async () => {
    const mockPrisma = createMockPrisma();

    await expect(seedPlatform(mockPrisma))
      .rejects
      .toThrow(/openssl rand|generate/i);
  });

  it('should validate password length (min 12 chars)', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_DEFAULT_PASSWORD = 'short'; // Only 5 chars

    const mockPrisma = createMockPrisma();

    await expect(seedPlatform(mockPrisma))
      .rejects
      .toThrow(/12.*character|password.*length/i);
  });

  it('should allow optional ADMIN_NAME', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_DEFAULT_PASSWORD = 'valid-password-123';
    // ADMIN_NAME not set (should default to 'Platform Admin')

    const mockPrisma = createMockPrisma();

    await expect(seedPlatform(mockPrisma)).resolves.not.toThrow();

    const createCall = mockPrisma.user.create.mock.calls[0];
    expect(createCall[0].data.name).toBe('Platform Admin');
  });
});
```

### 5.3 Mock Prisma Pattern for Unit Tests

**For testing services with Prisma:**

```typescript
/**
 * Helper to create fully mocked Prisma client for unit testing
 */
function createMockPrisma(): Partial<PrismaClient> {
  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((callback) => callback(this)),

    // Common models with mock methods
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
      update: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
    },

    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'user-1' }),
      update: vi.fn().mockResolvedValue({ id: 'user-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'user-1' }),
    },

    booking: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'booking-1' }),
      update: vi.fn().mockResolvedValue({ id: 'booking-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'booking-1' }),
    },

    // Raw query support for tests
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Pattern for testing services with mocked repositories
 */
describe('BookingService', () => {
  it('should prevent double bookings using transaction locks', async () => {
    const mockPrisma = createMockPrisma();

    // Mock transaction to simulate lock behavior
    (mockPrisma.$transaction as any).mockImplementation(async (callback) => {
      // Simulate pessimistic lock: existing booking found
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'booking-1' }]),
        booking: {
          create: vi.fn().mockRejectedValue(
            new PrismaClientKnownRequestError(
              'Unique constraint failed',
              'P2002',
              '6.17.1'
            )
          ),
        },
      };
      return callback(tx);
    });

    const service = new BookingService(mockPrisma as any);

    await expect(service.create({
      tenantId: 'tenant-1',
      date: new Date(),
      // ... other fields
    })).rejects.toThrow(BookingConflictError);
  });
});
```

### 5.4 Responsive E2E Testing Pattern

**For testing UI on different screen sizes:**

```typescript
/**
 * Test UI responsiveness across breakpoints
 */
test.describe('Responsive Layout', () => {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ];

  breakpoints.forEach(({ name, width, height }) => {
    test(`should render correctly on ${name}`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({ width, height });

      // Navigate to feature
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      // Verify layout-specific elements
      if (name === 'mobile') {
        // Mobile: single column
        const tierCards = page.locator('[data-testid^="tier-card-"]');
        const box = await tierCards.first().boundingBox();

        // Cards should use full width minus padding
        expect(box?.width).toBeGreaterThan(width * 0.7);
        expect(box?.width).toBeLessThan(width * 0.95);
      } else if (name === 'tablet') {
        // Tablet: 2 columns
        const cards = page.locator('[data-testid^="tier-card-"]');
        const firstCard = await cards.nth(0).boundingBox();
        const secondCard = await cards.nth(1).boundingBox();

        // Should be side by side
        expect((secondCard?.x || 0) - (firstCard?.x || 0))
          .toBeGreaterThan(firstCard?.width || 0);
      } else {
        // Desktop: 3+ columns
        const cards = page.locator('[data-testid^="tier-card-"]');
        const count = await cards.count();

        expect(count).toBeGreaterThanOrEqual(3);
      }

      // Verify no horizontal scroll
      const scrollWidth = await page.evaluate(() =>
        document.documentElement.scrollWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  });
});
```

### 5.5 Error Path Testing Pattern

**For testing error states and recovery:**

```typescript
/**
 * Test service error handling and recovery
 */
describe('Error Handling', () => {
  it('should throw custom domain error on booking conflict', async () => {
    const mockPrisma = createMockPrisma();

    // Mock unique constraint violation
    (mockPrisma.booking.create as any).mockRejectedValue(
      new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`tenantId`,`date`)',
        'P2002',
        '6.17.1'
      )
    );

    const service = new BookingService(mockPrisma as any);

    await expect(service.create({
      tenantId: 'tenant-1',
      date: new Date(),
    })).rejects.toThrow(BookingConflictError);
  });

  it('should include date in error for debugging', async () => {
    const bookingDate = new Date('2025-12-25');
    const mockPrisma = createMockPrisma();

    (mockPrisma.booking.create as any).mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', 'P2002', '6.17.1')
    );

    const service = new BookingService(mockPrisma as any);

    try {
      await service.create({
        tenantId: 'tenant-1',
        date: bookingDate,
      });
    } catch (error) {
      expect(error.message).toContain('2025-12-25');
    }
  });

  it('should re-throw unknown errors', async () => {
    const mockPrisma = createMockPrisma();

    // Unknown error
    (mockPrisma.booking.create as any).mockRejectedValue(
      new Error('Connection timeout')
    );

    const service = new BookingService(mockPrisma as any);

    // Should not wrap/transform unknown errors
    await expect(service.create({
      tenantId: 'tenant-1',
      date: new Date(),
    })).rejects.toThrow('Connection timeout');
  });
});
```

---

## 6. Testing Implementation Timeline

### Phase 1: Foundation (Week 1)
- [x] Add seed function unit tests (66 tests)
- [x] Add storefront E2E tests (6+ tests)
- [ ] Update pre-commit hooks with test validation
- [ ] Update code review checklist

### Phase 2: CI Integration (Week 2)
- [ ] Add seed-tests job to main-pipeline.yml
- [ ] Add E2E coverage analysis job
- [ ] Configure coverage thresholds
- [ ] Document CI coverage requirements

### Phase 3: Refinement (Week 3)
- [ ] Add pre-commit hooks for test coverage
- [ ] Create test pattern library
- [ ] Document mutation testing strategy
- [ ] Review and refine based on team feedback

### Phase 4: Team Adoption (Week 4+)
- [ ] Train team on testing patterns
- [ ] Enforce new guidelines on PRs
- [ ] Iterate based on real-world usage
- [ ] Expand to other critical modules

---

## 7. Quick Reference Cheat Sheet

### Pre-Commit Checks
```bash
# Run all pre-commit checks locally
npm run test:unit
npm run typecheck
./scripts/validate-docs.sh

# Run seed tests specifically
npm test -- server/test/seeds/

# Run E2E tests (slow, optional pre-commit)
npm run test:e2e
```

### Test Coverage Verification
```bash
# Coverage for changed files
npm run test:coverage -- --coverage

# Coverage for specific module
npm run test:coverage -- server/src/services/booking.service.ts

# View coverage report
npm run test:coverage:report
```

### Adding Tests

**For new seed function:**
1. Create `server/prisma/seeds/my-seed.ts`
2. Create `server/test/seeds/my-seed.test.ts`
3. Include env validation, idempotency, error tests
4. Run: `npm test -- server/test/seeds/my-seed.test.ts`

**For new E2E feature:**
1. Create `e2e/tests/my-feature.spec.ts`
2. Test happy path, error states, responsive layout
3. Run: `npm run test:e2e -- e2e/tests/my-feature.spec.ts`

### CI Pipeline Commands
```bash
# Test seed idempotency locally
npm run db:seed:production
npm run db:seed:production  # Should not error

# Test E2E in mock mode
npm run dev:e2e &
npm run test:e2e

# Full pipeline (local)
npm run typecheck && npm run test:unit && npm run test:coverage
```

---

## Related Documentation

- [Testing Guide](../TESTING.md)
- [Multi-Tenant Security Patterns](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Prevention Strategies Index](./PREVENTION-STRATEGIES-INDEX.md)
- [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md)

---

## Appendix: Test File Templates

### Seed Test Template
See: `server/test/seeds/seed-orchestrator.test.ts` (existing example)

### E2E Test Template
See: `e2e/tests/storefront.spec.ts` (existing example)

### Service Test Template
See: `server/src/services/audit.service.test.ts` (existing example)
