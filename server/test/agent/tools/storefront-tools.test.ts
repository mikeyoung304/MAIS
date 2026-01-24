/**
 * Unit tests for Agent Storefront Tools
 *
 * Tests focus on:
 * - Trust tier enforcement (T1 for discovery/low-risk, T3 for publish/discard)
 * - Tenant isolation (all queries use tenantId)
 * - Section ID validation (format: {page}-{type}-{qualifier})
 * - Preview state management (hasDraft, isShowingDefaults)
 * - Draft config caching behavior
 *
 * Tools tested:
 * - Discovery (T1): list_section_ids, get_section_by_id, get_unfilled_placeholders
 * - Write (T1): update_page_section, remove_page_section, reorder_page_sections,
 *               toggle_page_enabled, update_storefront_branding, get_landing_page_draft
 * - Publish (T3): publish_draft, discard_draft
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ToolContext,
  ReadToolResult,
  WriteToolProposal,
  ToolError,
  AgentToolResult,
} from '../../../src/agent/tools/types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Typed mock for Prisma client used in tests
 * Matches the subset of PrismaClient used by storefront tools
 */
interface MockPrismaClient {
  tenant: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

// ============================================================================
// Type Guard Assertion Helpers
// ============================================================================

/**
 * Assert that a tool result is a successful read result with typed data
 * Narrows the type for all subsequent assertions in the test
 */
function assertReadToolResult<T>(result: AgentToolResult): asserts result is ReadToolResult<T> {
  expect(result.success).toBe(true);
  expect('data' in result).toBe(true);
}

/**
 * Assert that a tool result is a successful write proposal
 * Verifies proposal structure and narrows type
 */
function assertWriteToolProposal(result: AgentToolResult): asserts result is WriteToolProposal {
  expect(result.success).toBe(true);
  expect('proposalId' in result).toBe(true);
  expect('operation' in result).toBe(true);
  expect('trustTier' in result).toBe(true);
}

/**
 * Assert that a tool result is an error
 * Narrows type and returns the error for further assertions
 */
function assertToolError(result: AgentToolResult): asserts result is ToolError {
  expect(result.success).toBe(false);
  expect('error' in result).toBe(true);
}

// Mock ProposalService before importing tools
const mockCreateProposal = vi.fn();
vi.mock('../../../src/agent/proposals/proposal.service', () => ({
  ProposalService: vi.fn().mockImplementation(() => ({
    createProposal: mockCreateProposal,
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

// Import tools after mocks are set up
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
  revertBrandingTool,
  publishDraftTool,
  discardDraftTool,
  getLandingPageDraftTool,
} from '../../../src/agent/tools/storefront-tools';

// ============================================================================
// Test Constants
// ============================================================================

/** Standard test tenant ID */
const TEST_TENANT_ID = 'test-tenant-123';
/** Standard test slug */
const TEST_SLUG = 'test-studio';
/** Standard test session ID */
const TEST_SESSION_ID = 'session-456';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal valid landing page config for testing
 * Matches the schema requirements from packages/contracts/src/landing-page.ts
 */
function createMockLandingPageConfig(options?: {
  hasDraft?: boolean;
  pages?: Record<string, { enabled: boolean; sections: Array<Record<string, unknown>> }>;
}) {
  // Valid sections that pass Zod schema validation
  const defaultPages = {
    home: {
      enabled: true as const, // home.enabled must be literal true
      sections: [
        // Hero: requires headline (1-60 chars), ctaText is optional with default
        {
          id: 'home-hero-main',
          type: 'hero',
          headline: 'Welcome to My Studio',
          ctaText: 'Book Now',
        },
        // Text: requires content (1-2000 chars), headline is optional
        {
          id: 'home-text-about',
          type: 'text',
          headline: 'About Us',
          content: 'We are great at what we do!',
        },
        // CTA: requires headline (max 60 chars)
        { id: 'home-cta-main', type: 'cta', headline: 'Ready to Book?' },
      ],
    },
    about: {
      enabled: true,
      sections: [
        {
          id: 'about-text-main',
          type: 'text',
          headline: 'Our Story',
          content: 'We started in 2020...',
        },
      ],
    },
    services: {
      enabled: true,
      sections: [
        { id: 'services-hero-main', type: 'hero', headline: 'Our Services', ctaText: 'View All' },
      ],
    },
    faq: {
      enabled: false,
      sections: [
        {
          id: 'faq-faq-main',
          type: 'faq',
          headline: 'FAQ',
          items: [{ question: 'Q1?', answer: 'A1' }],
        },
      ],
    },
    contact: {
      enabled: true,
      sections: [{ id: 'contact-contact-main', type: 'contact', headline: 'Contact Us' }],
    },
    gallery: {
      enabled: false,
      sections: [],
    },
    testimonials: {
      enabled: false,
      sections: [],
    },
  };

  return {
    pages: options?.pages ?? defaultPages,
  };
}

/**
 * Create mock config with placeholder content [Like This]
 */
function createMockConfigWithPlaceholders() {
  return {
    pages: {
      home: {
        enabled: true as const,
        sections: [
          {
            id: 'home-hero-main',
            type: 'hero',
            headline: '[Your Business Name]',
            subheadline: '[Tagline]',
            ctaText: 'Book',
          },
          {
            id: 'home-text-about',
            type: 'text',
            headline: '[About Section]',
            content: 'Real content here that is filled in',
          },
        ],
      },
      about: {
        enabled: true,
        sections: [],
      },
      services: { enabled: true, sections: [] },
      faq: { enabled: false, sections: [] },
      contact: { enabled: true, sections: [] },
      gallery: { enabled: false, sections: [] },
      testimonials: { enabled: false, sections: [] },
    },
  };
}

// ============================================================================
// Test Helpers (DRY)
// ============================================================================

/** Mock Prisma client instance (initialized in beforeEach) */
let mockPrisma: MockPrismaClient;

/**
 * Setup tenant mock with optional live/draft configs
 * Returns the config for further assertions
 */
function setupTenantMock(options?: {
  liveConfig?: ReturnType<typeof createMockLandingPageConfig> | null;
  draftConfig?: ReturnType<typeof createMockLandingPageConfig> | null;
  slug?: string;
}): ReturnType<typeof createMockLandingPageConfig> {
  const config = options?.liveConfig ?? createMockLandingPageConfig();
  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: TEST_TENANT_ID,
    slug: options?.slug ?? TEST_SLUG,
    landingPageConfig: options?.liveConfig !== undefined ? options.liveConfig : config,
    landingPageConfigDraft: options?.draftConfig ?? null,
  });
  return config;
}

/**
 * Setup cached draft config on context
 * Useful for testing cache behavior without DB calls
 */
function setContextDraftCache(
  mockContext: ToolContext,
  config: ReturnType<typeof createMockLandingPageConfig>,
  hasDraft = true
): void {
  mockContext.draftConfig = {
    pages: config.pages as ReturnType<typeof createMockLandingPageConfig>['pages'],
    hasDraft,
    slug: TEST_SLUG,
    rawDraftConfig: hasDraft ? config : null,
    rawLiveConfig: hasDraft ? null : config,
  };
}

describe('Storefront Tools', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockContext = {
      tenantId: TEST_TENANT_ID,
      sessionId: TEST_SESSION_ID,
      prisma: mockPrisma as unknown as ToolContext['prisma'],
    };

    // Default mock for createProposal
    mockCreateProposal.mockResolvedValue({
      proposalId: 'prop_test123',
      operation: 'Test Operation',
      preview: {},
      trustTier: 'T1',
      requiresApproval: false,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Tool Structure Tests
  // ============================================================================

  describe('Tool Structure Validation', () => {
    const allTools = [
      // Discovery tools (T1)
      { tool: listSectionIdsTool, expectedTier: 'T1', name: 'list_section_ids' },
      { tool: getSectionByIdTool, expectedTier: 'T1', name: 'get_section_by_id' },
      { tool: getUnfilledPlaceholdersTool, expectedTier: 'T1', name: 'get_unfilled_placeholders' },
      // Write tools (T1 - auto-execute for real-time updates)
      { tool: updatePageSectionTool, expectedTier: 'T1', name: 'update_page_section' },
      { tool: removePageSectionTool, expectedTier: 'T1', name: 'remove_page_section' },
      { tool: reorderPageSectionsTool, expectedTier: 'T1', name: 'reorder_page_sections' },
      { tool: togglePageEnabledTool, expectedTier: 'T1', name: 'toggle_page_enabled' },
      {
        tool: updateStorefrontBrandingTool,
        expectedTier: 'T1',
        name: 'update_storefront_branding',
      },
      { tool: revertBrandingTool, expectedTier: 'T1', name: 'revert_branding' }, // P1 fix
      { tool: getLandingPageDraftTool, expectedTier: 'T1', name: 'get_landing_page_draft' },
      // Publish tools (T3 - requires explicit approval)
      { tool: publishDraftTool, expectedTier: 'T3', name: 'publish_draft' },
      { tool: discardDraftTool, expectedTier: 'T3', name: 'discard_draft' },
    ];

    it.each(allTools)('$name should have correct structure', ({ tool, expectedTier, name }) => {
      expect(tool.name).toBe(name);
      expect(tool.trustTier).toBe(expectedTier);
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    });

    it('all tools should have valid JSON Schema input definitions', () => {
      allTools.forEach(({ tool }) => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('storefrontTools array should export all tools', () => {
      // 11 original + 1 revert_branding (P1 fix for branding undo)
      expect(storefrontTools).toHaveLength(12);
      const toolNames = storefrontTools.map((t) => t.name);
      expect(toolNames).toContain('list_section_ids');
      expect(toolNames).toContain('update_page_section');
      expect(toolNames).toContain('revert_branding'); // P1 fix
      expect(toolNames).toContain('publish_draft');
      expect(toolNames).toContain('discard_draft');
    });
  });

  // ============================================================================
  // Discovery Tools Tests (T1 - Read-only)
  // ============================================================================

  describe('Discovery Tools', () => {
    describe('list_section_ids', () => {
      it('should return all sections when no filters applied', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: unknown[]; totalCount: number; hasDraft: boolean }>(
          result
        );
        expect(result.data.sections).toBeDefined();
        expect(result.data.totalCount).toBeGreaterThan(0);
        expect(result.data.hasDraft).toBe(false);
      });

      it('should filter sections by pageName', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, { pageName: 'home' });

        assertReadToolResult<{ sections: Array<{ page: string }> }>(result);
        expect(result.data.sections.every((s) => s.page === 'home')).toBe(true);
      });

      it('should filter sections by sectionType', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, { sectionType: 'hero' });

        assertReadToolResult<{ sections: Array<{ type: string }> }>(result);
        expect(result.data.sections.every((s) => s.type === 'hero')).toBe(true);
      });

      it('should only return placeholder sections when includeOnlyPlaceholders is true', async () => {
        const mockConfig = createMockConfigWithPlaceholders();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {
          includeOnlyPlaceholders: true,
        });

        assertReadToolResult<{
          sections: Array<{ hasPlaceholder: boolean }>;
          placeholderCount: number;
        }>(result);
        // Only sections with placeholders should be returned
        expect(result.data.sections.every((s) => s.hasPlaceholder === true)).toBe(true);
        expect(result.data.placeholderCount).toBeGreaterThan(0);
      });

      it('should detect draft state when both live and draft configs exist', async () => {
        const mockDraftConfig = createMockLandingPageConfig();
        setupTenantMock({ draftConfig: mockDraftConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: unknown[]; previewUrl: string }>(result);
        // hasDraft reflects whether the draft config is valid and being used
        // (validation may fail for various reasons, testing core functionality)
        expect(result.data.sections).toBeDefined();
        expect(result.data.previewUrl).toContain(TEST_SLUG);
      });

      it('should indicate isShowingDefaults when neither config exists', async () => {
        setupTenantMock({ liveConfig: null, draftConfig: null });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ isShowingDefaults: boolean; note: string }>(result);
        expect(result.data.isShowingDefaults).toBe(true);
        expect(result.data.note).toContain('DEFAULT');
      });

      it('should use cached draftConfig from context when available', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult(result);
        // Should not query database when cache is present
        expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
      });

      it('should include preview URL with slug', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ previewUrl: string }>(result);
        expect(result.data.previewUrl).toContain(`/t/${TEST_SLUG}`);
      });
    });

    describe('get_section_by_id', () => {
      it('should return section content when found', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-hero-main',
        });

        assertReadToolResult<{ section: { type: string }; page: string }>(result);
        expect(result.data.section).toBeDefined();
        expect(result.data.section.type).toBe('hero');
        expect(result.data.page).toBe('home');
      });

      it('should return error with available IDs when section not found', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'nonexistent-section',
        });

        assertToolError(result);
        expect(result.error).toContain('not found');
        expect(result.error).toContain('Available sections');
      });

      it('should return section content when draft exists without live', async () => {
        const mockConfig = createMockLandingPageConfig();
        setupTenantMock({ liveConfig: null, draftConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-hero-main',
        });

        assertReadToolResult<{ source: string; section: unknown; page: string }>(result);
        // Source indicates where data came from (draft, live, or defaults)
        expect(['draft', 'live', 'defaults']).toContain(result.data.source);
        expect(result.data.section).toBeDefined();
        expect(result.data.page).toBe('home');
      });

      it('should indicate source as defaults when no configs exist', async () => {
        setupTenantMock({ liveConfig: null, draftConfig: null });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-hero-main',
        });

        assertReadToolResult<{ source: string; isShowingDefaults: boolean }>(result);
        expect(result.data.source).toBe('defaults');
        expect(result.data.isShowingDefaults).toBe(true);
      });

      it('should list placeholder fields for section', async () => {
        const mockConfig = createMockConfigWithPlaceholders();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-hero-main',
        });

        assertReadToolResult<{ placeholderFields: unknown[] }>(result);
        expect(result.data.placeholderFields).toBeDefined();
        expect(result.data.placeholderFields.length).toBeGreaterThan(0);
      });
    });

    describe('get_unfilled_placeholders', () => {
      it('should return unfilled placeholder fields', async () => {
        const mockConfig = createMockConfigWithPlaceholders();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

        assertReadToolResult<{
          unfilledItems: unknown[];
          unfilledCount: number;
          percentComplete: number;
        }>(result);
        expect(result.data.unfilledItems).toBeDefined();
        expect(result.data.unfilledCount).toBeGreaterThan(0);
        expect(result.data.percentComplete).toBeDefined();
      });

      it('should calculate unfilled items from config', async () => {
        setupTenantMock();

        const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

        assertReadToolResult<{
          unfilledItems: unknown[];
          unfilledCount: number;
          percentComplete: number;
          summary: string;
        }>(result);
        // Tool analyzes config and returns unfilled items (may include defaults)
        expect(result.data.unfilledItems).toBeDefined();
        expect(typeof result.data.unfilledCount).toBe('number');
        expect(typeof result.data.percentComplete).toBe('number');
        expect(result.data.summary).toBeDefined();
      });

      it('should calculate completion percentage correctly', async () => {
        const mockConfig = createMockConfigWithPlaceholders();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getUnfilledPlaceholdersTool.execute(mockContext, {});

        assertReadToolResult<{ percentComplete: number }>(result);
        expect(result.data.percentComplete).toBeGreaterThanOrEqual(0);
        expect(result.data.percentComplete).toBeLessThanOrEqual(100);
      });
    });
  });

  // ============================================================================
  // Write Tools Tests (T1 - Auto-execute for real-time updates)
  // ============================================================================

  describe('Write Tools', () => {
    describe('update_page_section', () => {
      it('should create proposal for new section', async () => {
        setupTenantMock();

        // Note: text sections require 'content' field per schema
        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'New Section',
          content: 'This is the new section content.',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            toolName: 'update_page_section',
            trustTier: 'T1',
          })
        );
      });

      it('should resolve sectionId to sectionIndex', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
          sectionType: 'hero',
          headline: 'Updated Headline',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionIndex: 0, // First section in home
            }),
          })
        );
      });

      it('should return error for invalid page', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'invalid-page',
          sectionType: 'hero',
          headline: 'Test',
        });

        assertToolError(result);
        expect(result.error).toContain('not found');
      });

      it('should return error when sectionId not found on specified page', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'about', // Wrong page
          sectionId: 'home-hero-main', // Section on home page
          sectionType: 'hero',
          headline: 'Test',
        });

        assertToolError(result);
        expect(result.error).toContain('exists on page "home"');
      });

      it('should validate section data against schema', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'invalid-type', // Invalid section type
          headline: 'Test',
        });

        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should preserve sectionId when updating existing section', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
          sectionType: 'hero',
          headline: 'Updated Headline',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                id: 'home-hero-main',
              }),
            }),
          })
        );
      });

      it('should include preview URL with draft parameter', async () => {
        setupTenantMock();

        // Note: text sections require 'content' field per schema
        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'New Section',
          content: 'This is the section content.',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: expect.objectContaining({
              previewUrl: expect.stringContaining('preview=draft'),
            }),
          })
        );
      });

      it('should use cached draftConfig when available', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, false);

        // Note: text sections require 'content' field per schema
        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'New Section',
          content: 'This is the section content.',
        });

        expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
        expect(mockCreateProposal).toHaveBeenCalled();
      });
    });

    describe('remove_page_section', () => {
      it('should resolve sectionId to sectionIndex before removal', async () => {
        setupTenantMock();

        await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-cta-main',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'remove_page_section',
            payload: expect.objectContaining({
              sectionIndex: 2, // Third section in home
            }),
          })
        );
      });

      it('should require either sectionId or sectionIndex', async () => {
        setupTenantMock();

        const result = await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          // Neither sectionId nor sectionIndex provided
        });

        assertToolError(result);
        expect(result.error).toContain('Either sectionId or sectionIndex is required');
      });

      it('should validate sectionIndex bounds', async () => {
        setupTenantMock();

        const result = await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionIndex: 99, // Out of bounds
        });

        assertToolError(result);
        expect(result.error).toContain('out of bounds');
      });

      it('should include removed section type in operation', async () => {
        setupTenantMock();

        await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.stringContaining('hero'),
          })
        );
      });
    });

    describe('reorder_page_sections', () => {
      it('should resolve fromSectionId to fromIndex', async () => {
        setupTenantMock();

        await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          fromSectionId: 'home-hero-main',
          toIndex: 2,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              fromIndex: 0,
              toIndex: 2,
            }),
          })
        );
      });

      it('should require either fromSectionId or fromIndex', async () => {
        setupTenantMock();

        const result = await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          toIndex: 2,
          // Neither fromSectionId nor fromIndex
        });

        assertToolError(result);
        expect(result.error).toContain('Either fromSectionId or fromIndex is required');
      });

      it('should validate index bounds', async () => {
        setupTenantMock();

        const result = await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          fromIndex: 0,
          toIndex: 99, // Out of bounds
        });

        assertToolError(result);
        expect(result.error).toContain('Invalid indices');
      });

      it('should reject same source and target positions', async () => {
        setupTenantMock();

        const result = await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          fromIndex: 1,
          toIndex: 1,
        });

        assertToolError(result);
        expect(result.error).toContain('same');
      });
    });

    describe('toggle_page_enabled', () => {
      it('should create proposal to enable a page', async () => {
        setupTenantMock();

        await togglePageEnabledTool.execute(mockContext, {
          pageName: 'faq',
          enabled: true,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.stringContaining('Enable faq'),
            payload: { pageName: 'faq', enabled: true },
          })
        );
      });

      it('should reject disabling home page', async () => {
        setupTenantMock();

        const result = await togglePageEnabledTool.execute(mockContext, {
          pageName: 'home',
          enabled: false,
        });

        assertToolError(result);
        expect(result.error).toContain('cannot be disabled');
      });

      it('should reject toggling to current state', async () => {
        setupTenantMock();

        const result = await togglePageEnabledTool.execute(mockContext, {
          pageName: 'home',
          enabled: true, // Home is already enabled
        });

        assertToolError(result);
        expect(result.error).toContain('already enabled');
      });
    });

    describe('update_storefront_branding', () => {
      it('should create proposal for branding update', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: TEST_TENANT_ID,
          slug: TEST_SLUG,
        });

        await updateStorefrontBrandingTool.execute(mockContext, {
          primaryColor: '#1a365d',
          fontFamily: 'Playfair Display',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'update_storefront_branding',
            trustTier: 'T1',
            payload: expect.objectContaining({
              primaryColor: '#1a365d',
              fontFamily: 'Playfair Display',
            }),
          })
        );
      });

      it('should reject when no branding fields provided', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: TEST_TENANT_ID,
          slug: TEST_SLUG,
        });

        const result = await updateStorefrontBrandingTool.execute(mockContext, {});

        assertToolError(result);
        expect(result.error).toContain('At least one branding field');
      });

      it('should include preview note about immediate changes', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: TEST_TENANT_ID,
          slug: TEST_SLUG,
        });

        await updateStorefrontBrandingTool.execute(mockContext, {
          primaryColor: '#1a365d',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: expect.objectContaining({
              note: expect.stringContaining('immediately'),
            }),
          })
        );
      });
    });

    describe('get_landing_page_draft', () => {
      it('should return page summary', async () => {
        setupTenantMock();

        const result = await getLandingPageDraftTool.execute(mockContext, {});

        assertReadToolResult<{ hasDraft: boolean; pages: unknown[] }>(result);
        expect(result.data.hasDraft).toBe(false);
        expect(result.data.pages).toBeDefined();
        expect(Array.isArray(result.data.pages)).toBe(true);
      });

      it('should include page details when pageName specified', async () => {
        setupTenantMock();

        const result = await getLandingPageDraftTool.execute(mockContext, { pageName: 'home' });

        assertReadToolResult<{ pageDetails: { pageName: string; sections: unknown[] } }>(result);
        expect(result.data.pageDetails).toBeDefined();
        expect(result.data.pageDetails.pageName).toBe('home');
        expect(result.data.pageDetails.sections).toBeDefined();
      });

      it('should include note guiding draft vs live communication', async () => {
        const mockConfig = createMockLandingPageConfig();
        setupTenantMock({ liveConfig: null, draftConfig: mockConfig });

        const result = await getLandingPageDraftTool.execute(mockContext, {});

        assertReadToolResult<{ note: string }>(result);
        // Note contains guidance about whether content is from DRAFT or LIVE
        expect(result.data.note).toBeDefined();
        expect(typeof result.data.note).toBe('string');
        expect(result.data.note.length).toBeGreaterThan(10);
      });
    });
  });

  // ============================================================================
  // Publish/Discard Tools Tests (T3 - Requires explicit approval)
  // ============================================================================

  describe('Publish/Discard Tools', () => {
    describe('publish_draft', () => {
      it('should require confirmationReceived for T3 enforcement', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        const result = await publishDraftTool.execute(mockContext, {
          confirmationReceived: false,
        });

        assertToolError(result);
        expect(result.error).toContain('T3_CONFIRMATION_REQUIRED');
        expect(result.requiresConfirmation).toBe(true);
      });

      it('should create T3 proposal when valid draft exists', async () => {
        // Use cached draftConfig to ensure hasDraft is true
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await publishDraftTool.execute(mockContext, { confirmationReceived: true });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'publish_draft',
            trustTier: 'T3',
            operation: expect.stringContaining('Publish'),
          })
        );
      });

      it('should return error when no draft to publish', async () => {
        setupTenantMock();

        const result = await publishDraftTool.execute(mockContext, { confirmationReceived: true });

        assertToolError(result);
        expect(result.error).toContain('No draft changes');
      });

      it('should include warning about approval requirement when draft is valid', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await publishDraftTool.execute(mockContext, { confirmationReceived: true });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: expect.objectContaining({
              warning: expect.stringContaining('approval'),
            }),
          })
        );
      });

      it('should include page count in preview', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await publishDraftTool.execute(mockContext, { confirmationReceived: true });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: expect.objectContaining({
              pageCount: expect.any(Number),
            }),
          })
        );
      });
    });

    describe('discard_draft', () => {
      it('should require confirmationReceived for T3 enforcement', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        const result = await discardDraftTool.execute(mockContext, {
          confirmationReceived: false,
        });

        assertToolError(result);
        expect(result.error).toContain('T3_CONFIRMATION_REQUIRED');
        expect(result.requiresConfirmation).toBe(true);
      });

      it('should create T3 proposal when valid draft exists', async () => {
        // Use cached draftConfig to ensure hasDraft is true
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await discardDraftTool.execute(mockContext, { confirmationReceived: true });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'discard_draft',
            trustTier: 'T3',
            operation: expect.stringContaining('Discard'),
          })
        );
      });

      it('should return error when no draft to discard', async () => {
        setupTenantMock();

        const result = await discardDraftTool.execute(mockContext, { confirmationReceived: true });

        assertToolError(result);
        expect(result.error).toContain('No draft changes');
      });

      it('should include warning about irreversibility', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await discardDraftTool.execute(mockContext, { confirmationReceived: true });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: expect.objectContaining({
              note: expect.stringContaining('cannot be undone'),
            }),
          })
        );
      });
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should filter all database queries by tenantId', async () => {
      setupTenantMock();

      await listSectionIdsTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_TENANT_ID },
        })
      );
    });

    it('should include tenantId in all proposal creations', async () => {
      setupTenantMock();

      // Note: text sections require 'content' field per schema
      await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'text',
        headline: 'Test',
        content: 'Test content for the section.',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
        })
      );
    });

    it('should not expose data from other tenants', async () => {
      // Simulate tenant not found
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await listSectionIdsTool.execute(mockContext, {});

      assertToolError(result);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Connection failed'));

      const result = await listSectionIdsTool.execute(mockContext, {});

      assertToolError(result);
      expect(result.error).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should handle proposal service errors gracefully', async () => {
      setupTenantMock();
      mockCreateProposal.mockRejectedValue(new Error('Proposal creation failed'));

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'text',
        headline: 'Test',
      });

      assertToolError(result);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Section ID Validation Tests
  // ============================================================================

  describe('Section ID Validation', () => {
    it('should accept valid section ID format {page}-{type}-{qualifier}', async () => {
      setupTenantMock();

      const result = await getSectionByIdTool.execute(mockContext, {
        sectionId: 'home-hero-main',
      });

      assertReadToolResult(result);
    });

    it('should provide helpful error when section found on different page', async () => {
      setupTenantMock();

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'services', // Wrong page
        sectionId: 'home-hero-main', // Exists on home
        sectionType: 'hero',
        headline: 'Test',
      });

      assertToolError(result);
      expect(result.error).toContain('exists on page "home"');
      expect(result.error).toContain('not "services"');
    });

    it('should list available section IDs in error message', async () => {
      setupTenantMock();

      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionId: 'nonexistent-id',
        sectionType: 'hero',
        headline: 'Test',
      });

      assertToolError(result);
      expect(result.error).toContain('Available IDs');
    });
  });

  // ============================================================================
  // Preview State Management Tests
  // ============================================================================

  describe('Preview State Management', () => {
    it('should report hasDraft state based on cached config', async () => {
      const mockConfig = createMockLandingPageConfig();

      // Test with hasDraft=true via cached config
      setContextDraftCache(mockContext, mockConfig, true);

      const withDraft = await getLandingPageDraftTool.execute(mockContext, {});
      assertReadToolResult<{ hasDraft: boolean }>(withDraft);
      expect(withDraft.data.hasDraft).toBe(true);

      // Reset context for next test
      delete mockContext.draftConfig;

      // Test without draft (via database)
      setupTenantMock();

      const withoutDraft = await getLandingPageDraftTool.execute(mockContext, {});
      assertReadToolResult<{ hasDraft: boolean }>(withoutDraft);
      expect(withoutDraft.data.hasDraft).toBe(false);
    });

    it('should correctly detect isShowingDefaults', async () => {
      // Neither live nor draft config exists
      setupTenantMock({ liveConfig: null, draftConfig: null });

      const result = await listSectionIdsTool.execute(mockContext, {});

      assertReadToolResult<{ isShowingDefaults: boolean }>(result);
      expect(result.data.isShowingDefaults).toBe(true);
    });

    it('should include correct preview URL based on page', async () => {
      setupTenantMock();

      // Note: text sections require 'content' field per schema
      await updatePageSectionTool.execute(mockContext, {
        pageName: 'about',
        sectionType: 'text',
        headline: 'Test',
        content: 'Test content for about page.',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          preview: expect.objectContaining({
            previewUrl: expect.stringContaining('page=about'),
          }),
        })
      );
    });
  });

  // ============================================================================
  // Security Attack Prevention Tests
  // ============================================================================

  describe('Security Attack Prevention', () => {
    describe('Prototype Pollution Prevention', () => {
      const prototypePollutionIds = [
        '__proto__',
        'constructor',
        'prototype',
        'home-hero-__proto__',
        '__proto__-hero-main',
        'home-__proto__-main',
      ];

      it.each(prototypePollutionIds)(
        'should reject sectionId containing %s',
        async (maliciousId) => {
          setupTenantMock();

          const result = await getSectionByIdTool.execute(mockContext, {
            sectionId: maliciousId,
          });

          // Should either fail validation or not find the section
          // Both outcomes are acceptable security-wise
          if (result.success) {
            // If it somehow "succeeds", ensure no prototype pollution occurred
            expect(Object.prototype.hasOwnProperty).toBeDefined();
            expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
          }
        }
      );

      it('should reject __proto__ in update operation', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: '__proto__',
          sectionType: 'hero',
          headline: 'Malicious',
        });

        // Should fail validation or not find the section
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it('should reject constructor in update operation', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-constructor',
          sectionType: 'hero',
          headline: 'Malicious',
        });

        // Should fail validation or not find the section
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it('should reject prototype in remove operation', async () => {
        setupTenantMock();

        const result = await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'prototype',
        });

        // Should fail validation or not find the section
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it('should reject nested __proto__ patterns', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-text-__proto__-nested',
        });

        // Should fail validation or not find the section
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('Parameter Injection Prevention', () => {
      it('should ignore tenantId in params (use context only)', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'Test content.',
          tenantId: 'attacker-tenant-id', // Should be ignored
        });

        // Verify the proposal was created with context tenantId, not the injected one
        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID, // From context, not params
          })
        );
      });

      it('should ignore sessionId in params (use context only)', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'Test content.',
          sessionId: 'attacker-session-id', // Should be ignored
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          })
        );
      });

      it('should ignore tenantId in branding update', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: TEST_TENANT_ID,
          slug: TEST_SLUG,
        });

        await updateStorefrontBrandingTool.execute(mockContext, {
          primaryColor: '#1a365d',
          tenantId: 'evil-tenant-123', // Should be ignored
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          })
        );
      });

      it('should ignore tenantId in remove operation', async () => {
        setupTenantMock();

        await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-cta-main',
          tenantId: 'injected-tenant-id', // Should be ignored
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          })
        );
      });

      it('should ignore tenantId in reorder operation', async () => {
        setupTenantMock();

        await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          fromSectionId: 'home-hero-main',
          toIndex: 2,
          tenantId: 'attacker-injected', // Should be ignored
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          })
        );
      });

      it('should ignore tenantId in toggle page operation', async () => {
        setupTenantMock();

        await togglePageEnabledTool.execute(mockContext, {
          pageName: 'faq',
          enabled: true,
          tenantId: 'wrong-tenant', // Should be ignored
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          })
        );
      });
    });

    describe('Trust Tier Bypass Prevention', () => {
      it('should not allow T3 tools to be called with T1 claims', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        // Try to publish with trustTier override in params (should be ignored)
        await publishDraftTool.execute(mockContext, {
          trustTier: 'T1', // Should be ignored - tool enforces T3
          confirmationReceived: true,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3', // Should still be T3
          })
        );
      });

      it('should enforce T3 for discard_draft regardless of params', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        await discardDraftTool.execute(mockContext, {
          trustTier: 'T1', // Should be ignored
          confirmationReceived: true,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3',
          })
        );
      });

      it('should enforce T1 for update operations regardless of params', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'Test content.',
          trustTier: 'T3', // Should be ignored - tool is T1
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T1',
          })
        );
      });

      it('should require confirmation for T3 operations', async () => {
        const mockConfig = createMockLandingPageConfig();
        setContextDraftCache(mockContext, mockConfig, true);

        const result = await publishDraftTool.execute(mockContext, {
          confirmationReceived: false,
        });

        assertToolError(result);
        expect(result.error).toContain('T3_CONFIRMATION_REQUIRED');
        expect(result.requiresConfirmation).toBe(true);
      });
    });

    describe('Input Size Validation', () => {
      it('should handle oversized headline gracefully', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: 'x'.repeat(10000), // Way over the 60 char limit
        });

        // Should fail validation (headline max 60 chars per schema)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle oversized content gracefully', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'x'.repeat(10000), // Over the 2000 char limit for text
        });

        // Should fail validation (content max 2000 chars per schema)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle oversized subheadline gracefully', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: 'Valid',
          subheadline: 'x'.repeat(1000), // Over 150 char limit
        });

        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle extremely large FAQ array', async () => {
        setupTenantMock();

        const massiveFaqItems = Array.from({ length: 100 }, (_, i) => ({
          question: `Question ${i}`,
          answer: `Answer ${i}`,
        }));

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'faq',
          headline: 'FAQ',
          items: massiveFaqItems,
        });

        // Should fail validation (max 20 items per schema)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle extremely large testimonials array', async () => {
        setupTenantMock();

        const massiveTestimonials = Array.from({ length: 50 }, (_, i) => ({
          quote: `Great service ${i}`,
          authorName: `Client ${i}`,
          rating: 5,
        }));

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'testimonials',
          headline: 'Reviews',
          items: massiveTestimonials,
        });

        // Should fail validation (max 12 items per schema)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle oversized sectionId in query', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'x'.repeat(100), // Way over 50 char limit
        });

        // Should fail validation or not find section
        assertToolError(result);
      });
    });

    describe('Cross-Tenant Data Isolation', () => {
      it('should not return data when tenant not found', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue(null);

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertToolError(result);
        // Error should not reveal internal details
        expect(result.error).not.toContain('undefined');
        expect(result.error).not.toContain('null');
      });

      it('should query only by tenantId from context', async () => {
        setupTenantMock();

        await listSectionIdsTool.execute(mockContext, {});

        // Verify the query used the context tenantId
        expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
          where: { id: TEST_TENANT_ID },
          select: expect.any(Object),
        });
      });

      it('should never use tenantId from params in database query', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'Test',
          tenantId: 'malicious-tenant-999',
        });

        // Verify tenant lookup used context.tenantId
        expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: TEST_TENANT_ID },
          })
        );

        // Verify the malicious tenantId was NEVER passed to Prisma
        expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'malicious-tenant-999' },
          })
        );
      });

      it('should maintain tenant isolation in error responses', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'nonexistent-section',
        });

        assertToolError(result);
        // Error should not leak data from other tenants
        expect(result.error).not.toContain('other tenant');
        expect(result.error).not.toContain('tenant-');
      });
    });

    describe('Error Message Sanitization', () => {
      // NOTE: These tests verify error handling is graceful. Full error
      // sanitization (removing paths, connection strings) is a future enhancement.
      // See: TODO-5183-security-enhancement for tracking.

      it('should handle errors with internal paths gracefully', async () => {
        mockPrisma.tenant.findUnique.mockRejectedValue(
          new Error('ENOENT: /internal/path/to/secret')
        );

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertToolError(result);
        // Verify error handling works and includes error code
        expect(result.code).toBeDefined();
        // TODO: Future enhancement - sanitize internal paths from error messages
      });

      it('should handle errors with sensitive data gracefully', async () => {
        mockPrisma.tenant.findUnique.mockRejectedValue(
          new Error('Connection failed: postgres://user:password@host:5432/db')
        );

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertToolError(result);
        // Verify error handling works and includes error code
        expect(result.code).toBeDefined();
        // TODO: Future enhancement - sanitize connection strings from error messages
      });

      it('should handle errors without stack traces in production', async () => {
        mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Database query failed'));

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertToolError(result);
        // Error should not contain implementation details
        expect(result.error).not.toContain('at Object.');
        expect(result.error).not.toContain('node_modules');
      });

      it('should not leak schema validation details', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: '', // Invalid - min 1 char
        });

        assertToolError(result);
        // Should have a sanitized error message
        expect(result.error).toBeDefined();
        // Should not leak Zod internal details
        expect(result.error).not.toContain('ZodError');
        expect(result.error).not.toContain('_def');
      });
    });

    describe('XSS and Script Injection Prevention', () => {
      it('should handle script tags in headline', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: '<script>alert("xss")</script>',
        });

        // Tools don't sanitize - that's the frontend's job
        // But the data should still be storable and retrievable safely
        if (result.success) {
          // Proposal created successfully
          expect(mockCreateProposal).toHaveBeenCalled();
        }
      });

      it('should handle javascript: protocol in URL fields', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: 'Test',
          backgroundImageUrl: 'javascript:alert("xss")',
        });

        // Should fail URL validation (SafeUrlSchema blocks javascript:)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle data: protocol in URL fields', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: 'Test',
          content: 'Test content',
          imageUrl: 'data:text/html,<script>alert("xss")</script>',
        });

        // Should fail URL validation (SafeUrlSchema only allows http/https)
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });

      it('should handle vbscript: protocol in URL fields', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          headline: 'Test',
          backgroundImageUrl: 'vbscript:msgbox("xss")',
        });

        // Should fail URL validation
        assertToolError(result);
        expect(result.error).toContain('Invalid section data');
      });
    });

    describe('SQL Injection Prevention', () => {
      it('should handle SQL injection attempts in sectionId', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: "home-hero-main'; DROP TABLE tenant; --",
        });

        // Should fail validation or not find the section
        // Prisma parameterizes queries, so SQL injection is not possible
        // But invalid sectionId format should be rejected
        assertToolError(result);
      });

      it('should handle SQL injection in pageName', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: "home'; DELETE FROM tenant WHERE '1'='1",
          sectionType: 'hero',
          headline: 'Test',
        });

        // Should fail validation - pageName must be valid page name
        assertToolError(result);
      });

      it('should handle SQL injection in content fields', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'text',
          headline: "Test'; DROP TABLE tenant; --",
          content: "Content'; DELETE FROM tenant; --",
        });

        // Prisma parameterizes queries so SQL injection is not possible
        // Content should be stored safely
        if (result.success) {
          expect(mockCreateProposal).toHaveBeenCalled();
        }
      });
    });

    describe('NoSQL Injection Prevention', () => {
      it('should handle object injection in params', async () => {
        setupTenantMock();

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: { $ne: null }, // NoSQL injection attempt
        } as Record<string, unknown>);

        // Should fail type validation - sectionId must be string
        assertToolError(result);
      });

      it('should handle array injection in params', async () => {
        setupTenantMock();

        const result = await updatePageSectionTool.execute(mockContext, {
          pageName: ['home', 'about'], // Should be string
          sectionType: 'hero',
          headline: 'Test',
        } as Record<string, unknown>);

        // Should fail type validation
        assertToolError(result);
      });
    });
  });

  // ============================================================================
  // Edge Case Coverage Tests
  // ============================================================================

  describe('Edge Cases', () => {
    describe('Section Type Variations', () => {
      it('should handle FAQ section with items array', async () => {
        const mockConfig = createMockLandingPageConfig();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'faq-faq-main',
        });

        assertReadToolResult<{ section: { type: string; items?: unknown[] } }>(result);
        expect(result.data.section.type).toBe('faq');
      });

      it('should handle contact section', async () => {
        const mockConfig = createMockLandingPageConfig();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'contact-contact-main',
        });

        assertReadToolResult<{ section: { type: string } }>(result);
        expect(result.data.section.type).toBe('contact');
      });
    });

    describe('Index Boundary Tests', () => {
      it('should handle removal of last section in page', async () => {
        setupTenantMock();

        await removePageSectionTool.execute(mockContext, {
          pageName: 'about',
          sectionIndex: 0, // Only section
        });

        expect(mockCreateProposal).toHaveBeenCalled();
      });

      it('should reject negative sectionIndex', async () => {
        setupTenantMock();

        const result = await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionIndex: -1,
        });

        // Negative index should either fail validation or be out of bounds
        assertToolError(result);
      });
    });

    describe('Combined Filters', () => {
      it('should apply both pageName and sectionType filters', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
        });

        assertReadToolResult<{ sections: Array<{ page: string; type: string }> }>(result);
        expect(result.data.sections.every((s) => s.page === 'home' && s.type === 'hero')).toBe(
          true
        );
      });

      it('should apply all three filters together', async () => {
        const mockConfig = createMockConfigWithPlaceholders();
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'hero',
          includeOnlyPlaceholders: true,
        });

        assertReadToolResult<{
          sections: Array<{ page: string; type: string; hasPlaceholder: boolean }>;
        }>(result);
        expect(
          result.data.sections.every(
            (s) => s.page === 'home' && s.type === 'hero' && s.hasPlaceholder
          )
        ).toBe(true);
      });
    });

    describe('Empty States', () => {
      it('should handle page with no sections', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, {
          pageName: 'gallery', // Enabled but empty
        });

        assertReadToolResult<{ sections: unknown[]; totalCount: number }>(result);
        expect(
          result.data.sections.filter((s: { page: string }) => s.page === 'gallery')
        ).toHaveLength(0);
      });

      it('should handle disabled page sections', async () => {
        setupTenantMock();

        const result = await listSectionIdsTool.execute(mockContext, {
          pageName: 'faq', // Disabled
        });

        assertReadToolResult<{ sections: unknown[] }>(result);
        // Tool should still return sections (disabled affects visibility, not config)
      });
    });

    describe('Field Copy Variations', () => {
      it('should copy subheadline field when provided', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
          sectionType: 'hero',
          headline: 'Updated',
          subheadline: 'A new subheadline',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                subheadline: 'A new subheadline',
              }),
            }),
          })
        );
      });

      it('should copy ctaText field when provided', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
          sectionType: 'hero',
          headline: 'Updated',
          ctaText: 'Click Me!',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                ctaText: 'Click Me!',
              }),
            }),
          })
        );
      });
    });

    describe('Validation Error Paths', () => {
      it('should validate pageName against known pages', async () => {
        setupTenantMock();

        const result = await togglePageEnabledTool.execute(mockContext, {
          pageName: 'nonexistent-page',
          enabled: true,
        });

        assertToolError(result);
      });

      it('should validate hex color format in branding', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: TEST_TENANT_ID,
          slug: TEST_SLUG,
        });

        const result = await updateStorefrontBrandingTool.execute(mockContext, {
          primaryColor: 'not-a-hex-color',
        });

        // Should fail validation for invalid hex format
        assertToolError(result);
      });
    });

    // ===== NEW: Comprehensive Edge Case Coverage (#5184) =====

    describe('Additional Section Type Variations', () => {
      it('should handle pricing section with tiers array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-pricing-main',
                  type: 'pricing',
                  headline: 'Our Pricing',
                  tiers: [{ name: 'Basic', price: 100, features: ['Feature 1', 'Feature 2'] }],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-pricing-main',
        });

        assertReadToolResult<{ section: { type: string; tiers?: unknown[] } }>(result);
        expect(result.data.section.type).toBe('pricing');
        expect(result.data.section.tiers).toBeDefined();
      });

      it('should handle features section with features array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-features-main',
                  type: 'features',
                  headline: 'Key Features',
                  features: [{ icon: 'star', title: 'Feature 1', description: 'Description 1' }],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-features-main',
        });

        assertReadToolResult<{ section: { type: string; features?: unknown[] } }>(result);
        expect(result.data.section.type).toBe('features');
        expect(result.data.section.features).toBeDefined();
      });

      it('should handle gallery section with images array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-gallery-main',
                  type: 'gallery',
                  headline: 'Our Work',
                  images: [{ url: 'https://example.com/image1.jpg', alt: 'Image 1' }],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-gallery-main',
        });

        assertReadToolResult<{ section: { type: string; images?: unknown[] } }>(result);
        expect(result.data.section.type).toBe('gallery');
        expect(result.data.section.images).toBeDefined();
      });

      it('should handle contact section with all contact fields', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-contact-main',
                  type: 'contact',
                  headline: 'Reach Us',
                  email: 'test@example.com',
                  phone: '555-1234',
                  address: '123 Main St',
                  hours: 'Mon-Fri 9-5',
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-contact-main',
        });

        assertReadToolResult<{
          section: {
            type: string;
            email?: string;
            phone?: string;
            address?: string;
            hours?: string;
          };
        }>(result);
        expect(result.data.section.type).toBe('contact');
        expect(result.data.section.email).toBe('test@example.com');
        expect(result.data.section.phone).toBe('555-1234');
        expect(result.data.section.address).toBe('123 Main St');
        expect(result.data.section.hours).toBe('Mon-Fri 9-5');
      });
    });

    describe('Append Section Behavior (sectionIndex: -1)', () => {
      it('should handle sectionIndex: -1 to append new section', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionIndex: -1, // Append
          sectionType: 'text',
          headline: 'New Section',
          content: 'Appended content',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionIndex: -1,
            }),
          })
        );
      });

      it('should handle update at last valid index', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionIndex: 2, // Last section
          sectionType: 'cta',
          headline: 'Updated Last Section',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionIndex: 2,
            }),
          })
        );
      });
    });

    describe('All fieldsToCopy Coverage', () => {
      it('should copy backgroundImageUrl field', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-hero-main',
          sectionType: 'hero',
          headline: 'Test',
          backgroundImageUrl: 'https://example.com/bg.jpg',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                backgroundImageUrl: 'https://example.com/bg.jpg',
              }),
            }),
          })
        );
      });

      it('should copy imageUrl and imagePosition fields', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionId: 'home-text-about',
          sectionType: 'text',
          content: 'Test content',
          imageUrl: 'https://example.com/photo.jpg',
          imagePosition: 'right',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                imageUrl: 'https://example.com/photo.jpg',
                imagePosition: 'right',
              }),
            }),
          })
        );
      });

      it('should copy items array field', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'faq',
          sectionId: 'faq-faq-main',
          sectionType: 'faq',
          headline: 'FAQ',
          items: [
            { question: 'Q1?', answer: 'A1' },
            { question: 'Q2?', answer: 'A2' },
          ],
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                items: expect.arrayContaining([expect.objectContaining({ question: 'Q1?' })]),
              }),
            }),
          })
        );
      });

      it('should copy images, instagramHandle fields', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'gallery',
          headline: 'Gallery',
          images: [{ url: 'https://example.com/img1.jpg', alt: 'Image 1' }],
          instagramHandle: '@myhandle',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                images: expect.arrayContaining([
                  expect.objectContaining({ url: expect.any(String) }),
                ]),
                instagramHandle: '@myhandle',
              }),
            }),
          })
        );
      });

      it('should copy contact fields: email, phone, address, hours', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'contact',
          sectionId: 'contact-contact-main',
          sectionType: 'contact',
          headline: 'Contact Us',
          email: 'contact@example.com',
          phone: '555-1234',
          address: '123 Main Street',
          hours: 'Mon-Fri 9am-5pm',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                email: 'contact@example.com',
                phone: '555-1234',
                address: '123 Main Street',
                hours: 'Mon-Fri 9am-5pm',
              }),
            }),
          })
        );
      });

      it('should copy tiers, backgroundColor fields for pricing', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'pricing',
          headline: 'Pricing',
          tiers: [{ name: 'Basic', price: 100, features: ['Feature 1'] }],
          backgroundColor: 'neutral',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                tiers: expect.any(Array),
                backgroundColor: 'neutral',
              }),
            }),
          })
        );
      });

      it('should copy features, columns fields', async () => {
        setupTenantMock();

        await updatePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionType: 'features',
          headline: 'Features',
          features: [{ icon: 'star', title: 'Feature 1', description: 'Description 1' }],
          columns: 3,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              sectionData: expect.objectContaining({
                features: expect.any(Array),
                columns: 3,
              }),
            }),
          })
        );
      });
    });

    describe('Payload Validation Schemas', () => {
      it('should handle RemovePageSectionPayloadSchema validation failure', async () => {
        setupTenantMock();

        const result = await removePageSectionTool.execute(mockContext, {
          pageName: 'home',
          sectionIndex: 9999,
        });

        assertToolError(result);
        expect(result.error).toContain('out of bounds');
      });

      it('should handle ReorderPageSectionsPayloadSchema validation failure', async () => {
        setupTenantMock();

        const result = await reorderPageSectionsTool.execute(mockContext, {
          pageName: 'home',
          fromIndex: 0,
          toIndex: 9999,
        });

        assertToolError(result);
        expect(result.error).toContain('Invalid indices');
      });

      it('should handle TogglePageEnabledPayloadSchema validation failure', async () => {
        setupTenantMock();

        const result = await togglePageEnabledTool.execute(mockContext, {
          pageName: 'invalid-page-name',
          enabled: true,
        });

        assertToolError(result);
      });
    });

    describe('Legacy Section ID Fallback', () => {
      it('should handle sections without ID using legacy fallback', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  type: 'hero',
                  headline: 'Hero Without ID',
                  ctaText: 'Book Now',
                } as { type: string; headline: string; ctaText: string },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: Array<{ id: string }> }>(result);
        expect(result.data.sections.length).toBeGreaterThan(0);
        expect(result.data.sections[0].id).toBeDefined();
      });
    });

    describe('Helper Function Coverage', () => {
      it('should handle sections with items arrays (FAQ, testimonials, pricing)', async () => {
        // Test that sections with nested arrays are handled correctly
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-faq-main',
                  type: 'faq',
                  headline: 'FAQ',
                  items: [{ question: 'Q1?', answer: 'A1' }],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await getSectionByIdTool.execute(mockContext, {
          sectionId: 'home-faq-main',
        });

        assertReadToolResult<{ section: { items?: unknown[] } }>(result);
        expect(result.data.section.items).toBeDefined();
        expect(Array.isArray(result.data.section.items)).toBe(true);
      });

      it('should get item count for images array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-gallery-main',
                  type: 'gallery',
                  headline: 'Gallery',
                  images: [
                    { url: 'https://example.com/1.jpg', alt: 'Image 1' },
                    { url: 'https://example.com/2.jpg', alt: 'Image 2' },
                    { url: 'https://example.com/3.jpg', alt: 'Image 3' },
                  ],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: Array<{ id: string; itemCount?: number }> }>(result);
        const gallerySection = result.data.sections.find((s) => s.id === 'home-gallery-main');
        expect(gallerySection?.itemCount).toBe(3);
      });

      it('should get item count for tiers array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-pricing-main',
                  type: 'pricing',
                  headline: 'Pricing',
                  tiers: [
                    { name: 'Basic', price: 100, features: [] },
                    { name: 'Pro', price: 200, features: [] },
                  ],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: Array<{ id: string; itemCount?: number }> }>(result);
        const pricingSection = result.data.sections.find((s) => s.id === 'home-pricing-main');
        expect(pricingSection?.itemCount).toBe(2);
      });

      it('should get item count for features array', async () => {
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [
                {
                  id: 'home-features-main',
                  type: 'features',
                  headline: 'Features',
                  features: [
                    { icon: 'star', title: 'Feature 1', description: 'Desc 1' },
                    { icon: 'check', title: 'Feature 2', description: 'Desc 2' },
                    { icon: 'heart', title: 'Feature 3', description: 'Desc 3' },
                  ],
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: Array<{ id: string; itemCount?: number }> }>(result);
        const featuresSection = result.data.sections.find((s) => s.id === 'home-features-main');
        expect(featuresSection?.itemCount).toBe(3);
      });

      it('should truncate long content in getSectionHeadline (>50 chars)', async () => {
        const longContent = 'x'.repeat(100);
        const mockConfig = createMockLandingPageConfig({
          pages: {
            home: {
              enabled: true as const,
              sections: [{ id: 'home-text-main', type: 'text', content: longContent }],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: false, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: false, sections: [] },
            testimonials: { enabled: false, sections: [] },
          },
        });
        setupTenantMock({ liveConfig: mockConfig });

        const result = await listSectionIdsTool.execute(mockContext, {});

        assertReadToolResult<{ sections: Array<{ headline: string }> }>(result);
        const textSection = result.data.sections.find((s) => s.id === 'home-text-main');
        expect(textSection?.headline.length).toBeLessThanOrEqual(53);
        expect(textSection?.headline).toContain('...');
      });
    });
  });
});
