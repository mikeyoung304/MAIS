# Test Isolation: Database-Specific Patterns for Multi-Tenant Systems

## Overview

This guide provides database-level patterns for preventing test isolation issues in multi-tenant applications. These patterns complement the application-level strategies in `TEST_ISOLATION_PREVENTION_STRATEGIES.md`.

---

## Pattern 1: Tenant-Scoped Data Validation

### Problem

Tests can leak data between tenants if queries don't filter properly by `tenantId`.

### Solution: Test Tenant Isolation

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
    // Create identical package in both tenants
    const pkg1 = ctx.factories.package.create({ title: 'Premium' });
    const pkg2 = ctx.factories.package.create({ title: 'Premium' });

    await repository.createPackage(tenantA_id, pkg1);
    await repository.createPackage(tenantB_id, pkg2);

    // Query as Tenant A
    const packagesA = await repository.getPackages(tenantA_id);

    // Assert: Only Tenant A's package visible
    expect(packagesA).toHaveLength(1);
    expect(packagesA[0].title).toBe('Premium');
    // Verify no leak from Tenant B
    expect(packagesA[0].tenantId).toBe(tenantA_id);

    // Query as Tenant B
    const packagesB = await repository.getPackages(tenantB_id);

    // Assert: Only Tenant B's package visible
    expect(packagesB).toHaveLength(1);
    expect(packagesB[0].tenantId).toBe(tenantB_id);
  });

  it('should handle cross-tenant operations safely', async () => {
    const pkgA = ctx.factories.package.create();
    const pkgB = ctx.factories.package.create();

    // Create in different tenants
    const createdA = await repository.createPackage(tenantA_id, pkgA);
    const createdB = await repository.createPackage(tenantB_id, pkgB);

    // Try to query Tenant A's package as Tenant B (should fail or return nothing)
    const queryResult = await repository.getPackageById(tenantB_id, createdA.id);

    // Assert: Tenant B cannot access Tenant A's data
    expect(queryResult).toBeNull();
  });
});
```

### Key Assertions

```typescript
// Always verify tenantId is correct
expect(record.tenantId).toBe(expectedTenantId);

// Verify query isolation (no cross-tenant leaks)
const allRecords = await repository.getAll(tenantId);
for (const record of allRecords) {
  expect(record.tenantId).toBe(tenantId);
}

// Verify count is correct (not inflated by other tenants' data)
const count = await repository.count(tenantId);
expect(count).toBe(expectedCount);
```

---

## Pattern 2: Foreign Key Constraint-Safe Cleanup

### Problem

Tests fail with foreign key constraint violations when cleanup order is wrong.

### Solution: Dependency-Aware Cleanup

**First, map the foreign key dependencies:**

```
tenant (root)
├── package (tenantId FK)
├── addOn (tenantId FK)
├── booking (tenantId FK, packageId FK)
│   └── bookingAddOn (bookingId FK, addOnId FK) [BOTH are FK!]
└── photoSession (tenantId FK)

Cleanup Order (reverse of creation):
1. bookingAddOn (depends on booking + addOn)
2. booking (depends on package)
3. addOn (independent)
4. package (independent)
5. photoSession (independent)
6. tenant (root - delete last)
```

**Implementation:**

```typescript
// server/test/helpers/integration-setup.ts

async function deleteTenants(slugs: string[]) {
  if (slugs.length === 0) return;

  // Get tenant IDs
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length === 0) return;

  // Delete in reverse dependency order (children before parents)

  // 1. BookingAddOn (has FK to both booking AND addOn)
  await prisma.bookingAddOn.deleteMany({
    where: {
      booking: {
        tenantId: { in: tenantIds },
      },
    },
  });

  // 2. Booking (child of tenant, parent of bookingAddOn)
  await prisma.booking.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });

  // 3. AddOn (child of tenant, parent of bookingAddOn)
  await prisma.addOn.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });

  // 4. Package (child of tenant)
  await prisma.package.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });

  // 5. PhotoSession (child of tenant)
  await prisma.photoSession.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });

  // 6. Tenant (root - delete last)
  await prisma.tenant.deleteMany({
    where: { id: { in: tenantIds } },
  });
}
```

### Testing Cleanup Order

```typescript
it('should completely cleanup without FK violations', async () => {
  // Create complex relationships
  const pkg = await repository.createPackage(tenantA_id, data);
  const booking = await repository.createBooking(tenantA_id, { packageId: pkg.id });
  const addOn = await repository.createAddOn(tenantA_id, data);
  await repository.addBookingAddOn(tenantA_id, booking.id, addOn.id);

  // Cleanup (should not throw FK violation)
  await expect(ctx.tenants.cleanupTenants()).resolves.not.toThrow();

  // Verify everything is gone
  const tenants = await ctx.prisma.tenant.findMany({
    where: { id: { in: ctx.tenants.getTenantIds() } },
  });
  expect(tenants).toHaveLength(0);

  const bookings = await ctx.prisma.booking.findMany({
    where: { tenantId: ctx.tenants.tenantA.id },
  });
  expect(bookings).toHaveLength(0);
});
```

---

## Pattern 3: Concurrent Data Access Testing

### Problem

Race conditions in parallel tests can cause data conflicts.

### Solution: Test Concurrent Bookings (Serialization)

```typescript
describe.sequential('Concurrent Booking Prevention', () => {
  const ctx = setupCompleteIntegrationTest('concurrent-bookings');

  let tenantA_id: string;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    tenantA_id = ctx.tenants.tenantA.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should prevent concurrent booking of same date', async () => {
    // Setup: Create package
    const pkg = ctx.factories.package.create();
    const createdPkg = await repository.createPackage(tenantA_id, pkg);

    const bookingDate = new Date('2025-06-15');

    // Simulate concurrent booking attempts
    const bookingAttempts = [
      repository.createBooking(tenantA_id, {
        packageId: createdPkg.id,
        date: bookingDate,
        customerName: 'Alice',
      }),
      repository.createBooking(tenantA_id, {
        packageId: createdPkg.id,
        date: bookingDate,
        customerName: 'Bob',
      }),
    ];

    // One should succeed, one should fail
    const results = await Promise.allSettled(bookingAttempts);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      status: 'rejected',
      reason: expect.any(Error), // BookingConflictError
    });
  });

  it('should allow bookings on different dates', async () => {
    const pkg = ctx.factories.package.create();
    const createdPkg = await repository.createPackage(tenantA_id, pkg);

    // Book different dates (should succeed)
    const booking1 = await repository.createBooking(tenantA_id, {
      packageId: createdPkg.id,
      date: new Date('2025-06-15'),
      customerName: 'Alice',
    });

    const booking2 = await repository.createBooking(tenantA_id, {
      packageId: createdPkg.id,
      date: new Date('2025-06-16'),
      customerName: 'Bob',
    });

    expect(booking1.id).toBeDefined();
    expect(booking2.id).toBeDefined();
    expect(booking1.id).not.toBe(booking2.id);
  });
});
```

**Why use `.sequential()`:**

- These tests modify shared resource (availability calendar)
- Concurrent execution causes unpredictable results
- Sequential ensures test order is deterministic

---

## Pattern 4: Cache Isolation in Multi-Tenant Systems

### Problem

Cache can leak data between tenants if keys don't include `tenantId`.

### Solution: Tenant-Scoped Cache Keys

```typescript
describe('Cache Isolation', () => {
  const ctx = setupCompleteIntegrationTest('cache-isolation');

  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    ctx.cache.resetStats();
  });

  afterEach(async () => {
    ctx.cache.flush();
    await ctx.cleanup();
  });

  it('should use tenant-scoped cache keys', async () => {
    // Build cache keys
    const keyA = `tenant:${tenantA_id}:packages:all`;
    const keyB = `tenant:${tenantB_id}:packages:all`;

    // Verify keys are different
    expect(keyA).not.toBe(keyB);

    // Verify key format includes tenantId
    expect(keyA).toMatch(/^tenant:[a-z0-9-]+:packages:all$/);
  });

  it('should isolate cache between tenants', async () => {
    // Create different data in each tenant
    const pkgA = ctx.factories.package.create({ priceCents: 100000 });
    const pkgB = ctx.factories.package.create({ priceCents: 200000 });

    await repository.createPackage(tenantA_id, pkgA);
    await repository.createPackage(tenantB_id, pkgB);

    // Fetch (will cache with tenant-scoped key)
    const packagesA = await service.getAllPackages(tenantA_id);
    const packagesB = await service.getAllPackages(tenantB_id);

    // Verify data
    expect(packagesA[0].priceCents).toBe(100000);
    expect(packagesB[0].priceCents).toBe(200000);

    // Reset stats to measure subsequent access
    ctx.cache.resetStats();

    // Fetch again (should hit cache)
    await service.getAllPackages(tenantA_id);
    await service.getAllPackages(tenantB_id);

    // Verify cache was used (2 hits)
    const stats = await ctx.cache.getStats();
    expect(stats.hits).toBe(2);
  });

  it('should invalidate only specific tenant cache on update', async () => {
    // Setup: Cache packages for both tenants
    const pkgA = ctx.factories.package.create();
    const pkgB = ctx.factories.package.create();

    await repository.createPackage(tenantA_id, pkgA);
    await repository.createPackage(tenantB_id, pkgB);

    // Cache by fetching
    await service.getAllPackages(tenantA_id);
    await service.getAllPackages(tenantB_id);

    // Reset stats
    ctx.cache.resetStats();

    // Update Tenant A's package (should invalidate only A's cache)
    const updatePkg = await repository.getPackages(tenantA_id);
    await repository.updatePackage(tenantA_id, updatePkg[0].id, { priceCents: 250000 });

    // Fetch again
    const pkgsA = await service.getAllPackages(tenantA_id); // Cache MISS (invalidated)
    const pkgsB = await service.getAllPackages(tenantB_id); // Cache HIT (not affected)

    // Verify
    const stats = await ctx.cache.getStats();
    expect(stats.misses).toBeGreaterThanOrEqual(1); // Tenant A
    expect(stats.hits).toBeGreaterThanOrEqual(1); // Tenant B
    expect(pkgsA[0].priceCents).toBe(250000); // Updated value
  });
});
```

### Cache Key Validation Helper

```typescript
// Verify cache keys follow security pattern
function validateCacheKeyFormat(key: string, tenantId: string): void {
  const expectedPrefix = `tenant:${tenantId}:`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(
      `Cache key security violation!\n` +
        `Expected: ${expectedPrefix}*\n` +
        `Actual: ${key}\n` +
        `This is a security vulnerability: data could leak between tenants!`
    );
  }
}

// Use in tests
it('should validate cache key format', () => {
  const key = service.buildCacheKey(tenantA_id, 'packages');
  validateCacheKeyFormat(key, tenantA_id); // Should not throw
});
```

---

## Pattern 5: Unique Test Data Generation

### Problem

Hardcoded test data causes conflicts when tests run in parallel.

### Solution: Factory-Based Unique ID Generation

```typescript
// PackageFactory auto-generates unique slugs
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
      // ... other fields
    };
  }
}

// Usage
describe('Package Tests', () => {
  const factory = new PackageFactory();

  it('test 1', () => {
    const pkg1 = factory.create(); // slug: 'test-package-1-1699564800000'
    const pkg2 = factory.create(); // slug: 'test-package-2-1699564800001'
    // Never conflict!
  });

  it('test 2 (parallel with test 1)', () => {
    const pkg3 = factory.create(); // slug: 'test-package-1-1699564800500' (different timestamp)
    // Still unique even if parallel!
  });
});
```

### Why This Works

```
Test A                          Test B (parallel)
├─ counter=0, timestamp=1000    ├─ counter=0, timestamp=1050
├─ slug: test-package-1-1000    ├─ slug: test-package-1-1050 (DIFFERENT!)
├─ counter=1, timestamp=1010    ├─ counter=1, timestamp=1060
├─ slug: test-package-2-1010    └─ slug: test-package-2-1060 (DIFFERENT!)
└─ No conflicts!
```

---

## Pattern 6: Migration Testing

### Problem

Tests may fail if database schema changes aren't properly applied.

### Solution: Migration Validation in Tests

```typescript
describe('Schema Migrations', () => {
  const { prisma, cleanup } = setupIntegrationTest();

  afterEach(async () => {
    await cleanup();
  });

  it('should have required columns on Package table', async () => {
    // This validates the migration was applied
    const pkg = await prisma.package.create({
      data: {
        tenantId: 'test-tenant',
        slug: 'test-package',
        title: 'Test',
        priceCents: 10000,
        durationMinutes: 60,
      },
    });

    expect(pkg).toMatchObject({
      tenantId: 'test-tenant',
      slug: 'test-package',
      title: 'Test',
      priceCents: 10000,
      durationMinutes: 60,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should enforce tenantId uniqueness on Package slug', async () => {
    const tenantId = 'test-tenant';

    // Create first package
    await prisma.package.create({
      data: {
        tenantId,
        slug: 'duplicate-test',
        title: 'First',
        priceCents: 10000,
        durationMinutes: 60,
      },
    });

    // Try to create duplicate (should fail)
    await expect(
      prisma.package.create({
        data: {
          tenantId,
          slug: 'duplicate-test', // Same slug
          title: 'Second',
          priceCents: 20000,
          durationMinutes: 60,
        },
      })
    ).rejects.toThrow('Unique constraint failed');
  });
});
```

---

## Pattern 7: State Pollution Detection

### Problem

Tests pollute database state for subsequent tests without visible errors.

### Solution: State Validation Tests

```typescript
describe('State Pollution Detection', () => {
  const ctx = setupCompleteIntegrationTest('state-pollution');

  it('database should be clean at test start', async () => {
    // Count total records (excluding system data)
    const tenantCount = await ctx.prisma.tenant.count();
    const packageCount = await ctx.prisma.package.count();
    const bookingCount = await ctx.prisma.booking.count();

    // Should be close to zero (only system/seed data if any)
    expect(tenantCount).toBeLessThan(10);
    expect(packageCount).toBeLessThan(100);
    expect(bookingCount).toBeLessThan(100);
  });

  it('should cleanup after creating test data', async () => {
    // Create test tenants
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    let tenantCount = await ctx.prisma.tenant.count();
    expect(tenantCount).toBeGreaterThan(0);

    // Cleanup
    await ctx.tenants.cleanupTenants();

    // Verify cleanup worked
    const remainingTenants = await ctx.prisma.tenant.findMany({
      where: { id: { in: ctx.tenants.getTenantIds() } },
    });
    expect(remainingTenants).toHaveLength(0);
  });
});
```

---

## Validation Checklist

Before running tests with concurrent execution:

```
Database Setup:
  ☐ Migrations applied (prisma migrate deploy)
  ☐ Manual SQL migrations applied
  ☐ No schema drift detected

Test Data:
  ☐ All test data uses factories (no hardcoded slugs)
  ☐ File-specific tenant slugs (e.g., 'booking-test-tenant-a')
  ☐ Factories generate unique IDs (counter + timestamp)

Cleanup:
  ☐ afterEach calls cleanup() (CRITICAL!)
  ☐ Cleanup respects FK dependency order
  ☐ No leftover data after cleanup
  ☐ Verify with count queries

Cache:
  ☐ All cache keys include tenantId
  ☐ Cache invalidation is tenant-specific
  ☐ Cache cleared in afterEach

Multi-Tenant:
  ☐ Data isolation test passes (different tenants see different data)
  ☐ Cross-tenant queries return nothing
  ☐ All repository methods accept tenantId parameter
```

---

## Related Documentation

- `TEST_ISOLATION_PREVENTION_STRATEGIES.md` - Comprehensive prevention guide
- `server/test/helpers/integration-setup.ts` - MAIS helper implementation
- `server/prisma/schema.prisma` - MAIS database schema with FK definitions
- `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Multi-tenant architecture
