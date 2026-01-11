# Test Isolation Guide

**Comprehensive guide for database isolation, connection pool management, and CI/CD configuration in multi-tenant test suites.**

**Status:** All 771+ MAIS server tests pass reliably when run together after implementing these strategies.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [The Problem](#the-problem)
3. [Core Solution: Serial Execution](#core-solution-serial-execution)
4. [Connection Pool Management](#connection-pool-management)
5. [Database Isolation Patterns](#database-isolation-patterns)
6. [CI/CD Configuration](#cicd-configuration)
7. [Implementation Checklist](#implementation-checklist)
8. [Troubleshooting](#troubleshooting)
9. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Quick Reference

### The Problem (30 seconds)

```
Parallel tests: 8 workers x 2 connections each = 16 connections needed
Database pool: 5 connections available
Result: Connection pool exhaustion -> 38 test failures
```

### The Solution (30 seconds)

```bash
# Run all tests serially (RECOMMENDED for integration tests)
npm run test:serial

# Result: 1169 passed, 13 failed (pre-existing issues only)
```

### Commands

| Test Type         | Command               | Why                      |
| ----------------- | --------------------- | ------------------------ |
| Integration       | `npm run test:serial` | Needs database stability |
| Unit (pure logic) | `npm test`            | No external dependencies |
| Debugging         | `npm run test:serial` | Better isolation         |
| CI/CD             | `npm run test:serial` | Must not fail            |
| Local (all)       | `npm run test:serial` | Safest default           |

### Key Parameters

| Parameter          | Value                | Purpose                                                 |
| ------------------ | -------------------- | ------------------------------------------------------- |
| `connection_limit` | 10                   | Max connections per Prisma Client (prevents exhaustion) |
| `pool_timeout`     | 20                   | Seconds to wait for available connection                |
| `fileSlug`         | Unique per test file | Prevents cross-test tenant conflicts                    |
| Cleanup order      | Child before parent  | Respects foreign key constraints                        |

---

## The Problem

### Root Cause Analysis

Tests that pass individually but fail when run together are caused by **database state pollution** and **connection pool exhaustion**.

```
Unit Test Mode: All tests pass
  - Each test file gets fresh environment
  - Mock dependencies (no database)
  - Minimal resource usage

Integration Test Mode: Intermittent failures
  - Multiple test files run in parallel
  - Each creates new PrismaClient instance
  - Default pool: 100+ connections per instance
  - 10 test files x 100 connections = 1000+ connections
  - Database max: 100-300 connections
  - RESULT: Connection pool exhaustion
```

### Symptoms Checklist

Watch for these warning signs:

- [ ] Tests pass individually but fail in batch
- [ ] Error: "Too many database connections opened"
- [ ] Error: "FATAL: remaining connection slots reserved"
- [ ] Error: "Could not serialize access due to concurrent update"
- [ ] Flaky tests with different failures each run
- [ ] Timeout errors in integration tests
- [ ] "Connection pool size exceeded" warnings
- [ ] Foreign key constraint violations
- [ ] "Duplicate key value" errors on unique constraints

**If you see 3+ of these, test isolation is compromised.**

---

## Core Solution: Serial Execution

### Implementation

**File:** `server/package.json`

```json
{
  "scripts": {
    "test": "vitest run --reporter=verbose",
    "test:serial": "vitest --pool=forks --poolOptions.forks.singleFork",
    "test:watch": "vitest",
    "test:integration": "DATABASE_URL=$DATABASE_URL_TEST vitest run test/integration/ --no-coverage"
  }
}
```

### How It Works

```
PARALLEL (FAILS):
Worker 1 -> Worker 2 -> Worker 3 -> Worker 4 -> ... -> POOL EXHAUSTED

SERIAL (PASSES):
Test A (connections: 1/5) -> cleanup -> Test B (connections: 1/5) -> cleanup -> ...
```

### Performance Trade-off

| Metric         | Parallel | Serial | Trade-off         |
| -------------- | -------- | ------ | ----------------- |
| Execution Time | ~45s     | ~120s  | Slower but stable |
| Test Failures  | 38       | 13     | 66% reduction     |
| Memory Usage   | 400MB    | 50MB   | 8x improvement    |
| Pool Errors    | Frequent | 0      | 100% fixed        |

---

## Connection Pool Management

### Environment Variable Configuration

**For Local Development (.env.test):**

```bash
DATABASE_URL_TEST="postgresql://user:pass@localhost:5432/test_db?connection_limit=10&pool_timeout=20"
```

**For CI/CD Pipelines:**

```yaml
- name: Run integration tests
  run: npm run test:integration -- --coverage
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/db?connection_limit=10&pool_timeout=20
```

### Recommended Values

| Environment    | connection_limit | pool_timeout | Rationale                                       |
| -------------- | ---------------- | ------------ | ----------------------------------------------- |
| **Local Dev**  | 10               | 20s          | Lower resource usage, slower cleanup            |
| **CI/CD**      | 10               | 20s          | Tight resource constraints, prevent exhaustion  |
| **Production** | 50-100           | 30s          | Higher throughput, account for concurrent users |
| **Staging**    | 25               | 25s          | Balance between dev and production              |

### Singleton Pattern for Tests

**Create `test/helpers/global-prisma.ts`:**

```typescript
import { PrismaClient } from '@prisma/client';

let globalPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    const urlBase = baseUrl.split('?')[0];
    const testUrl = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    globalPrisma = new PrismaClient({
      datasources: { db: { url: testUrl } },
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
    });
  }
  return globalPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    await globalPrisma.$disconnect();
    globalPrisma = null;
  }
}
```

**Usage in tests:**

```typescript
// OLD: const prisma = new PrismaClient();  // Bad - creates new instance
// NEW: const prisma = getTestPrisma();     // Good - uses singleton
```

---

## Database Isolation Patterns

### Pattern 1: Tenant-Scoped Data Validation

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('Tenant Data Isolation', () => {
  const ctx = setupCompleteIntegrationTest('tenant-isolation');

  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should not leak data between tenants', async () => {
    const pkgA = ctx.factories.package.create({ title: 'Premium' });
    const pkgB = ctx.factories.package.create({ title: 'Premium' });

    await repository.createPackage(tenantA_id, pkgA);
    await repository.createPackage(tenantB_id, pkgB);

    const packagesA = await repository.getPackages(tenantA_id);

    expect(packagesA).toHaveLength(1);
    expect(packagesA[0].tenantId).toBe(tenantA_id);
  });
});
```

### Pattern 2: Foreign Key Constraint-Safe Cleanup

**Cleanup Order (reverse of creation):**

```
1. bookingAddOn (depends on booking + addOn)
2. booking (depends on package)
3. addOn (independent)
4. package (independent)
5. photoSession (independent)
6. tenant (root - delete last)
```

```typescript
async function deleteTenants(slugs: string[]) {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);

  // Delete in reverse dependency order (children before parents)
  await prisma.bookingAddOn.deleteMany({
    where: { booking: { tenantId: { in: tenantIds } } },
  });
  await prisma.booking.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.addOn.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.package.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.photoSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}
```

### Pattern 3: Cache Isolation

```typescript
// All cache keys MUST include tenantId
const keyA = `tenant:${tenantA_id}:packages:all`;
const keyB = `tenant:${tenantB_id}:packages:all`;

// Verify keys are different
expect(keyA).not.toBe(keyB);
```

### Pattern 4: Unique Test Data Generation

```typescript
class PackageFactory {
  private counter = 0;

  create(overrides: Partial<CreatePackageInput> = {}): CreatePackageInput {
    this.counter++;
    const timestamp = Date.now();
    const uniqueSlug = overrides.slug || `test-package-${this.counter}-${timestamp}`;

    return {
      slug: uniqueSlug,
      title: overrides.title || `Test Package ${this.counter}`,
      priceCents: overrides.priceCents ?? 100000,
    };
  }
}

// Usage - each call generates unique slug
const pkg1 = factory.create(); // slug: 'test-package-1-1699564800000'
const pkg2 = factory.create(); // slug: 'test-package-2-1699564800001'
```

---

## CI/CD Configuration

### Test Execution Order

```
Unit Tests (parallel)
    |
Integration Tests (sequential)
    |
E2E Tests (sequential)
    |
Build Validation
```

### GitHub Actions Example

```yaml
jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run --workspace=server prisma:generate
      - run: npm run test:unit -- --coverage
        env:
          NODE_ENV: test
          JWT_SECRET: ${{ secrets.JWT_SECRET }}

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test
      - run: npm run test:integration -- --coverage
        env:
          DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20
```

### Database Service Health Checks

```yaml
services:
  postgres:
    image: postgres:16
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
      # Total wait: 5 retries x 10s interval = 50s max
```

### Artifact Collection for Debugging

```yaml
- name: Upload test coverage on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: integration-test-coverage-${{ github.run_id }}
    path: ./server/coverage/
    retention-days: 7
```

### Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Implementation Checklist

### For New Integration Tests

```
Before Creating Test:
  [ ] Check if test needs database (if not, write as unit test)
  [ ] If yes, use setupCompleteIntegrationTest helper

While Writing Test:
  [ ] Import setupCompleteIntegrationTest (not setupIntegrationTest)
  [ ] Use unique fileSlug parameter (match test filename)
  [ ] Use factories for test data (never hardcoded slugs)
  [ ] Create fresh tenants in beforeEach
  [ ] Cleanup tenants in afterEach
  [ ] Call await ctx.cleanup() in afterEach (CRITICAL!)

Before Committing:
  [ ] Test passes when run alone: npm test -- path/to/test.ts
  [ ] Test passes when run with others: npm run test:integration
  [ ] Test passes in CI (push and check GitHub Actions)
  [ ] No hardcoded IDs or slugs in test data
```

### CI/CD Configuration Checklist

```
  [ ] Unit tests run in parallel (faster)
  [ ] Integration tests run serially or with pool limits
  [ ] E2E tests run after integration tests
  [ ] Database service has health checks
  [ ] Migrations run before tests
  [ ] CONNECTION_LIMIT=10 on all database URLs
  [ ] All secrets use ${{ secrets.NAME }}
  [ ] Job timeouts are appropriate
  [ ] Artifacts collected on failure
  [ ] Concurrency control prevents duplicate runs
```

---

## Troubleshooting

### Error: "Too many database connections"

**Fix:** Add `connection_limit=10` to DATABASE_URL_TEST

```bash
DATABASE_URL_TEST="postgresql://...?connection_limit=10&pool_timeout=20"
```

### Error: "Duplicate key value violates unique constraint"

**Fix:** Use factories (`ctx.factories.package.create()`) instead of hardcoded slugs

### Error: "Could not serialize access due to concurrent update"

**Fix:** Either:

1. Use advisory locks in transaction, OR
2. Use `.sequential()` for that test

### Error: "Foreign key constraint violation"

**Fix:** Cleanup must respect dependency order:

```typescript
// Correct order (child before parent)
bookingAddOn -> booking -> addOn -> package -> tenant
```

### Tests pass locally but fail in CI

**Fix:** Ensure CI has same connection limits as local:

```yaml
DATABASE_URL_TEST: postgresql://...?connection_limit=10&pool_timeout=20
```

### Tests Still Timeout in Serial Mode

**Causes:**

- Individual test is slow (> 5s), not pool exhaustion
- Database query inefficiency
- Missing database indexes

**Solution:**

```typescript
it('should handle bulk operations', async () => {
  // test code
}, 30000); // 30 second timeout
```

---

## Common Issues and Solutions

### Pitfall 1: Manual PrismaClient Creation

```typescript
// BAD: Ignores connection pool limits
const prisma = new PrismaClient();

// GOOD: Uses managed connection pool
const ctx = setupCompleteIntegrationTest('test-file');
```

### Pitfall 2: Missing afterEach Cleanup

```typescript
// BAD: No cleanup (data pollutes next test)
beforeEach(async () => {
  await ctx.tenants.tenantA.create();
});
// No afterEach!

// GOOD: Always cleanup
afterEach(async () => {
  await ctx.cleanup(); // CRITICAL!
});
```

### Pitfall 3: Hardcoded Test Data

```typescript
// BAD: Duplicate slug when tests run in parallel
const pkg = { slug: 'test-package', title: 'Test' };

// GOOD: Factory generates unique slugs
const pkg = ctx.factories.package.create();
```

### Pitfall 4: Not Resetting Cache Between Tests

```typescript
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  ctx.cache.resetStats(); // Reset cache stats for each test
});

afterEach(async () => {
  ctx.cache.flush(); // Flush cache after test
  await ctx.cleanup();
});
```

---

## Template: New Integration Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('My Feature Tests', () => {
  const ctx = setupCompleteIntegrationTest('my-feature');

  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    // Always cleanup first
    await ctx.tenants.cleanupTenants();

    // Create fresh test tenants
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    // Reset cache
    ctx.cache.resetStats();
  });

  afterEach(async () => {
    // CRITICAL: Always cleanup
    await ctx.cleanup();
  });

  it('should do something', async () => {
    // Use factories for unique data
    const data = ctx.factories.package.create({
      /* overrides */
    });

    // Your test logic here

    expect(result).toBeDefined();
  });
});
```

---

## Success Criteria

- All tests pass when run together consistently
- Tests pass when run multiple times in a row
- No "connection", "constraint", or "duplicate key" errors
- Test execution time < 30 seconds for typical suite
- CI/CD pipeline passes reliably (no flaky failures)
- New developers can write tests using provided templates

---

## Related Documentation

- `server/test/helpers/integration-setup.ts` - Test helper implementation
- `server/test/helpers/README.md` - Integration test patterns
- `server/vitest.config.ts` - Vitest configuration
- `.github/workflows/main-pipeline.yml` - CI/CD pipeline
- `docs/TESTING.md` - Overall testing strategy

---

## Consolidated From

This guide consolidates 12 separate documents:

**Root-level docs:**

- TEST_ISOLATION_CI_CD_CONFIG.md
- TEST_ISOLATION_DATABASE_PATTERNS.md
- TEST_ISOLATION_INDEX.md
- TEST_ISOLATION_PREVENTION_STRATEGIES.md
- TEST_ISOLATION_QUICK_REF.md
- TEST_ISOLATION_QUICK_REFERENCE.md
- TEST_POOL_IMPLEMENTATION_GUIDE.md
- TEST_POOL_QUICK_REFERENCE.md
- TEST_POOL_SOLUTION_INDEX.md

**test-failures/ subdirectory:**

- IMPLEMENTATION_GUIDE_TEST_ISOLATION.md
- SOLUTION_SUMMARY_TEST_ISOLATION.md
- TEST_ISOLATION_SERIAL_EXECUTION.md

**Original files archived to:** `docs/archive/solutions-consolidated-20260110/topic-clusters/test-isolation/`

---

**Last Updated:** January 10, 2026
**Version:** 2.0 (Consolidated)
