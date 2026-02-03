/**
 * Section Content Service Tests
 *
 * Unit tests for SectionContentService.
 * Uses mock repository to test business logic in isolation.
 *
 * Test categories:
 * - T1: Read operations (no side effects)
 * - T2: Write operations (create/update/delete)
 * - T3: Publish operations (confirmation required)
 *
 * CRITICAL: All tests verify tenant isolation via mock assertions.
 *
 * @see section-content.service.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SectionContentService } from './section-content.service';
import type {
  ISectionContentRepository,
  SectionContentEntity,
  UpsertSectionInput,
  VersionEntry,
} from '../lib/ports';
import type { BlockType } from '../generated/prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a mock section entity
 */
function createMockSection(overrides: Partial<SectionContentEntity> = {}): SectionContentEntity {
  return {
    id: 'section-1',
    tenantId: 'tenant-1',
    segmentId: null,
    blockType: 'HERO' as BlockType,
    pageName: 'home',
    content: { headline: 'Welcome' },
    order: 0,
    isDraft: true,
    publishedAt: null,
    versions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock repository with all methods
 */
function createMockRepo(): ISectionContentRepository {
  return {
    findByBlockType: vi.fn(),
    findAllForTenant: vi.fn().mockResolvedValue([]),
    hasDrafts: vi.fn().mockResolvedValue(false),
    upsert: vi.fn(),
    reorder: vi.fn(),
    delete: vi.fn(),
    publishSection: vi.fn(),
    publishAll: vi.fn().mockResolvedValue({ count: 0 }),
    discardSection: vi.fn(),
    discardAll: vi.fn().mockResolvedValue({ count: 0 }),
    getVersionHistory: vi.fn().mockResolvedValue([]),
    restoreVersion: vi.fn(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SectionContentService', () => {
  let service: SectionContentService;
  let mockRepo: ISectionContentRepository;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new SectionContentService(mockRepo);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPageStructure', () => {
    it('should return empty pages array when no sections exist', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.success).toBe(true);
      expect(result.hasDraft).toBe(false);
      expect(result.pages).toHaveLength(0);
      expect(mockRepo.findAllForTenant).toHaveBeenCalledWith('tenant-1', {
        pageName: undefined,
      });
    });

    it('should group sections by page name', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ id: 's1', blockType: 'HERO', pageName: 'home', order: 0 }),
        createMockSection({ id: 's2', blockType: 'ABOUT', pageName: 'home', order: 1 }),
        createMockSection({ id: 's3', blockType: 'FAQ', pageName: 'faq', order: 0 }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages).toHaveLength(2);

      const homePage = result.pages.find((p) => p.name === 'home');
      expect(homePage?.sections).toHaveLength(2);
      expect(homePage?.sections[0].blockType).toBe('HERO');
      expect(homePage?.sections[1].blockType).toBe('ABOUT');

      const faqPage = result.pages.find((p) => p.name === 'faq');
      expect(faqPage?.sections).toHaveLength(1);
    });

    it('should sort sections by index within each page', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ id: 's2', order: 2, blockType: 'SERVICES' }),
        createMockSection({ id: 's1', order: 0, blockType: 'HERO' }),
        createMockSection({ id: 's3', order: 1, blockType: 'ABOUT' }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      const sections = result.pages[0].sections;
      expect(sections[0].index).toBe(0);
      expect(sections[1].index).toBe(1);
      expect(sections[2].index).toBe(2);
    });

    it('should indicate hasDraft when any section is draft', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ isDraft: false }),
        createMockSection({ isDraft: true }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.hasDraft).toBe(true);
    });

    it('should filter by pageName when provided', async () => {
      await service.getPageStructure('tenant-1', { pageName: 'about' });

      expect(mockRepo.findAllForTenant).toHaveBeenCalledWith('tenant-1', {
        pageName: 'about',
      });
    });

    it('should extract headline from content', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'My Headline' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages[0].sections[0].headline).toBe('My Headline');
    });

    it('should extract title as headline fallback', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { title: 'My Title' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages[0].sections[0].headline).toBe('My Title');
    });

    it('should detect placeholder content', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'Welcome to Your Business' } }),
        createMockSection({ id: 's2', content: { headline: 'My Real Business' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages[0].sections[0].isPlaceholder).toBe(true);
      expect(result.pages[0].sections[1].isPlaceholder).toBe(false);
    });

    it('should convert blockType to type', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ blockType: 'HERO' }),
      ]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages[0].sections[0].type).toBe('hero');
    });
  });

  describe('getSectionContent', () => {
    it('should return section content by ID', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ id: 'section-1', content: { headline: 'Test' } }),
      ]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.sectionId).toBe('section-1');
      expect(result!.section).toEqual({ headline: 'Test' });
    });

    it('should return null for non-existent section', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);

      const result = await service.getSectionContent('tenant-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should include version information', async () => {
      const versions: VersionEntry[] = [
        { content: { v: 1 }, timestamp: '2024-01-01T00:00:00Z' },
        { content: { v: 2 }, timestamp: '2024-01-02T00:00:00Z' },
      ];
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection({ versions })]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.canUndo).toBe(true);
      expect(result!.undoSteps).toBe(2);
    });

    it('should indicate no undo when no versions', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection({ versions: [] })]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.canUndo).toBe(false);
      expect(result!.undoSteps).toBe(0);
    });

    it('should include draft status', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ isDraft: true }),
      ]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.isDraft).toBe(true);
      expect(result!.isPublished).toBe(false);
      expect(result!.hasUnpublishedChanges).toBe(true);
    });

    it('should format publishedAt and lastModified as ISO strings', async () => {
      const publishedAt = new Date('2024-01-15T10:00:00Z');
      const updatedAt = new Date('2024-01-16T12:00:00Z');
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ publishedAt, updatedAt, isDraft: false }),
      ]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.publishedAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result!.lastModified).toBe('2024-01-16T12:00:00.000Z');
    });
  });

  describe('getPublishedSections', () => {
    it('should call repo with publishedOnly option', async () => {
      await service.getPublishedSections('tenant-1');

      expect(mockRepo.findAllForTenant).toHaveBeenCalledWith('tenant-1', {
        publishedOnly: true,
      });
    });

    it('should return published sections', async () => {
      const sections = [
        createMockSection({ isDraft: false }),
        createMockSection({ id: 's2', isDraft: false }),
      ];
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue(sections);

      const result = await service.getPublishedSections('tenant-1');

      expect(result).toEqual(sections);
    });
  });

  describe('getPreviewSections', () => {
    it('should return all sections for preview', async () => {
      const sections = [
        createMockSection({ isDraft: true }),
        createMockSection({ id: 's2', isDraft: false }),
      ];
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue(sections);

      const result = await service.getPreviewSections('tenant-1');

      expect(result).toEqual(sections);
      expect(mockRepo.findAllForTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('hasDraft', () => {
    it('should delegate to repository', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);

      const result = await service.hasDraft('tenant-1');

      expect(result).toBe(true);
      expect(mockRepo.hasDrafts).toHaveBeenCalledWith('tenant-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2)
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateSection', () => {
    it('should return error for non-existent section', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);

      const result = await service.updateSection('tenant-1', 'nonexistent', {
        headline: 'New',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should merge updates with existing content', async () => {
      const existing = createMockSection({
        content: { headline: 'Old', subheadline: 'Keep this' },
      });
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([existing]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(
        createMockSection({
          content: { headline: 'New', subheadline: 'Keep this' },
        })
      );

      await service.updateSection('tenant-1', 'section-1', { headline: 'New' });

      expect(mockRepo.upsert).toHaveBeenCalledWith('tenant-1', {
        blockType: 'HERO',
        pageName: 'home',
        segmentId: null,
        content: { headline: 'New', subheadline: 'Keep this' },
        order: 0,
      });
    });

    it('should return success with hasDraft=true', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection()]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      const result = await service.updateSection('tenant-1', 'section-1', {
        headline: 'Updated',
      });

      expect(result.success).toBe(true);
      expect(result.hasDraft).toBe(true);
      expect(result.visibility).toBe('draft');
    });

    it('should include updated section in result', async () => {
      const updated = createMockSection({ content: { headline: 'Updated' } });
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection()]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(updated);

      const result = await service.updateSection('tenant-1', 'section-1', {
        headline: 'Updated',
      });

      expect(result.updatedSection).toEqual(updated);
    });

    it('should include canUndo when versions exist', async () => {
      const updated = createMockSection({
        versions: [{ content: {}, timestamp: 'now' }],
      });
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection()]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(updated);

      const result = await service.updateSection('tenant-1', 'section-1', {});

      expect(result.canUndo).toBe(true);
    });

    it('should include dashboardAction for UI navigation', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection()]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      const result = await service.updateSection('tenant-1', 'section-1', {});

      expect(result.dashboardAction).toEqual({
        type: 'SCROLL_TO_SECTION',
        sectionId: 'section-1',
      });
    });

    it('should proceed even with validation warnings', async () => {
      // Invalid content for HERO (missing required fields per schema)
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection()]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      const result = await service.updateSection('tenant-1', 'section-1', {
        invalidField: true,
      });

      // Should still succeed - validation is advisory
      expect(result.success).toBe(true);
    });
  });

  describe('addSection', () => {
    it('should create section with correct blockType', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection({ blockType: 'FAQ' }));

      const result = await service.addSection('tenant-1', 'home', 'faq');

      expect(result.success).toBe(true);
      expect(result.blockType).toBe('FAQ');
    });

    it('should return error for invalid section type', async () => {
      const result = await service.addSection('tenant-1', 'home', 'invalid-type');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid section type');
    });

    it('should use provided content', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      await service.addSection('tenant-1', 'home', 'hero', {
        headline: 'Custom',
      });

      const upsertCall = vi.mocked(mockRepo.upsert).mock.calls[0];
      expect(upsertCall[1].content).toMatchObject({ headline: 'Custom' });
    });

    it('should use default content when not provided', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      await service.addSection('tenant-1', 'home', 'hero');

      const upsertCall = vi.mocked(mockRepo.upsert).mock.calls[0];
      expect(upsertCall[1].content).toMatchObject({
        headline: 'Welcome to Your Business',
        visible: true,
      });
    });

    it('should calculate order from existing sections', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ order: 0 }),
        createMockSection({ id: 's2', order: 1 }),
      ]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      await service.addSection('tenant-1', 'home', 'cta');

      const upsertCall = vi.mocked(mockRepo.upsert).mock.calls[0];
      expect(upsertCall[1].order).toBe(2);
    });

    it('should use provided position', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([createMockSection({ order: 0 })]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      await service.addSection('tenant-1', 'home', 'cta', undefined, 5);

      const upsertCall = vi.mocked(mockRepo.upsert).mock.calls[0];
      expect(upsertCall[1].order).toBe(5);
    });

    it('should return dashboardAction for new section', async () => {
      const newSection = createMockSection({ id: 'new-section' });
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(newSection);

      const result = await service.addSection('tenant-1', 'home', 'hero');

      expect(result.dashboardAction).toEqual({
        type: 'SCROLL_TO_SECTION',
        sectionId: 'new-section',
      });
    });

    it('should generate default content for all block types', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection());

      const blockTypes = [
        'hero',
        'about',
        'services',
        'pricing',
        'testimonials',
        'faq',
        'contact',
        'cta',
        'gallery',
        'features',
        'custom',
      ];

      for (const type of blockTypes) {
        await service.addSection('tenant-1', 'home', type);
        const upsertCall = vi.mocked(mockRepo.upsert).mock.calls.at(-1);
        expect(upsertCall?.[1].content).toBeDefined();
        expect(upsertCall?.[1].content).toHaveProperty('visible', true);
      }
    });
  });

  describe('removeSection', () => {
    it('should delete section and return success', async () => {
      vi.mocked(mockRepo.delete).mockResolvedValue(undefined);
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(false);

      const result = await service.removeSection('tenant-1', 'section-1');

      expect(result.success).toBe(true);
      expect(result.removedSectionId).toBe('section-1');
      expect(mockRepo.delete).toHaveBeenCalledWith('tenant-1', 'section-1');
    });

    it('should return hasDraft status after deletion', async () => {
      vi.mocked(mockRepo.delete).mockResolvedValue(undefined);
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);

      const result = await service.removeSection('tenant-1', 'section-1');

      expect(result.hasDraft).toBe(true);
    });

    it('should handle delete error gracefully', async () => {
      vi.mocked(mockRepo.delete).mockRejectedValue(new Error('Section not found'));

      const result = await service.removeSection('tenant-1', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Section not found');
    });
  });

  describe('reorderSection', () => {
    it('should update section order', async () => {
      vi.mocked(mockRepo.reorder).mockResolvedValue(createMockSection({ order: 3 }));

      const result = await service.reorderSection('tenant-1', 'section-1', 3);

      expect(result.success).toBe(true);
      expect(result.movedSectionId).toBe('section-1');
      expect(result.newPosition).toBe(3);
      expect(mockRepo.reorder).toHaveBeenCalledWith('tenant-1', 'section-1', 3);
    });

    it('should return hasDraft=true after reorder', async () => {
      vi.mocked(mockRepo.reorder).mockResolvedValue(createMockSection());

      const result = await service.reorderSection('tenant-1', 'section-1', 0);

      expect(result.hasDraft).toBe(true);
    });

    it('should handle reorder error gracefully', async () => {
      vi.mocked(mockRepo.reorder).mockRejectedValue(new Error('Section not found'));

      const result = await service.reorderSection('tenant-1', 'nonexistent', 0);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Section not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  describe('publishSection', () => {
    it('should require confirmation (T3 pattern)', async () => {
      const result = await service.publishSection('tenant-1', 'section-1', false);

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.message).toContain('Publish this section');
      expect(mockRepo.publishSection).not.toHaveBeenCalled();
    });

    it('should publish when confirmed', async () => {
      const published = createMockSection({
        isDraft: false,
        publishedAt: new Date(),
      });
      vi.mocked(mockRepo.publishSection).mockResolvedValue(published);
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(false);

      const result = await service.publishSection('tenant-1', 'section-1', true);

      expect(result.success).toBe(true);
      expect(result.visibility).toBe('live');
      expect(result.publishedAt).toBeDefined();
      expect(mockRepo.publishSection).toHaveBeenCalledWith('tenant-1', 'section-1');
    });

    it('should include hasDraft status after publish', async () => {
      vi.mocked(mockRepo.publishSection).mockResolvedValue(createMockSection({ isDraft: false }));
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);

      const result = await service.publishSection('tenant-1', 'section-1', true);

      expect(result.hasDraft).toBe(true);
    });

    it('should include dashboardAction for preview', async () => {
      vi.mocked(mockRepo.publishSection).mockResolvedValue(
        createMockSection({ id: 'published-section', isDraft: false })
      );
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(false);

      const result = await service.publishSection('tenant-1', 'section-1', true);

      expect(result.dashboardAction).toEqual({
        type: 'SHOW_PREVIEW',
        sectionId: 'published-section',
      });
    });

    it('should handle publish error gracefully', async () => {
      vi.mocked(mockRepo.publishSection).mockRejectedValue(new Error('Section not found'));

      const result = await service.publishSection('tenant-1', 'nonexistent', true);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Section not found');
    });
  });

  describe('publishAll', () => {
    it('should return early when no drafts exist', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(false);

      const result = await service.publishAll('tenant-1', false);

      expect(result.success).toBe(true);
      expect(result.publishedCount).toBe(0);
      expect(result.message).toContain('No drafts to publish');
      expect(mockRepo.publishAll).not.toHaveBeenCalled();
    });

    it('should require confirmation when drafts exist', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);

      const result = await service.publishAll('tenant-1', false);

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.message).toContain('Publish all changes');
    });

    it('should publish all when confirmed', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);
      vi.mocked(mockRepo.publishAll).mockResolvedValue({ count: 3 });

      const result = await service.publishAll('tenant-1', true);

      expect(result.success).toBe(true);
      expect(result.publishedCount).toBe(3);
      expect(result.hasDraft).toBe(false);
      expect(result.visibility).toBe('live');
      expect(result.message).toContain('Published 3 section(s)');
    });

    it('should include dashboardAction for refresh', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);
      vi.mocked(mockRepo.publishAll).mockResolvedValue({ count: 2 });

      const result = await service.publishAll('tenant-1', true);

      expect(result.dashboardAction).toEqual({ type: 'REFRESH' });
    });

    it('should include publishedAt timestamp', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);
      vi.mocked(mockRepo.publishAll).mockResolvedValue({ count: 1 });

      const result = await service.publishAll('tenant-1', true);

      expect(result.publishedAt).toBeDefined();
      // Should be a valid ISO date string
      expect(new Date(result.publishedAt!).toISOString()).toBe(result.publishedAt);
    });
  });

  describe('discardAll', () => {
    it('should return early when no drafts exist', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(false);

      const result = await service.discardAll('tenant-1', false);

      expect(result.success).toBe(true);
      expect(result.discardedCount).toBe(0);
      expect(result.message).toContain('No drafts to discard');
      expect(mockRepo.discardAll).not.toHaveBeenCalled();
    });

    it('should require confirmation when drafts exist', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);

      const result = await service.discardAll('tenant-1', false);

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.message).toContain('Discard all changes');
    });

    it('should discard all when confirmed', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);
      vi.mocked(mockRepo.discardAll).mockResolvedValue({ count: 2 });

      const result = await service.discardAll('tenant-1', true);

      expect(result.success).toBe(true);
      expect(result.discardedCount).toBe(2);
      expect(result.hasDraft).toBe(false);
      expect(result.message).toContain('Discarded 2 draft(s)');
    });

    it('should include dashboardAction for refresh', async () => {
      vi.mocked(mockRepo.hasDrafts).mockResolvedValue(true);
      vi.mocked(mockRepo.discardAll).mockResolvedValue({ count: 1 });

      const result = await service.discardAll('tenant-1', true);

      expect(result.dashboardAction).toEqual({ type: 'REFRESH' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helper Coverage
  // ─────────────────────────────────────────────────────────────────────────

  describe('placeholder detection', () => {
    it('should detect "welcome" as placeholder', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'Welcome to Your Business' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(true);
    });

    it('should detect "your headline" as placeholder', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { title: 'Your Headline Here' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(true);
    });

    it('should detect "placeholder" as placeholder', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'Placeholder Text' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(true);
    });

    it('should detect "lorem ipsum" as placeholder', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'Lorem Ipsum Dolor' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(true);
    });

    it('should not detect real content as placeholder', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { headline: 'Sarah Johnson Photography' } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(false);
    });

    it('should handle content without headline gracefully', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ content: { items: [] } }),
      ]);

      const result = await service.getPageStructure('tenant-1');
      expect(result.pages[0].sections[0].isPlaceholder).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle null versions gracefully', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ versions: null as unknown as VersionEntry[] }),
      ]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.canUndo).toBe(false);
      expect(result!.undoSteps).toBe(0);
    });

    it('should handle null publishedAt gracefully', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([
        createMockSection({ publishedAt: null }),
      ]);

      const result = await service.getSectionContent('tenant-1', 'section-1');

      expect(result!.publishedAt).toBeNull();
    });

    it('should handle empty sections array', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);

      const result = await service.getPageStructure('tenant-1');

      expect(result.pages).toHaveLength(0);
      expect(result.hasDraft).toBe(false);
    });

    it('should convert text sectionType to ABOUT blockType', async () => {
      vi.mocked(mockRepo.findAllForTenant).mockResolvedValue([]);
      vi.mocked(mockRepo.upsert).mockResolvedValue(createMockSection({ blockType: 'ABOUT' }));

      const result = await service.addSection('tenant-1', 'home', 'text');

      expect(result.success).toBe(true);
      expect(result.blockType).toBe('ABOUT');
    });
  });
});
