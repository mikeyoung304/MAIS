# Prevention Strategies: Test Tenant Accumulation

## Overview

**Problem:** Test tenant accumulation causes test suite hangs when tests are interrupted (Ctrl+C, timeout, process kill).

**Root Cause:** Integration test `afterEach` cleanup hooks don't run if the test runner process is terminated before completing all tests.

**Solution Implemented:** Global setup hook that cleans orphaned test tenants before tests run, combined with standardized cleanup patterns in test files.

---

## Best Practices for Writing Integration Tests

### 1. Always Use the Standard Setup Pattern

Every integration test file must follow this pattern to ensure orphaned tenants are cleaned up:

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

describe('My Feature Integration Tests', () => {
  // Initialize once per test file
  const ctx = setupCompleteIntegrationTest('my-feature', { cacheTTL: 60 });

  let tenantId: string;

  // Clean before each test
  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    tenantId = ctx.tenants.tenantA.id;
  });

  // Clean after each test (safety net if test fails)
  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    ctx.cache.flush();
  });

  // Clean connection after ALL tests complete
  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should do something', async () => {
    // Test code here
  });
});
```

**Key Points:**

- Use `setupCompleteIntegrationTest()` for all integration tests
- The `fileSlug` parameter becomes part of tenant naming (e.g., `my-feature-tenant-a`)
- Always call `cleanupTenants()` in both `beforeEach` and `afterEach`
- Never create a new `PrismaClient` instance - use the singleton via `getTestPrisma()`

### 2. Use Descriptive File Slugs

File slugs should clearly identify what feature is being tested:

```typescript
// ✅ GOOD - Clearly identifies the feature
setupCompleteIntegrationTest('cache-isolation', { ... });
setupCompleteIntegrationTest('booking-race-conditions', { ... });
setupCompleteIntegrationTest('payment-flow', { ... });

// ❌ BAD - Too generic, ambiguous
setupCompleteIntegrationTest('test', { ... });
setupCompleteIntegrationTest('integration', { ... });
setupCompleteIntegrationTest('foo', { ... });
```

Descriptive slugs help identify test tenants in production databases and make cleanup patterns more maintainable.

### 3. Handle Test Failures Gracefully

Tests may fail mid-execution, leaving cleanup incomplete:

```typescript
describe('My Tests', () => {
  const ctx = setupCompleteIntegrationTest('my-feature');

  beforeEach(async () => {
    // Always cleanup first to ensure clean slate
    // Even if previous test didn't clean up
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
  });

  afterEach(async () => {
    // This runs ONLY if beforeEach and test complete
    // If test times out, this might not run
    await ctx.tenants.cleanupTenants();
  });

  it('should handle errors', async () => {
    try {
      // risky operation
    } catch (error) {
      // IMPORTANT: Cleanup on error to prevent orphaned tenants
      await ctx.tenants.cleanupTenants();
      throw error; // Re-throw for test failure
    }
  });
});
```

**Pattern:** Place cleanup in try/finally blocks for complex tests:

```typescript
it('should handle complex operation', async () => {
  const tenantId = ctx.tenants.tenantA.id;

  try {
    // Setup additional data
    const pkg = await createTestPackage(tenantId);

    // Complex operation that might fail
    await complexOperation(tenantId, pkg.id);

    // Verify results
    expect(pkg).toBeDefined();
  } finally {
    // Ensure cleanup happens regardless of test outcome
    await ctx.tenants.cleanupTenants();
  }
});
```

### 4. Use Factories for Test Data

Factories generate unique test data and prevent conflicts:

```typescript
const ctx = setupCompleteIntegrationTest('booking-flow');
const packageFactory = ctx.factories.package;
const addOnFactory = ctx.factories.addOn;

it('should book package with add-ons', async () => {
  const tenantId = ctx.tenants.tenantA.id;

  // Factories generate unique slugs automatically
  const pkg1 = packageFactory.create({ title: 'Package A' });
  const pkg2 = packageFactory.create({ title: 'Package B' });
  const addOn = addOnFactory.create({ title: 'Premium Add-On' });

  // Create in database
  const createdPkg1 = await catalogRepo.createPackage(tenantId, pkg1);
  const createdPkg2 = await catalogRepo.createPackage(tenantId, pkg2);
  const createdAddOn = await catalogRepo.createAddOn(tenantId, addOn);

  // Test logic
  expect(createdPkg1.slug).toBe(pkg1.slug);
  expect(createdPkg2.slug).toBe(pkg2.slug);
});
```

**Why:** Factories prevent duplicate key errors when tests run in different orders or are re-run.

### 5. Test Isolation Using Multi-Tenant Helpers

Always use the multi-tenant setup to prevent cross-tenant data leaks:

```typescript
describe('Cache Isolation Tests', () => {
  const ctx = setupCompleteIntegrationTest('cache-isolation');

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();

    // Create TWO isolated tenants
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    ctx.cache.flush();
  });

  it('should not leak cache data between tenants', async () => {
    const tenantA_id = ctx.tenants.tenantA.id;
    const tenantB_id = ctx.tenants.tenantB.id;

    // Create same package slug in both tenants
    const pkg = ctx.factories.package.create({ slug: 'premium-package' });

    const pkgA = await catalogRepo.createPackage(tenantA_id, pkg);
    const pkgB = await catalogRepo.createPackage(tenantB_id, pkg);

    // Get package from cache for tenant A
    const cachedA = await catalogService.getPackageBySlug(tenantA_id, 'premium-package');

    // MUST return Tenant B's package, not cached A's package
    const pkgB_fetch = await catalogService.getPackageBySlug(tenantB_id, 'premium-package');

    expect(cachedA.id).toBe(pkgA.id);
    expect(pkgB_fetch.id).toBe(pkgB.id);
    expect(cachedA.id).not.toBe(pkgB_fetch.id);
  });
});
```

---

## Early Warning Signs of Test Tenant Accumulation

Watch for these indicators that orphaned test tenants are accumulating:

### 1. Increasingly Slow Test Runs

```bash
# Check if test execution time is creeping up
npm run test:integration -- test/integration/health-check.service.test.ts

# Compare against baseline (should be < 5 seconds for single test)
# If > 30 seconds, orphaned tenants likely causing scheduler slowdown
```

**Why:** The reminder scheduler processes ALL tenants in the database. Each orphaned test tenant adds ~250ms overhead.

### 2. Reminder Scheduler Logs Show High Tenant Count

```typescript
// In server logs or test output, watch for:
[17:23:45] Reminder scheduler: Processing 250+ tenants (took 45s)
```

Expected tenant count should be:

- Production: 10-50 tenants
- Development: 3-5 tenants (mais, little-bit-farm, demo)
- During test run: 3-5 + temporary test tenants

If count is > 100, orphaned test tenants are accumulating.

### 3. Database Query Timeouts

```bash
# P1001 or connection timeout errors mean connection pool is exhausted
# Symptom of tests creating too many tenants (connections)
Error: P1001: Can't reach database server at `db.*.supabase.co`
```

### 4. Global Setup Takes Longer Than Expected

```bash
npm run test:integration
# Output:
# [vitest] Global setup: Cleaned 47 orphaned test tenants (1200ms)
# ^^^ This is good - cleanup is working
# But if this number keeps growing, tests are being interrupted
```

Track the "cleaned X orphaned test tenants" metric across days.

### 5. Tests Pass Individually But Fail Together

```bash
# This passes
npm run test:integration -- test/integration/cache-isolation.integration.spec.ts

# This fails
npm run test:integration

# Symptom: Isolated test passes, but full suite fails
# Likely cause: Orphaned tenants from previous interrupted run
```

---

## Quick Checklist for Test Infrastructure Changes

When modifying test infrastructure, verify:

- [ ] **Test Tenant Naming:** New test tenants follow pattern `{fileSlug}-tenant-{a|b}`
- [ ] **Global Cleanup:** Pattern added to `TEST_TENANT_PATTERNS` in `vitest-global-setup.ts`
- [ ] **Cleanup Hooks:** Both `beforeEach` and `afterEach` call cleanup
- [ ] **Error Handling:** Cleanup is wrapped in try/finally blocks
- [ ] **Factory Generation:** Factories generate unique slugs (timestamps, counters)
- [ ] **Singleton PrismaClient:** No new `PrismaClient` instances created in tests
- [ ] **Connection Pool:** Uses pgbouncer settings (`connection_limit=3, pool_timeout=5`)
- [ ] **Hook Timeouts:** vitest.config.ts has `hookTimeout: 10000` (10s max)
- [ ] **Test Timeouts:** Individual tests have `testTimeout: 30000` (30s max)
- [ ] **Sequential Running:** `describe.sequential()` used for concurrency-sensitive tests

### Adding a New Test Tenant Pattern

If you create new test tenant naming patterns, MUST add to cleanup list:

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/helpers/vitest-global-setup.ts`

```typescript
// BEFORE (line 19-28)
const TEST_TENANT_PATTERNS = [
  'hash-test-business-%',
  'test-business-%',
  // ...
];

// AFTER - add your new pattern
const TEST_TENANT_PATTERNS = [
  'hash-test-business-%',
  'test-business-%',
  'my-new-feature-%', // Add new pattern here
  // ...
];

// ALSO update the WHERE clause (line 46-54)
const testTenants = await prisma.tenant.findMany({
  where: {
    OR: [
      { slug: { startsWith: 'hash-test-business-' } },
      { slug: { startsWith: 'test-business-' } },
      { slug: { startsWith: 'my-new-feature-' } }, // Add here too
      // ...
    ],
  },
});
```

---

## Potential Test Cases to Verify the Solution

### 1. Global Setup Cleanup Verification

```typescript
// File: server/test/helpers/vitest-global-setup.spec.ts
describe('Vitest Global Setup', () => {
  it('should clean up all test tenant patterns', async () => {
    const prisma = getTestPrisma();

    // Create test tenants matching all patterns
    const patterns = [
      'hash-test-business-123',
      'test-business-456',
      'first-business-789',
      'no-match-test-012',
      'some-tenant-a',
      'other-tenant-b',
      'test-tenant-xyz',
      'auth-prevention-special',
    ];

    for (const slug of patterns) {
      await prisma.tenant.create({
        data: {
          slug,
          name: `Test ${slug}`,
          apiKeyPublic: `pk_test_${slug}`,
          apiKeySecret: `sk_test_${slug}`,
        },
      });
    }

    // Run global setup cleanup
    const beforeCount = await prisma.tenant.count();
    await cleanupOrphanedTestTenants();
    const afterCount = await prisma.tenant.count();

    expect(afterCount).toBe(beforeCount - patterns.length);
  });

  it('should NOT delete production tenants', async () => {
    const prisma = getTestPrisma();

    // Ensure production tenants exist
    const productionSlugs = ['mais', 'little-bit-farm', 'demo'];
    for (const slug of productionSlugs) {
      await prisma.tenant.upsert({
        where: { slug },
        create: {
          slug,
          name: slug,
          apiKeyPublic: `pk_live_${slug}`,
          apiKeySecret: `sk_live_${slug}`,
        },
        update: {},
      });
    }

    const beforeCount = await prisma.tenant.count();
    await cleanupOrphanedTestTenants();
    const afterCount = await prisma.tenant.count();

    // Should not delete production tenants
    expect(afterCount).toBe(beforeCount);

    // Verify production tenants still exist
    for (const slug of productionSlugs) {
      const tenant = await prisma.tenant.findFirst({
        where: { slug },
      });
      expect(tenant).toBeDefined();
    }
  });
});
```

### 2. Interrupted Test Cleanup Verification

```typescript
// File: server/test/integration/test-cleanup-robustness.spec.ts
describe('Test Cleanup Robustness', () => {
  const ctx = setupCompleteIntegrationTest('cleanup-test');

  it('should clean up even if test throws error', async () => {
    const { prisma } = ctx;
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();

    const tenantASlug = 'cleanup-test-tenant-a';
    const beforeCount = await prisma.tenant.count({
      where: { slug: tenantASlug },
    });

    expect(beforeCount).toBe(1);

    // Simulate error mid-test
    throw new Error('Intentional test failure');
  });

  afterEach(async () => {
    // Verify cleanup runs even after error
    const { prisma } = ctx;
    const afterCount = await prisma.tenant.count({
      where: { slug: 'cleanup-test-tenant-a' },
    });

    // Should be 0 (cleaned up)
    expect(afterCount).toBe(0);

    await ctx.cleanup();
  });
});
```

### 3. PrismaClient Singleton Verification

```typescript
// File: server/test/helpers/global-prisma.spec.ts
describe('Global PrismaClient Singleton', () => {
  it('should return same instance on multiple calls', () => {
    const client1 = getTestPrisma();
    const client2 = getTestPrisma();
    const client3 = getTestPrisma();

    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
  });

  it('should not exhaust connection pool with multiple gets', async () => {
    const clients = Array.from({ length: 10 }, () => getTestPrisma());

    // All should be same instance
    const allSame = clients.every((c) => c === clients[0]);
    expect(allSame).toBe(true);

    // Should be able to perform operations
    const count = await clients[0].tenant.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

### 4. Test Isolation Verification

```typescript
// File: server/test/integration/test-isolation.integration.spec.ts
describe('Test Isolation with Multi-Tenant Setup', () => {
  const ctx = setupCompleteIntegrationTest('isolation-test');

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
  });

  it('should have completely isolated tenants', async () => {
    const tenantA_id = ctx.tenants.tenantA.id;
    const tenantB_id = ctx.tenants.tenantB.id;

    // Tenants should be different
    expect(tenantA_id).not.toBe(tenantB_id);

    // Creating data in A should not appear in B
    const pkg = ctx.factories.package.create({ title: 'A Only' });
    await repository.createPackage(tenantA_id, pkg);

    const packagesA = await repository.getPackages(tenantA_id);
    const packagesB = await repository.getPackages(tenantB_id);

    expect(packagesA).toHaveLength(1);
    expect(packagesB).toHaveLength(0);
  });
});
```

### 5. Database Consistency After Cleanup

```typescript
// File: server/test/integration/cleanup-consistency.spec.ts
describe('Cleanup Database Consistency', () => {
  const ctx = setupCompleteIntegrationTest('consistency-test');

  it('should respect foreign key constraints during cleanup', async () => {
    const { prisma } = ctx;
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();

    const tenantA_id = ctx.tenants.tenantA.id;

    // Create package and booking
    const pkg = ctx.factories.package.create();
    const createdPkg = await repository.createPackage(tenantA_id, pkg);

    const booking = {
      packageId: createdPkg.id,
      coupleName: 'Test Couple',
      email: 'test@example.com',
      eventDate: '2025-12-25',
      addOnIds: [],
      totalCents: createdPkg.priceCents,
      status: 'PAID' as const,
    };
    await repository.createBooking(tenantA_id, booking);

    // Cleanup should handle cascade properly
    await ctx.tenants.cleanupTenants();

    // All data should be gone
    const remainingTenant = await prisma.tenant.findFirst({
      where: { id: tenantA_id },
    });
    expect(remainingTenant).toBeNull();

    const remainingPackages = await prisma.package.count({
      where: { tenantId: tenantA_id },
    });
    expect(remainingPackages).toBe(0);

    const remainingBookings = await prisma.booking.count({
      where: { tenantId: tenantA_id },
    });
    expect(remainingBookings).toBe(0);
  });
});
```

---

## Monitoring and Maintenance

### Daily Health Check

```bash
#!/bin/bash
# scripts/check-test-tenant-health.sh

DATABASE_URL="${1:?DATABASE_URL required}"

psql "$DATABASE_URL" <<EOF
-- Count orphaned test tenants
SELECT COUNT(*) as orphaned_test_tenants
FROM tenant
WHERE slug LIKE 'hash-test-business-%'
   OR slug LIKE 'test-business-%'
   OR slug LIKE 'test-tenant-%'
   OR slug LIKE '%-tenant-a'
   OR slug LIKE '%-tenant-b';

-- Expected: 0 (or very small number if tests just ran)
EOF
```

Run this weekly to monitor accumulation.

### Integration Test Pipeline Monitoring

Add to CI/CD:

```bash
# Before running tests
echo "Test tenants before: $(psql $DATABASE_URL -t -c \
  "SELECT COUNT(*) FROM tenant WHERE slug LIKE 'test-%';")"

# Run tests
npm run test:integration

# After running tests
echo "Test tenants after: $(psql $DATABASE_URL -t -c \
  "SELECT COUNT(*) FROM tenant WHERE slug LIKE 'test-%';")"

# Should be 0 (or very small number)
```

---

## Related Documentation

- **Global Setup Hook:** `/Users/mikeyoung/CODING/MAIS/server/test/helpers/vitest-global-setup.ts`
- **Integration Setup Helpers:** `/Users/mikeyoung/CODING/MAIS/server/test/helpers/integration-setup.ts`
- **Vitest Config:** `/Users/mikeyoung/CODING/MAIS/server/vitest.config.ts`
- **Test Examples:** Look at any file in `/Users/mikeyoung/CODING/MAIS/server/test/integration/`

---

## Summary

Test tenant accumulation is prevented through:

1. **Global setup hook** that cleans orphaned tenants before tests run
2. **Standard test patterns** that always cleanup in beforeEach/afterEach
3. **Descriptive tenant naming** that makes patterns recognizable for cleanup
4. **Factory-based test data** that prevents key conflicts
5. **PrismaClient singleton** that prevents connection pool exhaustion
6. **Comprehensive monitoring** to catch accumulation early

Following these patterns ensures your integration tests remain fast and reliable, even after interrupted test runs.
