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
  // SEGMENT-SCOPED TIER QUERIES
  // ============================================================================

  describe('Segment-scoped tier queries', () => {
    it('should return tiers for specific segment only', async () => {
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

      // Create tiers for segment A
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentA.id,
          slug: 'wellness-pkg-1',
          name: 'Wellness Package 1',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentA.id,
          slug: 'wellness-pkg-2',
          name: 'Wellness Package 2',
          description: 'Description',
          priceCents: 20000,
          sortOrder: 2,
          features: [],
          active: true,
        },
      });

      // Create tier for segment B
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segmentB.id,
          slug: 'wedding-pkg-1',
          name: 'Wedding Package 1',
          description: 'Description',
          priceCents: 30000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Query tiers for segment A - should only return 2 tiers
      const tiersA = await catalogService.getTiersBySegment(tenant.id, segmentA.id);
      expect(tiersA).toHaveLength(2);
      expect(tiersA.every((p) => p.title.startsWith('Wellness'))).toBe(true);

      // Query tiers for segment B - should only return 1 tier
      const tiersB = await catalogService.getTiersBySegment(tenant.id, segmentB.id);
      expect(tiersB).toHaveLength(1);
      expect(tiersB[0].title).toBe('Wedding Package 1');
    });

    it('should order tiers by sortOrder then createdAt', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create tiers with different sortOrders
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'couple-pkg',
          name: 'Couple Package',
          description: 'Description',
          priceCents: 20000,
          sortOrder: 2,
          features: [],
          active: true,
        },
      });

      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'solo-pkg',
          name: 'Solo Package',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'group-pkg',
          name: 'Group Package',
          description: 'Description',
          priceCents: 30000,
          sortOrder: 3,
          features: [],
          active: true,
        },
      });

      const tiers = await catalogService.getTiersBySegment(tenant.id, segment.id);

      expect(tiers).toHaveLength(3);
      expect(tiers[0].title).toBe('Solo Package');
      expect(tiers[1].title).toBe('Couple Package');
      expect(tiers[2].title).toBe('Group Package');
    });

    it('should only return active tiers', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create active tier
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'active-pkg',
          name: 'Active Package',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Create inactive tier
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'inactive-pkg',
          name: 'Inactive Package',
          description: 'Description',
          priceCents: 20000,
          sortOrder: 2,
          features: [],
          active: false,
        },
      });

      const tiers = await catalogService.getTiersBySegment(tenant.id, segment.id);

      expect(tiers).toHaveLength(1);
      expect(tiers[0].title).toBe('Active Package');
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

      // Create a tier to link add-ons to (required - all add-ons must have at least one tier)
      const tier = await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'wellness-pkg',
          name: 'Wellness Package',
          description: 'Test package',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Create segment-specific add-on
      const yogaAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'yoga-session',
          name: 'Yoga Session',
          price: 7500,
          active: true,
        },
      });

      // Link yoga add-on to tier
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: yogaAddOn.id,
        },
      });

      // Create global add-on (segmentId = null)
      const mealsAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: null,
          slug: 'farm-meals',
          name: 'Farm-Fresh Meals',
          price: 15000,
          active: true,
        },
      });

      // Link meals add-on to tier (global means available to all tiers, not tierless)
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: mealsAddOn.id,
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

      // Create tier for other segment
      const otherTier = await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: otherSegment.id,
          slug: 'wedding-pkg',
          name: 'Wedding Package',
          description: 'Test package',
          priceCents: 20000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      const photoAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: otherSegment.id,
          slug: 'photography',
          name: 'Photography',
          price: 120000,
          active: true,
        },
      });

      // Link photography add-on to wedding tier
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: otherTier.id,
          addOnId: photoAddOn.id,
        },
      });

      const addOns = await catalogService.getAddOnsForSegment(tenant.id, segment.id);

      // Should include wellness-specific (1) + global (1) = 2 total
      expect(addOns).toHaveLength(2);
      expect(addOns.find((a) => a.title === 'Yoga Session')).toBeTruthy();
      expect(addOns.find((a) => a.title === 'Farm-Fresh Meals')).toBeTruthy();
      expect(addOns.find((a) => a.title === 'Photography')).toBeUndefined();
    });

    it('should filter tiers with add-ons to show only relevant add-ons', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create tier
      const tier = await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'weekend-detox',
          name: 'Weekend Detox',
          description: 'Description',
          priceCents: 79900,
          sortOrder: 1,
          features: [],
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

      // Link add-ons to tier
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: yogaAddOn.id,
        },
      });

      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: mealsAddOn.id,
        },
      });

      const tiers = await catalogService.getTiersBySegmentWithAddOns(tenant.id, segment.id);

      expect(tiers).toHaveLength(1);
      expect(tiers[0].addOns).toHaveLength(2);
      expect(tiers[0].addOns.find((a) => a.title === 'Yoga Session')).toBeTruthy();
      expect(tiers[0].addOns.find((a) => a.title === 'Farm Meals')).toBeTruthy();
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

      // Create a tier to link add-ons to (required - all add-ons must have at least one tier)
      const tier = await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'wellness-pkg',
          name: 'Wellness Package',
          description: 'Test package',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Create active add-on
      const activeAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'active-addon',
          name: 'Active Add-on',
          price: 7500,
          active: true,
        },
      });

      // Link active add-on to tier
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: activeAddOn.id,
        },
      });

      // Create inactive add-on
      const inactiveAddOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'inactive-addon',
          name: 'Inactive Add-on',
          price: 15000,
          active: false,
        },
      });

      // Link inactive add-on to tier (still needs tier association even if inactive)
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: inactiveAddOn.id,
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
    it('should cache getTiersBySegment with tenantId + segmentId key', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-pkg',
          name: 'Test Package',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      ctx.cache.resetStats();

      // First call - cache miss
      await catalogService.getTiersBySegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).misses).toBe(1);
      expect((await ctx.cache.getStats()).hits).toBe(0);

      // Second call - cache hit
      await catalogService.getTiersBySegment(tenant.id, segment.id);
      expect((await ctx.cache.getStats()).misses).toBe(1);
      expect((await ctx.cache.getStats()).hits).toBe(1);

      // Verify cache key format
      const cacheKey = `catalog:${tenant.id}:segment:${segment.id}:tiers`;
      const cached = await ctx.cache.cache.get(cacheKey);
      expect(cached).toBeTruthy();
    });

    it('should cache getTiersBySegmentWithAddOns separately', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await segmentRepo.create({
        tenantId: tenant.id,
        slug: 'wellness',
        name: 'Wellness',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-pkg',
          name: 'Test Package',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      ctx.cache.resetStats();

      // Call both methods
      await catalogService.getTiersBySegment(tenant.id, segment.id);
      await catalogService.getTiersBySegmentWithAddOns(tenant.id, segment.id);

      // Should have different cache keys
      const tiersKey = `catalog:${tenant.id}:segment:${segment.id}:tiers`;
      const withAddOnsKey = `catalog:${tenant.id}:segment:${segment.id}:tiers-with-addons`;

      expect(await ctx.cache.cache.get(tiersKey)).toBeTruthy();
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

      // Create a tier to link add-on to (required - all add-ons must have at least one tier)
      const tier = await ctx.prisma.tier.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'wellness-pkg',
          name: 'Wellness Package',
          description: 'Test package',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      const addOn = await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-addon',
          name: 'Test Add-on',
          price: 5000,
          active: true,
        },
      });

      // Link add-on to tier
      await ctx.prisma.tierAddOn.create({
        data: {
          tierId: tier.id,
          addOnId: addOn.id,
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
    it('should isolate tiers between tenants even with same segment structure', async () => {
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

      // Create tier for tenant A
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenantA.id,
          segmentId: segmentA.id,
          slug: 'pkg-a',
          name: 'Package A',
          description: 'Description',
          priceCents: 10000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Create tier for tenant B
      await ctx.prisma.tier.create({
        data: {
          tenantId: tenantB.id,
          segmentId: segmentB.id,
          slug: 'pkg-b',
          name: 'Package B',
          description: 'Description',
          priceCents: 20000,
          sortOrder: 1,
          features: [],
          active: true,
        },
      });

      // Query tiers for each tenant
      const tiersA = await catalogService.getTiersBySegment(tenantA.id, segmentA.id);
      const tiersB = await catalogService.getTiersBySegment(tenantB.id, segmentB.id);

      // Each tenant should only see their own tiers
      expect(tiersA).toHaveLength(1);
      expect(tiersB).toHaveLength(1);
      expect(tiersA[0].title).toBe('Package A');
      expect(tiersB[0].title).toBe('Package B');
      expect(tiersA[0].tenantId).toBe(tenantA.id);
      expect(tiersB[0].tenantId).toBe(tenantB.id);
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
      await catalogService.getTiersBySegment(tenantA.id, segmentA.id);
      await catalogService.getTiersBySegment(tenantB.id, segmentB.id);

      // Cache keys should be different
      const cacheKeyA = `catalog:${tenantA.id}:segment:${segmentA.id}:tiers`;
      const cacheKeyB = `catalog:${tenantB.id}:segment:${segmentB.id}:tiers`;

      expect(cacheKeyA).not.toBe(cacheKeyB);

      const cachedA = await ctx.cache.cache.get(cacheKeyA);
      const cachedB = await ctx.cache.cache.get(cacheKeyB);

      expect(cachedA).toBeTruthy();
      expect(cachedB).toBeTruthy();
    });
  });
});
