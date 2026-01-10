/**
 * Storefront Build Mode Agent Tools
 *
 * Write tools for the Build Mode - Split-Screen Storefront Editor.
 * These tools enable AI-assisted editing of landing pages with real-time preview.
 *
 * Trust Tiers:
 * - T1: Auto-confirmed (reorder sections, toggle pages, discovery tools)
 * - T2: Soft confirm (content updates, branding changes, discard draft)
 * - T3: Requires approval (publish_draft - makes changes live to visitors)
 *
 * All write operations target the draft config (`landingPageConfigDraft`).
 * Changes become live only when user explicitly publishes (T3 approval required).
 *
 * Section ID Support:
 * - All section tools prefer sectionId over sectionIndex for reliable targeting
 * - Use list_section_ids to discover IDs before updating
 * - IDs follow {page}-{type}-{qualifier} pattern (e.g., "home-hero-main")
 *
 * Security:
 * - All tools use tenantId from JWT context
 * - Payloads validated against Zod schemas from executor-schemas (DRY)
 * - Server-side proposals prevent prompt injection bypass
 * - Section IDs validated against reserved patterns (prototype pollution prevention)
 */

import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from './types';
import { ProposalService } from '../proposals/proposal.service';
import {
  handleToolError,
  getDraftConfigWithSlug,
  resolveSectionIndex,
  getLegacySectionId,
} from './utils';
import {
  // Validation schemas (DRY - shared with executors)
  RemovePageSectionPayloadSchema,
  ReorderPageSectionsPayloadSchema,
  TogglePageEnabledPayloadSchema,
  UpdateStorefrontBrandingPayloadSchema,
  // Type guard for section ID detection (#664)
  isSectionWithId,
  // Types
  SectionSchema,
  PAGE_NAMES,
  SECTION_TYPES,
  type PageName,
  type SectionTypeName,
  type Section,
  type PagesConfig,
  type LandingPageConfig,
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
 *
 * RECOMMENDED: Use sectionId instead of sectionIndex for reliable updates.
 * Get section IDs from list_section_ids tool first.
 */
export const updatePageSectionTool: AgentTool = {
  name: 'update_page_section',
  trustTier: 'T2',
  description: `Update or add a section on a tenant's landing page.

Pages: home, about, services, faq, contact, gallery, testimonials
Section types: hero, text, gallery, testimonials, faq, contact, cta, pricing, features

PREFERRED: Use sectionId (e.g., "home-hero-main") to target specific section.
Get section IDs from list_section_ids tool first.

FALLBACK: Use sectionIndex (0-based) or omit to append new section.
Changes are saved to draft - user must publish to make live.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to update',
        enum: PAGE_NAMES as unknown as string[],
      },
      sectionId: {
        type: 'string',
        description:
          'PREFERRED: Section ID to update (e.g., "home-hero-main"). Get IDs from list_section_ids.',
      },
      sectionIndex: {
        type: 'number',
        description:
          'FALLBACK: Index of section to update (0-based). Omit or use -1 to append new section.',
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
    const sectionId = params.sectionId as string | undefined;
    let sectionIndex = params.sectionIndex as number | undefined;
    const sectionType = params.sectionType as string;

    try {
      // Get current draft config and slug in single query (#627 N+1 fix)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // =========================================================================
      // Resolve sectionId to sectionIndex (PREFERRED path)
      // Uses shared helper for DRY consistency (#661)
      // =========================================================================
      if (sectionId && sectionIndex === undefined) {
        const resolution = resolveSectionIndex(sectionId, pageName, pages);
        if (!resolution.success) {
          return { success: false, error: resolution.error };
        }
        sectionIndex = resolution.index;
      }

      // Build section data from params
      const sectionData: Record<string, unknown> = {
        type: sectionType,
      };

      // If updating existing section by ID, preserve the ID
      if (sectionId) {
        sectionData.id = sectionId;
      }

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

      // Determine operation
      const resolvedIndex =
        sectionIndex === undefined || sectionIndex === -1 ? page.sections.length : sectionIndex;

      const isAppend = resolvedIndex >= page.sections.length;

      const operation = isAppend
        ? `Add ${sectionType} section to ${pageName} page`
        : `Update ${sectionType} section on ${pageName} page${sectionId ? ` (${sectionId})` : ''}`;

      // Build payload
      const payload = {
        pageName,
        sectionIndex: isAppend ? -1 : resolvedIndex,
        sectionData: validatedSection,
      };

      // Build preview
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

PREFERRED: Use sectionId (e.g., "home-hero-main") to target specific section.
FALLBACK: Use sectionIndex (0-based) to remove by position.

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
      sectionId: {
        type: 'string',
        description:
          'PREFERRED: Section ID to remove (e.g., "home-cta-main"). Get IDs from list_section_ids.',
      },
      sectionIndex: {
        type: 'number',
        description: 'FALLBACK: Index of section to remove (0-based)',
      },
    },
    required: ['pageName'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const sectionId = params.sectionId as string | undefined;
    let sectionIndex = params.sectionIndex as number | undefined;

    try {
      // Get current draft config and slug in single query (#627 N+1 fix)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // =========================================================================
      // Resolve sectionId to sectionIndex (PREFERRED path)
      // Uses shared helper for DRY consistency (#661)
      // =========================================================================
      if (sectionId && sectionIndex === undefined) {
        const resolution = resolveSectionIndex(sectionId, pageName, pages);
        if (!resolution.success) {
          return { success: false, error: resolution.error };
        }
        sectionIndex = resolution.index;
      }

      // Require either sectionId or sectionIndex
      if (sectionIndex === undefined) {
        return {
          success: false,
          error: 'Either sectionId or sectionIndex is required.',
        };
      }

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

      // Validate section exists
      if (sectionIndex < 0 || sectionIndex >= page.sections.length) {
        return {
          success: false,
          error: `Section index ${sectionIndex} is out of bounds. Page has ${page.sections.length} sections.`,
        };
      }

      const sectionToRemove = page.sections[sectionIndex];
      const sectionType = sectionToRemove.type;
      const removedId = isSectionWithId(sectionToRemove) ? sectionToRemove.id : undefined;

      const operation = sectionId
        ? `Remove ${sectionType} section (${sectionId}) from ${pageName} page`
        : `Remove ${sectionType} section from ${pageName} page`;
      const payload = { pageName, sectionIndex };

      const preview: Record<string, unknown> = {
        action: 'remove',
        page: pageName,
        sectionType,
        sectionIndex,
        ...(removedId && { sectionId: removedId }),
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
        `Failed to create section removal proposal. Verify sectionId or sectionIndex is valid`
      );
    }
  },
};

/**
 * reorder_page_sections - Move a section to a new position
 *
 * Trust Tier: T1 (auto-confirm) - Low risk, easily reversible
 *
 * RECOMMENDED: Use fromSectionId instead of fromIndex for reliable targeting.
 * Get section IDs from list_section_ids tool first.
 */
export const reorderPageSectionsTool: AgentTool = {
  name: 'reorder_page_sections',
  trustTier: 'T1',
  description: `Reorder sections on a landing page by moving a section from one position to another.

PREFERRED: Use fromSectionId (e.g., "home-hero-main") to identify the section to move.
FALLBACK: Use fromIndex (0-based) if sectionId is not available.

Get section IDs from list_section_ids tool first.
Auto-confirms since order changes are low-risk and easily reversible.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Which page to modify',
        enum: PAGE_NAMES as unknown as string[],
      },
      fromSectionId: {
        type: 'string',
        description:
          'PREFERRED: Section ID to move (e.g., "home-cta-main"). Get IDs from list_section_ids.',
      },
      fromIndex: {
        type: 'number',
        description: 'FALLBACK: Current position of section to move (0-based)',
      },
      toIndex: {
        type: 'number',
        description: 'Target position to move section to (0-based)',
      },
    },
    required: ['pageName', 'toIndex'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const pageName = params.pageName as PageName;
    const fromSectionId = params.fromSectionId as string | undefined;
    let fromIndex = params.fromIndex as number | undefined;
    const toIndex = params.toIndex as number;

    try {
      // Get current draft config and slug in single query (#627 N+1 fix)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

      // Validate page exists
      const page = pages[pageName as keyof PagesConfig];
      if (!page) {
        return { success: false, error: `Page "${pageName}" not found` };
      }

      // =========================================================================
      // Resolve fromSectionId to fromIndex (PREFERRED path)
      // Uses shared helper for DRY consistency (#661)
      // =========================================================================
      if (fromSectionId && fromIndex === undefined) {
        const resolution = resolveSectionIndex(fromSectionId, pageName, pages);
        if (!resolution.success) {
          return { success: false, error: resolution.error };
        }
        fromIndex = resolution.index;
      }

      // Require either fromSectionId or fromIndex
      if (fromIndex === undefined) {
        return {
          success: false,
          error: 'Either fromSectionId or fromIndex is required.',
        };
      }

      // Validate payload (with resolved fromIndex)
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
      const movedId = isSectionWithId(sectionToMove) ? sectionToMove.id : undefined;

      const operation = fromSectionId
        ? `Move ${sectionType} section (${fromSectionId}) to position ${toIndex} on ${pageName}`
        : `Move ${sectionType} section from position ${fromIndex} to ${toIndex} on ${pageName}`;
      const payload = { pageName, fromIndex, toIndex };

      const preview: Record<string, unknown> = {
        action: 'reorder',
        page: pageName,
        sectionType,
        fromIndex,
        toIndex,
        ...(movedId && { sectionId: movedId }),
        hasDraft,
        previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
      };

      return createProposal(context, 'reorder_page_sections', operation, 'T1', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'reorder_page_sections',
        tenantId,
        'Failed to create reorder proposal. Verify fromSectionId or fromIndex is valid'
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

      // Get current draft config and slug in single query (#627 N+1 fix)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

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

      // Get slug for preview URL (#627 - only fetch slug, no draft needed)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      const slug = tenant?.slug;

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
 * Trust Tier: T3 (requires approval) - Makes changes live to visitors
 * Copies landingPageConfigDraft to landingPageConfig and clears draft
 *
 * T3 because this action has REAL IMPACT on visitors - once published,
 * changes are immediately visible. User must explicitly approve.
 */
export const publishDraftTool: AgentTool = {
  name: 'publish_draft',
  trustTier: 'T3',
  description: `Publish the current draft to make it live on the storefront.

This copies all draft changes to the live landing page configuration.
The draft is cleared after publishing.
Use this when the user is satisfied with their changes and wants them visible to visitors.

IMPORTANT: This requires explicit user approval because changes will be immediately
visible to all visitors.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext, _params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Check if there's a draft to publish (#627 N+1 fix - single query)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

      if (!hasDraft) {
        return {
          success: false,
          error: 'No draft changes to publish. Make some edits first.',
        };
      }

      const operation = 'Publish draft changes to live storefront';
      const payload = {};

      const preview: Record<string, unknown> = {
        action: 'publish',
        pageCount: Object.keys(pages).length,
        previewUrl: slug ? `/t/${slug}` : undefined,
        note: 'Draft changes will become visible to visitors immediately.',
        warning: 'This action requires your explicit approval.',
      };

      return createProposal(context, 'publish_draft', operation, 'T3', payload, preview);
    } catch (error) {
      return handleToolError(error, 'publish_draft', tenantId, 'Failed to create publish proposal');
    }
  },
};

/**
 * discard_draft - Discard all draft changes
 *
 * Trust Tier: T3 (user confirm) - Destructive and irreversible
 * Clears landingPageConfigDraft without affecting live config
 */
export const discardDraftTool: AgentTool = {
  name: 'discard_draft',
  trustTier: 'T3',
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
      // Check if there's a draft to discard (#627 N+1 fix - single query)
      const { hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

      if (!hasDraft) {
        return {
          success: false,
          error: 'No draft changes to discard.',
        };
      }

      const operation = 'Discard draft changes';
      const payload = {};

      const preview: Record<string, unknown> = {
        action: 'discard',
        previewUrl: slug ? `/t/${slug}` : undefined,
        note: 'All draft changes will be lost. This cannot be undone.',
      };

      return createProposal(context, 'discard_draft', operation, 'T3', payload, preview);
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
- Whether a draft exists (hasDraft)
- The current pages and sections from DRAFT if exists, otherwise from LIVE
- Summary of changes from live version

COMMUNICATION RULES (#699):
- If hasDraft=true: Say "In your unpublished draft..." or "Your draft shows..."
- If hasDraft=false: Say "On your live storefront..." or "Visitors currently see..."
- NEVER say "live" or "on your storefront" when hasDraft=true

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
      // Get draft config and slug in single query (#627 N+1 fix)
      const { pages, hasDraft, slug } = await getDraftConfigWithSlug(prisma, tenantId);

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
            ? 'DRAFT content shown above. Say "In your draft..." when discussing. Never say "live" or "on your storefront" - this is unpublished.'
            : 'LIVE content shown above. Say "On your live storefront..." when discussing - visitors see this now.',
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
// Discovery Tools (T1 - Read-only)
// ============================================================================

/**
 * Placeholder detection regex
 * Matches content like [Hero Headline] or [Your Business Name]
 */
const PLACEHOLDER_REGEX = /^\[[\w\s-]+\]$/;

/**
 * Section summary for discovery response
 */
interface SectionSummary {
  id: string;
  page: PageName;
  type: SectionTypeName;
  headline: string;
  hasPlaceholder: boolean;
  placeholderFields: string[];
  existsInDraft: boolean;
  existsInLive: boolean;
  itemCount?: number;
}

/**
 * Find fields containing placeholder text [Like This]
 */
function findPlaceholderFields(section: Section): string[] {
  const placeholders: string[] = [];

  const checkValue = (key: string, value: unknown): void => {
    if (typeof value === 'string' && PLACEHOLDER_REGEX.test(value)) {
      placeholders.push(key);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.entries(item).forEach(([k, v]) => {
            if (typeof v === 'string' && PLACEHOLDER_REGEX.test(v)) {
              placeholders.push(`${key}[${index}].${k}`);
            }
          });
        }
      });
    }
  };

  // Check all fields except type and id
  Object.entries(section).forEach(([key, value]) => {
    if (key !== 'type' && key !== 'id') {
      checkValue(key, value);
    }
  });

  return placeholders;
}

/**
 * Get item count for array-based sections
 */
function getItemCount(section: Section): number | undefined {
  if ('items' in section && Array.isArray(section.items)) {
    return section.items.length;
  }
  if ('images' in section && Array.isArray(section.images)) {
    return section.images.length;
  }
  if ('tiers' in section && Array.isArray(section.tiers)) {
    return section.tiers.length;
  }
  if ('features' in section && Array.isArray(section.features)) {
    return section.features.length;
  }
  return undefined;
}

/**
 * Get headline from a section (handles different section types)
 */
function getSectionHeadline(section: Section): string {
  if ('headline' in section && typeof section.headline === 'string') {
    return section.headline;
  }
  if ('content' in section && typeof section.content === 'string') {
    return section.content.substring(0, 50) + (section.content.length > 50 ? '...' : '');
  }
  return '';
}

/**
 * Collect all section IDs from a config
 */
function collectSectionIds(config: LandingPageConfig | null): Set<string> {
  const ids = new Set<string>();
  if (!config?.pages) return ids;

  for (const pageConfig of Object.values(config.pages)) {
    for (const section of pageConfig.sections || []) {
      if (isSectionWithId(section)) {
        ids.add(section.id);
      }
    }
  }
  return ids;
}

/**
 * list_section_ids - Discover all sections in tenant's storefront
 *
 * Trust Tier: T1 (auto-confirm) - Read-only operation
 * CALL THIS FIRST before updating any sections.
 */
export const listSectionIdsTool: AgentTool = {
  name: 'list_section_ids',
  trustTier: 'T1',
  description: `Discover all sections in the tenant's storefront.

Returns section IDs, types, and whether they contain placeholder content.
CALL THIS FIRST before updating any sections to get the correct IDs.

Filters:
- pageName: Filter by specific page
- sectionType: Filter by section type
- includeOnlyPlaceholders: Only return sections needing content`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        enum: PAGE_NAMES as unknown as string[],
        description: 'Filter by page (optional). Omit to get all pages.',
      },
      sectionType: {
        type: 'string',
        enum: SECTION_TYPES as unknown as string[],
        description: 'Filter by section type (optional).',
      },
      includeOnlyPlaceholders: {
        type: 'boolean',
        description: 'If true, only return sections with placeholder content.',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { pageName, sectionType, includeOnlyPlaceholders } = params as {
      pageName?: PageName;
      sectionType?: SectionTypeName;
      includeOnlyPlaceholders?: boolean;
    };

    try {
      // Get config using helper that falls back to defaults (fixes chatbot not seeing default frame)
      // TODO #718 FIX: Use raw configs from single query instead of N+1 pattern
      const {
        pages: workingPages,
        hasDraft,
        slug,
        rawDraftConfig,
        rawLiveConfig,
      } = await getDraftConfigWithSlug(prisma, tenantId);

      // Collect IDs from both configs for existsInDraft/existsInLive flags
      const draftIds = collectSectionIds(rawDraftConfig);
      const liveIds = collectSectionIds(rawLiveConfig);

      // Determine if we're showing defaults (neither draft nor live exists)
      const isShowingDefaults = !rawDraftConfig && !rawLiveConfig;

      const sections: SectionSummary[] = [];

      // Iterate through working config pages (includes defaults if no custom config)
      for (const [page, pageConfig] of Object.entries(workingPages)) {
        if (pageName && page !== pageName) continue;

        for (const section of pageConfig.sections || []) {
          if (sectionType && section.type !== sectionType) continue;

          // Use type guard for section ID detection (#664)
          const sectionId = isSectionWithId(section)
            ? section.id
            : getLegacySectionId(page, section.type);

          const headline = getSectionHeadline(section);
          const placeholderFields = findPlaceholderFields(section);
          const hasPlaceholder = placeholderFields.length > 0;

          if (includeOnlyPlaceholders && !hasPlaceholder) continue;

          sections.push({
            id: sectionId,
            page: page as PageName,
            type: section.type as SectionTypeName,
            headline,
            hasPlaceholder,
            placeholderFields,
            existsInDraft: draftIds.has(sectionId),
            existsInLive: liveIds.has(sectionId),
            itemCount: getItemCount(section),
          });
        }
      }

      // Build contextual note based on config state
      let note: string;
      if (isShowingDefaults) {
        note =
          'Showing DEFAULT template sections. This is the starting frame for new tenants - all fields have [placeholder] values. Update sections to customize their storefront.';
      } else if (hasDraft) {
        note = 'Sections from DRAFT. Say "In your draft..." when discussing content. Not live yet.';
      } else {
        note = 'Sections from LIVE. Say "On your storefront..." - visitors see this content.';
      }

      return {
        success: true,
        data: {
          sections,
          totalCount: sections.length,
          hasDraft,
          isShowingDefaults,
          placeholderCount: sections.filter((s) => s.hasPlaceholder).length,
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
          note,
        },
      };
    } catch (error) {
      return handleToolError(error, 'list_section_ids', tenantId, 'Failed to list sections');
    }
  },
};

/**
 * get_section_by_id - Get full content of a section by its ID
 *
 * Trust Tier: T1 (auto-confirm) - Read-only operation
 */
export const getSectionByIdTool: AgentTool = {
  name: 'get_section_by_id',
  trustTier: 'T1',
  description: `Get full content of a section by its ID.

Use this to see current content before making updates.
Get IDs from list_section_ids first.`,
  inputSchema: {
    type: 'object',
    properties: {
      sectionId: {
        type: 'string',
        description: 'Section ID (e.g., "home-hero-main"). Get IDs from list_section_ids.',
      },
    },
    required: ['sectionId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { sectionId } = params as { sectionId: string };

    try {
      // Get config using helper that falls back to defaults (fixes chatbot not seeing default frame)
      // TODO #718 FIX: Use raw configs from single query instead of N+1 pattern
      const {
        pages: workingPages,
        hasDraft,
        slug,
        rawDraftConfig,
        rawLiveConfig,
      } = await getDraftConfigWithSlug(prisma, tenantId);

      // Determine source state from raw configs
      const isShowingDefaults = !rawDraftConfig && !rawLiveConfig;

      // Find section by ID across all pages
      for (const [pageName, pageConfig] of Object.entries(workingPages)) {
        for (const section of pageConfig.sections || []) {
          // Use type guard for section ID detection (#664)
          const currentId = isSectionWithId(section)
            ? section.id
            : getLegacySectionId(pageName, section.type);

          if (currentId === sectionId) {
            // Build contextual note based on config state
            let note: string;
            if (isShowingDefaults) {
              note =
                'Content from DEFAULT template. All [placeholder] fields need to be customized. Update to personalize this section.';
            } else if (hasDraft) {
              note = 'Content from DRAFT. Say "In your draft..." when discussing. Not yet live.';
            } else {
              note = 'Content from LIVE. Say "On your storefront..." - visitors see this.';
            }

            return {
              success: true,
              data: {
                section,
                page: pageName,
                source: isShowingDefaults ? 'defaults' : hasDraft ? 'draft' : 'live',
                isShowingDefaults,
                placeholderFields: findPlaceholderFields(section),
                previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
                note,
              },
            };
          }
        }
      }

      // Not found - list available IDs
      const availableIds: string[] = [];
      for (const [pageName, pageConfig] of Object.entries(workingPages)) {
        for (const section of pageConfig.sections || []) {
          // Use type guard for section ID detection (#664)
          const id = isSectionWithId(section)
            ? section.id
            : getLegacySectionId(pageName, section.type);
          availableIds.push(id);
        }
      }

      return {
        success: false,
        error: `Section '${sectionId}' not found. Available sections: ${availableIds.join(', ') || 'none'}`,
      };
    } catch (error) {
      return handleToolError(error, 'get_section_by_id', tenantId, 'Failed to get section');
    }
  },
};

/**
 * get_unfilled_placeholders - Get all unfilled placeholder fields
 *
 * Trust Tier: T1 (auto-confirm) - Read-only operation
 * Use this to guide users through setup.
 */
export const getUnfilledPlaceholdersTool: AgentTool = {
  name: 'get_unfilled_placeholders',
  trustTier: 'T1',
  description: `Get all sections and fields that still contain placeholder content [Like This].

Use this to:
- See what content still needs to be filled in
- Guide users through setup
- Track completion progress`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Get config using helper that falls back to defaults (fixes chatbot not seeing default frame)
      // TODO #718 FIX: Use raw configs from single query instead of N+1 pattern
      const {
        pages: workingPages,
        hasDraft,
        slug,
        rawDraftConfig,
        rawLiveConfig,
      } = await getDraftConfigWithSlug(prisma, tenantId);

      // Determine source state from raw configs
      const isShowingDefaults = !rawDraftConfig && !rawLiveConfig;

      const unfilledItems: Array<{
        sectionId: string;
        page: string;
        sectionType: string;
        field: string;
        currentValue: string;
      }> = [];

      let totalFields = 0;
      let filledFields = 0;

      for (const [pageName, pageConfig] of Object.entries(workingPages)) {
        for (const section of pageConfig.sections || []) {
          // Use type guard for section ID detection (#664)
          const sectionId = isSectionWithId(section)
            ? section.id
            : getLegacySectionId(pageName, section.type);

          const placeholders = findPlaceholderFields(section);

          // Count editable fields for completion percentage
          const editableKeys = [
            'headline',
            'subheadline',
            'content',
            'ctaText',
            'email',
            'phone',
            'address',
            'hours',
          ];
          let sectionFields = 0;
          for (const key of editableKeys) {
            if (key in section) sectionFields++;
          }
          // Add array items to count
          const itemCount = getItemCount(section);
          if (itemCount) {
            sectionFields += itemCount * 2; // question+answer or quote+author etc
          }
          sectionFields = Math.max(sectionFields, 1);

          totalFields += sectionFields;
          filledFields += sectionFields - placeholders.length;

          // Add placeholder items to list
          for (const field of placeholders) {
            const value = getFieldValue(section, field);
            unfilledItems.push({
              sectionId,
              page: pageName,
              sectionType: section.type,
              field,
              currentValue: value,
            });
          }
        }
      }

      const percentComplete =
        totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100;

      // Build contextual summary based on config state
      let summary: string;
      if (isShowingDefaults) {
        summary = `Showing DEFAULT template. ${unfilledItems.length} placeholder fields to customize. Start by telling me about your business!`;
      } else if (unfilledItems.length === 0) {
        summary = 'All content is filled in! Ready to publish.';
      } else {
        summary = `${unfilledItems.length} fields still need content. ${percentComplete}% complete.`;
      }

      return {
        success: true,
        data: {
          unfilledItems,
          unfilledCount: unfilledItems.length,
          percentComplete,
          isShowingDefaults,
          hasDraft,
          summary,
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'get_unfilled_placeholders',
        tenantId,
        'Failed to get placeholder status'
      );
    }
  },
};

/**
 * Get value at a field path like "items[0].question"
 */
function getFieldValue(section: Section, fieldPath: string): string {
  const parts = fieldPath.split(/[\[\].]+/).filter(Boolean);
  let value: unknown = section;

  for (const part of parts) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }

  return typeof value === 'string' ? value : '';
}

// ============================================================================
// Export
// ============================================================================

/**
 * All storefront tools exported as array for registration
 */
export const storefrontTools: AgentTool[] = [
  // Discovery tools (T1 - read-only)
  listSectionIdsTool,
  getSectionByIdTool,
  getUnfilledPlaceholdersTool,
  // Write tools (T1/T2)
  updatePageSectionTool,
  removePageSectionTool,
  reorderPageSectionsTool,
  togglePageEnabledTool,
  updateStorefrontBrandingTool,
  publishDraftTool,
  discardDraftTool,
  getLandingPageDraftTool,
];
