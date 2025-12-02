/**
 * Integration tests for Catalog segment-scoped methods
 * Tests segment filtering, global vs segment-specific add-ons, and cache behavior
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { PrismaCatalogRepository } from '../../src/adapters/prisma/catalog.repository';
import { PrismaSegmentRepository } from '../../src/adapters/prisma/segment.repository';
import { CatalogService } from '../../src/services/catalog.service';

describe.sequential('Catalog Segment Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('catalog-segment');
  let catalogRepo: PrismaCatalogRepository;
  let segmentRepo: PrismaSegmentRepository;
  let catalogService: CatalogService;

  beforeAll(async () => {
    catalogRepo = new PrismaCatalogRepository(ctx.prisma);
    segmentRepo = new PrismaSegmentRepository(ctx.prisma);
    catalogService = new CatalogService(catalogRepo, ctx.cache.cache);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    ctx.cache.cache.flush();
    ctx.cache.resetStats();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ============================================================================
  // SEGMENT-SCOPED PACKAGE QUERIES
  // ============================================================================

  describe('Segment-scoped package queries', () => {
    it('should return packages for specific segment only', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Create two segments
      const segmentA = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      const segmentB = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wedding',
        name: 'Wedding',
        heroTitle: 'Title',
        sortOrder: 1,
        active: true,
      });

      // Create packages for segment A
      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentA.id,
          slug: 'wellness-pkg-1',
          name: 'Wellness Package 1',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentA.id,
          slug: 'wellness-pkg-2',
          name: 'Wellness Package 2',
          description: 'Description',
          basePrice: 20000,
          active: true,
        },
      });

      // Create package for segment B
      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentB.id,
          slug: 'wedding-pkg-1',
          name: 'Wedding Package 1',
          description: 'Description',
          basePrice: 30000,
          active: true,
        },
      });

      // Query packages for segment A - should only return 2 packages
      const packagesA = await catalogService.getPackagesBySegment(tenant.id, segmentA.id);
      expect(packagesA).toHaveLength(2);
      expect(packagesA.every(p => p.title.startsWith('Wellness'))).toBe(true);

      // Query packages for segment B - should only return 1 package
      const packagesB = await catalogService.getPackagesBySegment(tenant.id, segmentB.id);
      expect(packagesB).toHaveLength(1);
      expect(packagesB[0].title).toBe('Wedding Package 1');
    });

    it('should order packages by groupingOrder then createdAt', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create packages with different groupingOrders
      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'couple-pkg',
          name: 'Couple Package',
          description: 'Description',
          basePrice: 20000,
          grouping: 'Couple',
          groupingOrder: 1,
          active: true,
        },
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'solo-pkg',
          name: 'Solo Package',
          description: 'Description',
          basePrice: 10000,
          grouping: 'Solo',
          groupingOrder: 0,
          active: true,
        },
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'group-pkg',
          name: 'Group Package',
          description: 'Description',
          basePrice: 30000,
          grouping: 'Group',
          groupingOrder: 2,
          active: true,
        },
      });

      const packages = await catalogService.getPackagesBySegment(tenant.id, segment.id);

      expect(packages).toHaveLength(3);
      expect(packages[0].title).toBe('Solo Package');
      expect(packages[1].title).toBe('Couple Package');
      expect(packages[2].title).toBe('Group Package');
    });

    it('should only return active packages', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create active package
      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'active-pkg',
          name: 'Active Package',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      // Create inactive package
      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'inactive-pkg',
          name: 'Inactive Package',
          description: 'Description',
          basePrice: 20000,
          active: false,
        },
      });

      const packages = await catalogService.getPackagesBySegment(tenant.id, segment.id);

      expect(packages).toHaveLength(1);
      expect(packages[0].title).toBe('Active Package');
    });
  });

  // ============================================================================
  // GLOBAL VS SEGMENT-SPECIFIC ADD-ONS
  // ============================================================================

  describe('Global vs segment-specific add-ons', () => {
    it('should return both segment-specific and global add-ons', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create segment-specific add-on
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'yoga-session',
          name: 'Yoga Session',
          price: 7500,
          active: true,
        },
      });

      // Create global add-on (segmentId = null)
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: null,
          slug: 'farm-meals',
          name: 'Farm-Fresh Meals',
          price: 15000,
          active: true,
        },
      });

      // Create add-on for different segment (should NOT be included)
      const otherSegment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wedding',
        name: 'Wedding',
        heroTitle: 'Title',
        sortOrder: 1,
        active: true,
      });

      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: otherSegment.id,
          slug: 'photography',
          name: 'Photography',
          price: 120000,
          active: true,
        },
      });

      const addOns = await catalogService.getAddOnsForSegment(tenant.id, segment.id);

      // Should include wellness-specific (1) + global (1) = 2 total
      expect(addOns).toHaveLength(2);
      expect(addOns.find(a => a.title === 'Yoga Session')).toBeTruthy();
      expect(addOns.find(a => a.title === 'Farm-Fresh Meals')).toBeTruthy();
      expect(addOns.find(a => a.title === 'Photography')).toBeUndefined();
    });

    it('should filter packages with add-ons to show only relevant add-ons', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create package
      const pkg = await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'weekend-detox',
          name: 'Weekend Detox',
          description: 'Description',
          basePrice: 79900,
          active: true,
        },
      });

      // Create add-ons
      const yogaAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'yoga',
          name: 'Yoga Session',
          price: 7500,
          active: true,
        },
      });

      const mealsAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: null, // Global
          slug: 'meals',
          name: 'Farm Meals',
          price: 15000,
          active: true,
        },
      });

      // Link add-ons to package
      await ctx.prisma.packageAddOn.create({
        data: {
          packageId: pkg.id,
          addOnId: yogaAddOn.id,
        },
      });

      await ctx.prisma.packageAddOn.create({
        data: {
          packageId: pkg.id,
          addOnId: mealsAddOn.id,
        },
      });

      const packages = await catalogService.getPackagesBySegmentWithAddOns(tenant.id, segment.id);

      expect(packages).toHaveLength(1);
      expect(packages[0].addOns).toHaveLength(2);
      expect(packages[0].addOns.find(a => a.title === 'Yoga Session')).toBeTruthy();
      expect(packages[0].addOns.find(a => a.title === 'Farm Meals')).toBeTruthy();
    });

    it('should not include inactive add-ons', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create active add-on
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'active-addon',
          name: 'Active Add-on',
          price: 7500,
          active: true,
        },
      });

      // Create inactive add-on
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'inactive-addon',
          name: 'Inactive Add-on',
          price: 15000,
          active: false,
        },
      });

      const addOns = await catalogService.getAddOnsForSegment(tenant.id, segment.id);

      expect(addOns).toHaveLength(1);
      expect(addOns[0].title).toBe('Active Add-on');
    });
  });

  // ============================================================================
  // CACHE BEHAVIOR
  // ============================================================================

  describe('Segment catalog cache behavior', () => {
    it('should cache getPackagesBySegment with tenantId + segmentId key', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-pkg',
          name: 'Test Package',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      ctx.cache.resetStats();

      // First call - cache miss
      await catalogService.getPackagesBySegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).misses).toBe(1);
      expect((await ctx.cache.getStats()).hits).toBe(0);

      // Second call - cache hit
      await catalogService.getPackagesBySegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).misses).toBe(1);
      expect((await ctx.cache.getStats()).hits).toBe(1);

      // Verify cache key format
      const cacheKey = `catalog:${tenant.id}:segment:${segment.id}:packages`;
      const cached = await ctx.cache.cache.get(cacheKey);
      expect(cached).toBeTruthy();
    });

    it('should cache getPackagesBySegmentWithAddOns separately', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-pkg',
          name: 'Test Package',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      ctx.cache.resetStats();

      // Call both methods
      await catalogService.getPackagesBySegment(tenant.id, segment.id);
      await catalogService.getPackagesBySegmentWithAddOns(tenant.id, segment.id);

      // Should have different cache keys
      const packagesKey = `catalog:${tenant.id}:segment:${segment.id}:packages`;
      const withAddOnsKey = `catalog:${tenant.id}:segment:${segment.id}:packages-with-addons`;

      expect(await ctx.cache.cache.get(packagesKey)).toBeTruthy();
      expect(await ctx.cache.cache.get(withAddOnsKey)).toBeTruthy();
    });

    it('should cache getAddOnsForSegment results', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-addon',
          name: 'Test Add-on',
          price: 5000,
          active: true,
        },
      });

      ctx.cache.resetStats();

      // First call - cache miss
      await catalogService.getAddOnsForSegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).misses).toBe(1);

      // Second call - cache hit
      await catalogService.getAddOnsForSegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).hits).toBe(1);

      // Verify cache key
      const cacheKey = `catalog:${tenant.id}:segment:${segment.id}:addons`;
      expect(await ctx.cache.cache.get(cacheKey)).toBeTruthy();
    });
  });

  // ============================================================================
  // MULTI-TENANT ISOLATION
  // ============================================================================

  describe('Multi-tenant isolation for segment catalog', () => {
    it('should isolate packages between tenants even with same segment structure', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Create identical segments for both tenants
      const segmentA = await segmentRepo.create({
        tenantId: tenantA.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      const segmentB = await segmentRepo.create({
        tenantId: tenantB.id,
        slug: 'wellness', // Same slug, different tenant
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create package for tenant A
      await ctx.prisma.package.create({
        data: {
          tenantId: tenantA.id,
          segmentId: segmentA.id,
          slug: 'pkg-a',
          name: 'Package A',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      // Create package for tenant B
      await ctx.prisma.package.create({
        data: {
          tenantId: tenantB.id,
          segmentId: segmentB.id,
          slug: 'pkg-b',
          name: 'Package B',
          description: 'Description',
          basePrice: 20000,
          active: true,
        },
      });

      // Query packages for each tenant
      const packagesA = await catalogService.getPackagesBySegment(tenantA.id, segmentA.id);
      const packagesB = await catalogService.getPackagesBySegment(tenantB.id, segmentB.id);

      // Each tenant should only see their own packages
      expect(packagesA).toHaveLength(1);
      expect(packagesB).toHaveLength(1);
      expect(packagesA[0].title).toBe('Package A');
      expect(packagesB[0].title).toBe('Package B');
      expect(packagesA[0].tenantId).toBe(tenantA.id);
      expect(packagesB[0].tenantId).toBe(tenantB.id);
    });

    it('should isolate cache between tenants for segment catalog', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      const segmentA = await segmentRepo.create({
        tenantId: tenantA.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      const segmentB = await segmentRepo.create({
        tenantId: tenantB.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Populate caches for both tenants
      await catalogService.getPackagesBySegment(tenantA.id, segmentA.id);
      await catalogService.getPackagesBySegment(tenantB.id, segmentB.id);

      // Cache keys should be different
      const cacheKeyA = `catalog:${tenantA.id}:segment:${segmentA.id}:packages`;
      const cacheKeyB = `catalog:${tenantB.id}:segment:${segmentB.id}:packages`;

      expect(cacheKeyA).not.toBe(cacheKeyB);

      const cachedA = await ctx.cache.cache.get(cacheKeyA);
      const cachedB = await ctx.cache.cache.get(cacheKeyB);

      expect(cachedA).toBeTruthy();
      expect(cachedB).toBeTruthy();
    });
  });
});
