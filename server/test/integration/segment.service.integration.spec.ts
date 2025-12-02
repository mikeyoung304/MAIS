/**
 * Integration tests for SegmentService
 * Tests business logic, cache behavior, and service-level operations
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { PrismaSegmentRepository } from '../../src/adapters/prisma/segment.repository';
import { SegmentService } from '../../src/services/segment.service';
import { ValidationError, NotFoundError } from '../../src/lib/errors';

describe.sequential('SegmentService Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('segment-service');
  let repository: PrismaSegmentRepository;
  let service: SegmentService;

  beforeAll(async () => {
    repository = new PrismaSegmentRepository(ctx.prisma);
    service = new SegmentService(repository, ctx.cache.cache);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    ctx.cache.flush();
    ctx.cache.resetStats();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ============================================================================
  // BUSINESS LOGIC VALIDATION
  // ============================================================================

  describe('Validation logic', () => {
    it('should validate required fields on create', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: '', // Empty slug - invalid
          name: 'Test',
          heroTitle: 'Title',
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'valid-slug',
          name: '', // Empty name - invalid
          heroTitle: 'Title',
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'valid-slug',
          name: 'Test',
          heroTitle: '', // Empty heroTitle - invalid
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate slug format (lowercase alphanumeric + hyphens only)', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Invalid: uppercase
      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'Invalid-Slug',
          name: 'Test',
          heroTitle: 'Title',
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);

      // Invalid: spaces
      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'invalid slug',
          name: 'Test',
          heroTitle: 'Title',
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);

      // Invalid: special characters
      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'invalid_slug!',
          name: 'Test',
          heroTitle: 'Title',
          sortOrder: 0,
          active: true,
        })
      ).rejects.toThrow(ValidationError);

      // Valid: lowercase alphanumeric with hyphens
      const valid = await service.createSegment({
        tenantId: tenant.id,
        slug: 'valid-slug-123',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      expect(valid.slug).toBe('valid-slug-123');
    });

    it('should enforce unique slug per tenant', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await service.createSegment({
        tenantId: tenant.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Attempt to create duplicate slug
      await expect(
        service.createSegment({
          tenantId: tenant.id,
          slug: 'wellness-retreat',
          name: 'Different Name',
          heroTitle: 'Different Title',
          sortOrder: 1,
          active: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow slug reuse when updating same segment', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await service.createSegment({
        tenantId: tenant.id,
        slug: 'original-slug',
        name: 'Original',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Update with same slug should work
      const updated = await service.updateSegment(tenant.id, segment.id, {
        slug: 'original-slug',
        name: 'Updated Name',
      });

      expect(updated.slug).toBe('original-slug');
      expect(updated.name).toBe('Updated Name');
    });

    it('should prevent slug collision when updating to existing slug', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await service.createSegment({
        tenantId: tenant.id,
        slug: 'slug-one',
        name: 'One',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      const segmentTwo = await service.createSegment({
        tenantId: tenant.id,
        slug: 'slug-two',
        name: 'Two',
        heroTitle: 'Title',
        sortOrder: 1,
        active: true,
      });

      // Attempt to update segment two to use slug-one (already taken)
      await expect(
        service.updateSegment(tenant.id, segmentTwo.id, {
          slug: 'slug-one',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Error handling', () => {
    it('should throw NotFoundError for non-existent segment on getSegmentBySlug', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await expect(
        service.getSegmentBySlug(tenant.id, 'non-existent-slug')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent segment on getSegmentWithRelations', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await expect(
        service.getSegmentWithRelations(tenant.id, 'non-existent-slug')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when updating non-existent segment', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await expect(
        service.updateSegment(tenant.id, 'non-existent-id', { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when deleting non-existent segment', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await expect(
        service.deleteSegment(tenant.id, 'non-existent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // CACHE BEHAVIOR
  // ============================================================================

  describe('Cache behavior', () => {
    it('should cache getSegments results with tenantId-scoped key', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await service.createSegment({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      ctx.cache.resetStats();

      // First call - cache miss
      const result1 = await service.getSegments(tenant.id, true);
      expect(result1).toHaveLength(1);
      expect(ctx.cache.getStats().misses).toBe(1);
      expect(ctx.cache.getStats().hits).toBe(0);

      // Second call - cache hit
      const result2 = await service.getSegments(tenant.id, true);
      expect(result2).toHaveLength(1);
      expect(ctx.cache.getStats().misses).toBe(1);
      expect(ctx.cache.getStats().hits).toBe(1);

      // Cache key should include tenantId
      const cacheKey = `segments:${tenant.id}:active`;
      const cached = await ctx.cache.cache.get(cacheKey);
      expect(cached).toBeTruthy();
    });

    it('should cache getSegmentBySlug results', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await service.createSegment({
        tenantId: tenant.id,
        slug: 'cached-segment',
        name: 'Cached',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      ctx.cache.resetStats();

      // First call - cache miss
      const result1 = await service.getSegmentBySlug(tenant.id, 'cached-segment');
      expect(result1.slug).toBe('cached-segment');
      expect(ctx.cache.getStats().misses).toBe(1);

      // Second call - cache hit
      const result2 = await service.getSegmentBySlug(tenant.id, 'cached-segment');
      expect(result2.slug).toBe('cached-segment');
      expect(ctx.cache.getStats().hits).toBe(1);
    });

    it('should cache getSegmentWithRelations results separately', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await service.createSegment({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      ctx.cache.resetStats();

      // First call - cache miss
      await service.getSegmentWithRelations(tenant.id, 'test-segment');
      expect(ctx.cache.getStats().misses).toBe(1);

      // Second call - cache hit
      await service.getSegmentWithRelations(tenant.id, 'test-segment');
      expect(ctx.cache.getStats().hits).toBe(1);

      // Cache keys should be different for basic and with-relations queries
      const basicKey = `segments:${tenant.id}:slug:test-segment`;
      const relationsKey = `segments:${tenant.id}:slug:test-segment:with-relations`;

      // getSegmentWithRelations should NOT populate basic cache
      const basicCached = await ctx.cache.cache.get(basicKey);
      expect(basicCached).toBeNull();

      // But should populate relations cache
      const relationsCached = await ctx.cache.cache.get(relationsKey);
      expect(relationsCached).toBeTruthy();
    });

    it('should invalidate cache on create', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Populate cache
      await service.getSegments(tenant.id, true);
      const cacheKey = `segments:${tenant.id}:active`;
      expect(await ctx.cache.cache.get(cacheKey)).toBeTruthy();

      // Create new segment - should invalidate cache
      await service.createSegment({
        tenantId: tenant.id,
        slug: 'new-segment',
        name: 'New',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Cache should be invalidated
      expect(await ctx.cache.cache.get(cacheKey)).toBeNull();
    });

    it('should invalidate cache on update', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await service.createSegment({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Populate caches
      await service.getSegments(tenant.id, true);
      await service.getSegmentBySlug(tenant.id, 'test-segment');

      const listKey = `segments:${tenant.id}:active`;
      const slugKey = `segments:${tenant.id}:slug:test-segment`;

      expect(await ctx.cache.cache.get(listKey)).toBeTruthy();
      expect(await ctx.cache.cache.get(slugKey)).toBeTruthy();

      // Update segment - should invalidate caches
      await service.updateSegment(tenant.id, segment.id, { name: 'Updated' });

      expect(await ctx.cache.cache.get(listKey)).toBeNull();
      expect(await ctx.cache.cache.get(slugKey)).toBeNull();
    });

    it('should invalidate cache on delete', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await service.createSegment({
        tenantId: tenant.id,
        slug: 'to-delete',
        name: 'To Delete',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Populate caches
      await service.getSegments(tenant.id, true);
      await service.getSegmentBySlug(tenant.id, 'to-delete');

      const listKey = `segments:${tenant.id}:active`;
      const slugKey = `segments:${tenant.id}:slug:to-delete`;

      expect(await ctx.cache.cache.get(listKey)).toBeTruthy();
      expect(await ctx.cache.cache.get(slugKey)).toBeTruthy();

      // Delete segment - should invalidate caches
      await service.deleteSegment(tenant.id, segment.id);

      expect(await ctx.cache.cache.get(listKey)).toBeNull();
      expect(await ctx.cache.cache.get(slugKey)).toBeNull();
    });

    it('should invalidate both old and new slug caches when updating slug', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await service.createSegment({
        tenantId: tenant.id,
        slug: 'old-slug',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Populate cache for old slug
      await service.getSegmentBySlug(tenant.id, 'old-slug');
      const oldSlugKey = `segments:${tenant.id}:slug:old-slug`;
      expect(await ctx.cache.cache.get(oldSlugKey)).toBeTruthy();

      // Update slug
      await service.updateSegment(tenant.id, segment.id, { slug: 'new-slug' });

      // Old slug cache should be invalidated
      expect(await ctx.cache.cache.get(oldSlugKey)).toBeNull();

      // New slug should not be cached yet (not accessed)
      const newSlugKey = `segments:${tenant.id}:slug:new-slug`;
      expect(await ctx.cache.cache.get(newSlugKey)).toBeNull();
    });
  });

  // ============================================================================
  // MULTI-TENANT CACHE ISOLATION
  // ============================================================================

  describe('Multi-tenant cache isolation', () => {
    it('should isolate segment caches between tenants', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      await service.createSegment({
        tenantId: tenantA.id,
        slug: 'segment-a',
        name: 'Segment A',
        heroTitle: 'Title A',
        sortOrder: 0,
        active: true,
      });

      await service.createSegment({
        tenantId: tenantB.id,
        slug: 'segment-b',
        name: 'Segment B',
        heroTitle: 'Title B',
        sortOrder: 0,
        active: true,
      });

      // Access both caches
      await service.getSegments(tenantA.id, true);
      await service.getSegments(tenantB.id, true);

      // Cache keys should be different
      const cacheKeyA = `segments:${tenantA.id}:active`;
      const cacheKeyB = `segments:${tenantB.id}:active`;

      const cachedA = await ctx.cache.cache.get(cacheKeyA);
      const cachedB = await ctx.cache.cache.get(cacheKeyB);

      expect(cachedA).toBeTruthy();
      expect(cachedB).toBeTruthy();

      // Each cache should only contain their own tenant's data
      expect(cachedA).toHaveLength(1);
      expect(cachedB).toHaveLength(1);
      expect((cachedA as any)[0].tenantId).toBe(tenantA.id);
      expect((cachedB as any)[0].tenantId).toBe(tenantB.id);
    });

    it('should not cross-contaminate caches when creating segments for different tenants', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Populate tenant A cache
      await service.getSegments(tenantA.id, true);
      const cacheKeyA = `segments:${tenantA.id}:active`;
      expect(await ctx.cache.cache.get(cacheKeyA)).toEqual([]);

      // Create segment for tenant B - should NOT invalidate tenant A cache
      await service.createSegment({
        tenantId: tenantB.id,
        slug: 'segment-b',
        name: 'Segment B',
        heroTitle: 'Title B',
        sortOrder: 0,
        active: true,
      });

      // Tenant A cache should still exist (empty array)
      const cachedA = await ctx.cache.cache.get(cacheKeyA);
      expect(cachedA).toEqual([]);
    });
  });

  // ============================================================================
  // GETTERS WITH RELATIONSHIPS
  // ============================================================================

  describe('Segment with relations', () => {
    it('should return segment with packages and add-ons', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await service.createSegment({
        tenantId: tenant.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate',
        sortOrder: 0,
        active: true,
      });

      // Create package for segment
      await ctx.prisma.package.create({
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

      // Create add-on for segment
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

      // Create global add-on (should also be included)
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: null, // Global
          slug: 'farm-meals',
          name: 'Farm-Fresh Meals',
          price: 15000,
          active: true,
        },
      });

      const result = await service.getSegmentWithRelations(tenant.id, 'wellness-retreat');

      expect(result.id).toBe(segment.id);
      expect(result.packages).toBeDefined();
      expect(result.addOns).toBeDefined();
      expect(result.packages).toHaveLength(1);
      expect(result.addOns).toHaveLength(2); // Segment-specific + global
    });
  });
});
