# Test Infrastructure Improvements - Implementation Guide

Quick reference for fixing identified issues. See TEST_INFRASTRUCTURE_ANALYSIS.md for detailed context.

---

## Quick Win #1: Extract HTTP Test Helper (1 hour)

### Problem

Duplicate beforeAll setup in 3+ HTTP test files (120+ lines of code duplication).

### Current Pattern (Duplicated)

```typescript
// packages.test.ts - beforeAll #1
describe('GET /v1/packages', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'elope' },
      update: { apiKeyPublic: 'pk_live_elope_...', ... },
      create: { id: 'tenant_...', slug: 'elope', ... }
    });
    testTenantApiKey = tenant.apiKeyPublic;
    await prisma.$disconnect();

    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    app = createApp(config, container, Date.now());
  });
});

// packages.test.ts - beforeAll #2 (DUPLICATE)
describe('GET /v1/packages/:slug', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // EXACT SAME CODE
  });
});
```

### Solution: Create Helper

```typescript
// server/test/helpers/http-setup.ts
import { Express } from 'express';
import { PrismaClient } from '../../src/generated/prisma';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer } from '../../src/di';

export interface HttpTestContext {
  app: Express;
  testTenantApiKey: string;
  cleanup: () => Promise<void>;
}

export async function setupHttpTest(
  options: {
    tenantSlug?: string;
    preset?: 'mock' | 'real';
    tenantId?: string;
  } = {}
): Promise<HttpTestContext> {
  const tenantSlug = options.tenantSlug || 'elope';
  const preset = options.preset || 'mock';

  const prisma = new PrismaClient();

  // Create test tenant with unique API key
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      apiKeyPublic: `pk_live_${tenantSlug}_0123456789abcdef`,
      apiKeySecret: `sk_live_${tenantSlug}_0123456789abcdef0123456789abcdef`,
      isActive: true,
    },
    create: {
      id: options.tenantId || `tenant_${tenantSlug}`,
      slug: tenantSlug,
      name: `Test Tenant (${tenantSlug})`,
      apiKeyPublic: `pk_live_${tenantSlug}_0123456789abcdef`,
      apiKeySecret: `sk_live_${tenantSlug}_0123456789abcdef0123456789abcdef`,
      commissionPercent: 10.0,
      branding: {},
      isActive: true,
    },
  });

  const testTenantApiKey = tenant.apiKeyPublic;

  const config = loadConfig();
  const container = buildContainer({ ...config, ADAPTERS_PRESET: preset });
  const app = createApp(config, container, Date.now());

  const cleanup = async () => {
    await prisma.$disconnect();
  };

  return { app, testTenantApiKey, cleanup };
}

/**
 * Setup multiple tenants for multi-tenant HTTP tests
 */
export async function setupMultiTenantHttpTest(
  options: {
    tenants?: Array<{ slug: string; id?: string }>;
    preset?: 'mock' | 'real';
  } = {}
): Promise<{
  app: Express;
  tenants: Array<{ slug: string; apiKey: string }>;
  cleanup: () => Promise<void>;
}> {
  const tenantConfigs = options.tenants || [{ slug: 'tenant-a' }, { slug: 'tenant-b' }];

  const prisma = new PrismaClient();
  const createdTenants: Array<{ slug: string; apiKey: string }> = [];

  for (const config of tenantConfigs) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: config.slug },
      update: { isActive: true },
      create: {
        id: config.id || `tenant_${config.slug}`,
        slug: config.slug,
        name: `Test ${config.slug}`,
        apiKeyPublic: `pk_live_${config.slug}_test`,
        apiKeySecret: `sk_live_${config.slug}_test_secret`,
        isActive: true,
      },
    });
    createdTenants.push({ slug: config.slug, apiKey: tenant.apiKeyPublic });
  }

  const appConfig = loadConfig();
  const container = buildContainer({ ...appConfig, ADAPTERS_PRESET: options.preset || 'mock' });
  const app = createApp(appConfig, container, Date.now());

  return {
    app,
    tenants: createdTenants,
    cleanup: () => prisma.$disconnect(),
  };
}
```

### Refactored Test

```typescript
// packages.test.ts (AFTER)
import { setupHttpTest } from '../helpers/http-setup';

describe('GET /v1/packages', () => {
  let ctx: Awaited<ReturnType<typeof setupHttpTest>>;

  beforeAll(async () => {
    ctx = await setupHttpTest({ tenantSlug: 'packages-test-get' });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns packages list with contract shape', async () => {
    const res = await request(ctx.app)
      .get('/v1/packages')
      .set('X-Tenant-Key', ctx.testTenantApiKey)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /v1/packages/:slug', () => {
  let ctx: Awaited<ReturnType<typeof setupHttpTest>>;

  beforeAll(async () => {
    ctx = await setupHttpTest({ tenantSlug: 'packages-test-slug' });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns single package by slug', async () => {
    const res = await request(ctx.app)
      .get('/v1/packages/basic-elopement')
      .set('X-Tenant-Key', ctx.testTenantApiKey)
      .expect(200);

    expect(res.body.slug).toBe('basic-elopement');
  });
});
```

**Savings:** Removes 80+ lines of duplication per test file, improves maintainability.

---

## Quick Win #2: Fix Package Factory Race Condition (30 minutes)

### Problem

Multiple packages created in same millisecond get duplicate slugs, causing test flakiness.

```typescript
// BEFORE - Race condition
class PackageFactory {
  private counter = 0;

  create(overrides: Partial<CreatePackageInput> = {}): CreatePackageInput {
    this.counter++;
    const timestamp = Date.now(); // ← Problem: same ms = duplicate
    const uniqueSlug = overrides.slug || `test-package-${this.counter}-${timestamp}`;
    // If counter=1, timestamp=1700610000000, generates: test-package-1-1700610000000
    // Next call in same ms: counter=2, timestamp=1700610000000, generates: test-package-2-1700610000000
    // Both are unique, BUT this relies on counter incrementing fast enough
  }
}
```

### Solution

```typescript
// AFTER - Guaranteed unique
class PackageFactory {
  private counter = 0;

  create(overrides: Partial<CreatePackageInput> = {}): CreatePackageInput {
    this.counter++;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const uniqueSlug =
      overrides.slug || `test-package-${this.counter}-${timestamp}-${randomSuffix}`;

    return {
      slug: uniqueSlug,
      title: overrides.title || `Test Package ${this.counter}`,
      description: overrides.description || `Test description ${this.counter}`,
      priceCents: overrides.priceCents ?? 100000,
      durationMinutes: overrides.durationMinutes ?? 60,
      maxGuests: overrides.maxGuests ?? 50,
      depositCents: overrides.depositCents,
      imageUrl: overrides.imageUrl,
      isActive: overrides.isActive ?? true,
    };
  }
}

// Or use UUID for maximum safety
import { randomUUID } from 'crypto';

class PackageFactory {
  create(overrides: Partial<CreatePackageInput> = {}): CreatePackageInput {
    const uniqueSlug = overrides.slug || `test-package-${randomUUID()}`;
    // ... rest of code
  }
}
```

---

## Quick Win #3: Add Error Type Assertions (1 hour)

### Problem

Tests accept ANY error instead of verifying specific error types, allowing silent failures.

```typescript
// BEFORE - Weak assertion
it('should prevent double-booking when concurrent requests arrive', async () => {
  const results = await Promise.allSettled([
    bookingRepo.create(testTenantId, booking1),
    bookingRepo.create(testTenantId, booking2),
  ]);

  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);

  const rejection = failed[0] as PromiseRejectedResult;
  expect(rejection.reason).toBeDefined(); // ← WEAK: any error passes
});
```

### Solution

```typescript
// AFTER - Strong assertions
it('should prevent double-booking when concurrent requests arrive', async () => {
  const results = await Promise.allSettled([
    bookingRepo.create(testTenantId, booking1),
    bookingRepo.create(testTenantId, booking2),
  ]);

  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);

  const rejection = failed[0] as PromiseRejectedResult;

  // Verify error type and message
  expect(rejection.reason).toBeInstanceOf(BookingConflictError);
  expect(rejection.reason.message).toContain('already booked');

  // Verify database consistency
  const bookings = await ctx.prisma.booking.findMany({
    where: {
      tenantId: testTenantId,
      date: new Date(eventDate),
    },
  });

  // Critical: Only ONE booking should exist
  expect(bookings).toHaveLength(1);

  // Verify it's one of the two attempted bookings
  const createdBooking = bookings[0];
  const successedBooking = (succeeded[0] as PromiseFulfilledResult<any>).value;
  expect(createdBooking.id).toBe(successedBooking.id);
});
```

---

## Quick Win #4: Make Cleanup Failures Throw (30 minutes)

### Problem

Test cleanup can fail silently, contaminating subsequent tests without alerting developers.

```typescript
// BEFORE - Silent failures
afterEach(async () => {
  await ctx.tenants.cleanupTenants(); // ← Can fail, test still passes
});
```

### Solution

```typescript
// AFTER - Fail loudly
afterEach(async () => {
  try {
    await ctx.tenants.cleanupTenants();
  } catch (error) {
    // Log detailed error for debugging
    console.error('CRITICAL: Test cleanup failed - test data may be contaminated', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Throw to make test fail and alert developer
    throw new Error(
      `Test cleanup failed and data may be contaminated. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
```

Or in integration setup:

```typescript
// server/test/helpers/integration-setup.ts
export function setupCompleteIntegrationTest(
  fileSlug: string,
  options: { cacheTTL?: number } = {}
) {
  // ... existing code ...

  const cleanup = async () => {
    const errors: Error[] = [];

    // Attempt cache cleanup
    try {
      cache.flush();
    } catch (error) {
      errors.push(new Error(`Cache flush failed: ${error}`));
    }

    // Attempt database cleanup
    try {
      await cleanupPrisma();
    } catch (error) {
      errors.push(new Error(`Prisma cleanup failed: ${error}`));
    }

    // If any cleanup failed, throw combined error
    if (errors.length > 0) {
      const message = errors.map((e) => e.message).join('\n');
      throw new Error(`Test cleanup failed:\n${message}`);
    }
  };

  return { prisma, tenants, cache, cleanup, factories };
}
```

---

## Quick Win #5: Enhance Cache Isolation Verification (2 hours)

### Problem

Cache isolation only checks key prefix, doesn't verify actual data isolation.

```typescript
// BEFORE - Weak check
verifyCacheKey = (key: string, tenantId: string): boolean => {
  return key.startsWith(`${tenantId}:`); // ← Only checks format
};
```

### Solution

```typescript
// AFTER - Comprehensive verification
export class CacheTestUtils {
  cache: CacheService;

  /**
   * Assert cache key has proper tenant isolation format
   */
  assertCacheKeyFormat(key: string, tenantId: string): void {
    expect(key).toMatch(
      new RegExp(`^${tenantId}:`),
      `Cache key must start with tenant ID. Got: "${key}"`
    );
  }

  /**
   * Assert that cache data is actually isolated between tenants
   */
  async assertCacheIsolation<T>(
    tenantId: string,
    otherTenantId: string,
    resource: string,
    expectedData: T
  ): Promise<void> {
    const key = `${tenantId}:${resource}`;
    const otherKey = `${otherTenantId}:${resource}`;

    // Store data for tenant A
    this.cache.set(key, expectedData);

    // Verify tenant A can retrieve their data
    const retrievedData = this.cache.get(key);
    expect(retrievedData).toEqual(expectedData);

    // Verify tenant B cannot access tenant A's data
    const otherData = this.cache.get(otherKey);
    expect(otherData).toBeNull(
      `Tenant ${otherTenantId} should NOT be able to access ${tenantId}'s data in cache`
    );

    // Verify no data leakage with similar keys
    const similarKey = `${tenantId}_similar:${resource}`;
    const similarData = this.cache.get(similarKey);
    expect(similarData).toBeNull(`Similar but different tenant ID should not match: ${similarKey}`);
  }

  /**
   * Assert cache invalidation works correctly
   */
  async assertCacheInvalidation(
    key: string,
    dataBeforeInvalidation: any,
    dataAfterInvalidation: any
  ): Promise<void> {
    // Set initial data
    this.cache.set(key, dataBeforeInvalidation);
    expect(this.cache.get(key)).toEqual(dataBeforeInvalidation);

    // Invalidate cache
    this.cache.delete(key);
    expect(this.cache.get(key)).toBeNull(`Cache key "${key}" should be null after invalidation`);

    // Verify new data is different
    this.cache.set(key, dataAfterInvalidation);
    const retrieved = this.cache.get(key);
    expect(retrieved).toEqual(dataAfterInvalidation);
    expect(retrieved).not.toEqual(
      dataBeforeInvalidation,
      'Cache invalidation should allow new data to be stored'
    );
  }
}
```

### Usage in Tests

```typescript
describe.sequential('Cache Tenant Isolation - Enhanced', () => {
  const ctx = setupCompleteIntegrationTest('cache-isolation');
  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;
  });

  it('should enforce tenant isolation in cache', async () => {
    const testPackage = { id: 'pkg_1', title: 'Test Package' };

    // Assert isolation
    await ctx.cache.assertCacheIsolation(tenantA_id, tenantB_id, 'packages:pkg_1', testPackage);
  });

  it('should properly invalidate cache', async () => {
    const oldData = { title: 'Old Package' };
    const newData = { title: 'Updated Package' };

    const key = `${tenantA_id}:packages:pkg_1`;

    await ctx.cache.assertCacheInvalidation(key, oldData, newData);
  });
});
```

---

## Medium Task: Fix Transaction Deadlock (1-2 days)

### Problem

Pessimistic locking (FOR UPDATE) causes transaction deadlock in booking creation tests.

```typescript
// FAILING CODE - causes deadlock
async create(tenantId: string, booking: Booking): Promise<Booking> {
  return await this.prisma.$transaction(async (tx) => {
    // Lock the date row for update
    const existing = await tx.$queryRaw`
      SELECT id FROM bookings
      WHERE tenantId = ${tenantId}
      AND date = ${booking.date}
      FOR UPDATE  // ← Causes deadlock in test environment
    `;

    if (existing.length > 0) {
      throw new BookingConflictError(booking.date);
    }

    // Create booking
    return await tx.booking.create({
      data: {
        tenantId,
        packageId: booking.packageId,
        date: booking.date,
        // ... other fields
      },
    });
  });
}
```

### Solution Options

#### Option A: Remove Pessimistic Lock (Simplest)

```typescript
// Rely on unique constraint + optimistic concurrency
async create(tenantId: string, booking: Booking): Promise<Booking> {
  try {
    // Try to create - unique constraint will prevent duplicates
    return await this.prisma.booking.create({
      data: {
        tenantId,
        packageId: booking.packageId,
        date: booking.date,
        // ... other fields
      },
    });
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      // Unique constraint failed
      throw new BookingConflictError(booking.date);
    }
    throw error;
  }
}
```

**Pros:** Simple, no deadlock, trusts database constraint
**Cons:** Race condition between check and create (acceptable due to unique constraint)

#### Option B: Use Pessimistic Lock With Timeout (Robust)

```typescript
async create(tenantId: string, booking: Booking): Promise<Booking> {
  return await this.prisma.$transaction(
    async (tx) => {
      // Try to lock with timeout
      const existing = await tx.$queryRaw`
        SELECT id FROM bookings
        WHERE tenantId = ${tenantId}
        AND date = ${booking.date}
        FOR UPDATE NOWAIT  // ← NOWAIT prevents hanging
      `;

      if (existing.length > 0) {
        throw new BookingConflictError(booking.date);
      }

      return await tx.booking.create({
        data: { tenantId, packageId: booking.packageId, date: booking.date }
      });
    },
    {
      timeout: 5000,  // 5 second timeout
      isolationLevel: 'Serializable'
    }
  );
}
```

**Pros:** Still uses pessimistic locking, handles concurrent access
**Cons:** More complex, requires proper error handling

#### Option C: Use Serializable Isolation (Most Reliable)

```typescript
async create(tenantId: string, booking: Booking): Promise<Booking> {
  return await this.prisma.$transaction(
    async (tx) => {
      // Just check and create - isolation level handles conflicts
      const existing = await tx.booking.findFirst({
        where: {
          tenantId,
          date: booking.date
        },
        select: { id: true }
      });

      if (existing) {
        throw new BookingConflictError(booking.date);
      }

      return await tx.booking.create({
        data: { tenantId, packageId: booking.packageId, date: booking.date }
      });
    },
    {
      isolationLevel: 'Serializable',  // ← Prevents phantom reads
      timeout: 10000
    }
  );
}
```

**Pros:** Database handles all concurrency, no explicit locks needed
**Cons:** Can have higher contention under load

---

## Testing After Fixes

### Verify HTTP Test Helper Works

```bash
npm test -- server/test/http/packages.test.ts
```

### Verify Factory Fix

```bash
npm test -- server/test/integration/booking-repository.integration.spec.ts
```

### Check Cache Isolation

```bash
npm test -- server/test/integration/cache-isolation.integration.spec.ts
```

### Run Full Test Suite

```bash
npm test
```

### Check Coverage

```bash
npm run test:coverage
```

---

## Checklist for Implementation

- [ ] Extract HTTP test helper (server/test/helpers/http-setup.ts)
  - [ ] Copy setupHttpTest function
  - [ ] Copy setupMultiTenantHttpTest function
  - [ ] Update packages.test.ts to use helper
  - [ ] Update tenant-admin-photos.test.ts to use helper
  - [ ] Update tenant-admin-logo.test.ts to use helper
  - [ ] Verify tests still pass

- [ ] Fix Package Factory
  - [ ] Update PackageFactory.create() with random suffix
  - [ ] Add same fix to AddOnFactory.create()
  - [ ] Verify integration tests still pass

- [ ] Strengthen Assertions
  - [ ] Update booking-race-conditions.spec.ts with error type checks
  - [ ] Add database consistency assertions
  - [ ] Verify tests still pass

- [ ] Improve Cleanup
  - [ ] Update integration-setup.ts cleanup to throw on error
  - [ ] Update all afterEach blocks to properly handle cleanup errors
  - [ ] Test with intentional cleanup failure

- [ ] Enhance Cache Tests
  - [ ] Add assertCacheIsolation method to CacheTestUtils
  - [ ] Update cache-isolation.integration.spec.ts tests
  - [ ] Verify multi-tenant isolation

- [ ] Fix Transaction Deadlock
  - [ ] Choose one solution (recommend Option A for simplicity)
  - [ ] Update booking.repository.ts
  - [ ] Update test expectations
  - [ ] Unskip booking-repository.integration.spec.ts tests
  - [ ] Verify all booking tests pass

---

**Total Estimated Time:** 8-10 hours for all quick wins + medium task
**Expected Impact:**

- 100% test pass rate (up from 99.8%)
- 0 skipped tests (down from 33)
- 120+ fewer lines of duplicate code
- Stronger test assertions
- Critical path coverage > 95%
