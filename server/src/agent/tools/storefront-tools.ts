/**
 * Storefront Build Mode Agent Tools
 *
 * Write tools for the Build Mode - Split-Screen Storefront Editor.
 * These tools enable AI-assisted editing of landing pages with real-time preview.
 *
 * Trust Tiers:
 * - T1: Auto-confirmed (reorder sections, toggle pages)
 * - T2: Soft confirm (content updates, branding changes)
 *
 * All operations target the draft config (`landingPageConfigDraft`).
 * Changes become live only when user explicitly publishes.
 *
 * Security:
 * - All tools use tenantId from JWT context
 * - Payloads validated against Zod schemas from executor-schemas (DRY)
 * - Server-side proposals prevent prompt injection bypass
 */

import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from './types';
import { ProposalService } from '../proposals/proposal.service';
import { handleToolError, getDraftConfig, getTenantSlug } from './utils';
import {
  // Validation schemas (DRY - shared with executors)
  RemovePageSectionPayloadSchema,
  ReorderPageSectionsPayloadSchema,
  TogglePageEnabledPayloadSchema,
  UpdateStorefrontBrandingPayloadSchema,
  // Types
  SectionSchema,
  PAGE_NAMES,
  type PageName,
  type Section,
  type PagesConfig,
} from '../proposals/executor-schemas';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a proposal for a write operation
 */
async function createProposal(
  context: ToolContext,
  toolName: string,
  operation: string,
  trustTier: 'T1' | 'T2' | 'T3',
  payload: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<WriteToolProposal> {
  const proposalService = new ProposalService(context.prisma);

  const result = await proposalService.createProposal({
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    toolName,
    operation,
    trustTier,
    payload,
    preview,
  });

  return {
    success: true,
    proposalId: result.proposalId,
    operation: result.operation,
    preview: result.preview,
    trustTier: result.trustTier,
    requiresApproval: result.requiresApproval,
    expiresAt: result.expiresAt,
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * update_page_section - Update or add a section on a landing page
 *
 * Trust Tier: T2 (soft confirm) - Content changes
 * Saves to draft config, not live
 */
export const updatePageSectionTool: AgentTool = {
  name: 'update_page_section',
  trustTier: 'T2',
  description: `Update or add a section on a tenant's landing page.

Pages: home, about, services, faq, contact, gallery, testimonials
Section types: hero, text, gallery, testimonials, faq, contact, cta, pricing, features

Use sectionIndex to update existing section (0-based), or omit/use -1 to append new section.
Changes are saved to draft - user must publish to make live.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to update',
        enum: PAGE_NAMES as unknown as string[],
      },
      sectionIndex: {
        type: 'number',
        description: 'Index of section to update (0-based). Omit or use -1 to append new section.',
      },
      sectionType: {
        type: 'string',
        description:
          'Type of section (hero, text, gallery, testimonials, faq, contact, cta, pricing, features)',
        enum: [
          'hero',
          'text',
          'gallery',
          'testimonials',
          'faq',
          'contact',
          'cta',
          'pricing',
          'features',
        ],
      },
      headline: {
        type: 'string',
        description: 'Section headline (required for most section types)',
      },
      subheadline: {
        type: 'string',
        description: 'Section subheadline (optional)',
      },
      content: {
        type: 'string',
        description: 'Main content text (for text sections)',
      },
      ctaText: {
        type: 'string',
        description: 'Call-to-action button text',
      },
      items: {
        type: 'array',
        description: 'Items array for faq, testimonials, gallery, pricing, features sections',
      },
    },
    required: ['pageName', 'sectionType'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const sectionIndex = params.sectionIndex as number | undefined;
    const sectionType = params.sectionType as string;

    try {
      // Build section data from params
      const sectionData: Record<string, unknown> = {
        type: sectionType,
      };

      // Copy relevant fields based on section type
      const fieldsToCopy = [
        'headline',
        'subheadline',
        'content',
        'ctaText',
        'backgroundImageUrl',
        'imageUrl',
        'imagePosition',
        'items',
        'images',
        'instagramHandle',
        'email',
        'phone',
        'address',
        'hours',
        'tiers',
        'features',
        'columns',
        'backgroundColor',
      ];

      for (const field of fieldsToCopy) {
        if (params[field] !== undefined) {
          sectionData[field] = params[field];
        }
      }

      // Validate section data against schema
      const validationResult = SectionSchema.safeParse(sectionData);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid section data: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const validatedSection = validationResult.data as Section;

      // Get current draft config
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // Determine operation
      const resolvedIndex =
        sectionIndex === undefined || sectionIndex === -1 ? page.sections.length : sectionIndex;

      const isAppend = resolvedIndex >= page.sections.length;
      const isUpdate = !isAppend && resolvedIndex < page.sections.length;

      const operation = isAppend
        ? `Add ${sectionType} section to ${pageName} page`
        : `Update ${sectionType} section on ${pageName} page`;

      // Build payload
      const payload = {
        pageName,
        sectionIndex: isAppend ? -1 : resolvedIndex,
        sectionData: validatedSection,
      };

      // Build preview
      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: isAppend ? 'add' : 'update',
        page: pageName,
        sectionType,
        sectionIndex: isAppend ? page.sections.length : resolvedIndex,
        headline:
          validatedSection.type === 'hero'
            ? (validatedSection as { headline?: string }).headline
            : undefined,
        hasDraft,
        previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
      };

      return createProposal(context, 'update_page_section', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'update_page_section',
        tenantId,
        `Failed to create section update proposal for ${pageName}. Verify section data matches the expected schema`
      );
    }
  },
};

/**
 * remove_page_section - Remove a section from a landing page
 *
 * Trust Tier: T2 (soft confirm) - Destructive but reversible via discard
 */
export const removePageSectionTool: AgentTool = {
  name: 'remove_page_section',
  trustTier: 'T2',
  description: `Remove a section from a landing page.

Specify the page name and section index (0-based) to remove.
Changes are saved to draft - user must publish to make live.
Can be undone by discarding draft.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to modify',
        enum: PAGE_NAMES as unknown as string[],
      },
      sectionIndex: {
        type: 'number',
        description: 'Index of section to remove (0-based)',
      },
    },
    required: ['pageName', 'sectionIndex'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const sectionIndex = params.sectionIndex as number;

    try {
      // Validate payload
      const validationResult = RemovePageSectionPayloadSchema.safeParse({
        pageName,
        sectionIndex,
      });
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Get current draft config
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // Validate section exists
      if (sectionIndex < 0 || sectionIndex >= page.sections.length) {
        return {
          success: false,
          error: `Section index ${sectionIndex} is out of bounds. Page has ${page.sections.length} sections.`,
        };
      }

      const sectionToRemove = page.sections[sectionIndex];
      const sectionType = sectionToRemove.type;

      const operation = `Remove ${sectionType} section from ${pageName} page`;
      const payload = { pageName, sectionIndex };

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: 'remove',
        page: pageName,
        sectionType,
        sectionIndex,
        hasDraft,
        previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
        note: 'Section will be removed. Discard draft to undo.',
      };

      return createProposal(context, 'remove_page_section', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'remove_page_section',
        tenantId,
        `Failed to create section removal proposal. Verify section index is valid`
      );
    }
  },
};

/**
 * reorder_page_sections - Move a section to a new position
 *
 * Trust Tier: T1 (auto-confirm) - Low risk, easily reversible
 */
export const reorderPageSectionsTool: AgentTool = {
  name: 'reorder_page_sections',
  trustTier: 'T1',
  description: `Reorder sections on a landing page by moving a section from one position to another.

Specify the page, source index (fromIndex), and target index (toIndex).
Auto-confirms since order changes are low-risk and easily reversible.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to modify',
        enum: PAGE_NAMES as unknown as string[],
      },
      fromIndex: {
        type: 'number',
        description: 'Current position of section to move (0-based)',
      },
      toIndex: {
        type: 'number',
        description: 'Target position to move section to (0-based)',
      },
    },
    required: ['pageName', 'fromIndex', 'toIndex'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const fromIndex = params.fromIndex as number;
    const toIndex = params.toIndex as number;

    try {
      // Validate payload
      const validationResult = ReorderPageSectionsPayloadSchema.safeParse({
        pageName,
        fromIndex,
        toIndex,
      });
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Get current draft config
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // Validate indices
      const maxIndex = page.sections.length - 1;
      if (fromIndex < 0 || fromIndex > maxIndex || toIndex < 0 || toIndex > maxIndex) {
        return {
          success: false,
          error: `Invalid indices. Page has ${page.sections.length} sections (indices 0-${maxIndex}).`,
        };
      }

      if (fromIndex === toIndex) {
        return {
          success: false,
          error: 'Source and target positions are the same. No change needed.',
        };
      }

      const sectionToMove = page.sections[fromIndex];
      const sectionType = sectionToMove.type;

      const operation = `Move ${sectionType} section from position ${fromIndex} to ${toIndex} on ${pageName}`;
      const payload = { pageName, fromIndex, toIndex };

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: 'reorder',
        page: pageName,
        sectionType,
        fromIndex,
        toIndex,
        hasDraft,
        previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
      };

      return createProposal(context, 'reorder_page_sections', operation, 'T1', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'reorder_page_sections',
        tenantId,
        'Failed to create reorder proposal. Verify section indices are valid'
      );
    }
  },
};

/**
 * toggle_page_enabled - Enable or disable entire pages
 *
 * Trust Tier: T1 (auto-confirm) - Low risk visibility toggle
 * Note: Home page cannot be disabled
 */
export const togglePageEnabledTool: AgentTool = {
  name: 'toggle_page_enabled',
  trustTier: 'T1',
  description: `Enable or disable an entire page on the storefront.

Disabled pages won't appear in navigation or be accessible.
Home page cannot be disabled.
Auto-confirms since visibility toggles are low-risk.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to toggle',
        enum: PAGE_NAMES as unknown as string[],
      },
      enabled: {
        type: 'boolean',
        description: 'Whether page should be enabled (true) or disabled (false)',
      },
    },
    required: ['pageName', 'enabled'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const enabled = params.enabled as boolean;

    try {
      // Validate payload
      const validationResult = TogglePageEnabledPayloadSchema.safeParse({
        pageName,
        enabled,
      });
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Cannot disable home page
      if (pageName === 'home' && !enabled) {
        return { success: false, error: 'Home page cannot be disabled.' };
      }

      // Get current draft config
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // Check if already in desired state
      if (page.enabled === enabled) {
        return {
          success: false,
          error: `Page "${pageName}" is already ${enabled ? 'enabled' : 'disabled'}.`,
        };
      }

      const operation = enabled ? `Enable ${pageName} page` : `Disable ${pageName} page`;
      const payload = { pageName, enabled };

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: enabled ? 'enable' : 'disable',
        page: pageName,
        currentState: page.enabled ? 'enabled' : 'disabled',
        newState: enabled ? 'enabled' : 'disabled',
        hasDraft,
        previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
        note: enabled ? 'Page will appear in navigation' : 'Page will be hidden from navigation',
      };

      return createProposal(context, 'toggle_page_enabled', operation, 'T1', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'toggle_page_enabled',
        tenantId,
        'Failed to create page toggle proposal'
      );
    }
  },
};

/**
 * update_storefront_branding - Update brand colors, fonts, logo
 *
 * Trust Tier: T2 (soft confirm) - Visual changes affect entire storefront
 * NOTE: Branding changes are applied IMMEDIATELY (not part of draft system)
 */
export const updateStorefrontBrandingTool: AgentTool = {
  name: 'update_storefront_branding',
  trustTier: 'T2',
  description: `Update storefront branding (colors, fonts, logo).

NOTE: Branding changes take effect immediately and are NOT part of the draft system.
Changes cannot be discarded - they are applied directly to the live storefront.
All colors should be hex format (e.g., "#1a365d").`,
  inputSchema: {
    type: 'object',
    properties: {
      primaryColor: {
        type: 'string',
        description: 'Primary brand color in hex format (e.g., "#1a365d")',
      },
      secondaryColor: {
        type: 'string',
        description: 'Secondary/accent color in hex format',
      },
      accentColor: {
        type: 'string',
        description: 'Accent color for highlights in hex format',
      },
      backgroundColor: {
        type: 'string',
        description: 'Page background color in hex format',
      },
      fontFamily: {
        type: 'string',
        description: 'Font family name (e.g., "Inter", "Playfair Display")',
      },
      logoUrl: {
        type: 'string',
        description: 'URL to business logo image',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Validate payload
      const validationResult = UpdateStorefrontBrandingPayloadSchema.safeParse(params);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const validatedParams = validationResult.data;

      // Check at least one field provided
      const providedFields = Object.entries(validatedParams).filter(([_, v]) => v !== undefined);
      if (providedFields.length === 0) {
        return { success: false, error: 'At least one branding field must be provided.' };
      }

      const changes: string[] = providedFields.map(([k]) => k);
      const operation = `Update branding (${changes.join(', ')})`;
      const payload = validatedParams;

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: 'update_branding',
        changes,
        previewUrl: slug ? `/t/${slug}` : undefined,
        note: 'Branding changes take effect immediately (not part of draft system).',
      };

      return createProposal(
        context,
        'update_storefront_branding',
        operation,
        'T2',
        payload,
        preview
      );
    } catch (error) {
      return handleToolError(
        error,
        'update_storefront_branding',
        tenantId,
        'Failed to create branding proposal. Ensure colors are valid hex codes (e.g., "#1a365d")'
      );
    }
  },
};

/**
 * publish_draft - Publish draft changes to live storefront
 *
 * Trust Tier: T2 (soft confirm) - Makes draft changes live
 * Copies landingPageConfigDraft to landingPageConfig and clears draft
 */
export const publishDraftTool: AgentTool = {
  name: 'publish_draft',
  trustTier: 'T2',
  description: `Publish the current draft to make it live on the storefront.

This copies all draft changes to the live landing page configuration.
The draft is cleared after publishing.
Use this when the user is satisfied with their changes and wants them visible to visitors.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext, _params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Check if there's a draft to publish
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);

      if (!hasDraft) {
        return {
          success: false,
          error: 'No draft changes to publish. Make some edits first.',
        };
      }

      const operation = 'Publish draft changes to live storefront';
      const payload = {};

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: 'publish',
        pageCount: Object.keys(pages).length,
        previewUrl: slug ? `/t/${slug}` : undefined,
        note: 'Draft changes will become visible to visitors.',
      };

      return createProposal(context, 'publish_draft', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(error, 'publish_draft', tenantId, 'Failed to create publish proposal');
    }
  },
};

/**
 * discard_draft - Discard all draft changes
 *
 * Trust Tier: T2 (soft confirm) - Destructive but reversible
 * Clears landingPageConfigDraft without affecting live config
 */
export const discardDraftTool: AgentTool = {
  name: 'discard_draft',
  trustTier: 'T2',
  description: `Discard all draft changes and revert to the current live version.

This clears the draft without affecting the live landing page.
Use this when the user wants to start over or abandon their changes.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext, _params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Check if there's a draft to discard
      const { hasDraft } = await getDraftConfig(prisma, tenantId);

      if (!hasDraft) {
        return {
          success: false,
          error: 'No draft changes to discard.',
        };
      }

      const operation = 'Discard draft changes';
      const payload = {};

      const slug = await getTenantSlug(prisma, tenantId);
      const preview: Record<string, unknown> = {
        action: 'discard',
        previewUrl: slug ? `/t/${slug}` : undefined,
        note: 'All draft changes will be lost. This cannot be undone.',
      };

      return createProposal(context, 'discard_draft', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(error, 'discard_draft', tenantId, 'Failed to create discard proposal');
    }
  },
};

/**
 * get_landing_page_draft - Get current draft state
 *
 * Trust Tier: T1 (auto-confirm) - Read-only operation
 * Returns the current draft config and whether it differs from live
 */
export const getLandingPageDraftTool: AgentTool = {
  name: 'get_landing_page_draft',
  trustTier: 'T1',
  description: `Get the current draft state of the landing page.

Returns:
- Whether a draft exists
- The current draft pages and sections
- Summary of changes from live version

Use this to understand the current editing state before making changes.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Optional: specific page to get details for',
        enum: ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'],
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as string | undefined;

    try {
      const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);
      const slug = await getTenantSlug(prisma, tenantId);

      // Build summary of pages and their section counts
      const pageSummary = Object.entries(pages).map(([name, page]) => ({
        name,
        enabled: page.enabled,
        sectionCount: page.sections.length,
        sectionTypes: page.sections.map((s: Section) => s.type),
      }));

      // If specific page requested, include full details
      let pageDetails: Record<string, unknown> | undefined;
      if (pageName && pages[pageName as keyof PagesConfig]) {
        const page = pages[pageName as keyof PagesConfig];
        pageDetails = {
          pageName,
          enabled: page.enabled,
          sections: page.sections.map((section: Section, index: number) => ({
            index,
            type: section.type,
            headline:
              'headline' in section ? (section as { headline?: string }).headline : undefined,
          })),
        };
      }

      return {
        success: true,
        data: {
          hasDraft,
          pages: pageSummary,
          ...(pageDetails && { pageDetails }),
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
          note: hasDraft
            ? 'Draft has unpublished changes. Use publish_draft to make them live.'
            : 'No draft changes. Live config is being shown.',
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'get_landing_page_draft',
        tenantId,
        'Failed to get draft state'
      );
    }
  },
};

// ============================================================================
// Export
// ============================================================================

/**
 * All storefront tools exported as array for registration
 */
export const storefrontTools: AgentTool[] = [
  updatePageSectionTool,
  removePageSectionTool,
  reorderPageSectionsTool,
  togglePageEnabledTool,
  updateStorefrontBrandingTool,
  publishDraftTool,
  discardDraftTool,
  getLandingPageDraftTool,
];
