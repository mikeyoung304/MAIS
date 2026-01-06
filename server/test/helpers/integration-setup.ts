/**
 * Integration Test Setup Helpers
 *
 * Reusable utilities for multi-tenant integration tests
 * Provides standardized patterns for:
 * - Database initialization and cleanup
 * - Multi-tenant test data setup
 * - Cache testing utilities
 * - Test data factories
 *
 * Usage:
 * ```typescript
 * import { setupIntegrationTest, createMultiTenantSetup } from '../helpers/integration-setup';
 *
 * describe('My Integration Test', () => {
 *   const { prisma, cleanup } = setupIntegrationTest();
 *   const { tenantA, tenantB, cleanupTenants } = createMultiTenantSetup(prisma, 'my-test-file');
 *
 *   beforeEach(async () => {
 *     await cleanupTenants();
 *     await tenantA.create();
 *     await tenantB.create();
 *   });
 *
 *   afterEach(async () => {
 *     await cleanup();
 *   });
 * });
 * ```
 */

import type { Tenant } from '../../src/generated/prisma/client';
import { PrismaClient, Package, AddOn } from '../../src/generated/prisma/client';
import { InMemoryCacheAdapter } from '../../src/adapters/mock/cache.adapter';
import type { CreatePackageInput, CreateAddOnInput, CacheServicePort } from '../../src/lib/ports';
import { getTestPrisma } from './global-prisma';

/**
 * Integration test context with PrismaClient and cleanup
 */
export interface IntegrationTestContext {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

/**
 * Multi-tenant test setup with two tenants (A and B)
 */
export interface MultiTenantTestSetup {
  tenantA: {
    id: string;
    data: Tenant;
    create: () => Promise<Tenant>;
    cleanup: () => Promise<void>;
  };
  tenantB: {
    id: string;
    data: Tenant;
    create: () => Promise<Tenant>;
    cleanup: () => Promise<void>;
  };
  cleanupTenants: () => Promise<void>;
  getTenantIds: () => string[];
}

/**
 * Cache test utilities
 * Uses InMemoryCacheAdapter (modern async cache interface)
 */
export interface CacheTestUtils {
  cache: CacheServicePort;
  resetStats: () => void;
  flush: () => void;
  getStats: () => Promise<{
    hits: number;
    misses: number;
    keys: number;
    totalRequests: number;
    hitRate: string;
  }>;
  verifyCacheKey: (key: string, tenantId: string) => boolean;
}

/**
 * Initialize PrismaClient for integration tests
 *
 * IMPORTANT: Uses a global singleton PrismaClient to prevent connection pool
 * exhaustion with Supabase pgbouncer. DO NOT create new PrismaClient instances
 * in test files - always use this function.
 *
 * The cleanup function is a no-op for individual tests since the singleton
 * manages its own lifecycle. Connection is shared across all test files.
 */
export function setupIntegrationTest(): IntegrationTestContext {
  // Use global singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();

  // Cleanup is a no-op - singleton manages its own lifecycle
  // Individual tests should NOT disconnect the shared client
  const cleanup = async () => {
    // No-op: singleton PrismaClient is shared across all tests
    // Disconnecting here would break subsequent test files
  };

  return { prisma, cleanup };
}

/**
 * Create multi-tenant test setup with isolated tenant data
 *
 * @param prisma - PrismaClient instance
 * @param fileSlug - Unique identifier for this test file (e.g., 'cache-isolation', 'booking-race')
 * @returns Multi-tenant setup with tenant A and B
 *
 * @example
 * ```typescript
 * const { tenantA, tenantB, cleanupTenants } = createMultiTenantSetup(prisma, 'my-test');
 *
 * beforeEach(async () => {
 *   await cleanupTenants();
 *   await tenantA.create();
 *   await tenantB.create();
 * });
 * ```
 */
export function createMultiTenantSetup(
  prisma: PrismaClient,
  fileSlug: string
): MultiTenantTestSetup {
  const tenantASlug = `${fileSlug}-tenant-a`;
  const tenantBSlug = `${fileSlug}-tenant-b`;

  let tenantA_id = '';
  let tenantB_id = '';
  let tenantA_data: Tenant | null = null;
  let tenantB_data: Tenant | null = null;

  const createTenantA = async (): Promise<Tenant> => {
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantASlug },
      update: { isTestTenant: true },
      create: {
        slug: tenantASlug,
        name: `Test Tenant A (${fileSlug})`,
        apiKeyPublic: `pk_test_${fileSlug}_a`,
        apiKeySecret: `sk_test_${fileSlug}_a_hash`,
        isTestTenant: true,
      },
    });
    tenantA_id = tenant.id;
    tenantA_data = tenant;
    return tenant;
  };

  const createTenantB = async (): Promise<Tenant> => {
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantBSlug },
      update: { isTestTenant: true },
      create: {
        slug: tenantBSlug,
        name: `Test Tenant B (${fileSlug})`,
        apiKeyPublic: `pk_test_${fileSlug}_b`,
        apiKeySecret: `sk_test_${fileSlug}_b_hash`,
        isTestTenant: true,
      },
    });
    tenantB_id = tenant.id;
    tenantB_data = tenant;
    return tenant;
  };

  /**
   * Delete tenant records completely
   *
   * Note: BookingAddOn has onDelete: Restrict for addOnId, so we must
   * manually delete BookingAddOns before cascade can work properly.
   * This prevents test tenants from accumulating in the database.
   */
  const deleteTenants = async (slugs: string[]) => {
    if (slugs.length === 0) return;

    // First, get all tenant IDs for these slugs
    const tenants = await prisma.tenant.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);

    if (tenantIds.length === 0) return;

    // Delete BookingAddOns first (has onDelete: Restrict on addOnId)
    // This must be done before AddOns can be deleted via cascade
    await prisma.bookingAddOn.deleteMany({
      where: {
        booking: {
          tenantId: { in: tenantIds },
        },
      },
    });

    // Now tenant deletion will cascade properly
    await prisma.tenant.deleteMany({
      where: {
        slug: { in: slugs },
      },
    });
  };

  const cleanupTenantA = async () => {
    if (tenantA_id) {
      await deleteTenants([tenantASlug]);
      tenantA_id = '';
      tenantA_data = null;
    }
  };

  const cleanupTenantB = async () => {
    if (tenantB_id) {
      await deleteTenants([tenantBSlug]);
      tenantB_id = '';
      tenantB_data = null;
    }
  };

  /**
   * Clean up all test tenants created by this setup
   * Deletes tenant records completely (ON DELETE CASCADE handles related data)
   */
  const cleanupTenants = async () => {
    await deleteTenants([tenantASlug, tenantBSlug]);
    tenantA_id = '';
    tenantB_id = '';
    tenantA_data = null;
    tenantB_data = null;
  };

  const getTenantIds = () => {
    return [tenantA_id, tenantB_id].filter((id) => id !== '');
  };

  return {
    tenantA: {
      get id() {
        return tenantA_id;
      },
      get data() {
        if (!tenantA_data) {
          throw new Error('Tenant A not created yet. Call tenantA.create() first.');
        }
        return tenantA_data;
      },
      create: createTenantA,
      cleanup: cleanupTenantA,
    },
    tenantB: {
      get id() {
        return tenantB_id;
      },
      get data() {
        if (!tenantB_data) {
          throw new Error('Tenant B not created yet. Call tenantB.create() first.');
        }
        return tenantB_data;
      },
      create: createTenantB,
      cleanup: cleanupTenantB,
    },
    cleanupTenants,
    getTenantIds,
  };
}

/**
 * Create cache test utilities for validating cache isolation
 *
 * Uses InMemoryCacheAdapter (modern async cache interface) instead of
 * legacy CacheService. This ensures test code uses same patterns as production.
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 60) - NOT USED, kept for API compatibility
 * @returns Cache utilities for testing
 *
 * @example
 * ```typescript
 * const { cache, resetStats, verifyCacheKey } = createCacheTestUtils();
 *
 * beforeEach(() => {
 *   resetStats();
 * });
 *
 * it('should have tenant-scoped cache key', async () => {
 *   const key = 'catalog:tenantId:packages';
 *   expect(verifyCacheKey(key, tenantId)).toBe(true);
 * });
 * ```
 */
export function createCacheTestUtils(ttlSeconds = 60): CacheTestUtils {
  const cache = new InMemoryCacheAdapter();

  const verifyCacheKey = (key: string, tenantId: string): boolean => {
    // Cache keys MUST include tenantId in the format: prefix:tenantId:...
    return key.includes(`:${tenantId}:`);
  };

  return {
    cache,
    resetStats: () => cache.resetStats(),
    flush: () => cache.clear(), // InMemoryCacheAdapter uses clear() instead of flush()
    getStats: () => cache.getStats(),
    verifyCacheKey,
  };
}

/**
 * Package factory for creating test packages
 * Generates unique slugs to avoid conflicts in concurrent tests
 */
export class PackageFactory {
  private counter = 0;

  /**
   * Create package input with unique slug
   *
   * @param overrides - Optional overrides for package data
   * @returns Package input ready for repository.createPackage()
   *
   * @example
   * ```typescript
   * const factory = new PackageFactory();
   * const pkg = factory.create({ priceCents: 150000 });
   * await repository.createPackage(tenantId, pkg);
   * ```
   */
  create(overrides: Partial<CreatePackageInput> = {}): CreatePackageInput {
    this.counter++;
    const timestamp = Date.now();
    const uniqueSlug = overrides.slug || `test-package-${this.counter}-${timestamp}`;

    return {
      slug: uniqueSlug,
      title: overrides.title || `Test Package ${this.counter}`,
      description: overrides.description || `Test package description ${this.counter}`,
      priceCents: overrides.priceCents ?? 100000,
      durationMinutes: overrides.durationMinutes ?? 60,
      maxGuests: overrides.maxGuests ?? 50,
      depositCents: overrides.depositCents,
      imageUrl: overrides.imageUrl,
      isActive: overrides.isActive ?? true,
    };
  }

  /**
   * Create multiple packages with incremental naming
   *
   * @param count - Number of packages to create
   * @param baseOverrides - Base overrides applied to all packages
   * @returns Array of package inputs
   *
   * @example
   * ```typescript
   * const factory = new PackageFactory();
   * const packages = factory.createMany(3, { priceCents: 150000 });
   * for (const pkg of packages) {
   *   await repository.createPackage(tenantId, pkg);
   * }
   * ```
   */
  createMany(count: number, baseOverrides: Partial<CreatePackageInput> = {}): CreatePackageInput[] {
    return Array.from({ length: count }, () => this.create(baseOverrides));
  }
}

/**
 * AddOn factory for creating test add-ons
 * Generates unique slugs to avoid conflicts in concurrent tests
 */
export class AddOnFactory {
  private counter = 0;

  /**
   * Create add-on input with unique slug
   *
   * @param overrides - Optional overrides for add-on data
   * @returns AddOn input ready for repository.createAddOn()
   *
   * @example
   * ```typescript
   * const factory = new AddOnFactory();
   * const addOn = factory.create({ priceCents: 5000 });
   * await repository.createAddOn(tenantId, addOn);
   * ```
   */
  create(overrides: Partial<CreateAddOnInput> = {}): CreateAddOnInput {
    this.counter++;
    const timestamp = Date.now();
    const uniqueSlug = overrides.slug || `test-addon-${this.counter}-${timestamp}`;

    return {
      slug: uniqueSlug,
      title: overrides.title || `Test Add-On ${this.counter}`,
      description: overrides.description || `Test add-on description ${this.counter}`,
      priceCents: overrides.priceCents ?? 5000,
      category: overrides.category || 'ENHANCEMENT',
      isActive: overrides.isActive ?? true,
    };
  }

  /**
   * Create multiple add-ons with incremental naming
   *
   * @param count - Number of add-ons to create
   * @param baseOverrides - Base overrides applied to all add-ons
   * @returns Array of add-on inputs
   *
   * @example
   * ```typescript
   * const factory = new AddOnFactory();
   * const addOns = factory.createMany(3, { category: 'ENHANCEMENT' });
   * for (const addOn of addOns) {
   *   await repository.createAddOn(tenantId, addOn);
   * }
   * ```
   */
  createMany(count: number, baseOverrides: Partial<CreateAddOnInput> = {}): CreateAddOnInput[] {
    return Array.from({ length: count }, () => this.create(baseOverrides));
  }
}

/**
 * Wait for a specified duration (useful for timing-sensitive tests)
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * await wait(100); // Wait 100ms for cache TTL
 * ```
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run concurrent operations and return results
 * Useful for testing race conditions and concurrent cache access
 *
 * @param operations - Array of async functions to run concurrently
 * @returns Promise with results from all operations
 *
 * @example
 * ```typescript
 * const results = await runConcurrent([
 *   () => service.getPackages(tenantA_id),
 *   () => service.getPackages(tenantB_id),
 * ]);
 * ```
 */
export async function runConcurrent<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
  return Promise.all(operations.map((op) => op()));
}

/**
 * Assert that cache key follows tenant isolation pattern
 * Throws if cache key doesn't include tenantId prefix
 *
 * @param key - Cache key to validate
 * @param tenantId - Expected tenant ID
 * @throws Error if cache key doesn't follow pattern
 *
 * @example
 * ```typescript
 * assertTenantScopedCacheKey('tenant-123:packages', 'tenant-123'); // ✅ Pass
 * assertTenantScopedCacheKey('packages', 'tenant-123'); // ❌ Throws error
 * ```
 */
export function assertTenantScopedCacheKey(key: string, tenantId: string): void {
  if (!key.startsWith(`${tenantId}:`)) {
    throw new Error(
      `Cache key "${key}" violates tenant isolation pattern. ` +
        `Expected format: "${tenantId}:resource:id". ` +
        `See .claude/CACHE_WARNING.md for security requirements.`
    );
  }
}

/**
 * Complete integration test setup with all utilities
 * Combines database, multi-tenant, and cache setup
 *
 * @param fileSlug - Unique identifier for this test file
 * @param options - Configuration options
 * @returns Complete test context
 *
 * @example
 * ```typescript
 * describe('My Integration Test', () => {
 *   const ctx = setupCompleteIntegrationTest('my-test', { cacheTTL: 60 });
 *
 *   beforeEach(async () => {
 *     await ctx.tenants.cleanupTenants();
 *     await ctx.tenants.tenantA.create();
 *     await ctx.tenants.tenantB.create();
 *     ctx.cache.resetStats();
 *   });
 *
 *   afterEach(async () => {
 *     ctx.cache.flush();
 *     await ctx.cleanup();
 *   });
 * });
 * ```
 */
export function setupCompleteIntegrationTest(
  fileSlug: string,
  options: {
    cacheTTL?: number;
  } = {}
) {
  const { prisma, cleanup: cleanupPrisma } = setupIntegrationTest();
  const tenants = createMultiTenantSetup(prisma, fileSlug);
  const cache = createCacheTestUtils(options.cacheTTL);

  const cleanup = async () => {
    cache.flush();
    await cleanupPrisma();
  };

  return {
    prisma,
    tenants,
    cache,
    cleanup,
    factories: {
      package: new PackageFactory(),
      addOn: new AddOnFactory(),
    },
  };
}
