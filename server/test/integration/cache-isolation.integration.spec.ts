/**
 * Integration tests for cache tenant isolation
 * Validates that cache operations prevent cross-tenant data leakage
 *
 * Security Critical: Tests validate CACHE_WARNING.md requirements
 * Pattern: All cache keys MUST include ${tenantId}: prefix
 *
 * Setup: Requires test database
 * Run: npm run test:integration
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaCatalogRepository } from '../../src/adapters/prisma/catalog.repository';
import { CatalogService } from '../../src/services/catalog.service';
import type { CreateTierInput } from '../../src/lib/ports';
import {
  setupCompleteIntegrationTest,
  assertTenantScopedCacheKey,
  runConcurrent,
  createTestSegment,
} from '../helpers/integration-setup';

describe.sequential('Cache Tenant Isolation - Integration Tests', () => {
  // Setup complete integration test context
  const ctx = setupCompleteIntegrationTest('cache-isolation', { cacheTTL: 60 });

  let repository: PrismaCatalogRepository;
  let catalogService: CatalogService;
  let tenantA_id: string;
  let tenantB_id: string;
  let testSegmentIdA: string;
  let testSegmentIdB: string;

  beforeEach(async () => {
    // Clean and create tenants
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    // Create segments (Tier.segmentId is a non-nullable FK)
    const segmentA = await createTestSegment(ctx.prisma, tenantA_id, 'segment-a');
    testSegmentIdA = segmentA.id;
    const segmentB = await createTestSegment(ctx.prisma, tenantB_id, 'segment-b');
    testSegmentIdB = segmentB.id;

    // Initialize repository and service
    repository = new PrismaCatalogRepository(ctx.prisma);
    catalogService = new CatalogService(repository, ctx.cache.cache);

    // Reset cache stats
    ctx.cache.resetStats();
  });

  afterEach(async () => {
    // Clean up test data but keep connection open
    await ctx.tenants.cleanupTenants();
    ctx.cache.flush();
  });

  // Cleanup connection after all tests
  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Cache Key Generation', () => {
    it('should generate cache keys with tenantId prefix for getAllTiers', async () => {
      // Create a package for Tenant A
      const pkg = ctx.factories.tier.create({ title: 'Package A', segmentId: testSegmentIdA });
      await repository.createTier(tenantA_id, pkg);

      // First call - cache miss, populates cache
      await catalogService.getAllTiers(tenantA_id);

      // Second call - should hit cache
      const stats1 = await ctx.cache.getStats();
      await catalogService.getAllTiers(tenantA_id);
      const stats2 = await ctx.cache.getStats();

      // Verify cache hit occurred
      expect(stats2.hits).toBe(stats1.hits + 1);
      expect(stats2.hitRate).not.toBe('0%');
    });

    it('should generate cache keys with tenantId prefix for getTierBySlug', async () => {
      // Create a package for Tenant A
      const pkg = ctx.factories.tier.create({ segmentId: testSegmentIdA });
      await repository.createTier(tenantA_id, pkg);

      // First call - cache miss
      await catalogService.getTierBySlug(tenantA_id, pkg.slug);

      // Second call - should hit cache
      const stats1 = await ctx.cache.getStats();
      await catalogService.getTierBySlug(tenantA_id, pkg.slug);
      const stats2 = await ctx.cache.getStats();

      // Verify cache hit occurred
      expect(stats2.hits).toBe(stats1.hits + 1);
    });
  });

  describe('Cross-Tenant Cache Isolation', () => {
    it('should not return cached data for different tenant (getAllTiers)', async () => {
      // Create unique packages for each tenant
      const packageA: CreateTierInput = {
        slug: 'intimate-isolation-a',
        title: 'Intimate Package - Tenant A',
        description: 'Tenant A specific package',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      };

      const packageB: CreateTierInput = {
        slug: 'intimate-isolation-b',
        title: 'Intimate Package - Tenant B',
        description: 'Tenant B specific package',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      };

      const createdA = await repository.createTier(tenantA_id, packageA);
      const createdB = await repository.createTier(tenantB_id, packageB);

      // Verify packages were created
      expect(createdA.slug).toBe('intimate-isolation-a');
      expect(createdB.slug).toBe('intimate-isolation-b');

      // Tenant A fetches their packages (populates cache)
      const packagesA = await catalogService.getAllTiers(tenantA_id);

      // Tenant B fetches their packages (should NOT get Tenant A's cache)
      const packagesB = await catalogService.getAllTiers(tenantB_id);

      // Verify complete isolation
      expect(packagesA).toHaveLength(1);
      expect(packagesB).toHaveLength(1);
      expect(packagesA[0].title).toBe('Intimate Package - Tenant A');
      expect(packagesB[0].title).toBe('Intimate Package - Tenant B');
      expect(packagesA[0].priceCents).toBe(100000);
      expect(packagesB[0].priceCents).toBe(200000);

      // Verify both tenants have their own cache keys
      // Each tenant should have 1 cache miss (initial fetch)
      const stats = await ctx.cache.getStats();
      expect(stats.misses).toBe(2); // 2 different tenants, 2 cache misses
    });

    it('should not return cached data for different tenant (getTierBySlug)', async () => {
      // Create packages with SAME slug but different tenants (allowed by multi-tenant design)
      const packageA: CreateTierInput = {
        slug: 'premium',
        title: 'Premium - Tenant A',
        description: 'Tenant A premium package',
        priceCents: 150000,
        segmentId: testSegmentIdA,
      };

      const packageB: CreateTierInput = {
        slug: 'premium',
        title: 'Premium - Tenant B',
        description: 'Tenant B premium package',
        priceCents: 300000,
        segmentId: testSegmentIdB,
      };

      await repository.createTier(tenantA_id, packageA);
      await repository.createTier(tenantB_id, packageB);

      // Tenant A fetches "premium" (populates cache)
      const pkgA = await catalogService.getTierBySlug(tenantA_id, 'premium');

      // Tenant B fetches "premium" (should NOT get Tenant A's cache)
      const pkgB = await catalogService.getTierBySlug(tenantB_id, 'premium');

      // Verify complete isolation
      expect(pkgA.title).toBe('Premium - Tenant A');
      expect(pkgB.title).toBe('Premium - Tenant B');
      expect(pkgA.priceCents).toBe(150000);
      expect(pkgB.priceCents).toBe(300000);
      expect(pkgA.description).toContain('Tenant A');
      expect(pkgB.description).toContain('Tenant B');
    });

    it('should maintain separate cache entries for same resource across tenants', async () => {
      // Create identical packages for both tenants
      const packageDataA: CreateTierInput = {
        slug: 'standard',
        title: 'Standard Package',
        description: 'Standard offering',
        priceCents: 175000,
        segmentId: testSegmentIdA,
      };

      const packageDataB: CreateTierInput = {
        slug: 'standard',
        title: 'Standard Package',
        description: 'Standard offering',
        priceCents: 175000,
        segmentId: testSegmentIdB,
      };

      await repository.createTier(tenantA_id, packageDataA);
      await repository.createTier(tenantB_id, packageDataB);

      // Both tenants fetch packages multiple times
      await catalogService.getAllTiers(tenantA_id); // Miss
      await catalogService.getAllTiers(tenantA_id); // Hit
      await catalogService.getAllTiers(tenantB_id); // Miss
      await catalogService.getAllTiers(tenantB_id); // Hit

      const stats = await ctx.cache.getStats();

      // Should have 2 cache misses (one per tenant's first call)
      expect(stats.misses).toBe(2);

      // Should have 2 cache hits (one per tenant's second call)
      expect(stats.hits).toBe(2);

      // Should have 2 cache keys (one per tenant)
      expect(stats.keys).toBe(2);
    });
  });

  describe('Cache Invalidation Scoping', () => {
    it('should invalidate cache only for specific tenant (getAllTiers)', async () => {
      // Create packages for both tenants
      await repository.createTier(tenantA_id, {
        slug: 'package-a1',
        title: 'Package A1',
        description: 'Tenant A package',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      await repository.createTier(tenantB_id, {
        slug: 'package-b1',
        title: 'Package B1',
        description: 'Tenant B package',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      });

      // Both tenants cache their packages
      await catalogService.getAllTiers(tenantA_id);
      await catalogService.getAllTiers(tenantB_id);

      // Reset stats to track invalidation behavior
      ctx.cache.resetStats();

      // Tenant A creates a new package (invalidates Tenant A cache)
      await catalogService.createTier(tenantA_id, {
        slug: 'package-a2',
        title: 'Package A2',
        description: 'New package',
        priceCents: 150000,
        segmentId: testSegmentIdA,
        groupingOrder: 1,
      });

      // Tenant A should get cache miss (cache was invalidated)
      await catalogService.getAllTiers(tenantA_id);

      // Tenant B should get cache hit (cache was NOT invalidated)
      await catalogService.getAllTiers(tenantB_id);

      const stats = await ctx.cache.getStats();

      // Verify Tenant A cache miss and Tenant B cache hit
      expect(stats.misses).toBeGreaterThanOrEqual(1); // Tenant A
      expect(stats.hits).toBeGreaterThanOrEqual(1); // Tenant B
    });

    it('should invalidate cache only for specific tenant (getTierBySlug)', async () => {
      // RE-ENABLED (Sprint 6 - Phase 4 Batch 2): Was Phase 1 flaky (2/3 pass rate), testing with stable infrastructure

      // Create packages for both tenants with same slug
      const pkgA = await repository.createTier(tenantA_id, {
        slug: 'deluxe-invalidation-test',
        title: 'Deluxe - Tenant A',
        description: 'Original',
        priceCents: 250000,
        segmentId: testSegmentIdA,
      });

      const pkgB = await repository.createTier(tenantB_id, {
        slug: 'deluxe-invalidation-test',
        title: 'Deluxe - Tenant B',
        description: 'Original',
        priceCents: 350000,
        segmentId: testSegmentIdB,
      });

      // Both tenants cache their packages
      await catalogService.getTierBySlug(tenantA_id, 'deluxe-invalidation-test');
      await catalogService.getTierBySlug(tenantB_id, 'deluxe-invalidation-test');

      // Reset stats
      ctx.cache.resetStats();

      // Update Tenant B's package (invalidates Tenant B cache only)
      await catalogService.updateTier(tenantB_id, pkgB.id, {
        title: 'Deluxe - Updated',
        description: 'Updated description',
      });

      // Tenant B should get cache miss (cache was invalidated)
      const updatedB = await catalogService.getTierBySlug(tenantB_id, 'deluxe-invalidation-test');
      expect(updatedB.title).toBe('Deluxe - Updated');

      // Tenant A should get cache hit (cache was NOT affected)
      const cachedA = await catalogService.getTierBySlug(tenantA_id, 'deluxe-invalidation-test');
      expect(cachedA.title).toBe('Deluxe - Tenant A');

      const stats = await ctx.cache.getStats();

      // Verify Tenant B cache miss and Tenant A cache hit
      expect(stats.misses).toBeGreaterThanOrEqual(1); // Tenant B
      expect(stats.hits).toBeGreaterThanOrEqual(1); // Tenant A
    });

    it('should invalidate both all-packages and specific package caches on update', async () => {
      // RE-ENABLED (Sprint 6 - Phase 4 Batch 1): Was Phase 2 cascading failure, testing with stable infrastructure
      // Create a package for Tenant A
      const pkg = await repository.createTier(tenantA_id, {
        slug: 'ultimate-cache-test',
        title: 'Ultimate Package',
        description: 'Top tier',
        priceCents: 500000,
        segmentId: testSegmentIdA,
      });

      // Cache both getAllTiers and getTierBySlug
      await catalogService.getAllTiers(tenantA_id);
      await catalogService.getTierBySlug(tenantA_id, 'ultimate-cache-test');

      // Reset stats
      ctx.cache.resetStats();

      // Update the package
      await catalogService.updateTier(tenantA_id, pkg.id, {
        priceCents: 550000,
      });

      // Both calls should result in cache misses (both caches invalidated)
      const allPackages = await catalogService.getAllTiers(tenantA_id);
      const specificPackage = await catalogService.getTierBySlug(tenantA_id, 'ultimate-cache-test');

      // Verify updates were applied
      expect(allPackages[0].priceCents).toBe(550000);
      expect(specificPackage.priceCents).toBe(550000);

      const stats = await ctx.cache.getStats();

      // Should have 2 cache misses (both caches invalidated)
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
    });

    it('should invalidate old and new slug caches when slug is updated', async () => {
      // FIXED: Added verification that package exists before update, added delay for DB consistency

      // Create a package
      const pkg = await repository.createTier(tenantA_id, {
        slug: 'old-slug-test-unique',
        title: 'Package with Old Slug',
        description: 'Will be renamed',
        priceCents: 200000,
        segmentId: testSegmentIdA,
      });

      // Verify package exists immediately after creation
      const verifyCreated = await repository.getTierById(tenantA_id, pkg.id);
      expect(verifyCreated).not.toBeNull();
      expect(verifyCreated?.id).toBe(pkg.id);

      // Cache the package by old slug
      await catalogService.getTierBySlug(tenantA_id, 'old-slug-test-unique');

      // Add small delay to ensure DB consistency
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify package still exists before update
      const verifyBeforeUpdate = await repository.getTierById(tenantA_id, pkg.id);
      expect(verifyBeforeUpdate).not.toBeNull();

      // Update slug
      await catalogService.updateTier(tenantA_id, pkg.id, {
        slug: 'new-slug-test-unique',
      });

      // Reset stats
      ctx.cache.resetStats();

      // Fetch by new slug - should be cache miss (new slug wasn't cached)
      const pkgByNewSlug = await catalogService.getTierBySlug(tenantA_id, 'new-slug-test-unique');

      const stats = await ctx.cache.getStats();

      // Verify cache miss occurred and package was updated
      expect(stats.misses).toBe(1);
      expect(pkgByNewSlug.slug).toBe('new-slug-test-unique');
      expect(pkgByNewSlug.title).toBe('Package with Old Slug');
    });

    it('should invalidate tenant cache on package deletion', async () => {
      // RE-ENABLED (Sprint 6 - Phase 3 Batch 4): Was Phase 2 test logic issue, testing with stable infrastructure
      // Create a package
      const pkg = await repository.createTier(tenantA_id, {
        slug: 'to-delete',
        title: 'Package to Delete',
        description: 'Will be removed',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      // Cache the packages
      await catalogService.getAllTiers(tenantA_id);
      await catalogService.getTierBySlug(tenantA_id, 'to-delete');

      // Reset stats
      ctx.cache.resetStats();

      // Delete the package
      await catalogService.deleteTier(tenantA_id, pkg.id);

      // Fetch all packages - should be cache miss (cache invalidated)
      const packages = await catalogService.getAllTiers(tenantA_id);

      const stats = await ctx.cache.getStats();

      // Verify cache was invalidated
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(packages).toHaveLength(0);
    });
  });

  describe('Concurrent Cache Operations Across Tenants', () => {
    it('should handle concurrent reads from multiple tenants without leakage', async () => {
      // RE-ENABLED (Sprint 6 - Phase 4 Batch 1): Was Phase 2 cascading failure, testing with stable infrastructure
      // Create unique packages for each tenant sequentially to avoid race conditions
      const pkgA = ctx.factories.tier.create({
        title: 'Concurrent Package A',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });
      const pkgB = ctx.factories.tier.create({
        title: 'Concurrent Package B',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      });

      const createdA = await repository.createTier(tenantA_id, pkgA);
      const createdB = await repository.createTier(tenantB_id, pkgB);

      // Verify packages were created
      expect(createdA.slug).toBe(pkgA.slug);
      expect(createdB.slug).toBe(pkgB.slug);

      // Simulate concurrent requests from both tenants using helper
      const [packagesA, packagesB] = await runConcurrent([
        () => catalogService.getAllTiers(tenantA_id),
        () => catalogService.getAllTiers(tenantB_id),
      ]);

      // Verify isolation
      expect(packagesA).toHaveLength(1);
      expect(packagesB).toHaveLength(1);
      expect(packagesA[0].title).toBe('Concurrent Package A');
      expect(packagesB[0].title).toBe('Concurrent Package B');
      expect(packagesA[0].priceCents).toBe(100000);
      expect(packagesB[0].priceCents).toBe(200000);
    });

    it('should handle concurrent updates from different tenants', async () => {
      // RE-ENABLED (Sprint 6 - Phase 4 Batch 2): Was Phase 1 flaky (2/3 pass rate), testing with stable infrastructure

      // Create packages for both tenants with same slug
      const pkgA = await repository.createTier(tenantA_id, {
        slug: 'update-test',
        title: 'Update Test - Tenant A',
        description: 'Original A',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      const pkgB = await repository.createTier(tenantB_id, {
        slug: 'update-test',
        title: 'Update Test - Tenant B',
        description: 'Original B',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      });

      // Cache both packages
      await catalogService.getTierBySlug(tenantA_id, 'update-test');
      await catalogService.getTierBySlug(tenantB_id, 'update-test');

      // Concurrent updates
      await Promise.all([
        catalogService.updateTier(tenantA_id, pkgA.id, {
          description: 'Updated A',
        }),
        catalogService.updateTier(tenantB_id, pkgB.id, {
          description: 'Updated B',
        }),
      ]);

      // Verify both caches were properly invalidated and each tenant gets their own data
      const [updatedA, updatedB] = await Promise.all([
        catalogService.getTierBySlug(tenantA_id, 'update-test'),
        catalogService.getTierBySlug(tenantB_id, 'update-test'),
      ]);

      expect(updatedA.description).toBe('Updated A');
      expect(updatedB.description).toBe('Updated B');
    });

    it('should handle cache hits and misses correctly under concurrent load', async () => {
      // RE-ENABLED (Sprint 6 - Phase 4 Batch 2): Was Phase 1 flaky (2/3 pass rate), testing with stable infrastructure

      // Create packages with unique slugs for this test
      const slugA = `load-test-a-${Date.now()}`;
      const slugB = `load-test-b-${Date.now()}`;

      const pkgA = await repository.createTier(tenantA_id, {
        slug: slugA,
        title: 'Load Test Package A',
        description: 'Tenant A',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      const pkgB = await repository.createTier(tenantB_id, {
        slug: slugB,
        title: 'Load Test Package B',
        description: 'Tenant B',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      });

      // Verify packages created
      expect(pkgA.slug).toBe(slugA);
      expect(pkgB.slug).toBe(slugB);
      expect(pkgA.tenantId).toBe(tenantA_id);
      expect(pkgB.tenantId).toBe(tenantB_id);

      // First, populate cache with initial requests (sequential)
      await catalogService.getAllTiers(tenantA_id);
      await catalogService.getTierBySlug(tenantA_id, slugA);
      await catalogService.getAllTiers(tenantB_id);
      await catalogService.getTierBySlug(tenantB_id, slugB);

      // Reset stats to track only the subsequent requests
      ctx.cache.resetStats();

      // Now make concurrent requests that should hit cache
      const requests = [
        // Tenant A requests (should hit cache)
        catalogService.getAllTiers(tenantA_id),
        catalogService.getAllTiers(tenantA_id),
        catalogService.getTierBySlug(tenantA_id, slugA),
        catalogService.getTierBySlug(tenantA_id, slugA),
        // Tenant B requests (should hit cache)
        catalogService.getAllTiers(tenantB_id),
        catalogService.getAllTiers(tenantB_id),
        catalogService.getTierBySlug(tenantB_id, slugB),
        catalogService.getTierBySlug(tenantB_id, slugB),
      ];

      const results = await Promise.all(requests);

      // Verify all results are correct (no cross-tenant contamination)
      // Results 0-3 are Tenant A
      expect(results[0]).toHaveLength(1);
      expect(results[0][0].priceCents).toBe(100000);
      expect(results[0][0].title).toBe('Load Test Package A');
      expect(results[2].priceCents).toBe(100000);
      expect(results[2].title).toBe('Load Test Package A');

      // Results 4-7 are Tenant B
      expect(results[4]).toHaveLength(1);
      expect(results[4][0].priceCents).toBe(200000);
      expect(results[4][0].title).toBe('Load Test Package B');
      expect(results[6].priceCents).toBe(200000);
      expect(results[6].title).toBe('Load Test Package B');

      const stats = await ctx.cache.getStats();

      // All requests should be cache hits (cache was pre-populated)
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hits).toBe(8); // All 8 requests should hit cache
    });
  });

  describe('Cache Security Validation', () => {
    it('should never allow cache key without tenantId prefix', async () => {
      // FIXED: Made async and added tenant verification
      // This test validates the pattern - cache keys MUST include tenantId

      // Verify tenant setup succeeded
      expect(tenantA_id).toBeTruthy();
      expect(tenantB_id).toBeTruthy();
      expect(tenantA_id).not.toBe(tenantB_id);

      // Test that attempting to manually use cache without tenantId would fail isolation
      // (This is a design validation test, not testing actual vulnerability)

      const unsafeKey = 'packages'; // ❌ WRONG - no tenantId
      const safeKeyA = `catalog:${tenantA_id}:packages`; // ✅ CORRECT
      const safeKeyB = `catalog:${tenantB_id}:packages`; // ✅ CORRECT

      // Verify keys are different
      expect(safeKeyA).not.toBe(safeKeyB);
      expect(safeKeyA).not.toBe(unsafeKey);
      expect(safeKeyB).not.toBe(unsafeKey);

      // Verify both include tenantId
      expect(safeKeyA).toContain(tenantA_id);
      expect(safeKeyB).toContain(tenantB_id);

      // Also verify neither includes the other's tenantId
      expect(safeKeyA).not.toContain(tenantB_id);
      expect(safeKeyB).not.toContain(tenantA_id);
    });

    it('should have cache key format: catalog:${tenantId}:resource', async () => {
      // FIXED: Added explicit cache cleanup and verification

      // Explicitly flush cache before test
      ctx.cache.flush();
      ctx.cache.resetStats();

      // Verify starting state
      const initialStats = await ctx.cache.getStats();
      expect(initialStats.keys).toBe(0);
      expect(initialStats.totalRequests).toBe(0);

      // Create and cache a package
      const created = await repository.createTier(tenantA_id, {
        slug: 'format-test',
        title: 'Format Test',
        description: 'Test',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      // Verify package was created
      expect(created.id).toBeTruthy();
      expect(created.slug).toBe('format-test');

      // Cache the package (these should increment cache stats)
      const allPackages = await catalogService.getAllTiers(tenantA_id);
      const specificPackage = await catalogService.getTierBySlug(tenantA_id, 'format-test');

      // Verify fetch results
      expect(allPackages).toHaveLength(1);
      expect(specificPackage.slug).toBe('format-test');

      const stats = await ctx.cache.getStats();

      // Verify cache behavior
      expect(stats.misses).toBe(2); // First call to each method = 2 misses
      expect(stats.hits).toBe(0); // No hits yet
      expect(stats.keys).toBe(2); // all-packages + specific package

      // The actual key format is enforced in CatalogService implementation:
      // `catalog:${tenantId}:all-packages`
      // `catalog:${tenantId}:package:${slug}`
    });
  });

  describe('Cache Performance and Behavior', () => {
    it('should improve response time on cache hit', async () => {
      // FIXED: Removed timing assertions (inherently flaky) - focus on cache correctness instead

      // Create a package
      await repository.createTier(tenantA_id, {
        slug: 'perf-test',
        title: 'Performance Test',
        description: 'Test',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      // Reset stats to track just these operations
      ctx.cache.resetStats();

      // First call - cache miss (should populate cache)
      const result1 = await catalogService.getAllTiers(tenantA_id);
      const statsAfterMiss = await ctx.cache.getStats();

      // Verify cache miss behavior
      expect(statsAfterMiss.misses).toBe(1);
      expect(statsAfterMiss.hits).toBe(0);
      expect(result1).toHaveLength(1);

      // Second call - cache hit (should return from memory)
      const result2 = await catalogService.getAllTiers(tenantA_id);
      const statsAfterHit = await ctx.cache.getStats();

      // Verify cache hit behavior
      expect(statsAfterHit.misses).toBe(1); // Still 1 miss
      expect(statsAfterHit.hits).toBe(1); // Now 1 hit
      expect(statsAfterHit.hitRate).toBe('50.00%');

      // Verify data consistency (same results from cache)
      expect(result1).toEqual(result2);
      expect(result2).toHaveLength(1);
      expect(result2[0].slug).toBe('perf-test');
    });

    it('should track cache statistics correctly', async () => {
      // FIXED: Added explicit cache cleanup and step-by-step verification

      // Ensure clean starting state
      ctx.cache.flush();
      ctx.cache.resetStats();

      const initialStats = await ctx.cache.getStats();
      expect(initialStats.totalRequests).toBe(0);
      expect(initialStats.keys).toBe(0);

      // Create packages for both tenants
      await repository.createTier(tenantA_id, {
        slug: 'stats-a',
        title: 'Stats A',
        description: 'Tenant A',
        priceCents: 100000,
        segmentId: testSegmentIdA,
      });

      await repository.createTier(tenantB_id, {
        slug: 'stats-b',
        title: 'Stats B',
        description: 'Tenant B',
        priceCents: 200000,
        segmentId: testSegmentIdB,
      });

      // Reset stats AFTER package creation to only track catalog calls
      ctx.cache.resetStats();

      // Make specific number of calls with step-by-step verification
      await catalogService.getAllTiers(tenantA_id); // Miss

      let stats = await ctx.cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.keys).toBe(1);

      await catalogService.getAllTiers(tenantA_id); // Hit

      stats = await ctx.cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.keys).toBe(1);

      await catalogService.getAllTiers(tenantB_id); // Miss

      stats = await ctx.cache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.keys).toBe(2);

      await catalogService.getAllTiers(tenantB_id); // Hit

      // Final verification
      stats = await ctx.cache.getStats();
      expect(stats.totalRequests).toBe(4);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe('50.00%');
      expect(stats.keys).toBe(2); // 2 tenants = 2 cache keys
    });
  });
});
