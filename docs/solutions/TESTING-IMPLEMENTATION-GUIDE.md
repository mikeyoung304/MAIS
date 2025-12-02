# Testing Prevention Implementation Guide

Step-by-step guide to implement the testing prevention strategies in your codebase.

## Part 1: Setting Up Pre-Commit Hooks

### Step 1.1: Create Seed Validation Hook

Create `.husky/seed-validation`:

```bash
#!/bin/bash

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

  # Verify test file has required test suites
  if ! grep -q "describe('.*Idempotency" "$TEST_FILE"; then
    echo "⚠️  Warning: Test file missing idempotency tests: $TEST_FILE"
  fi

done

echo "✅ Seed function validation passed"
```

Make it executable:
```bash
chmod +x .husky/seed-validation
```

### Step 1.2: Create E2E Coverage Check Hook

Create `.husky/e2e-coverage-check`:

```bash
#!/bin/bash

set -e

echo "Checking E2E coverage for critical flows..."

CRITICAL_ROUTES=(
  "client/src/pages/SignupPage.tsx"
  "client/src/features/storefront/"
  "client/src/features/booking/"
)

CHANGED_FILES=$(git diff --cached --name-only | grep -E '\.(tsx|ts)$' || true)

HAS_CRITICAL_CHANGES=0
for CRITICAL_ROUTE in "${CRITICAL_ROUTES[@]}"; do
  for CHANGED_FILE in $CHANGED_FILES; do
    if [[ "$CHANGED_FILE" == *"$CRITICAL_ROUTE"* ]]; then
      HAS_CRITICAL_CHANGES=1
      echo "ℹ️  Critical UI change detected: $CHANGED_FILE"
      break
    fi
  done
done

if [ "$HAS_CRITICAL_CHANGES" -eq 1 ]; then
  echo ""
  echo "⚠️  Remember to add/update E2E tests for critical UI changes"
  echo "Run: npm run test:e2e to verify coverage"
fi

echo "✅ E2E coverage check passed"
```

Make it executable:
```bash
chmod +x .husky/e2e-coverage-check
```

### Step 1.3: Update Main Pre-Commit Hook

Update `.husky/pre-commit`:

```bash
#!/bin/bash

set -e

echo "Running pre-commit checks..."
echo ""

# 1. Documentation validation (fast)
echo "[1/5] Documentation validation..."
./scripts/validate-docs.sh || exit 1

# 2. Seed validation (fast)
echo "[2/5] Seed function test validation..."
./.husky/seed-validation || exit 1

# 3. E2E coverage check (fast)
echo "[3/5] E2E coverage check..."
./.husky/e2e-coverage-check || exit 1

# 4. TypeScript type checking (medium)
echo "[4/5] TypeScript type checking..."
npm run typecheck || exit 1

# 5. Unit tests (medium)
echo "[5/5] Running unit tests..."
npm run test:unit || exit 1

echo ""
echo "✅ All pre-commit checks passed!"
```

## Part 2: Updating CI Pipeline

### Step 2.1: Add Seed Tests Job

Add this job to `.github/workflows/main-pipeline.yml` before the `e2e-tests` job:

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

      - name: Run seed function unit tests
        run: npm test -- server/test/seeds/ --reporter=verbose
        env:
          NODE_ENV: test

      - name: Test seed idempotency
        run: |
          echo "Testing production seed idempotency..."
          npm run --workspace=server db:seed:production
          echo "✅ First run succeeded"

          echo "Testing second run (idempotency)..."
          npm run --workspace=server db:seed:production
          echo "✅ Second run succeeded (idempotent)"

          echo "Testing e2e seed idempotency..."
          npm run --workspace=server db:seed:e2e
          npm run --workspace=server db:seed:e2e
          echo "✅ E2E seed is idempotent"
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_seed_test
          ADMIN_EMAIL: ci@example.com
          ADMIN_DEFAULT_PASSWORD: ci-password-12345
          NODE_ENV: test

      - name: Comment PR on failure
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ **Seed function tests failed**\n\nPlease verify seed functions:\n```bash\nnpm test -- server/test/seeds/\n```\n\nAlso verify idempotency:\n```bash\nnpm run db:seed:production\nnpm run db:seed:production\n```'
            })
```

### Step 2.2: Update Pipeline Complete Job

Find the `pipeline-complete` job and update the `needs` field:

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
      seed-tests,  # ADD THIS LINE
      e2e-tests,
      build
    ]
    if: always()

    steps:
      - name: Check all jobs status
        run: |
          # Required checks
          if [ "${{ needs.docs-validation.result }}" != "success" ] || \
             [ "${{ needs.pattern-validation.result }}" != "success" ] || \
             [ "${{ needs.lint.result }}" != "success" ] || \
             [ "${{ needs.typecheck.result }}" != "success" ] || \
             [ "${{ needs.unit-tests.result }}" != "success" ] || \
             [ "${{ needs.integration-tests.result }}" != "success" ] || \
             [ "${{ needs.seed-tests.result }}" != "success" ] || \
             [ "${{ needs.e2e-tests.result }}" != "success" ] || \
             [ "${{ needs.build.result }}" != "success" ]; then
            echo "❌ One or more required checks failed"
            exit 1
          else
            echo "✅ All pipeline checks passed!"
          fi

      - name: Comment PR with success
        if: success() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ **All pipeline checks passed!**\n\n- Documentation: Passed\n- Multi-tenant patterns: Passed\n- Code quality: Passed\n- Type checking: Passed\n- Unit tests: Passed\n- Integration tests: Passed\n- **Seed tests: Passed** (NEW)\n- E2E tests: Passed\n- Build validation: Passed\n\nReady for review!'
            })
```

## Part 3: Code Review Template

### Step 3.1: Update Pull Request Template

Create `.github/pull_request_template.md` if it doesn't exist:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Dependency update
- [ ] Documentation
- [ ] Other

## Changes

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if UI changes)
- [ ] Manual testing completed
- [ ] All tests passing locally

## Checklist

### Seed Function Changes
- [ ] If modifying `server/prisma/seeds/`, test file exists (`server/test/seeds/`)
- [ ] Idempotency verified (running seed twice doesn't create duplicates)
- [ ] Environment variable guards tested
- [ ] Error paths tested
- [ ] Used `upsert` instead of `create` for idempotency

### UI/Route Changes
- [ ] If modifying critical UI (`client/src/features/storefront/`, etc.), E2E test exists
- [ ] E2E test covers happy path
- [ ] E2E test covers error states
- [ ] E2E test covers responsive layout (mobile, tablet, desktop)
- [ ] Multi-tenant scoping verified (if applicable)

### Service Changes
- [ ] Unit tests added/updated (with mocked dependencies)
- [ ] Integration tests added/updated (with real database)
- [ ] Error paths tested (domain errors thrown correctly)
- [ ] Multi-tenant queries scoped by `tenantId`

### Security Review
- [ ] No hardcoded secrets or API keys
- [ ] Multi-tenant data isolation verified
- [ ] Rate limiting still effective
- [ ] No bypass of authentication/authorization

## Screenshots (if UI changes)

[Add screenshots of before/after if applicable]

## Related Issues

Closes #[issue-number]

---

**Note:** All pipeline checks must pass before merge:
- ✅ Documentation standards
- ✅ Multi-tenant security patterns
- ✅ Linting & formatting
- ✅ Type checking
- ✅ Unit tests
- ✅ Integration tests
- ✅ Seed tests (NEW)
- ✅ E2E tests
- ✅ Build validation
```

### Step 3.2: Create Separate Review Guides

Create `docs/CODE_REVIEW_GUIDE.md`:

```markdown
# Code Review Guide

## Seed Function Changes

When reviewing changes to `server/prisma/seeds/`:

### Mandatory Checks

1. **Test File Exists**
   - [ ] Test file exists: `server/test/seeds/{seed-name}.test.ts`
   - [ ] Test file has same structure as other seed tests

2. **Environment Variables**
   - [ ] Required env vars are documented in comments
   - [ ] Missing env vars throw clear errors with help text
   - [ ] Error messages include generation tips (e.g., `openssl rand -hex 32`)
   - [ ] Optional env vars have sensible defaults

3. **Idempotency**
   - [ ] Seed uses `upsert` or `findUnique` + conditional create
   - [ ] Running twice doesn't create duplicate records
   - [ ] Existing records are preserved (not overwritten)
   - [ ] Sensitive values (passwords) are never updated

4. **Security**
   - [ ] Passwords are hashed (never stored plaintext)
   - [ ] API keys are generated securely (cryptographically random)
   - [ ] Sensitive values are never logged
   - [ ] Database constraints prevent duplicates

5. **Error Handling**
   - [ ] Database constraint violations caught and handled
   - [ ] Prisma errors wrapped appropriately
   - [ ] No sensitive information leaked in error messages

### Test Expectations

```
✅ Environment Variable Validation
✅ Idempotency (multiple runs)
✅ Data Creation (correct values)
✅ Error Handling (constraint violations)
✅ Security Guards (password hashing, key generation)
```

## Storefront / UI Feature Changes

When reviewing `client/src/features/storefront/`, `client/src/pages/`, or similar:

### Mandatory Checks

1. **E2E Test Coverage**
   - [ ] E2E test file exists: `e2e/tests/{feature}.spec.ts`
   - [ ] Test covers happy path (data loads, user completes action)
   - [ ] Test covers error states (network errors, 404, 500)
   - [ ] Test covers navigation (links work, routing correct)

2. **Responsive Design**
   - [ ] E2E test covers mobile (375px width)
   - [ ] E2E test covers tablet (768px width)
   - [ ] E2E test covers desktop (1920px width)
   - [ ] No horizontal scroll at any breakpoint

3. **Data Fetching**
   - [ ] Loading state shown while fetching
   - [ ] Error state shown if fetch fails
   - [ ] Empty state shown if no data
   - [ ] Data correctly displayed when available

4. **User Interaction**
   - [ ] Forms validate input correctly
   - [ ] Buttons trigger correct actions
   - [ ] Modals/dialogs open and close
   - [ ] Keyboard navigation works (Tab, Enter, Escape)

### Test Expectations

```
✅ Navigation (routing, deep linking)
✅ Data Display (loading, success, error, empty states)
✅ User Interaction (forms, buttons, dialogs)
✅ Responsive Layout (mobile, tablet, desktop)
✅ Error Handling (network errors, invalid data)
```

## Service Layer Changes

When reviewing `server/src/services/`:

### Mandatory Checks

1. **Unit Tests**
   - [ ] Unit tests added/updated
   - [ ] Mocked all external dependencies (repos, providers, event emitters)
   - [ ] Tests cover happy path
   - [ ] Tests cover error paths

2. **Integration Tests**
   - [ ] Integration tests added/updated
   - [ ] Database changes verified
   - [ ] Multiple runs don't create duplicates
   - [ ] Database state correctly updated

3. **Multi-Tenant Isolation**
   - [ ] All queries filter by `tenantId`
   - [ ] No cross-tenant data leakage possible
   - [ ] Tests verify tenant scoping

4. **Error Handling**
   - [ ] Service throws custom domain errors
   - [ ] Routes catch and map to HTTP errors
   - [ ] Error messages don't leak sensitive info

5. **Async Safety**
   - [ ] Race conditions handled (locks, transactions)
   - [ ] Pessimistic locks used for booking/reservations
   - [ ] Idempotency keys used for payments

### Test Expectations

```
✅ Unit Tests (mocked dependencies)
✅ Integration Tests (real database)
✅ Multi-Tenant Scoping (tenantId in all queries)
✅ Error Paths (domain errors)
✅ Async Safety (no race conditions)
```

## General Guidance

### Questions to Ask

1. **Testing**: "Are all code paths tested? Are error cases covered?"
2. **Multi-Tenant**: "Is `tenantId` filtered in all queries?"
3. **Security**: "Are sensitive values protected? Could there be data leakage?"
4. **Performance**: "Will this scale? Are there N+1 queries?"
5. **Reliability**: "What could go wrong? Is error handling sufficient?"

### Red Flags

- ❌ No tests for new functionality
- ❌ Tests mocking too much (testing mocks, not code)
- ❌ Seed function without idempotency tests
- ❌ UI changes without E2E tests
- ❌ Queries missing `tenantId` filter
- ❌ Error handling only for happy path
- ❌ Hardcoded values or secrets

### Green Flags

- ✅ New tests added alongside code
- ✅ Tests include happy path AND error paths
- ✅ Mocks only for external dependencies
- ✅ Seed idempotency verified
- ✅ E2E tests for critical user flows
- ✅ All tenant queries scoped properly
- ✅ Clear error messages with context
```

## Part 4: Local Testing Before Committing

### Step 4.1: Running Pre-Commit Checks Locally

```bash
# Option 1: Run all pre-commit checks
npm run test:unit
npm run typecheck
./scripts/validate-docs.sh
./.husky/seed-validation

# Option 2: Run seed tests specifically
npm test -- server/test/seeds/

# Option 3: Run E2E tests (slower)
npm run test:e2e
```

### Step 4.2: Testing Seed Idempotency Locally

```bash
# Start with fresh database
npm run --workspace=server db:seed:dev
echo "✅ First run succeeded"

# Run again - should not error
npm run --workspace=server db:seed:dev
echo "✅ Idempotency verified"

# Test specific seed mode
SEED_MODE=production npm run --workspace=server db:seed
```

### Step 4.3: Running Full Test Suite

```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires database)
npm run test:integration

# E2E tests (slowest, requires running servers)
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

## Part 5: Creating Tests for New Seed Functions

### Step 5.1: Seed Function Template

Create `server/prisma/seeds/my-feature.ts`:

```typescript
/**
 * Seed for my feature
 *
 * Usage:
 *   SEED_MODE=my-feature npm run db:seed
 */

import type { PrismaClient } from '../src/generated/prisma';
import { apiKeyService } from '../src/lib/api-key.service';
import { logger } from '../src/lib/core/logger';

export async function seedMyFeature(prisma: PrismaClient) {
  // Validate environment variables
  const requiredEnvVars = ['MY_FEATURE_EMAIL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `${envVar} environment variable is required for seedMyFeature. ` +
        `Generate a secure value with: openssl rand -hex 32`
      );
    }
  }

  const email = process.env.MY_FEATURE_EMAIL!;

  logger.info({ email }, 'Seeding my feature');

  // Create tenant (idempotent)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'my-feature-demo' },
    update: {},
    create: {
      slug: 'my-feature-demo',
      name: 'My Feature Demo',
      email: email,
      isActive: true,
    },
  });

  logger.info({ tenantId: tenant.id }, 'My feature seed complete');
}
```

### Step 5.2: Test File Template

Create `server/test/seeds/my-feature.test.ts`:

```typescript
/**
 * Unit tests for My Feature seed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing anything
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock api-key service
vi.mock('../../src/lib/api-key.service', () => ({
  apiKeyService: {
    hashSecretKey: vi.fn().mockReturnValue('hashed-key'),
  },
}));

import { seedMyFeature } from '../../prisma/seeds/my-feature';

describe('My Feature Seed', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MY_FEATURE_EMAIL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    it('should throw when MY_FEATURE_EMAIL is missing', async () => {
      const mockPrisma = createMockPrisma();

      await expect(seedMyFeature(mockPrisma))
        .rejects
        .toThrow('MY_FEATURE_EMAIL.*required');
    });

    it('should include helpful error message', async () => {
      const mockPrisma = createMockPrisma();

      await expect(seedMyFeature(mockPrisma))
        .rejects
        .toThrow(/openssl rand/i);
    });
  });

  describe('Idempotency', () => {
    it('should use upsert pattern', async () => {
      process.env.MY_FEATURE_EMAIL = 'test@example.com';
      const mockPrisma = createMockPrisma();

      await seedMyFeature(mockPrisma);

      // Verify upsert was called, not create
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
    });

    it('should not update existing tenant on second run', async () => {
      process.env.MY_FEATURE_EMAIL = 'test@example.com';
      const mockPrisma = createMockPrisma();

      await seedMyFeature(mockPrisma);

      // Check the upsert call - update should be empty
      const call = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(call.update).toEqual({});
    });
  });

  describe('Data Creation', () => {
    it('should create tenant with correct slug', async () => {
      process.env.MY_FEATURE_EMAIL = 'test@example.com';
      const mockPrisma = createMockPrisma();

      await seedMyFeature(mockPrisma);

      const call = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(call.where.slug).toBe('my-feature-demo');
      expect(call.create.slug).toBe('my-feature-demo');
    });

    it('should set tenant as active', async () => {
      process.env.MY_FEATURE_EMAIL = 'test@example.com';
      const mockPrisma = createMockPrisma();

      await seedMyFeature(mockPrisma);

      const call = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(call.create.isActive).toBe(true);
    });
  });
});

// Helper to create mock Prisma
function createMockPrisma() {
  return {
    tenant: {
      upsert: vi.fn().mockResolvedValue({
        id: 'tenant-1',
        slug: 'my-feature-demo',
        name: 'My Feature Demo',
      }),
    },
  };
}
```

## Part 6: Creating E2E Tests for UI Changes

### Step 6.1: E2E Test Template

Create `e2e/tests/my-feature.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.describe('Happy Path', () => {
    test('should load my feature page', async ({ page }) => {
      await page.goto('/my-feature');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/my-feature');
    });

    test('should display feature data', async ({ page }) => {
      await page.goto('/my-feature');

      const data = page.locator('[data-testid="feature-data"]');
      await expect(data).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Error States', () => {
    test('should show error on network failure', async ({ page }) => {
      // Simulate network error
      await page.route('**/api/my-feature', route => route.abort());

      await page.goto('/my-feature');

      const error = page.locator('[data-testid="error-message"]');
      await expect(error).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should work on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/my-feature');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/my-feature');
    });

    test('should work on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/my-feature');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/my-feature');
    });

    test('should work on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto('/my-feature');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/my-feature');
    });
  });
});
```

## Verification Checklist

After implementing these strategies, verify:

- [ ] Pre-commit hooks are executable and working
- [ ] `npm test -- server/test/seeds/` runs all seed tests
- [ ] CI pipeline includes seed-tests job
- [ ] All existing seed functions have tests
- [ ] E2E tests cover critical UI flows
- [ ] Code review template includes testing checklist
- [ ] Team understands new testing requirements

## Support & Troubleshooting

### Pre-commit hooks not running?

```bash
# Make sure hooks are installed
npx husky install

# Make sure files are executable
chmod +x .husky/pre-commit
chmod +x .husky/seed-validation
chmod +x .husky/e2e-coverage-check
```

### Tests failing in CI but passing locally?

```bash
# Ensure same Node version
node --version  # Should be 20.x

# Ensure DATABASE_URL is set for integration tests
echo $DATABASE_URL

# Run tests with same environment as CI
NODE_ENV=test npm test
```

### Can't find test helpers?

```bash
# Check helpers exist
ls server/test/helpers/

# Import from correct path
import { createMockPrisma } from '../helpers/fakes';
```
