/**
 * Unit tests for Storefront Build Mode Tools
 *
 * Tests focus on:
 * - Tool metadata (name, trustTier, description, inputSchema)
 * - Validation errors for invalid inputs
 * - Success cases for proposal creation
 * - Tenant isolation (all operations use tenantId from context)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  storefrontTools,
  listSectionIdsTool,
  getSectionByIdTool,
  getUnfilledPlaceholdersTool,
  updatePageSectionTool,
  removePageSectionTool,
  reorderPageSectionsTool,
  togglePageEnabledTool,
  updateStorefrontBrandingTool,
  publishDraftTool,
  discardDraftTool,
  getLandingPageDraftTool,
} from '../../../src/agent/tools/storefront-tools';
import { resolveSectionIndex } from '../../../src/agent/tools/utils';
import type { ToolContext } from '../../../src/agent/tools/types';
import { DEFAULT_PAGES_CONFIG, type PagesConfig } from '@macon/contracts';

// Mock dependencies
vi.mock('../../../src/agent/proposals/proposal.service', () => ({
  ProposalService: vi.fn().mockImplementation(() => ({
    createProposal: vi.fn().mockResolvedValue({
      proposalId: 'prop-123',
      operation: 'test operation',
      preview: {},
      trustTier: 'T2',
      requiresApproval: false,
      expiresAt: new Date(Date.now() + 600000),
    }),
  })),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Storefront Build Mode Tools', () => {
  let mockContext: ToolContext;
  let mockPrisma: {
    tenant: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockContext = {
      tenantId: 'tenant-123',
      sessionId: 'session-456',
      prisma: mockPrisma as unknown as ToolContext['prisma'],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('storefrontTools list', () => {
    it('should include all 11 storefront tools', () => {
      expect(storefrontTools).toHaveLength(11);
    });

    it('should include all expected tools', () => {
      const toolNames = storefrontTools.map((t) => t.name);
      // Discovery tools (T1 - read-only)
      expect(toolNames).toContain('list_section_ids');
      expect(toolNames).toContain('get_section_by_id');
      expect(toolNames).toContain('get_unfilled_placeholders');
      // Write tools
      expect(toolNames).toContain('update_page_section');
      expect(toolNames).toContain('remove_page_section');
      expect(toolNames).toContain('reorder_page_sections');
      expect(toolNames).toContain('toggle_page_enabled');
      expect(toolNames).toContain('update_storefront_branding');
      expect(toolNames).toContain('publish_draft');
      expect(toolNames).toContain('discard_draft');
      expect(toolNames).toContain('get_landing_page_draft');
    });
  });

  describe('update_page_section tool', () => {
    it('should have correct metadata', () => {
      expect(updatePageSectionTool.name).toBe('update_page_section');
      expect(updatePageSectionTool.trustTier).toBe('T2');
      expect(updatePageSectionTool.description).toContain('landing page');
      expect(updatePageSectionTool.inputSchema.required).toContain('pageName');
      expect(updatePageSectionTool.inputSchema.required).toContain('sectionType');
    });

    it('should create proposal for valid section update', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'hero',
        headline: 'Welcome to Our Site',
        subheadline: 'We help you succeed',
      });

      expect(result.success).toBe(true);
      expect(result.proposalId).toBe('prop-123');
    });

    it('should return error for invalid page name', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'invalid_page',
        sectionType: 'hero',
        headline: 'Test',
      });

      // The section validation should fail for invalid page
      expect(result.success).toBe(false);
    });
  });

  describe('remove_page_section tool', () => {
    it('should have correct metadata', () => {
      expect(removePageSectionTool.name).toBe('remove_page_section');
      expect(removePageSectionTool.trustTier).toBe('T2');
      expect(removePageSectionTool.inputSchema.required).toContain('pageName');
      // sectionIndex is no longer required - can use sectionId instead (PREFERRED)
      expect(removePageSectionTool.inputSchema.properties).toHaveProperty('sectionId');
      expect(removePageSectionTool.inputSchema.properties).toHaveProperty('sectionIndex');
    });

    it('should return error for out of bounds section index', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await removePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionIndex: 999, // Way out of bounds
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });
  });

  describe('reorder_page_sections tool', () => {
    it('should have correct metadata', () => {
      expect(reorderPageSectionsTool.name).toBe('reorder_page_sections');
      expect(reorderPageSectionsTool.trustTier).toBe('T1'); // Auto-confirm
      expect(reorderPageSectionsTool.inputSchema.required).toContain('pageName');
      expect(reorderPageSectionsTool.inputSchema.required).toContain('toIndex');
      // fromIndex is now optional (fallback for fromSectionId)
      expect(reorderPageSectionsTool.inputSchema.required).not.toContain('fromIndex');
      // New: fromSectionId is PREFERRED path
      expect(reorderPageSectionsTool.inputSchema.properties).toHaveProperty('fromSectionId');
    });

    it('should return error when from and to are the same', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        fromIndex: 0,
        toIndex: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same');
    });

    it('should resolve fromSectionId to correct index', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      // Move home-hero-main (index 0) to position 1
      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        fromSectionId: 'home-hero-main', // PREFERRED path
        toIndex: 1,
      });

      // Should create proposal successfully
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('proposalId');
    });

    it('should return error when fromSectionId is not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        fromSectionId: 'nonexistent-section',
        toIndex: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('Available IDs');
    });

    it('should return error when fromSectionId is on different page', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      // Try to reorder about-text-main on home page (cross-page error)
      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        fromSectionId: 'about-text-main', // Exists on about page, not home
        toIndex: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('about');
      expect(result.error).toContain('not "home"');
    });

    it('should return error when neither fromSectionId nor fromIndex provided', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        toIndex: 1,
        // Missing both fromSectionId and fromIndex
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('fromSectionId or fromIndex is required');
    });

    it('should use fromIndex when both fromSectionId and fromIndex provided', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      // Provide both - fromIndex takes precedence (explicit value wins)
      // This matches behavior of update_page_section and remove_page_section
      const result = await reorderPageSectionsTool.execute(mockContext, {
        pageName: 'home',
        fromSectionId: 'home-hero-main', // Would resolve to index 0
        fromIndex: 1, // Explicit index used instead
        toIndex: 0,
      });

      // Should create proposal successfully using explicit fromIndex
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('proposalId');
    });
  });

  describe('toggle_page_enabled tool', () => {
    it('should have correct metadata', () => {
      expect(togglePageEnabledTool.name).toBe('toggle_page_enabled');
      expect(togglePageEnabledTool.trustTier).toBe('T1'); // Auto-confirm
      expect(togglePageEnabledTool.inputSchema.required).toContain('pageName');
      expect(togglePageEnabledTool.inputSchema.required).toContain('enabled');
    });

    it('should return error when trying to disable home page', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await togglePageEnabledTool.execute(mockContext, {
        pageName: 'home',
        enabled: false, // Can't disable home
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be disabled');
    });
  });

  describe('update_storefront_branding tool', () => {
    it('should have correct metadata', () => {
      expect(updateStorefrontBrandingTool.name).toBe('update_storefront_branding');
      expect(updateStorefrontBrandingTool.trustTier).toBe('T2');
    });

    it('should return error when no fields provided', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
      });

      const result = await updateStorefrontBrandingTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one branding field');
    });

    it('should return error for invalid hex color', async () => {
      const result = await updateStorefrontBrandingTool.execute(mockContext, {
        primaryColor: 'not-a-color',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('publish_draft tool', () => {
    it('should have correct metadata', () => {
      expect(publishDraftTool.name).toBe('publish_draft');
      // T3 because publishing makes changes live to visitors - high impact
      expect(publishDraftTool.trustTier).toBe('T3');
      expect(publishDraftTool.description).toContain('Publish');
    });

    it('should return error when no draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null, // No draft
      });

      const result = await publishDraftTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No draft');
    });

    it('should create proposal when draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG }, // Has draft
      });

      const result = await publishDraftTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.proposalId).toBe('prop-123');
    });
  });

  describe('discard_draft tool', () => {
    it('should have correct metadata', () => {
      expect(discardDraftTool.name).toBe('discard_draft');
      // T3 because discard is destructive and irreversible - requires explicit user confirmation
      expect(discardDraftTool.trustTier).toBe('T3');
      expect(discardDraftTool.description).toContain('Discard');
    });

    it('should return error when no draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null, // No draft
      });

      const result = await discardDraftTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No draft');
    });
  });

  describe('get_landing_page_draft tool', () => {
    it('should have correct metadata', () => {
      expect(getLandingPageDraftTool.name).toBe('get_landing_page_draft');
      expect(getLandingPageDraftTool.trustTier).toBe('T1'); // Read-only
      expect(getLandingPageDraftTool.description).toContain('draft state');
    });

    it('should return draft state when draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      const result = await getLandingPageDraftTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect((result as { data: { hasDraft: boolean } }).data.hasDraft).toBe(true);
      expect((result as { data: { pages: unknown[] } }).data.pages).toBeDefined();
    });

    it('should return live config when no draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await getLandingPageDraftTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect((result as { data: { hasDraft: boolean } }).data.hasDraft).toBe(false);
    });
  });

  describe('Tenant isolation', () => {
    it('should use tenantId from context in all queries', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await getLandingPageDraftTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        })
      );
    });
  });

  // ============================================================================
  // Discovery Tools (New in Section ID feature)
  // ============================================================================

  describe('list_section_ids tool', () => {
    it('should have correct metadata', () => {
      expect(listSectionIdsTool.name).toBe('list_section_ids');
      expect(listSectionIdsTool.trustTier).toBe('T1'); // Read-only
      expect(listSectionIdsTool.description).toContain('Discover');
      expect(listSectionIdsTool.description).toContain('CALL THIS FIRST');
    });

    it('should return sections with IDs and placeholder flags', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await listSectionIdsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (result as { data: { sections: unknown[]; totalCount: number } }).data;
      expect(data.sections).toBeDefined();
      expect(data.totalCount).toBeGreaterThan(0);
    });

    it('should filter by page name', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await listSectionIdsTool.execute(mockContext, { pageName: 'home' });

      expect(result.success).toBe(true);
      const data = (result as { data: { sections: Array<{ page: string }> } }).data;
      expect(data.sections.every((s) => s.page === 'home')).toBe(true);
    });

    it('should return default sections when no config exists', async () => {
      // First call from getDraftConfigWithSlug
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });
      // Second call for draft/live comparison
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });

      const result = await listSectionIdsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (
        result as { data: { totalCount: number; isShowingDefaults: boolean; note: string } }
      ).data;
      // Now returns DEFAULT_PAGES_CONFIG sections instead of empty
      expect(data.totalCount).toBeGreaterThan(0);
      expect(data.isShowingDefaults).toBe(true);
      expect(data.note).toContain('DEFAULT template');
    });
  });

  describe('get_section_by_id tool', () => {
    it('should have correct metadata', () => {
      expect(getSectionByIdTool.name).toBe('get_section_by_id');
      expect(getSectionByIdTool.trustTier).toBe('T1'); // Read-only
      expect(getSectionByIdTool.inputSchema.required).toContain('sectionId');
    });

    it('should return section content when ID exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      // home-hero-main exists in DEFAULT_PAGES_CONFIG
      const result = await getSectionByIdTool.execute(mockContext, {
        sectionId: 'home-hero-main',
      });

      expect(result.success).toBe(true);
      const data = (result as { data: { section: { type: string }; page: string } }).data;
      expect(data.section).toBeDefined();
      expect(data.section.type).toBe('hero');
      expect(data.page).toBe('home');
    });

    it('should return error with available IDs when section not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await getSectionByIdTool.execute(mockContext, {
        sectionId: 'nonexistent-section-id',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('Available sections');
    });
  });

  // ============================================================================
  // Edge Case Tests: Cross-Page Section ID Detection
  // ============================================================================
  // WHY THESE TESTS EXIST:
  // When a user provides a sectionId that exists in the config but on a different
  // page than pageName, we need to return a helpful error message pointing them
  // to the correct page. Without these tests, regressions could break this UX.

  describe('update_page_section cross-page sectionId error', () => {
    it('should return helpful error when sectionId exists on different page', async () => {
      // Setup: about-text-main exists on about page, user tries to use it on home page
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [{ id: 'home-hero-main', type: 'hero', headline: 'Test' }],
            },
            about: {
              enabled: true,
              sections: [
                { id: 'about-text-main', type: 'text', headline: 'About', content: 'Content' },
              ],
            },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionId: 'about-text-main', // Exists on about, not home
        sectionType: 'text',
        content: 'Updated content',
      });

      expect(result.success).toBe(false);
      // Error should tell user where the section actually is
      expect(result.error).toContain('exists on page');
      expect(result.error).toContain('"about"');
      expect(result.error).toContain('not "home"');
    });

    it('should succeed when sectionId is on correct page', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [{ id: 'home-hero-main', type: 'hero', headline: 'Test' }],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionId: 'home-hero-main', // Correct page
        sectionType: 'hero',
        headline: 'Updated headline',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('remove_page_section cross-page sectionId error', () => {
    it('should return helpful error when sectionId exists on different page', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [{ id: 'home-hero-main', type: 'hero', headline: 'Test' }],
            },
            faq: {
              enabled: true,
              sections: [{ id: 'faq-faq-main', type: 'faq', headline: 'FAQ', items: [] }],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await removePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionId: 'faq-faq-main', // Exists on faq, not home
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exists on page');
      expect(result.error).toContain('"faq"');
    });
  });

  // ============================================================================
  // Edge Case Tests: Legacy ID Generation
  // ============================================================================
  // WHY THESE TESTS EXIST:
  // Existing tenant configs may have sections without IDs (pre-migration data).
  // Discovery tools generate synthetic IDs in format "${page}-${type}-legacy"
  // for backward compatibility. These tests prevent regressions in that fallback.

  describe('list_section_ids legacy ID generation', () => {
    it('should generate legacy ID for sections without ID field', async () => {
      // Setup: section has no id field (legacy data)
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [
                { type: 'hero', headline: 'No ID Hero' }, // No id field
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await listSectionIdsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (
        result as { data: { sections: Array<{ id: string; page: string; type: string }> } }
      ).data;

      // Should find the legacy section with generated ID
      const legacySection = data.sections.find((s) => s.page === 'home' && s.type === 'hero');
      expect(legacySection).toBeDefined();
      expect(legacySection!.id).toBe('home-hero-legacy');
    });

    it('should use actual ID when section has id field', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [{ id: 'home-hero-main', type: 'hero', headline: 'Has ID' }],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await listSectionIdsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (result as { data: { sections: Array<{ id: string }> } }).data;
      const heroSection = data.sections.find((s) => s.id === 'home-hero-main');
      expect(heroSection).toBeDefined();
    });
  });

  describe('get_section_by_id legacy ID lookup', () => {
    it('should find section by legacy ID when section has no id field', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [
                { type: 'hero', headline: 'Legacy Hero', subheadline: 'No ID' }, // No id field
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await getSectionByIdTool.execute(mockContext, {
        sectionId: 'home-hero-legacy', // Legacy format
      });

      expect(result.success).toBe(true);
      const data = (result as { data: { section: { headline: string }; page: string } }).data;
      expect(data.section.headline).toBe('Legacy Hero');
      expect(data.page).toBe('home');
    });
  });

  describe('get_unfilled_placeholders legacy ID handling', () => {
    it('should use legacy ID format in unfilled items list', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: {
          pages: {
            home: {
              enabled: true,
              sections: [
                { type: 'hero', headline: '[Placeholder Headline]' }, // No id, has placeholder
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        },
        landingPageConfigDraft: null,
      });

      const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (result as { data: { unfilledItems: Array<{ sectionId: string }> } }).data;
      expect(data.unfilledItems.length).toBeGreaterThan(0);
      // The unfilled section should have legacy ID format
      const heroPlaceholder = data.unfilledItems.find((p) => p.sectionId === 'home-hero-legacy');
      expect(heroPlaceholder).toBeDefined();
    });
  });

  describe('get_unfilled_placeholders tool', () => {
    it('should have correct metadata', () => {
      expect(getUnfilledPlaceholdersTool.name).toBe('get_unfilled_placeholders');
      expect(getUnfilledPlaceholdersTool.trustTier).toBe('T1'); // Read-only
      expect(getUnfilledPlaceholdersTool.description).toContain('placeholder');
    });

    it('should detect placeholder content in sections', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (result as { data: { unfilledCount: number; percentComplete: number } }).data;
      // DEFAULT_PAGES_CONFIG has [Placeholder] content
      expect(data.unfilledCount).toBeGreaterThan(0);
      expect(data.percentComplete).toBeDefined();
    });

    it('should return 100% complete when no placeholders', async () => {
      // Config with real content (no [Bracket] placeholders)
      const filledConfig = {
        pages: {
          home: {
            enabled: true as const,
            sections: [
              {
                id: 'home-hero-main',
                type: 'hero',
                headline: 'Real Headline',
                subheadline: 'Real subheadline',
                ctaText: 'Book Now',
              },
            ],
          },
          about: { enabled: true, sections: [] },
          services: { enabled: true, sections: [] },
          faq: { enabled: true, sections: [] },
          contact: { enabled: true, sections: [] },
          gallery: { enabled: false, sections: [] },
          testimonials: { enabled: false, sections: [] },
        },
      };

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: filledConfig,
        landingPageConfigDraft: null,
      });

      const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      const data = (result as { data: { unfilledCount: number; summary: string } }).data;
      expect(data.unfilledCount).toBe(0);
      expect(data.summary).toContain('Ready to publish');
    });
  });
});

// ============================================================================
// Shared Helper Tests: resolveSectionIndex
// ============================================================================
// DRY implementation tested in isolation to ensure consistency across all tools
// that use it (update_page_section, remove_page_section, reorder_page_sections)

describe('resolveSectionIndex helper', () => {
  const testPages: PagesConfig = {
    home: {
      enabled: true,
      sections: [
        { id: 'home-hero-main', type: 'hero', headline: 'Hero' },
        { id: 'home-cta-main', type: 'cta', headline: 'CTA', ctaText: 'Click' },
      ],
    },
    about: {
      enabled: true,
      sections: [{ id: 'about-text-main', type: 'text', headline: 'About', content: 'Content' }],
    },
    services: { enabled: true, sections: [] },
    faq: { enabled: true, sections: [] },
    contact: { enabled: true, sections: [] },
    gallery: { enabled: false, sections: [] },
    testimonials: { enabled: false, sections: [] },
  };

  it('should return success with index when section found', () => {
    const result = resolveSectionIndex('home-hero-main', 'home', testPages);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.index).toBe(0);
    }
  });

  it('should return success with correct index for non-first section', () => {
    const result = resolveSectionIndex('home-cta-main', 'home', testPages);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.index).toBe(1);
    }
  });

  it('should return error with available IDs when section not found', () => {
    const result = resolveSectionIndex('nonexistent', 'home', testPages);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
      expect(result.error).toContain('Available IDs');
      expect(result.error).toContain('home-hero-main');
      expect(result.error).toContain('home-cta-main');
    }
  });

  it('should return helpful error when section exists on different page', () => {
    const result = resolveSectionIndex('about-text-main', 'home', testPages);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('exists on page');
      expect(result.error).toContain('"about"');
      expect(result.error).toContain('not "home"');
    }
  });

  it('should return error when page not found', () => {
    const result = resolveSectionIndex('home-hero-main', 'invalid-page', testPages);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Page "invalid-page" not found');
    }
  });

  it('should handle empty sections array', () => {
    const result = resolveSectionIndex('some-section', 'services', testPages);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
      // Should indicate no IDs available (or empty list)
    }
  });
});
