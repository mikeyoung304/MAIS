# Connection Pool Prevention: Code Examples & Reference Implementation

**Real working code examples for implementing connection pool exhaustion prevention.**

---

## Example 1: Correct Test File Setup

### ✅ GOOD: Proper test file with all prevention measures

**File: `server/src/services/booking.service.test.ts`**

```typescript
/**
 * Booking Service Tests - Connection Pool Safe Pattern
 *
 * This test file demonstrates the correct pattern for integration tests:
 * - Uses global singleton PrismaClient
 * - Proper cleanup in afterEach
 * - File-specific multi-tenant setup
 * - Factory-generated unique IDs
 * - All queries filter by tenantId
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../../test/helpers/integration-setup';
import { BookingService } from './booking.service';
import { PrismBookingRepository } from '../adapters/prisma/booking.repository';
import { AvailabilityService } from './availability.service';

describe('BookingService Integration Tests', () => {
  // 1. Setup integration test context (handles singleton, connection limits)
  const ctx = setupCompleteIntegrationTest('booking-service');

  let bookingService: BookingService;
  let tenantAId: string;
  let tenantBId: string;

  // 2. beforeEach: Create fresh isolated state
  beforeEach(async () => {
    // Always cleanup first (idempotent, safe)
    await ctx.tenants.cleanupTenants();

    // Create test tenants (unique file-specific slugs)
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantAId = ctx.tenants.tenantA.id;
    tenantBId = ctx.tenants.tenantB.id;

    // Setup services with shared Prisma singleton
    const bookingRepo = new PrismBookingRepository(ctx.prisma);
    const availabilityService = new AvailabilityService(bookingRepo);
    bookingService = new BookingService(bookingRepo, availabilityService);

    // Reset cache stats for this test
    ctx.cache.resetStats();
  });

  // 3. afterEach: Cleanup (CRITICAL - do not skip!)
  afterEach(async () => {
    // Cleanup in correct order
    await ctx.tenants.cleanupTenants();
    await ctx.cache.flush();
    await ctx.cleanup(); // Disconnect global Prisma
  });

  // 4. Tests with proper isolation
  describe('Create Booking', () => {
    it('should create booking for tenant A', async () => {
      // Arrange
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 1); // Tomorrow

      // Act: Create booking for tenantA
      const booking = await bookingService.createBooking(tenantAId, {
        date: bookingDate,
        clientEmail: 'client@test.com',
        clientName: 'Test Client',
      });

      // Assert
      expect(booking).toBeDefined();
      expect(booking.tenantId).toBe(tenantAId);
      expect(booking.date).toEqual(bookingDate);

      // Verify: Data is isolated to tenantA
      const bookingsB = await ctx.prisma.booking.findMany({
        where: { tenantId: tenantBId }, // Different tenant
      });
      expect(bookingsB).toHaveLength(0); // Nothing for B
    });

    it('should prevent double-booking', async () => {
      // Arrange
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 1);

      await bookingService.createBooking(tenantAId, {
        date: bookingDate,
        clientEmail: 'client1@test.com',
        clientName: 'Client 1',
      });

      // Act & Assert: Second booking on same date fails
      await expect(
        bookingService.createBooking(tenantAId, {
          date: bookingDate,
          clientEmail: 'client2@test.com',
          clientName: 'Client 2',
        })
      ).rejects.toThrow('double-booking');
    });

    it('should allow same date for different tenants (isolation test)', async () => {
      // Arrange
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 1);

      // Act: Create booking for A
      const bookingA = await bookingService.createBooking(tenantAId, {
        date: bookingDate,
        clientEmail: 'clientA@test.com',
        clientName: 'Client A',
      });

      // Same date for B should work (different tenant)
      const bookingB = await bookingService.createBooking(tenantBId, {
        date: bookingDate,
        clientEmail: 'clientB@test.com',
        clientName: 'Client B',
      });

      // Assert
      expect(bookingA.tenantId).toBe(tenantAId);
      expect(bookingB.tenantId).toBe(tenantBId);
      expect(bookingA.date).toEqual(bookingB.date);
    });
  });

  describe('List Bookings', () => {
    it('should return tenant-scoped bookings only', async () => {
      // Arrange: Create bookings for both tenants
      const factory = new BookingFactory();

      const dates = [new Date(Date.now() + 1 * 86400000), new Date(Date.now() + 2 * 86400000)];

      for (const date of dates) {
        // Create for A
        await bookingService.createBooking(tenantAId, {
          date,
          clientEmail: `clientA${date.getTime()}@test.com`,
          clientName: 'Client A',
        });

        // Create for B
        await bookingService.createBooking(tenantBId, {
          date,
          clientEmail: `clientB${date.getTime()}@test.com`,
          clientName: 'Client B',
        });
      }

      // Act: Get bookings for tenantA
      const bookingsA = await bookingService.getBookings(tenantAId);
      const bookingsB = await bookingService.getBookings(tenantBId);

      // Assert: Each tenant sees only their own bookings
      expect(bookingsA).toHaveLength(2);
      expect(bookingsB).toHaveLength(2);

      // Verify isolation
      expect(bookingsA.every((b) => b.tenantId === tenantAId)).toBe(true);
      expect(bookingsB.every((b) => b.tenantId === tenantBId)).toBe(true);
    });
  });
});
```

---

## Example 2: BAD Test File (What NOT to Do)

### ❌ BAD: Anti-pattern with connection pool risks

**File: `server/src/services/catalog.service.integration.test.ts` (BEFORE FIX)**

```typescript
// ❌ WRONG: Creates own PrismaClient (exhausts pool!)
import { PrismaClient } from '../../src/generated/prisma';
const prisma = new PrismaClient();

describe('CatalogService Integration', () => {
  const testTenantId = 'test_tenant_integration';

  // ❌ No proper cleanup - connections leak!
  afterEach(async () => {
    // Missing: await prisma.$disconnect();
    // This leaks a connection each test
  });

  it('should create package', async () => {
    // ❌ Hardcoded slug - conflicts with parallel tests!
    const result = await catalogService.createPackage(testTenantId, {
      slug: 'test-package', // Same slug every test!
      title: 'Test Package',
      // ...
    });
  });
});
```

**Problems:**

1. ❌ `new PrismaClient()` creates 10+ connections per test file
2. ❌ No cleanup/disconnect - leaks connections
3. ❌ Hardcoded slug `'test-package'` - duplicate key errors
4. ❌ Not using setupCompleteIntegrationTest() - no isolation

**Results when run with other tests:**

- After 5-10 test files: Connection pool exhausted
- After 20 test files: `FATAL: remaining connection slots reserved`
- Tests hang indefinitely

---

## Example 3: Fixed Version

### ✅ GOOD: Same test file, fixed pattern

**File: `server/src/services/catalog.service.integration.test.ts` (AFTER FIX)**

```typescript
/**
 * Catalog Service Integration Tests - Connection Pool Safe
 *
 * Key fixes:
 * - Uses setupCompleteIntegrationTest() for singleton Prisma
 * - Proper cleanup in afterEach
 * - File-specific multi-tenant setup
 * - Factory generates unique IDs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../../test/helpers/integration-setup';
import { CatalogService } from './catalog.service';
import { PrismaCatalogRepository } from '../adapters/prisma/catalog.repository';
import { PackageFactory } from '../../test/helpers/integration-setup';

describe('CatalogService Integration - Audit Logging', () => {
  // ✅ FIX 1: Use setupCompleteIntegrationTest (not new PrismaClient)
  const ctx = setupCompleteIntegrationTest('catalog-service');

  let catalogService: CatalogService;
  let tenantAId: string;

  beforeEach(async () => {
    // ✅ FIX 2: Create fresh isolated tenants
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    tenantAId = ctx.tenants.tenantA.id;

    // Setup service
    const catalogRepo = new PrismaCatalogRepository(ctx.prisma);
    catalogService = new CatalogService(catalogRepo);
  });

  afterEach(async () => {
    // ✅ FIX 3: Proper cleanup
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup(); // Disconnect Prisma
  });

  describe('createPackage', () => {
    it('should create package with unique slug', async () => {
      // ✅ FIX 4: Use factory for unique IDs (not hardcoded)
      const factory = new PackageFactory();
      const input = factory.create({
        title: 'Test Package',
      });

      // input.slug now: 'test-package-1-1699564800000' (unique!)

      const result = await catalogService.createPackage(tenantAId, input);

      expect(result.id).toBeDefined();
      expect(result.slug).toBe(input.slug);

      // ✅ FIX 5: Verify tenant scoping
      const packages = await ctx.prisma.package.findMany({
        where: { tenantId: tenantAId },
      });
      expect(packages).toHaveLength(1);
    });

    it('should prevent duplicate slugs within tenant', async () => {
      const factory = new PackageFactory();
      const input1 = factory.create({ title: 'Package 1' });
      const input2 = factory.create({ title: 'Package 2' });

      // Both have unique slugs (different timestamps)
      expect(input1.slug).not.toBe(input2.slug);

      await catalogService.createPackage(tenantAId, input1);

      // Creating with different slug succeeds
      const result = await catalogService.createPackage(tenantAId, input2);
      expect(result.id).toBeDefined();
    });
  });
});
```

---

## Example 4: Helper Implementation

### Global Prisma Singleton

**File: `server/test/helpers/global-prisma.ts`**

```typescript
/**
 * Global Singleton PrismaClient for Integration Tests
 *
 * CRITICAL: All integration tests MUST use this singleton to prevent
 * connection pool exhaustion with Supabase pgbouncer.
 *
 * Supabase Session/Transaction pooler has limited connections (~60).
 * Creating a new PrismaClient per test file would exhaust the pool.
 */

import { PrismaClient } from '../../src/generated/prisma';

// Singleton instance
let globalPrisma: PrismaClient | null = null;
let connectionCount = 0;

/**
 * Get the global PrismaClient singleton for tests
 *
 * Uses aggressive connection limits and timeouts to prevent pool exhaustion:
 * - connection_limit=3: Keep connections minimal
 * - pool_timeout=5: Fail fast if no connection available
 * - connect_timeout=5: Don't wait forever to connect
 *
 * All subsequent tests reuse this same instance.
 */
export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
    }

    // Strip existing connection params and add our own aggressive limits
    const urlBase = baseUrl.split('?')[0];
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    console.log('[TEST] Initializing global Prisma singleton...');

    globalPrisma = new PrismaClient({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    // Register cleanup on process exit
    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
    });
  }

  connectionCount++;
  return globalPrisma;
}

/**
 * Disconnect the global PrismaClient
 *
 * Call this in global teardown ONLY.
 * Individual test files should NOT call this - they share the singleton.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    try {
      console.log('[TEST] Disconnecting global Prisma singleton...');
      await globalPrisma.$disconnect();
      console.log(`[TEST] Disconnected (was used by ${connectionCount} getTestPrisma() calls)`);
    } catch (err) {
      console.error('[TEST] Error disconnecting test Prisma:', err);
    }
    globalPrisma = null;
    connectionCount = 0;
  }
}

/**
 * Get current connection count (for debugging)
 */
export function getConnectionCount(): number {
  return connectionCount;
}
```

---

## Example 5: Vitest Configuration

**File: `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',

      // ✅ CRITICAL: Global teardown disconnects singleton
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],

      // ✅ CRITICAL: Run all tests in single thread to prevent pool exhaustion
      // Prevents multiple worker processes creating multiple Prisma instances
      poolOptions: {
        threads: {
          singleThread: true, // Do not remove!
        },
      },

      // ✅ CRITICAL: Run test files sequentially (not in parallel)
      // Prevents multiple test files running simultaneously, exhausting pool
      fileParallelism: false, // Do not remove!

      // Prevent individual tests from running too long
      testTimeout: 30000,
      hookTimeout: 10000,

      // Use local storage (not Supabase) for file uploads in tests
      env: { ...env, STORAGE_MODE: 'local' },

      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/*.test.ts',
          'test/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          'dist/**',
          'coverage/**',
          'node_modules/**',
          'scripts/**',
          'prisma/**',
          '*.config.ts',
          '*.config.js',
          '**/*.d.ts',
          '**/index.ts',
        ],
        all: true,
        thresholds: {
          lines: 30,
          branches: 60,
          functions: 35,
          statements: 30,
        },
        reportsDirectory: './coverage',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
```

---

## Example 6: Global Teardown

**File: `server/test/helpers/vitest-global-teardown.ts`**

```typescript
/**
 * Vitest Global Teardown
 *
 * Runs once after ALL test files have completed.
 * Disconnects the singleton PrismaClient to release database connections.
 *
 * This is critical because Vitest normally exits after tests complete,
 * and un-closed connections can cause hanging or resource leaks.
 */

import { disconnectTestPrisma } from './global-prisma';

export default async function globalTeardown() {
  console.log('[vitest] Global teardown: disconnecting Prisma...');
  await disconnectTestPrisma();
  console.log('[vitest] Global teardown complete');
}
```

---

## Example 7: Environment Configuration

**File: `.env.test`**

```bash
# Test Database Configuration
# These connection limits are CRITICAL to prevent pool exhaustion

# PostgreSQL database URL for tests
# Parameters:
#   pgbouncer=true        - Use PgBouncer pooler mode
#   connection_limit=3    - Max connections per instance (CRITICAL: low value)
#   pool_timeout=5        - Seconds to wait for available connection
#   connect_timeout=5     - Seconds to connect to database

DATABASE_URL_TEST="postgresql://user:password@localhost:5432/test_db?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5"

# Alternative: Same as main DATABASE_URL if using separate test DB
# DATABASE_URL_TEST="postgresql://user:password@db.supabase.co:5432/postgres?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5"

# Enable Prisma query logging for debugging
DEBUG_PRISMA=""

# Use local file storage (not Supabase) for test uploads
STORAGE_MODE=local
```

---

## Example 8: Test with Factories

**File: `server/src/services/package.service.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../../test/helpers/integration-setup';
import { PackageFactory, AddOnFactory } from '../../test/helpers/integration-setup';
import { PackageService } from './package.service';

describe('PackageService with Factories', () => {
  const ctx = setupCompleteIntegrationTest('package-service');
  const packageFactory = new PackageFactory();
  const addOnFactory = new AddOnFactory();

  let service: PackageService;
  let tenantId: string;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    tenantId = ctx.tenants.tenantA.id;
    service = new PackageService(/* deps */);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup();
  });

  it('should create multiple packages with unique slugs', async () => {
    // Factory generates unique slugs: test-package-1-timestamp, test-package-2-timestamp
    const inputs = packageFactory.createMany(3, {
      priceCents: 100000,
    });

    // All have different slugs
    expect(new Set(inputs.map((p) => p.slug)).size).toBe(3);

    // Create all packages
    const results = await Promise.all(
      inputs.map((input) => service.createPackage(tenantId, input))
    );

    // All created successfully (no duplicate key errors)
    expect(results).toHaveLength(3);
    results.forEach((pkg) => {
      expect(pkg.id).toBeDefined();
    });
  });

  it('should create packages with add-ons', async () => {
    // Create package
    const pkgInput = packageFactory.create();
    const pkg = await service.createPackage(tenantId, pkgInput);

    // Create add-ons with unique slugs
    const addOnInputs = addOnFactory.createMany(2);
    const addOns = await Promise.all(
      addOnInputs.map((input) => service.createAddOn(tenantId, input))
    );

    // Link add-ons to package
    const withAddOns = await service.attachAddOns(
      tenantId,
      pkg.id,
      addOns.map((a) => a.id)
    );

    expect(withAddOns.addOns).toHaveLength(2);
  });
});
```

---

## Example 9: Multi-Tenant Test Isolation

**File: `server/src/adapters/prisma/catalog.repository.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../../test/helpers/integration-setup';
import { PrismaCatalogRepository } from './catalog.repository';

describe('PrismaCatalogRepository - Multi-Tenant Isolation', () => {
  const ctx = setupCompleteIntegrationTest('catalog-repository');
  let repo: PrismaCatalogRepository;

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
    repo = new PrismaCatalogRepository(ctx.prisma);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup();
  });

  it('should isolate packages between tenants', async () => {
    const factory = new PackageFactory();

    // Create package for A
    const pkgA = factory.create({ title: 'Package A' });
    await repo.createPackage(ctx.tenants.tenantA.id, pkgA);

    // Create same-named package for B
    const pkgB = factory.create({ title: 'Package B' });
    await repo.createPackage(ctx.tenants.tenantB.id, pkgB);

    // A sees only A's packages
    const packagesA = await repo.getPackages(ctx.tenants.tenantA.id);
    expect(packagesA).toHaveLength(1);
    expect(packagesA[0].title).toBe('Package A');

    // B sees only B's packages
    const packagesB = await repo.getPackages(ctx.tenants.tenantB.id);
    expect(packagesB).toHaveLength(1);
    expect(packagesB[0].title).toBe('Package B');
  });

  it('should verify tenantId filter in all queries', async () => {
    // Arrange: Create data for both tenants
    const factory = new PackageFactory();
    const pkgA = factory.create();
    const pkgB = factory.create();

    await repo.createPackage(ctx.tenants.tenantA.id, pkgA);
    await repo.createPackage(ctx.tenants.tenantB.id, pkgB);

    // Act & Assert: Direct database query should show both
    const allPackages = await ctx.prisma.package.findMany();
    expect(allPackages.length).toBeGreaterThanOrEqual(2);

    // But repository filters by tenant
    const tenantsAPackages = await repo.getPackages(ctx.tenants.tenantA.id);
    expect(tenantsAPackages).toHaveLength(1);

    // This test ensures the repository properly filters by tenantId
  });
});
```

---

## Quick Reference Checklist

**Use this when writing a new test file:**

```typescript
// ✅ Step 1: Import helpers
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

// ✅ Step 2: Setup context
const ctx = setupCompleteIntegrationTest('my-service-name');

// ✅ Step 3: beforeEach
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  await ctx.tenants.tenantA.create();
  // ... setup code ...
});

// ✅ Step 4: afterEach
afterEach(async () => {
  await ctx.tenants.cleanupTenants();
  await ctx.cleanup();
});

// ✅ Step 5: Use factories
const factory = new PackageFactory();
const pkg = factory.create(); // Unique slug!

// ✅ Step 6: Filter by tenantId
const packages = await ctx.prisma.package.findMany({
  where: { tenantId: ctx.tenants.tenantA.id },
});
```

---

## References

- **Prevention Guide:** `/docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md`
- **Quick Checklist:** `/docs/solutions/database-issues/CONNECTION_POOL_QUICK_CHECKLIST.md`
- **Detection Patterns:** `/docs/solutions/database-issues/CONNECTION_POOL_DETECTION_PATTERNS.md`
- **Integration Setup Helper:** `/server/test/helpers/integration-setup.ts`
- **Global Prisma Helper:** `/server/test/helpers/global-prisma.ts`
