/**
 * Section Content Repository Tests
 *
 * Integration tests for PrismaSectionContentRepository.
 * Tests use real Prisma with test database.
 *
 * CRITICAL: All tests verify tenant isolation - no cross-tenant data access.
 *
 * @see section-content.repository.ts
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaSectionContentRepository } from './section-content.repository';

// Prisma 7: Use driver adapter for PostgreSQL connections
const adapter = process.env.DATABASE_URL
  ? new PrismaPg({ connectionString: process.env.DATABASE_URL })
  : undefined;

// Test tenant IDs - will be created in beforeAll
let tenant1Id: string;
let tenant2Id: string;
let prisma: PrismaClient;
let repo: PrismaSectionContentRepository;

describe('PrismaSectionContentRepository', () => {
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter });

    // Create test tenants
    const tenant1 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 1',
        slug: `test-section-content-1-${Date.now()}`,
        apiKeyPublic: `pk_test_${Date.now()}_1`,
        apiKeySecret: `sk_test_${Date.now()}_1`,
      },
    });
    tenant1Id = tenant1.id;

    const tenant2 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 2',
        slug: `test-section-content-2-${Date.now()}`,
        apiKeyPublic: `pk_test_${Date.now()}_2`,
        apiKeySecret: `sk_test_${Date.now()}_2`,
      },
    });
    tenant2Id = tenant2.id;

    repo = new PrismaSectionContentRepository(prisma);
  });

  afterAll(async () => {
    // Clean up test data in correct order
    await prisma.sectionContent.deleteMany({
      where: { tenantId: { in: [tenant1Id, tenant2Id] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenant1Id, tenant2Id] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean sections before each test
    await prisma.sectionContent.deleteMany({
      where: { tenantId: { in: [tenant1Id, tenant2Id] } },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('findByBlockType', () => {
    it('should find section by blockType', async () => {
      // Create a section
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Welcome' },
      });

      const section = await repo.findByBlockType(tenant1Id, 'HERO');

      expect(section).not.toBeNull();
      expect(section!.blockType).toBe('HERO');
      expect(section!.content).toEqual({ headline: 'Welcome' });
    });

    it('should return null for non-existent section', async () => {
      const section = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(section).toBeNull();
    });

    it('should find by pageName', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        pageName: 'about',
        content: { headline: 'About Us' },
      });

      const homeSection = await repo.findByBlockType(tenant1Id, 'HERO', 'home');
      expect(homeSection).toBeNull();

      const aboutSection = await repo.findByBlockType(tenant1Id, 'HERO', 'about');
      expect(aboutSection).not.toBeNull();
      expect(aboutSection!.pageName).toBe('about');
    });

    it('should enforce tenant isolation', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Tenant 1' },
      });

      // Tenant 2 should not see Tenant 1's section
      const section = await repo.findByBlockType(tenant2Id, 'HERO');
      expect(section).toBeNull();
    });
  });

  describe('findAllForTenant', () => {
    beforeEach(async () => {
      // Create multiple sections
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Hero' },
        order: 0,
      });
      await repo.upsert(tenant1Id, {
        blockType: 'ABOUT',
        content: { title: 'About' },
        order: 1,
      });
    });

    it('should return all sections for tenant', async () => {
      const sections = await repo.findAllForTenant(tenant1Id);

      expect(sections).toHaveLength(2);
      expect(sections[0].blockType).toBe('HERO');
      expect(sections[1].blockType).toBe('ABOUT');
    });

    it('should return sections ordered by order field', async () => {
      const sections = await repo.findAllForTenant(tenant1Id);

      expect(sections[0].order).toBe(0);
      expect(sections[1].order).toBe(1);
    });

    it('should filter by pageName', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'FAQ',
        pageName: 'faq',
        content: { items: [] },
      });

      const homeSections = await repo.findAllForTenant(tenant1Id, { pageName: 'home' });
      expect(homeSections).toHaveLength(2);

      const faqSections = await repo.findAllForTenant(tenant1Id, { pageName: 'faq' });
      expect(faqSections).toHaveLength(1);
      expect(faqSections[0].blockType).toBe('FAQ');
    });

    it('should filter by draftsOnly', async () => {
      // Publish one section
      const section = await repo.findByBlockType(tenant1Id, 'HERO');
      await repo.publishSection(tenant1Id, section!.id);

      const drafts = await repo.findAllForTenant(tenant1Id, { draftsOnly: true });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].blockType).toBe('ABOUT');

      const published = await repo.findAllForTenant(tenant1Id, { publishedOnly: true });
      expect(published).toHaveLength(1);
      expect(published[0].blockType).toBe('HERO');
    });

    it('should enforce tenant isolation', async () => {
      const sections = await repo.findAllForTenant(tenant2Id);
      expect(sections).toHaveLength(0);
    });
  });

  describe('hasDrafts', () => {
    it('should return true when drafts exist', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      expect(await repo.hasDrafts(tenant1Id)).toBe(true);
    });

    it('should return false when no drafts exist', async () => {
      expect(await repo.hasDrafts(tenant1Id)).toBe(false);
    });

    it('should return false after all sections published', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });
      await repo.publishAll(tenant1Id);

      expect(await repo.hasDrafts(tenant1Id)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('should create new section', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Welcome' },
      });

      expect(section.id).toBeDefined();
      expect(section.tenantId).toBe(tenant1Id);
      expect(section.blockType).toBe('HERO');
      expect(section.isDraft).toBe(true);
      expect(section.content).toEqual({ headline: 'Welcome' });
    });

    it('should update existing section', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Original' },
      });

      const updated = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Updated' },
      });

      expect(updated.content).toEqual({ headline: 'Updated' });
      expect(updated.isDraft).toBe(true);
    });

    it('should save version history on update', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V1' },
      });

      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V2' },
      });

      const section = await repo.findByBlockType(tenant1Id, 'HERO');
      const versions = section!.versions as Array<{ content: unknown }>;

      expect(versions).toHaveLength(1);
      expect(versions[0].content).toEqual({ headline: 'V1' });
    });

    it('should limit version history to 5', async () => {
      // Create initial section
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V1' },
      });

      // Update 6 more times
      for (let i = 2; i <= 7; i++) {
        await repo.upsert(tenant1Id, {
          blockType: 'HERO',
          content: { headline: `V${i}` },
        });
      }

      const section = await repo.findByBlockType(tenant1Id, 'HERO');
      const versions = section!.versions as Array<{ content: unknown }>;

      expect(versions).toHaveLength(5);
      // Most recent previous versions (V6 -> V2)
      expect(versions[0].content).toEqual({ headline: 'V6' });
      expect(versions[4].content).toEqual({ headline: 'V2' });
    });

    it('should support different pages with same blockType', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        pageName: 'home',
        content: { headline: 'Home Hero' },
      });

      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        pageName: 'about',
        content: { headline: 'About Hero' },
      });

      const home = await repo.findByBlockType(tenant1Id, 'HERO', 'home');
      const about = await repo.findByBlockType(tenant1Id, 'HERO', 'about');

      expect(home!.content).toEqual({ headline: 'Home Hero' });
      expect(about!.content).toEqual({ headline: 'About Hero' });
    });
  });

  describe('reorder', () => {
    it('should update section order', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
        order: 0,
      });

      const updated = await repo.reorder(tenant1Id, section.id, 5);

      expect(updated.order).toBe(5);
      expect(updated.isDraft).toBe(true);
    });

    it('should throw for non-existent section', async () => {
      await expect(repo.reorder(tenant1Id, 'nonexistent', 0)).rejects.toThrow();
    });

    it('should enforce tenant isolation', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      // Tenant 2 cannot reorder Tenant 1's section
      await expect(repo.reorder(tenant2Id, section.id, 0)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete section', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await repo.delete(tenant1Id, section.id);

      const found = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(found).toBeNull();
    });

    it('should throw for non-existent section', async () => {
      await expect(repo.delete(tenant1Id, 'nonexistent')).rejects.toThrow();
    });

    it('should enforce tenant isolation', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      // Tenant 2 cannot delete Tenant 1's section
      await expect(repo.delete(tenant2Id, section.id)).rejects.toThrow();

      // Verify section still exists
      const found = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(found).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('publishSection', () => {
    it('should publish a section', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      const published = await repo.publishSection(tenant1Id, section.id);

      expect(published.isDraft).toBe(false);
      expect(published.publishedAt).not.toBeNull();
    });

    it('should be idempotent (already published)', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });
      await repo.publishSection(tenant1Id, section.id);

      // Publish again should not throw
      const published = await repo.publishSection(tenant1Id, section.id);
      expect(published.isDraft).toBe(false);
    });

    it('should throw for non-existent section', async () => {
      await expect(repo.publishSection(tenant1Id, 'nonexistent')).rejects.toThrow();
    });

    it('should enforce tenant isolation', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await expect(repo.publishSection(tenant2Id, section.id)).rejects.toThrow();
    });
  });

  describe('publishAll', () => {
    it('should publish all drafts', async () => {
      await repo.upsert(tenant1Id, { blockType: 'HERO', content: {} });
      await repo.upsert(tenant1Id, { blockType: 'ABOUT', content: {} });

      const result = await repo.publishAll(tenant1Id);

      expect(result.count).toBe(2);
      expect(await repo.hasDrafts(tenant1Id)).toBe(false);
    });

    it('should return 0 when no drafts', async () => {
      const result = await repo.publishAll(tenant1Id);
      expect(result.count).toBe(0);
    });

    it('should not affect other tenant', async () => {
      await repo.upsert(tenant1Id, { blockType: 'HERO', content: {} });
      await repo.upsert(tenant2Id, { blockType: 'ABOUT', content: {} });

      await repo.publishAll(tenant1Id);

      // Tenant 2 still has drafts
      expect(await repo.hasDrafts(tenant2Id)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Discard Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('discardSection', () => {
    it('should delete new section without history', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await repo.discardSection(tenant1Id, section.id);

      const found = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(found).toBeNull();
    });

    it('should restore previous version', async () => {
      // Create initial version
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Original' },
      });

      // Make a change
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Changed' },
      });

      // Discard should restore original
      await repo.discardSection(tenant1Id, section.id);

      const restored = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(restored!.content).toEqual({ headline: 'Original' });
      expect(restored!.isDraft).toBe(false);
    });

    it('should enforce tenant isolation', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await expect(repo.discardSection(tenant2Id, section.id)).rejects.toThrow();
    });
  });

  describe('discardAll', () => {
    it('should discard all drafts', async () => {
      await repo.upsert(tenant1Id, { blockType: 'HERO', content: { v: 1 } });
      await repo.upsert(tenant1Id, { blockType: 'ABOUT', content: { v: 1 } });

      const result = await repo.discardAll(tenant1Id);

      expect(result.count).toBe(2);
      expect(await repo.hasDrafts(tenant1Id)).toBe(false);
    });

    it('should restore sections with history and delete new ones', async () => {
      // Section with history
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Original' },
      });
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'Changed' },
      });

      // New section (no history)
      await repo.upsert(tenant1Id, {
        blockType: 'ABOUT',
        content: {},
      });

      await repo.discardAll(tenant1Id);

      // HERO should be restored
      const hero = await repo.findByBlockType(tenant1Id, 'HERO');
      expect(hero!.content).toEqual({ headline: 'Original' });

      // ABOUT should be deleted
      const about = await repo.findByBlockType(tenant1Id, 'ABOUT');
      expect(about).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Version History
  // ─────────────────────────────────────────────────────────────────────────

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V1' },
      });
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V2' },
      });

      const section = await repo.findByBlockType(tenant1Id, 'HERO');
      const history = await repo.getVersionHistory(tenant1Id, section!.id);

      expect(history).toHaveLength(1);
      expect(history[0].content).toEqual({ headline: 'V1' });
      expect(history[0].timestamp).toBeDefined();
    });

    it('should throw for non-existent section', async () => {
      await expect(repo.getVersionHistory(tenant1Id, 'nonexistent')).rejects.toThrow();
    });

    it('should enforce tenant isolation', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await expect(repo.getVersionHistory(tenant2Id, section.id)).rejects.toThrow();
    });
  });

  describe('restoreVersion', () => {
    it('should restore a previous version', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V1' },
      });
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V2' },
      });
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { headline: 'V3' },
      });

      // Restore V1 (index 1 in history, since V2 is at index 0)
      const restored = await repo.restoreVersion(tenant1Id, section.id, 1);

      expect(restored.content).toEqual({ headline: 'V1' });
      expect(restored.isDraft).toBe(true);
    });

    it('should throw for invalid version index', async () => {
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: {},
      });

      await expect(repo.restoreVersion(tenant1Id, section.id, 0)).rejects.toThrow();
    });

    it('should enforce tenant isolation', async () => {
      await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { v: 1 },
      });
      const section = await repo.upsert(tenant1Id, {
        blockType: 'HERO',
        content: { v: 2 },
      });

      await expect(repo.restoreVersion(tenant2Id, section.id, 0)).rejects.toThrow();
    });
  });
});
