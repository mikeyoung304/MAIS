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
  updatePageSectionTool,
  removePageSectionTool,
  reorderPageSectionsTool,
  togglePageEnabledTool,
  updateStorefrontBrandingTool,
  publishDraftTool,
  discardDraftTool,
  getLandingPageDraftTool,
} from '../../../src/agent/tools/storefront-tools';
import type { ToolContext } from '../../../src/agent/tools/types';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

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
    it('should include all 8 storefront tools', () => {
      expect(storefrontTools).toHaveLength(8);
    });

    it('should include all expected tools', () => {
      const toolNames = storefrontTools.map((t) => t.name);
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
      expect(removePageSectionTool.inputSchema.required).toContain('sectionIndex');
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
      expect(reorderPageSectionsTool.inputSchema.required).toContain('fromIndex');
      expect(reorderPageSectionsTool.inputSchema.required).toContain('toIndex');
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
      expect(publishDraftTool.trustTier).toBe('T2');
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
      expect(discardDraftTool.trustTier).toBe('T2');
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
});
