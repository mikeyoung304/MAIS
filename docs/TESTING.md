# Testing Guide

**Document Type:** Reference
**Audience:** Developers, QA Engineers, DevOps
**Last Updated:** 2025-11-14

## Overview

This document outlines the testing philosophy, strategy, and best practices for the MAIS project. For detailed test implementation guidance, see `/Users/mikeyoung/CODING/MAIS/server/test/README.md`.

## Testing Philosophy

### Principles

1. **Test Behavior, Not Implementation** - Tests should verify what the system does, not how it does it
2. **Multi-Tenancy First** - Every test must consider tenant isolation and data segregation
3. **Fast Feedback** - Unit tests provide immediate feedback; integration and E2E tests verify critical paths
4. **Confidence Over Coverage** - 100% coverage is not the goal; confidence in critical functionality is
5. **Maintainability** - Tests should be easy to understand and maintain over time

### Testing Pyramid

We follow the testing pyramid approach with the following distribution:

```
        /\
       /  \      E2E Tests (10%)
      /----\     - Full user journeys
     /      \    - Browser automation
    /--------\   - Critical happy paths
   /          \
  /   INTEG    \ Integration Tests (30%)
 /--------------\  - Database transactions
/                \ - Multi-tenant isolation
/      UNIT       \ - Race conditions
/------------------\ - Cache behavior
   Unit Tests (60%)
   - Service logic
   - Business rules
   - Edge cases
```

### Test Distribution Goals

| Test Type       | Target % | Purpose                                         | Speed            |
| --------------- | -------- | ----------------------------------------------- | ---------------- |
| **Unit**        | 60%      | Verify individual components in isolation       | < 10ms per test  |
| **Integration** | 30%      | Verify database interactions and data integrity | < 500ms per test |
| **E2E**         | 10%      | Verify complete user flows and UI interactions  | < 10s per test   |

## Test Types

### 1. Unit Tests

**Purpose:** Test individual components (services, utilities, controllers) in isolation

**Characteristics:**

- Use fake implementations (no real database, no external services)
- Fast execution (< 10ms per test)
- High volume (60% of all tests)
- Test business logic and edge cases

**Example:**

```typescript
describe('BookingService', () => {
  it('calculates total with package and add-ons', async () => {
    // Uses FakeCatalogRepository, no database
    const pkg = buildPackage({ priceCents: 100000 });
    catalogRepo.addPackage(pkg);

    const result = await service.createCheckout('test-tenant', {
      packageId: pkg.id,
      addOnIds: ['addon_1'],
    });

    expect(result.totalCents).toBe(150000);
  });
});
```

**When to Write:**

- New service methods
- Business logic functions
- Validation rules
- Error handling paths
- Edge cases and boundary conditions

### 2. Integration Tests

**Purpose:** Test database interactions, transactions, and multi-tenant isolation

**Characteristics:**

- Use real test database
- Slower execution (< 500ms per test)
- Medium volume (30% of all tests)
- Test data integrity and concurrency

**Example:**

```typescript
describe('PrismaBookingRepository', () => {
  it('prevents double-booking with database locks', async () => {
    // Uses real PostgreSQL test database
    await Promise.all([
      repository.create('tenant-a', booking1),
      repository.create('tenant-a', booking2), // Same date
    ]);

    // Verify only one booking was created
    const bookings = await repository.findAll('tenant-a');
    expect(bookings).toHaveLength(1);
  });
});
```

**When to Write:**

- New repository methods
- Database schema changes
- Transaction logic
- Multi-tenant isolation
- Race condition scenarios
- Cache invalidation

### 3. End-to-End (E2E) Tests

**Purpose:** Test complete user flows through the UI

**Characteristics:**

- Use Playwright for browser automation
- Slowest execution (< 10s per test)
- Low volume (10% of all tests)
- Test critical user journeys

**Example:**

```typescript
test('customer can book a package', async ({ page }) => {
  await page.goto('/packages');
  await page.click('text=Basic MAISment');
  await page.fill('input[name="coupleName"]', 'John & Jane');
  await page.click('text=Book Now');

  await expect(page).toHaveURL(/checkout/);
});
```

**When to Write:**

- New user workflows
- Critical business flows
- Multi-step processes
- UI regressions

## Running Tests

### Quick Reference

```bash
# All tests (unit + integration)
npm test

# Unit tests only (fast)
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode (unit tests)
npm run test:watch

# Coverage report
npm run test:coverage
```

For detailed commands and options, see `/Users/mikeyoung/CODING/MAIS/server/test/README.md`.

## Multi-Tenancy Testing Patterns

### Critical Rule

**All service and repository methods require `tenantId` as the first parameter.**

This is the foundation of our multi-tenant architecture and must be enforced in all tests.

### Pattern 1: Tenant Isolation

Verify that data is completely isolated between tenants:

```typescript
it('isolates bookings by tenant', async () => {
  // Create data for two different tenants
  await repo.create('tenant-a', bookingA);
  await repo.create('tenant-b', bookingB);

  // Verify tenant A can only see their data
  const tenantABookings = await repo.findAll('tenant-a');
  expect(tenantABookings).toHaveLength(1);
  expect(tenantABookings[0].id).toBe(bookingA.id);

  // Verify tenant B can only see their data
  const tenantBBookings = await repo.findAll('tenant-b');
  expect(tenantBBookings).toHaveLength(1);
  expect(tenantBBookings[0].id).toBe(bookingB.id);
});
```

### Pattern 2: Tenant-Scoped Operations

Verify that operations only affect the specified tenant:

```typescript
it('updates only affect the specified tenant', async () => {
  await repo.create('tenant-a', packageA);
  await repo.create('tenant-b', packageB);

  // Update package for tenant A
  await repo.updatePackage('tenant-a', packageA.id, {
    priceCents: 200000,
  });

  // Verify tenant A's package was updated
  const tenantAPkg = await repo.getPackageById('tenant-a', packageA.id);
  expect(tenantAPkg.priceCents).toBe(200000);

  // Verify tenant B's package was NOT affected
  const tenantBPkg = await repo.getPackageById('tenant-b', packageB.id);
  expect(tenantBPkg.priceCents).toBe(100000); // Original price
});
```

### Pattern 3: Cache Isolation

Verify that cache entries are isolated by tenant:

```typescript
it('isolates cache by tenant', async () => {
  // Prime cache for both tenants
  await service.getPackages('tenant-a');
  await service.getPackages('tenant-b');

  // Invalidate cache for tenant A
  await service.clearCache('tenant-a');

  // Verify tenant A's cache is cleared but tenant B's is not
  const tenantAHit = await cache.get('tenant-a:packages');
  expect(tenantAHit).toBeNull();

  const tenantBHit = await cache.get('tenant-b:packages');
  expect(tenantBHit).not.toBeNull();
});
```

## CI/CD Integration

### GitHub Actions Workflow

Tests are automatically run on every pull request and push to `main`:

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL_TEST: postgresql://postgres:test@localhost:5432/elope_test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

### Test Execution Strategy

1. **Unit Tests** - Run on every commit (fast feedback)
2. **Integration Tests** - Run on every PR (data integrity)
3. **E2E Tests** - Run before merge to main (critical flows)

### Failure Handling

- Tests must pass before PR can be merged
- Failed E2E tests should include screenshots and video
- Flaky tests should be investigated and fixed immediately

## Pre-Commit Testing

### Recommended Workflow

Before committing code, run these checks locally:

```bash
# 1. Type checking (fast)
npm run typecheck

# 2. Linting (fast)
npm run lint

# 3. Unit tests (fast - recommended before every commit)
npm run test:unit

# 4. Integration tests (slower - before pushing)
npm run test:integration

# 5. E2E tests (slowest - before creating PR)
npm run test:e2e
```

### Git Hooks

Consider using Husky for automated pre-commit checks:

```bash
# Install Husky
npm install --save-dev husky

# Setup pre-commit hook
npx husky init
echo "npm run test:unit && npm run typecheck" > .husky/pre-commit
```

## Test Data Management

### Unit Tests

Use builder functions for consistent test data:

```typescript
import { buildPackage, buildBooking, buildUser } from './helpers/fakes';

const pkg = buildPackage({ priceCents: 100000 });
const booking = buildBooking({ packageId: pkg.id });
const user = buildUser({ role: 'admin' });
```

### Integration Tests

Use factory functions with database cleanup:

```typescript
const ctx = setupCompleteIntegrationTest('test-name');

beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  await ctx.tenants.tenantA.create();
});

afterEach(async () => {
  await ctx.cleanup();
});
```

### E2E Tests

Use test fixtures for consistent UI state:

```typescript
test.beforeEach(async ({ page }) => {
  // Reset database to known state
  await page.goto('/test-fixtures/reset');

  // Seed test data
  await page.goto('/test-fixtures/seed-packages');
});
```

## Coverage Goals

### Target Coverage

| Metric           | Target | Current |
| ---------------- | ------ | ------- |
| **Overall**      | 80%    | TBD     |
| **Services**     | 90%    | TBD     |
| **Repositories** | 85%    | TBD     |
| **Controllers**  | 70%    | TBD     |
| **Utilities**    | 95%    | TBD     |

### Coverage Reports

Generate coverage reports with:

```bash
npm run test:coverage
```

View HTML report:

```bash
open coverage/index.html
```

### Coverage Philosophy

- Coverage is a tool, not a goal
- 100% coverage does not guarantee bug-free code
- Focus on testing critical paths and edge cases
- Uncovered code should be intentional (logging, trivial getters, etc.)

## Performance Benchmarks

### Target Test Execution Times

| Test Suite            | Target Time  | Alert Threshold |
| --------------------- | ------------ | --------------- |
| **Unit Tests**        | < 5 seconds  | > 10 seconds    |
| **Integration Tests** | < 30 seconds | > 60 seconds    |
| **E2E Tests**         | < 2 minutes  | > 5 minutes     |
| **Full Suite**        | < 3 minutes  | > 7 minutes     |

### Optimization Strategies

1. **Parallel Execution** - Run independent tests in parallel
2. **Database Connection Pooling** - Reuse database connections in integration tests
3. **Selective E2E** - Only run critical E2E tests on every PR
4. **Test Sharding** - Distribute tests across multiple CI workers

## Debugging Tests

### Debug Single Test

```bash
# Run specific test file
npm test -- booking.service.spec.ts

# Run specific test by name
npm test -- -t "creates booking successfully"
```

### Debug with VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Integration Tests

```bash
# Run with verbose logging
npm run test:integration -- --reporter=verbose

# Debug specific integration test
npm run test:integration -- booking-repository.integration.spec.ts
```

### Debug E2E Tests

```bash
# Run with headed browser (see what's happening)
npm run test:e2e:headed

# Run with UI mode (interactive debugging)
npm run test:e2e:ui

# Debug specific E2E test
npm run test:e2e -- booking-flow.spec.ts --debug
```

## Common Testing Pitfalls

### 1. Forgetting tenantId Parameter

**Problem:**

```typescript
// WRONG - Missing tenantId
await service.createBooking({ ... });
```

**Solution:**

```typescript
// CORRECT - Always include tenantId as first parameter
await service.createBooking('test-tenant', { ... });
```

### 2. Shared Test State

**Problem:**

```typescript
// WRONG - Shared state between tests
const repo = new FakeBookingRepository();

it('test 1', () => { repo.create(...); });
it('test 2', () => { /* repo still has data from test 1 */ });
```

**Solution:**

```typescript
// CORRECT - Fresh state for each test
let repo: FakeBookingRepository;

beforeEach(() => {
  repo = new FakeBookingRepository();
});
```

### 3. Missing HTTP Headers in API Tests

**Problem:**

```typescript
// WRONG - Missing tenant authentication
await request(app).get('/v1/packages').expect(200);
```

**Solution:**

```typescript
// CORRECT - Include X-Tenant-Key header
await request(app).get('/v1/packages').set('X-Tenant-Key', testTenantApiKey).expect(200);
```

### 4. Not Cleaning Up Integration Tests

**Problem:**

```typescript
// WRONG - No cleanup, pollutes database
it('creates booking', async () => {
  await repo.create('tenant-a', booking);
  // No cleanup!
});
```

**Solution:**

```typescript
// CORRECT - Clean up after each test
afterEach(async () => {
  await ctx.cleanup();
});
```

### 5. Testing Implementation Instead of Behavior

**Problem:**

```typescript
// WRONG - Testing internal implementation
it('calls repository.create()', async () => {
  const spy = vi.spyOn(repo, 'create');
  await service.createBooking('tenant-a', data);
  expect(spy).toHaveBeenCalled();
});
```

**Solution:**

```typescript
// CORRECT - Testing observable behavior
it('creates booking and returns checkout URL', async () => {
  const result = await service.createBooking('tenant-a', data);
  expect(result.checkoutUrl).toBeDefined();
});
```

## Test Maintenance

### When to Update Tests

- **New Feature** - Add tests for new functionality
- **Bug Fix** - Add regression test before fixing
- **Refactoring** - Tests should still pass without changes
- **Breaking Change** - Update affected tests
- **Deprecated Feature** - Remove associated tests

### Test Smell Indicators

- Tests take too long to run
- Tests are flaky (pass/fail inconsistently)
- Tests are hard to understand
- Tests require extensive setup
- Tests test implementation details
- Tests break on refactoring

### Regular Maintenance Tasks

- Review and update test data
- Remove obsolete tests
- Consolidate duplicate tests
- Update test documentation
- Monitor test execution times
- Fix flaky tests immediately

## Resources

### Internal Documentation

- `/Users/mikeyoung/CODING/MAIS/server/test/README.md` - Detailed test implementation guide
- `/Users/mikeyoung/CODING/MAIS/docs/architecture/MULTI_TENANT_ISOLATION.md` - Multi-tenancy architecture
- `/Users/mikeyoung/CODING/MAIS/docs/api/README.md` - API documentation

### External Resources

- [Vitest Documentation](https://vitest.dev/) - Test runner and assertion library
- [Playwright Documentation](https://playwright.dev/) - E2E testing framework
- [Testing Library](https://testing-library.com/) - React component testing (for client)
- [Test Pyramid Concept](https://martinfowler.com/articles/practical-test-pyramid.html) - Martin Fowler's guide

## Getting Help

### Test Failures

1. Read the error message carefully
2. Check `/Users/mikeyoung/CODING/MAIS/server/test/README.md` for common issues
3. Run test in isolation to rule out state pollution
4. Check for missing `tenantId` parameter
5. Verify test database is properly configured

### Writing New Tests

1. Look for similar existing tests as examples
2. Use builder/factory functions for test data
3. Follow the Arrange-Act-Assert pattern
4. Ensure proper cleanup in `afterEach`
5. Test both success and error cases

### Test Performance Issues

1. Check if tests can run in parallel
2. Reduce database operations in integration tests
3. Use mocks instead of real dependencies when possible
4. Profile test execution with `--reporter=verbose`
5. Consider moving slow tests to E2E category

## Appendix

### Test Execution Matrix

| Test Type   | Framework  | Database   | Browser  | Tenant Isolation | Parallel |
| ----------- | ---------- | ---------- | -------- | ---------------- | -------- |
| Unit        | Vitest     | Fake       | No       | Verified         | Yes      |
| Integration | Vitest     | PostgreSQL | No       | Verified         | Limited  |
| E2E         | Playwright | PostgreSQL | Chromium | Verified         | Limited  |

### Test File Locations

```
/Users/mikeyoung/CODING/MAIS/
├── server/
│   └── test/
│       ├── README.md                    # Test implementation guide
│       ├── *.spec.ts                    # Unit tests
│       ├── integration/
│       │   └── *.integration.spec.ts    # Integration tests
│       ├── http/
│       │   └── *.test.ts                # HTTP endpoint tests
│       └── helpers/
│           ├── fakes.ts                 # Fake implementations
│           └── integration-setup.ts     # Integration test utilities
└── e2e/
    ├── playwright.config.ts             # E2E configuration
    └── tests/
        └── *.spec.ts                    # E2E tests
```

### Environment Variables

| Variable            | Purpose              | Example                                            |
| ------------------- | -------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | Development database | `postgresql://user:pass@localhost:5432/elope`      |
| `DATABASE_URL_TEST` | Test database        | `postgresql://user:pass@localhost:5432/elope_test` |
| `NODE_ENV`          | Environment          | `test`                                             |
| `CI`                | CI/CD indicator      | `true`                                             |

---

**Document Maintenance:**

- Review quarterly for accuracy
- Update when testing strategy changes
- Add examples for new patterns
- Remove deprecated information
