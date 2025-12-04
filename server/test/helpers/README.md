# Integration Test Helpers

Reusable utilities for multi-tenant integration tests in the MAIS platform.

## Overview

This directory contains helper utilities that standardize integration test patterns across the codebase. The helpers eliminate boilerplate code and enforce best practices for:

- Multi-tenant test setup
- Database initialization and cleanup
- Cache testing and validation
- Test data factories with unique identifiers

## Quick Start

### Complete Integration Test Setup

For most integration tests, use `setupCompleteIntegrationTest()` which provides everything you need:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { MyRepository } from '../../src/adapters/prisma/my.repository';
import { MyService } from '../../src/services/my.service';

describe.sequential('My Integration Test', () => {
  const ctx = setupCompleteIntegrationTest('my-test', { cacheTTL: 60 });

  let repository: MyRepository;
  let service: MyService;
  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    // Clean and create tenants
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    // Initialize your services
    repository = new MyRepository(ctx.prisma);
    service = new MyService(repository, ctx.cache.cache);

    // Reset cache stats
    ctx.cache.resetStats();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should handle multi-tenant data correctly', async () => {
    // Use factories to create test data with unique identifiers
    const pkg = ctx.factories.package.create({ priceCents: 150000 });
    await repository.createPackage(tenantA_id, pkg);

    // Your test logic here...
  });
});
```

## Utilities Reference

### `setupCompleteIntegrationTest(fileSlug, options)`

Complete integration test setup with database, multi-tenant, cache, and factories.

**Parameters:**

- `fileSlug` (string): Unique identifier for this test file (e.g., 'cache-isolation', 'booking-race')
- `options.cacheTTL` (number, optional): Cache TTL in seconds (default: 60)

**Returns:** Object with:

- `prisma`: PrismaClient instance
- `tenants`: Multi-tenant setup (tenantA, tenantB, cleanup functions)
- `cache`: Cache test utilities
- `cleanup`: Cleanup function (disconnects from database, flushes cache)
- `factories`: Test data factories (package, addOn)

**Example:**

```typescript
const ctx = setupCompleteIntegrationTest('my-test', { cacheTTL: 60 });
```

---

### `setupIntegrationTest()`

Basic database setup for tests that don't need multi-tenant or cache utilities.

**Returns:** Object with:

- `prisma`: PrismaClient instance configured for test database
- `cleanup`: Disconnect function

**Example:**

```typescript
const { prisma, cleanup } = setupIntegrationTest();

beforeEach(async () => {
  // Your setup
});

afterEach(async () => {
  await cleanup();
});
```

---

### `createMultiTenantSetup(prisma, fileSlug)`

Create isolated multi-tenant test setup with Tenant A and Tenant B.

**Parameters:**

- `prisma`: PrismaClient instance
- `fileSlug`: Unique identifier for this test file

**Returns:** Object with:

- `tenantA`: Tenant A utilities (id, data, create, cleanup)
- `tenantB`: Tenant B utilities (id, data, create, cleanup)
- `cleanupTenants`: Clean up both tenants' data
- `getTenantIds`: Get array of tenant IDs

**Example:**

```typescript
const { tenantA, tenantB, cleanupTenants } = createMultiTenantSetup(prisma, 'my-test');

beforeEach(async () => {
  await cleanupTenants();
  await tenantA.create();
  await tenantB.create();

  const tenantAId = tenantA.id;
  const tenantBId = tenantB.id;
});
```

**Key Features:**

- File-specific tenant slugs prevent cross-file conflicts
- Respects foreign key constraints during cleanup
- Tenant data accessible via `.data` property
- Cleanup targets only this file's tenants

---

### `createCacheTestUtils(ttlSeconds)`

Cache testing utilities for validating cache isolation.

**Parameters:**

- `ttlSeconds` (number, optional): Cache TTL in seconds (default: 60)

**Returns:** Object with:

- `cache`: CacheService instance
- `resetStats`: Reset cache statistics
- `flush`: Flush all cache entries
- `getStats`: Get cache statistics (hits, misses, hitRate, totalRequests)
- `verifyCacheKey`: Verify cache key follows tenant isolation pattern

**Example:**

```typescript
const { cache, resetStats, verifyCacheKey } = createCacheTestUtils();

beforeEach(() => {
  resetStats();
});

it('should have tenant-scoped cache key', () => {
  const key = cache.buildKey(['packages'], tenantId);
  expect(verifyCacheKey(key, tenantId)).toBe(true);
});
```

---

### `PackageFactory`

Factory for creating test packages with unique slugs.

**Methods:**

- `create(overrides)`: Create single package input
- `createMany(count, baseOverrides)`: Create multiple package inputs

**Example:**

```typescript
const factory = new PackageFactory();

// Create single package
const pkg = factory.create({ priceCents: 150000 });
await repository.createPackage(tenantId, pkg);

// Create multiple packages
const packages = factory.createMany(3, { priceCents: 100000 });
for (const pkg of packages) {
  await repository.createPackage(tenantId, pkg);
}
```

**Unique Slugs:**
Factory automatically generates unique slugs using counter + timestamp: `test-package-1-1699564800000`

---

### `AddOnFactory`

Factory for creating test add-ons with unique slugs.

**Methods:**

- `create(overrides)`: Create single add-on input
- `createMany(count, baseOverrides)`: Create multiple add-on inputs

**Example:**

```typescript
const factory = new AddOnFactory();

// Create single add-on
const addOn = factory.create({ priceCents: 5000 });
await repository.createAddOn(tenantId, addOn);

// Create multiple add-ons
const addOns = factory.createMany(3, { category: 'ENHANCEMENT' });
for (const addOn of addOns) {
  await repository.createAddOn(tenantId, addOn);
}
```

---

### `runConcurrent(operations)`

Run multiple async operations concurrently and return results.

**Parameters:**

- `operations`: Array of async functions

**Returns:** Promise with array of results

**Example:**

```typescript
const [packagesA, packagesB] = await runConcurrent([
  () => service.getPackages(tenantA_id),
  () => service.getPackages(tenantB_id),
]);
```

---

### `assertTenantScopedCacheKey(key, tenantId)`

Assert that cache key follows tenant isolation pattern. Throws error if invalid.

**Parameters:**

- `key`: Cache key to validate
- `tenantId`: Expected tenant ID

**Throws:** Error if cache key doesn't start with `${tenantId}:`

**Example:**

```typescript
assertTenantScopedCacheKey('tenant-123:packages', 'tenant-123'); // ✅ Pass
assertTenantScopedCacheKey('packages', 'tenant-123'); // ❌ Throws error
```

---

### `wait(ms)`

Wait for specified duration (useful for timing-sensitive tests).

**Parameters:**

- `ms`: Milliseconds to wait

**Returns:** Promise that resolves after duration

**Example:**

```typescript
await wait(100); // Wait 100ms for cache TTL
```

## Best Practices

### 1. Use File-Specific Tenant Slugs

Always provide a unique `fileSlug` parameter to prevent test conflicts:

```typescript
// ✅ Good: Unique file slug
const ctx = setupCompleteIntegrationTest('cache-isolation');

// ❌ Bad: Generic slug (may conflict with other tests)
const ctx = setupCompleteIntegrationTest('test');
```

### 2. Use Sequential Test Execution for Shared State

If tests share database state or cache, use `.sequential()`:

```typescript
describe.sequential('Tests with shared state', () => {
  // Tests run one at a time
});
```

### 3. Use Factories for Unique Test Data

Always use factories instead of hardcoded slugs:

```typescript
// ✅ Good: Factory generates unique slug
const pkg = factory.create({ title: 'Test Package' });

// ❌ Bad: Hardcoded slug may conflict
const pkg = { slug: 'test-package', title: 'Test Package' };
```

### 4. Clean Up Between Tests

Always clean up tenants and cache between tests:

```typescript
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  await ctx.tenants.tenantA.create();
  await ctx.tenants.tenantB.create();
  ctx.cache.resetStats();
});

afterEach(async () => {
  await ctx.cleanup();
});
```

### 5. Validate Cache Isolation

For cache tests, always verify tenant isolation:

```typescript
it('should isolate cache by tenant', async () => {
  // Create data for both tenants
  const pkgA = factory.create({ priceCents: 100000 });
  const pkgB = factory.create({ priceCents: 200000 });

  await repository.createPackage(tenantA_id, pkgA);
  await repository.createPackage(tenantB_id, pkgB);

  // Fetch and verify isolation
  const packagesA = await service.getPackages(tenantA_id);
  const packagesB = await service.getPackages(tenantB_id);

  expect(packagesA[0].priceCents).toBe(100000);
  expect(packagesB[0].priceCents).toBe(200000);

  // Verify cache keys are tenant-scoped
  const stats = ctx.cache.getStats();
  expect(stats.keys).toBe(2); // Each tenant has own cache key
});
```

## Migration Guide

### Before (Manual Setup)

```typescript
describe('My Integration Test', () => {
  let prisma: PrismaClient;
  let cache: CacheService;
  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
        },
      },
    });

    cache = new CacheService(60);

    // Cleanup
    const tenants = await prisma.tenant.findMany({
      where: { slug: { in: ['tenant-a', 'tenant-b'] } },
    });
    const tenantIds = tenants.map((t) => t.id);
    await prisma.package.deleteMany({ where: { tenantId: { in: tenantIds } } });

    // Create tenants
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'tenant-a' },
      update: {},
      create: {
        slug: 'tenant-a',
        name: 'Tenant A',
        apiKeyPublic: 'pk_test_a',
        apiKeySecret: 'sk_test_a_hash',
      },
    });
    tenantA_id = tenantA.id;

    // ... repeat for tenantB
  });

  afterEach(async () => {
    cache.flush();
    await prisma.$disconnect();
  });

  it('should work', async () => {
    await prisma.package.create({
      data: {
        slug: 'test-package',
        title: 'Test Package',
        priceCents: 100000,
        tenantId: tenantA_id,
      },
    });
    // ... test logic
  });
});
```

### After (With Helpers)

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe.sequential('My Integration Test', () => {
  const ctx = setupCompleteIntegrationTest('my-test');
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
    await ctx.cleanup();
  });

  it('should work', async () => {
    const pkg = ctx.factories.package.create();
    await repository.createPackage(tenantA_id, pkg);
    // ... test logic
  });
});
```

**Benefits:**

- 70% less boilerplate code
- Automatic unique slugs (prevents test conflicts)
- File-specific tenant isolation
- Standardized cleanup patterns
- Built-in cache utilities

## Examples

### Example 1: Cache Isolation Test

```typescript
import { setupCompleteIntegrationTest, runConcurrent } from '../helpers/integration-setup';

describe.sequential('Cache Isolation Tests', () => {
  const ctx = setupCompleteIntegrationTest('cache-isolation');
  // ... setup code ...

  it('should isolate cache between tenants', async () => {
    // Create packages with same slug for different tenants
    const pkg = ctx.factories.package.create({ slug: 'premium' });
    await repository.createPackage(tenantA_id, { ...pkg, priceCents: 100000 });
    await repository.createPackage(tenantB_id, { ...pkg, priceCents: 200000 });

    // Concurrent reads
    const [pkgA, pkgB] = await runConcurrent([
      () => service.getPackageBySlug(tenantA_id, 'premium'),
      () => service.getPackageBySlug(tenantB_id, 'premium'),
    ]);

    expect(pkgA.priceCents).toBe(100000);
    expect(pkgB.priceCents).toBe(200000);
  });
});
```

### Example 2: Concurrent Operations Test

```typescript
it('should handle concurrent updates', async () => {
  const packages = ctx.factories.package.createMany(2);
  const [pkgA, pkgB] = await Promise.all([
    repository.createPackage(tenantA_id, packages[0]),
    repository.createPackage(tenantB_id, packages[1]),
  ]);

  await runConcurrent([
    () => service.updatePackage(tenantA_id, pkgA.id, { priceCents: 150000 }),
    () => service.updatePackage(tenantB_id, pkgB.id, { priceCents: 250000 }),
  ]);

  const [updatedA, updatedB] = await runConcurrent([
    () => service.getPackageById(tenantA_id, pkgA.id),
    () => service.getPackageById(tenantB_id, pkgB.id),
  ]);

  expect(updatedA.priceCents).toBe(150000);
  expect(updatedB.priceCents).toBe(250000);
});
```

### Example 3: Cache Invalidation Test

```typescript
it('should invalidate only specific tenant cache', async () => {
  // Create and cache packages for both tenants
  const pkgA = ctx.factories.package.create();
  const pkgB = ctx.factories.package.create();

  await repository.createPackage(tenantA_id, pkgA);
  await repository.createPackage(tenantB_id, pkgB);

  await service.getAllPackages(tenantA_id); // Cache
  await service.getAllPackages(tenantB_id); // Cache

  ctx.cache.resetStats();

  // Update Tenant A's package (invalidates only Tenant A's cache)
  await service.updatePackage(tenantA_id, pkgA.id, { priceCents: 200000 });

  // Tenant A: cache miss (invalidated)
  await service.getAllPackages(tenantA_id);
  // Tenant B: cache hit (not affected)
  await service.getAllPackages(tenantB_id);

  const stats = ctx.cache.getStats();
  expect(stats.misses).toBeGreaterThanOrEqual(1); // Tenant A
  expect(stats.hits).toBeGreaterThanOrEqual(1); // Tenant B
});
```

## Troubleshooting

### Database Connection Pool Exhaustion 🔴 **CRITICAL**

**Symptom:**

```
PrismaClientInitializationError:
Invalid `prisma.tenant.findMany()` invocation
Too many database connections opened:
FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
```

**Impact:**

- Tests that were passing suddenly fail
- Tests run slower or timeout
- Intermittent, unpredictable failures
- **Test regressions**: Test pass rate drops significantly

**Root Cause:**
Integration tests using `setupCompleteIntegrationTest()` create a new Prisma Client instance for each test file. Without connection pool limits, each instance can open 100+ connections, quickly exhausting the database server's available connections (typically 100-300 total).

**Fix: Configure Connection Pool Limits** ✅

Add connection pool parameters to `DATABASE_URL_TEST` in `.env.test`:

```bash
# Before (causes exhaustion):
DATABASE_URL_TEST="postgresql://user:pass@host:5432/db"

# After (prevents exhaustion):
DATABASE_URL_TEST="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

**Parameter Explanations:**

- `connection_limit=10`: Maximum connections per Prisma Client instance (default is unlimited)
- `pool_timeout=20`: Seconds to wait for available connection before timeout (default is 10)

**Why These Values:**

- `connection_limit=10`: Low enough to prevent exhaustion with 6+ test files, high enough for concurrent operations within tests
- `pool_timeout=20`: Longer timeout accounts for sequential test execution and cleanup operations

**Validation:**
After updating `.env.test`, re-run tests to confirm:

```bash
npm run test:integration

# Expected: Test pass rate returns to normal
# Before fix: 58/104 passing (55.8%)
# After fix:  75+/104 passing (72%+)
```

**Prevention:**

1. Always use `setupCompleteIntegrationTest()` which properly manages connections
2. Always call `await ctx.cleanup()` in `afterEach` hooks
3. Use `.sequential()` for test suites to avoid parallel connection creation
4. Monitor connection usage during test development

**Real Example (Sprint 5):**

- **Before connection limit**: booking-repository tests regressed from 10/11 passing to 5/11 passing
- **After connection limit**: Expected to return to 10/11 passing
- **Overall impact**: 17 tests regressed due to this issue alone

**See Also:**

- `.env.test` - Connection pool configuration with detailed comments
- `.claude/SPRINT_5_SESSION_REPORT.md` § Critical Blocker - Full investigation details

---

### Foreign Key Constraint Errors

If you see foreign key constraint errors, ensure cleanup order respects dependencies:

```typescript
// ✅ Correct order (child → parent)
await prisma.bookingAddOn.deleteMany();
await prisma.booking.deleteMany();
await prisma.package.deleteMany();

// ❌ Wrong order (parent before child)
await prisma.package.deleteMany(); // Error: referenced by bookings
```

The `cleanupTenants()` helper handles this automatically.

---

### Test Conflicts

If tests fail with "duplicate slug" errors, ensure:

1. Use unique `fileSlug` for each test file
2. Use factories for test data creation
3. Use `.sequential()` for tests with shared state

**Example:**

```typescript
// ✅ Good: Unique file slug prevents conflicts
const ctx = setupCompleteIntegrationTest('booking-repository');

// ❌ Bad: Generic slug may conflict with other test files
const ctx = setupCompleteIntegrationTest('test');
```

---

### Cache Not Isolating

If cache tests show cross-tenant leakage:

1. Verify cache keys include tenantId prefix
2. Use `assertTenantScopedCacheKey()` to validate format
3. Check cache invalidation includes tenantId

**Example:**

```typescript
// ✅ Tenant-isolated cache key
const key = `${tenantId}:packages:all`;

// ❌ Not tenant-isolated (security vulnerability!)
const key = 'packages:all';
```

---

### Tests Pass Locally But Fail in CI

Common causes:

1. **Connection pool exhaustion** (see above) - CI may have stricter connection limits
2. **Timing-dependent race conditions** - CI may have different CPU/IO characteristics
3. **Missing environment variables** - Check `.env.test` is properly configured in CI
4. **Database state** - CI database may have leftover data from previous runs

**Fix:**

- Ensure `.env.test` has connection pool limits configured
- Use `describe.sequential()` for timing-sensitive tests
- Ensure `beforeEach` properly cleans up test data
- Consider relaxing race condition test assertions (check for behavior, not exact timing)

## Related Documentation

- **Cache Security**: `.claude/CACHE_WARNING.md` - Multi-tenant cache isolation requirements
- **Multi-Tenant Patterns**: `.claude/PATTERNS.md` - Repository and service patterns
- **Integration Tests**: Test files in `/server/test/integration/`

## Contributing

When adding new test utilities:

1. Add JSDoc comments with examples
2. Export from `integration-setup.ts`
3. Update this README with usage examples
4. Update existing tests to use new utilities

## Support

For questions or issues with test helpers:

- Check existing integration tests for examples
- Review `.claude/CACHE_WARNING.md` for cache security patterns
- Consult Sprint 4 documentation: `SPRINT_4_SESSION_1_COMPLETE.md`
