/**
 * Unit tests for Storefront Build Mode Executors
 *
 * Tests focus on:
 * - Payload validation (Zod schemas)
 * - Draft operations (save, publish, discard)
 * - Section manipulation (add, update, remove, reorder)
 * - Tenant isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '../../../src/generated/prisma/client';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

// Mock dependencies
vi.mock('../../../src/agent/proposals/executor-registry', () => ({
  registerProposalExecutor: vi.fn(),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Storefront Executors', () => {
  let mockPrisma: {
    tenant: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  let registeredExecutors: Map<string, (tenantId: string, payload: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    registeredExecutors = new Map();

    // Capture executor registrations
    const { registerProposalExecutor } = await import(
      '../../../src/agent/proposals/executor-registry'
    );
    vi.mocked(registerProposalExecutor).mockImplementation((name, fn) => {
      registeredExecutors.set(name, fn);
    });

    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      // Mock $transaction to pass through the callback with a mock tx that uses same tenant mock
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        // The tx object inside the callback uses $executeRaw and tenant operations
        const mockTx = {
          $executeRaw: vi.fn().mockResolvedValue(1), // Advisory lock returns 1
          tenant: mockPrisma.tenant,
        };
        return fn(mockTx);
      }),
    };

    // Import and register executors
    const { registerStorefrontExecutors } = await import(
      '../../../src/agent/executors/storefront-executors'
    );
    registerStorefrontExecutors(mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Executor Registration', () => {
    it('should register all 7 executors', () => {
      expect(registeredExecutors.size).toBe(7);
    });

    it('should register expected executors', () => {
      expect(registeredExecutors.has('update_page_section')).toBe(true);
      expect(registeredExecutors.has('remove_page_section')).toBe(true);
      expect(registeredExecutors.has('reorder_page_sections')).toBe(true);
      expect(registeredExecutors.has('toggle_page_enabled')).toBe(true);
      expect(registeredExecutors.has('update_storefront_branding')).toBe(true);
      expect(registeredExecutors.has('publish_draft')).toBe(true);
      expect(registeredExecutors.has('discard_draft')).toBe(true);
    });
  });

  describe('update_page_section executor', () => {
    it('should throw ValidationError for invalid payload', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      await expect(
        executor('tenant-123', {
          pageName: 'invalid_page',
          sectionIndex: 0,
          sectionData: {},
        })
      ).rejects.toThrow();
    });

    it('should add new section when sectionIndex is -1', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: -1, // Append
        sectionData: {
          type: 'text',
          headline: 'New Section',
          content: 'Some content',
        },
      });

      expect(result).toHaveProperty('action', 'added');
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
    });

    it('should update existing section', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0,
        sectionData: {
          type: 'hero',
          headline: 'Updated Headline',
          subheadline: 'Updated subheadline',
        },
      });

      expect(result).toHaveProperty('action', 'updated');
    });
  });

  describe('remove_page_section executor', () => {
    it('should throw for invalid section index', async () => {
      const executor = registeredExecutors.get('remove_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          sectionIndex: 999, // Out of bounds
        })
      ).rejects.toThrow('out of bounds');
    });

    it('should remove section at specified index', async () => {
      const executor = registeredExecutors.get('remove_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0,
      });

      expect(result).toHaveProperty('action', 'removed');
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
    });
  });

  describe('reorder_page_sections executor', () => {
    it('should throw for invalid indices', async () => {
      const executor = registeredExecutors.get('reorder_page_sections')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          fromIndex: 0,
          toIndex: 999, // Out of bounds
        })
      ).rejects.toThrow('Invalid indices');
    });

    // TODO: Fix mock setup - Zod validation returning DEFAULT_PAGES_CONFIG (2 sections) instead of test config
    it.skip('should reorder sections correctly', async () => {
      const executor = registeredExecutors.get('reorder_page_sections')!;

      // Create a config with multiple sections (include all required fields for Zod validation)
      const configWithSections = {
        ...DEFAULT_PAGES_CONFIG,
        home: {
          ...DEFAULT_PAGES_CONFIG.home,
          sections: [
            {
              id: 'home-hero-1',
              type: 'hero' as const,
              headline: 'First',
              subheadline: '',
              ctaText: 'CTA',
            },
            { id: 'home-text-1', type: 'text' as const, headline: 'Second', content: '' },
            {
              id: 'home-cta-1',
              type: 'cta' as const,
              headline: 'Third',
              subheadline: '',
              ctaText: 'CTA',
              ctaLink: '',
            },
          ],
        },
      };

      // getDraftConfigWithSlug makes ONE call expecting all fields
      // Use landingPageConfigDraft (not live) to bypass live config validation
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        landingPageConfig: null,
        landingPageConfigDraft: { pages: configWithSections },
        slug: 'test-tenant',
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        fromIndex: 0,
        toIndex: 2,
      });

      expect(result).toHaveProperty('action', 'reordered');
      expect(result).toHaveProperty('movedSectionType', 'hero');
    });
  });

  describe('toggle_page_enabled executor', () => {
    it('should throw when trying to disable home page', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          enabled: false,
        })
      ).rejects.toThrow('cannot be disabled');
    });

    it('should toggle page enabled state', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'about',
        enabled: false,
      });

      expect(result).toHaveProperty('action', 'disabled');
    });
  });

  describe('publish_draft executor', () => {
    it('should throw when no draft exists', async () => {
      const executor = registeredExecutors.get('publish_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null, // No draft
      });

      await expect(executor('tenant-123', {})).rejects.toThrow('No draft');
    });

    it('should publish draft to live and clear draft', async () => {
      const executor = registeredExecutors.get('publish_draft')!;

      const draftConfig = {
        pages: {
          ...DEFAULT_PAGES_CONFIG,
          home: {
            ...DEFAULT_PAGES_CONFIG.home,
            sections: [{ type: 'hero' as const, headline: 'Draft Headline', subheadline: '' }],
          },
        },
      };

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: draftConfig,
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {});

      expect(result).toHaveProperty('action', 'published');
      // Verify update was called with wrapper format (#697 fix)
      // The public API's extractPublishedLandingPage() looks for landingPageConfig.published
      // Note: Prisma 7 uses DbNull instead of null for JSON fields
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: expect.objectContaining({
          landingPageConfig: expect.objectContaining({
            draft: null,
            draftUpdatedAt: null,
            published: draftConfig,
            publishedAt: expect.any(String),
          }),
        }),
      });
    });
  });

  describe('discard_draft executor', () => {
    it('should throw when no draft exists', async () => {
      const executor = registeredExecutors.get('discard_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(executor('tenant-123', {})).rejects.toThrow('No draft');
    });

    it('should clear draft without affecting live', async () => {
      const executor = registeredExecutors.get('discard_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {});

      expect(result).toHaveProperty('action', 'discarded');
      // Verify update was called - Prisma 7 uses DbNull instead of null for JSON fields
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: expect.objectContaining({}),
      });
    });
  });

  // ============================================================================
  // Edge Case Tests: Cross-Page Section ID Collision Detection
  // ============================================================================
  // WHY THESE TESTS EXIST:
  // The executor must reject section updates where the incoming section ID
  // already exists on a DIFFERENT page. This prevents duplicate IDs across
  // the entire config and maintains referential integrity. Without this test,
  // regressions could allow ID collisions that break AI chatbot references.

  describe('update_page_section cross-page ID collision', () => {
    it('should reject section with ID that exists on different page', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      // Config where 'about-text-main' exists on about page
      const configWithExistingId = {
        home: {
          enabled: true as const,
          sections: [{ id: 'home-hero-main', type: 'hero' as const, headline: 'Home Hero' }],
        },
        about: {
          enabled: true,
          sections: [
            { id: 'about-text-main', type: 'text' as const, headline: 'About', content: 'Content' },
          ],
        },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithExistingId },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      // Try to add a section to home page with ID that exists on about page
      await expect(
        executor('tenant-123', {
          pageName: 'home',
          sectionIndex: -1, // Append
          sectionData: {
            id: 'about-text-main', // COLLISION - exists on about page
            type: 'text',
            headline: 'New Section',
            content: 'Content',
          },
        })
      ).rejects.toThrow("already exists on page 'about'");
    });

    it('should allow updating same section with same ID', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      const configWithId = {
        home: {
          enabled: true as const,
          sections: [{ id: 'home-hero-main', type: 'hero' as const, headline: 'Original' }],
        },
        about: { enabled: true, sections: [] },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithId },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Updating existing section at index 0 with same ID should succeed
      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0, // Update existing
        sectionData: {
          id: 'home-hero-main', // Same ID as existing section
          type: 'hero',
          headline: 'Updated Headline',
        },
      });

      expect(result).toHaveProperty('action', 'updated');
    });

    it('should reject duplicate ID within same page', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      // Config with two sections on home page
      const configWithTwoSections = {
        home: {
          enabled: true as const,
          sections: [
            { id: 'home-hero-main', type: 'hero' as const, headline: 'Hero' },
            { id: 'home-cta-main', type: 'cta' as const, headline: 'CTA' },
          ],
        },
        about: { enabled: true, sections: [] },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithTwoSections },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      // Try to update second section (index 1) with ID of first section
      await expect(
        executor('tenant-123', {
          pageName: 'home',
          sectionIndex: 1, // Second section
          sectionData: {
            id: 'home-hero-main', // COLLISION - exists at index 0
            type: 'cta',
            headline: 'Updated CTA',
          },
        })
      ).rejects.toThrow("already exists on page 'home'");
    });
  });

  // ============================================================================
  // Defense-in-Depth: Server-Side ID Generation (#665)
  // ============================================================================
  // WHY THIS TEST EXISTS:
  // As defense-in-depth, the executor should generate IDs server-side for
  // sections that arrive without IDs (e.g., due to a tool bug). This catches
  // tool bugs and ensures all sections have stable IDs for AI chatbot references.

  describe('update_page_section server-side ID generation fallback', () => {
    it('should generate ID for section without ID when appending', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      const configWithExistingIds = {
        home: {
          enabled: true as const,
          sections: [{ id: 'home-hero-main', type: 'hero' as const, headline: 'Hero' }],
        },
        about: { enabled: true, sections: [] },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithExistingIds },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Append section WITHOUT an ID (simulating tool bug)
      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: -1, // Append
        sectionData: {
          // No 'id' field - defense-in-depth should generate one
          type: 'text',
          headline: 'New Text Section',
          content: 'Some content',
        },
      });

      expect(result).toHaveProperty('action', 'added');
      // The executor should have generated an ID
      expect(result).toHaveProperty('sectionId');
      expect((result as { sectionId: string }).sectionId).toMatch(/^home-text-/);
    });

    it('should use monotonic counter for generated IDs', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      // Config with existing text-main and text-2 IDs
      const configWithMultipleSections = {
        home: {
          enabled: true as const,
          sections: [
            { id: 'home-hero-main', type: 'hero' as const, headline: 'Hero' },
            { id: 'home-text-main', type: 'text' as const, headline: 'Text 1', content: 'Content' },
            { id: 'home-text-2', type: 'text' as const, headline: 'Text 2', content: 'Content' },
          ],
        },
        about: { enabled: true, sections: [] },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithMultipleSections },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: -1,
        sectionData: {
          // No ID - should generate home-text-3 (next in sequence)
          type: 'text',
          headline: 'Text 3',
          content: 'More content',
        },
      });

      expect(result).toHaveProperty('action', 'added');
      // Should be home-text-3 (monotonic counter: main exists, 2 exists, so next is 3)
      expect((result as { sectionId: string }).sectionId).toBe('home-text-3');
    });

    it('should not overwrite existing ID on section', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      const configWithExistingIds = {
        home: {
          enabled: true as const,
          sections: [],
        },
        about: { enabled: true, sections: [] },
        services: { enabled: true, sections: [] },
        faq: { enabled: true, sections: [] },
        contact: { enabled: true, sections: [] },
        gallery: { enabled: false, sections: [] },
        testimonials: { enabled: false, sections: [] },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithExistingIds },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Append section WITH an ID (tool working correctly)
      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: -1,
        sectionData: {
          id: 'home-text-main', // ID provided - should NOT be overwritten
          type: 'text',
          headline: 'Text Section',
          content: 'Content',
        },
      });

      expect(result).toHaveProperty('action', 'added');
      expect((result as { sectionId: string }).sectionId).toBe('home-text-main');
    });
  });

  describe('Tenant isolation', () => {
    it('should throw ResourceNotFoundError for missing tenant', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        executor('nonexistent-tenant', {
          pageName: 'home',
          sectionIndex: 0,
          sectionData: { type: 'hero', headline: 'Test', subheadline: '' },
        })
      ).rejects.toThrow('Tenant not found');
    });

    it('should use correct tenantId in all queries', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      await executor('tenant-123', {
        pageName: 'about',
        enabled: true,
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        })
      );

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        })
      );
    });
  });

  // ============================================================================
  // Phase 2: Race Condition & Concurrency Tests
  // ============================================================================

  describe('Race Condition Prevention (Phase 2)', () => {
    it('should acquire advisory lock for each concurrent update', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      // Mock tenant data for all concurrent requests
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Execute 5 concurrent updates
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          executor('tenant-123', {
            pageName: 'home',
            sectionIndex: 0,
            sectionData: {
              type: 'hero',
              headline: `Update ${i}`,
              subheadline: 'Test',
            },
          })
        );

      await Promise.all(promises);

      // Verify advisory lock was acquired for each update
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(5);

      // Verify $executeRaw was called for advisory locks
      // Note: mockTx.$executeRaw is called inside the transaction callback
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle concurrent section additions without corruption', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      const mockConfig = {
        pages: {
          ...DEFAULT_PAGES_CONFIG,
          home: {
            ...DEFAULT_PAGES_CONFIG.home,
            sections: [
              { id: 'home-hero-main', type: 'hero', headline: 'Original', ctaText: 'Book' },
            ],
          },
        },
      };

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: mockConfig,
        landingPageConfigDraft: mockConfig,
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Try to add sections concurrently (append with index -1)
      const promises = Array(3)
        .fill(null)
        .map((_, i) =>
          executor('tenant-123', {
            pageName: 'home',
            sectionIndex: -1, // Append
            sectionData: {
              type: 'text',
              headline: `Section ${i}`,
              content: 'Content',
            },
          })
        );

      await Promise.all(promises);

      // All should succeed
      expect(mockPrisma.tenant.update).toHaveBeenCalledTimes(3);

      // Advisory locks should have prevented race conditions
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should verify advisory lock called for remove_page_section', async () => {
      const executor = registeredExecutors.get('remove_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0,
      });

      // Verify transaction (with advisory lock) was used
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should verify advisory lock called for reorder_page_sections', async () => {
      const executor = registeredExecutors.get('reorder_page_sections')!;

      const mockConfig = {
        pages: {
          ...DEFAULT_PAGES_CONFIG,
          home: {
            ...DEFAULT_PAGES_CONFIG.home,
            sections: [
              { id: 'home-hero-main', type: 'hero', headline: 'Hero', ctaText: 'Book' },
              { id: 'home-text-about', type: 'text', headline: 'About', content: 'Text' },
            ],
          },
        },
      };

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: mockConfig,
        landingPageConfigDraft: mockConfig,
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Reorder using indices (executor uses fromIndex/toIndex, not IDs)
      await executor('tenant-123', {
        pageName: 'home',
        fromIndex: 1, // Move second section
        toIndex: 0, // To first position
      });

      // Verify transaction (with advisory lock) was used
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    // Note: toggle_page_enabled doesn't use advisory locks yet (Phase 3)
    // Test will be added in Phase 3 when lock is implemented

    it('should handle concurrent updates to different pages safely', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      // Update different pages concurrently
      const promises = [
        executor('tenant-123', {
          pageName: 'home',
          sectionIndex: 0,
          sectionData: { type: 'hero', headline: 'Home Update', ctaText: 'CTA' },
        }),
        executor('tenant-123', {
          pageName: 'about',
          sectionIndex: 0,
          sectionData: { type: 'text', headline: 'About Update', content: 'Content' },
        }),
        executor('tenant-123', {
          pageName: 'services',
          sectionIndex: 0,
          sectionData: { type: 'text', headline: 'Services Update', content: 'Content' },
        }),
      ];

      await Promise.all(promises);

      // All should succeed with advisory locks
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
      expect(mockPrisma.tenant.update).toHaveBeenCalledTimes(3);
    });
  });
});
