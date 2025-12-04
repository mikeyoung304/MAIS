/**
 * Integration tests for SegmentRepository
 * Tests CRUD operations, multi-tenant isolation, and data integrity
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { PrismaSegmentRepository } from '../../src/adapters/prisma/segment.repository';

describe.sequential('SegmentRepository Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('segment-repository');
  let repository: PrismaSegmentRepository;

  beforeAll(async () => {
    repository = new PrismaSegmentRepository(ctx.prisma);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ============================================================================
  // MULTI-TENANT ISOLATION
  // ============================================================================

  describe('Multi-tenant isolation', () => {
    it('should prevent cross-tenant segment access via findById', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Create segment for tenant A
      const segmentA = await repository.create({
        tenantId: tenantA.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate Your Mind & Body',
        sortOrder: 0,
        active: true,
      });

      // Verify tenant A can access their segment
      const foundByA = await repository.findById(tenantA.id, segmentA.id);
      expect(foundByA).not.toBeNull();
      expect(foundByA?.tenantId).toBe(tenantA.id);

      // CRITICAL: Verify tenant B CANNOT access tenant A's segment
      const foundByB = await repository.findById(tenantB.id, segmentA.id);
      expect(foundByB).toBeNull(); // Cross-tenant access denied

      // Verify tenant B's queries don't return tenant A's segment
      const segmentsB = await repository.findByTenant(tenantB.id, false);
      expect(segmentsB).toHaveLength(0);
      expect(segmentsB.find((s) => s.id === segmentA.id)).toBeUndefined();
    });

    it('should prevent cross-tenant segment updates', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Create segment for tenant A
      const segmentA = await repository.create({
        tenantId: tenantA.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate Your Mind & Body',
        sortOrder: 0,
        active: true,
      });

      // Tenant A can update their segment
      const updated = await repository.update(tenantA.id, segmentA.id, {
        name: 'Updated by Tenant A',
      });
      expect(updated.name).toBe('Updated by Tenant A');

      // CRITICAL: Tenant B CANNOT update tenant A's segment
      await expect(
        repository.update(tenantB.id, segmentA.id, {
          name: 'Malicious update by Tenant B',
        })
      ).rejects.toThrow(/not found or access denied/i);

      // Verify segment was not modified
      const afterAttempt = await repository.findById(tenantA.id, segmentA.id);
      expect(afterAttempt?.name).toBe('Updated by Tenant A'); // Unchanged
    });

    it('should prevent cross-tenant segment deletion', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Create segment for tenant A
      const segmentA = await repository.create({
        tenantId: tenantA.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate Your Mind & Body',
        sortOrder: 0,
        active: true,
      });

      // CRITICAL: Tenant B CANNOT delete tenant A's segment
      await expect(repository.delete(tenantB.id, segmentA.id)).rejects.toThrow(
        /not found or access denied/i
      );

      // Verify segment still exists
      const stillExists = await repository.findById(tenantA.id, segmentA.id);
      expect(stillExists).not.toBeNull();

      // Tenant A can delete their own segment
      await repository.delete(tenantA.id, segmentA.id);
      const deleted = await repository.findById(tenantA.id, segmentA.id);
      expect(deleted).toBeNull();
    });

    it('should prevent cross-tenant stats access', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Create segment for tenant A with packages
      const segmentA = await repository.create({
        tenantId: tenantA.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate Your Mind & Body',
        sortOrder: 0,
        active: true,
      });

      await ctx.prisma.package.create({
        data: {
          tenantId: tenantA.id,
          segmentId: segmentA.id,
          slug: 'package-1',
          name: 'Package 1',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      // Tenant A can access their stats
      const statsA = await repository.getStats(tenantA.id, segmentA.id);
      expect(statsA.packageCount).toBe(1);

      // CRITICAL: Tenant B CANNOT access tenant A's stats
      await expect(repository.getStats(tenantB.id, segmentA.id)).rejects.toThrow(
        /not found or access denied/i
      );
    });

    it('should enforce unique slugs per tenant (different tenants can use same slug)', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Both tenants can use the same slug
      const segmentA = await repository.create({
        tenantId: tenantA.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats A',
        heroTitle: 'Title A',
        sortOrder: 0,
        active: true,
      });

      const segmentB = await repository.create({
        tenantId: tenantB.id,
        slug: 'wellness-retreat', // Same slug, different tenant - should work
        name: 'Wellness Retreats B',
        heroTitle: 'Title B',
        sortOrder: 0,
        active: true,
      });

      expect(segmentA.slug).toBe('wellness-retreat');
      expect(segmentB.slug).toBe('wellness-retreat');
      expect(segmentA.tenantId).toBe(tenantA.id);
      expect(segmentB.tenantId).toBe(tenantB.id);

      // But same tenant cannot use duplicate slug
      const isAvailable = await repository.isSlugAvailable(tenantA.id, 'wellness-retreat');
      expect(isAvailable).toBe(false);
    });

    it('should isolate findBySlug queries to tenant scope', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      await repository.create({
        tenantId: tenantA.id,
        slug: 'micro-wedding',
        name: 'Micro-Weddings',
        heroTitle: 'Intimate Celebrations',
        sortOrder: 0,
        active: true,
      });

      // Tenant A can find by slug
      const foundByA = await repository.findBySlug(tenantA.id, 'micro-wedding');
      expect(foundByA).not.toBeNull();
      expect(foundByA?.tenantId).toBe(tenantA.id);

      // Tenant B cannot find tenant A's segment
      const foundByB = await repository.findBySlug(tenantB.id, 'micro-wedding');
      expect(foundByB).toBeNull();
    });
  });

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  describe('Create operations', () => {
    it('should create segment with all required fields', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await repository.create({
        tenantId: tenant.id,
        slug: 'wellness-retreat',
        name: 'Wellness Retreats',
        heroTitle: 'Rejuvenate Your Mind & Body',
        heroSubtitle: 'Escape to nature',
        heroImage: 'https://example.com/hero.jpg',
        description: 'Extended description for SEO',
        metaTitle: 'Wellness Retreats | Little Bit Farm',
        metaDescription: 'Discover our wellness retreat packages',
        sortOrder: 1,
        active: true,
      });

      expect(segment.id).toBeTruthy();
      expect(segment.tenantId).toBe(tenant.id);
      expect(segment.slug).toBe('wellness-retreat');
      expect(segment.name).toBe('Wellness Retreats');
      expect(segment.heroTitle).toBe('Rejuvenate Your Mind & Body');
      expect(segment.heroSubtitle).toBe('Escape to nature');
      expect(segment.heroImage).toBe('https://example.com/hero.jpg');
      expect(segment.description).toBe('Extended description for SEO');
      expect(segment.metaTitle).toBe('Wellness Retreats | Little Bit Farm');
      expect(segment.metaDescription).toBe('Discover our wellness retreat packages');
      expect(segment.sortOrder).toBe(1);
      expect(segment.active).toBe(true);
      expect(segment.createdAt).toBeInstanceOf(Date);
      expect(segment.updatedAt).toBeInstanceOf(Date);
    });

    it('should create segment with minimal required fields (optional fields as null)', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await repository.create({
        tenantId: tenant.id,
        slug: 'minimal-segment',
        name: 'Minimal Segment',
        heroTitle: 'Hero Title',
        sortOrder: 0,
        active: true,
      });

      expect(segment.id).toBeTruthy();
      expect(segment.heroSubtitle).toBeNull();
      expect(segment.heroImage).toBeNull();
      expect(segment.description).toBeNull();
      expect(segment.metaTitle).toBeNull();
      expect(segment.metaDescription).toBeNull();
    });
  });

  describe('Read operations', () => {
    it('should find segment by ID', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const created = await repository.create({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test Segment',
        heroTitle: 'Test Title',
        sortOrder: 0,
        active: true,
      });

      const found = await repository.findById(tenant.id, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.slug).toBe('test-segment');
    });

    it('should return null for non-existent segment ID', async () => {
      const tenant = await ctx.tenants.tenantA.create();
      const found = await repository.findById(tenant.id, 'non-existent-id');
      expect(found).toBeNull();
    });

    it('should find segments by tenant ordered by sortOrder', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Create segments with different sort orders
      await repository.create({
        tenantId: tenant.id,
        slug: 'third',
        name: 'Third',
        heroTitle: 'Title',
        sortOrder: 2,
        active: true,
      });

      await repository.create({
        tenantId: tenant.id,
        slug: 'first',
        name: 'First',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await repository.create({
        tenantId: tenant.id,
        slug: 'second',
        name: 'Second',
        heroTitle: 'Title',
        sortOrder: 1,
        active: true,
      });

      const segments = await repository.findByTenant(tenant.id, false);

      expect(segments).toHaveLength(3);
      expect(segments[0].slug).toBe('first');
      expect(segments[1].slug).toBe('second');
      expect(segments[2].slug).toBe('third');
    });

    it('should filter inactive segments when onlyActive=true', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await repository.create({
        tenantId: tenant.id,
        slug: 'active-segment',
        name: 'Active',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await repository.create({
        tenantId: tenant.id,
        slug: 'inactive-segment',
        name: 'Inactive',
        heroTitle: 'Title',
        sortOrder: 1,
        active: false,
      });

      const activeOnly = await repository.findByTenant(tenant.id, true);
      const all = await repository.findByTenant(tenant.id, false);

      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0].slug).toBe('active-segment');
      expect(all).toHaveLength(2);
    });
  });

  describe('Update operations', () => {
    it('should update segment fields', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const created = await repository.create({
        tenantId: tenant.id,
        slug: 'original-slug',
        name: 'Original Name',
        heroTitle: 'Original Title',
        sortOrder: 0,
        active: true,
      });

      const updated = await repository.update(tenant.id, created.id, {
        slug: 'updated-slug',
        name: 'Updated Name',
        heroTitle: 'Updated Title',
        heroSubtitle: 'New subtitle',
        sortOrder: 5,
        active: false,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.slug).toBe('updated-slug');
      expect(updated.name).toBe('Updated Name');
      expect(updated.heroTitle).toBe('Updated Title');
      expect(updated.heroSubtitle).toBe('New subtitle');
      expect(updated.sortOrder).toBe(5);
      expect(updated.active).toBe(false);
    });

    it('should partially update segment (only specified fields)', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const created = await repository.create({
        tenantId: tenant.id,
        slug: 'test-slug',
        name: 'Original Name',
        heroTitle: 'Original Title',
        sortOrder: 0,
        active: true,
      });

      const updated = await repository.update(tenant.id, created.id, {
        name: 'Updated Name Only',
      });

      expect(updated.slug).toBe('test-slug'); // Unchanged
      expect(updated.name).toBe('Updated Name Only'); // Changed
      expect(updated.heroTitle).toBe('Original Title'); // Unchanged
    });
  });

  describe('Delete operations', () => {
    it('should delete segment', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const created = await repository.create({
        tenantId: tenant.id,
        slug: 'to-delete',
        name: 'To Delete',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      await repository.delete(tenant.id, created.id);

      const found = await repository.findById(tenant.id, created.id);
      expect(found).toBeNull();
    });

    it('should handle delete of non-existent segment gracefully', async () => {
      const tenant = await ctx.tenants.tenantA.create();
      // Prisma will throw an error, but this tests that it doesn't crash
      await expect(repository.delete(tenant.id, 'non-existent-id')).rejects.toThrow();
    });
  });

  // ============================================================================
  // DATA INTEGRITY
  // ============================================================================

  describe('Data integrity', () => {
    it('should enforce unique slug constraint within tenant', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      await repository.create({
        tenantId: tenant.id,
        slug: 'duplicate-slug',
        name: 'First',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Attempting to create another segment with same slug should fail
      await expect(
        repository.create({
          tenantId: tenant.id,
          slug: 'duplicate-slug',
          name: 'Second',
          heroTitle: 'Title',
          sortOrder: 1,
          active: true,
        })
      ).rejects.toThrow();
    });

    it('should validate slug availability correctly', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Initially available
      const available1 = await repository.isSlugAvailable(tenant.id, 'new-slug');
      expect(available1).toBe(true);

      // Create segment
      const segment = await repository.create({
        tenantId: tenant.id,
        slug: 'new-slug',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Now not available
      const available2 = await repository.isSlugAvailable(tenant.id, 'new-slug');
      expect(available2).toBe(false);

      // But available when excluding current segment (for updates)
      const available3 = await repository.isSlugAvailable(tenant.id, 'new-slug', segment.id);
      expect(available3).toBe(true);
    });

    it('should get accurate segment stats (package and add-on counts)', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await repository.create({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Initially no packages or add-ons
      const stats1 = await repository.getStats(tenant.id, segment.id);
      expect(stats1.packageCount).toBe(0);
      expect(stats1.addOnCount).toBe(0);

      // Create 2 packages linked to segment
      await ctx.prisma.package.create({
        data: {
          id: 'pkg1',
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'package-1',
          name: 'Package 1',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      await ctx.prisma.package.create({
        data: {
          id: 'pkg2',
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'package-2',
          name: 'Package 2',
          description: 'Description',
          basePrice: 20000,
          active: true,
        },
      });

      // Create 1 add-on linked to segment
      await ctx.prisma.addOn.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'addon-1',
          name: 'Add-on 1',
          price: 5000,
          active: true,
        },
      });

      const stats2 = await repository.getStats(tenant.id, segment.id);
      expect(stats2.packageCount).toBe(2);
      expect(stats2.addOnCount).toBe(1);
    });
  });

  // ============================================================================
  // RELATIONSHIP HANDLING
  // ============================================================================

  describe('Package relationship handling (onDelete: SetNull)', () => {
    it('should set package.segmentId to null when segment is deleted', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const segment = await repository.create({
        tenantId: tenant.id,
        slug: 'test-segment',
        name: 'Test',
        heroTitle: 'Title',
        sortOrder: 0,
        active: true,
      });

      // Create package linked to segment
      const pkg = await ctx.prisma.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: 'test-package',
          name: 'Test Package',
          description: 'Description',
          basePrice: 10000,
          active: true,
        },
      });

      expect(pkg.segmentId).toBe(segment.id);

      // Delete segment
      await repository.delete(tenant.id, segment.id);

      // Package should still exist but with null segmentId
      const pkgAfter = await ctx.prisma.package.findUnique({
        where: { id: pkg.id },
      });

      expect(pkgAfter).not.toBeNull();
      expect(pkgAfter?.segmentId).toBeNull();
    });
  });
});
