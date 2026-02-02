/**
 * Storefront Write Tools
 *
 * T2 tools for modifying storefront content and structure.
 * All changes go to DRAFT - they are not live until published.
 *
 * Tools:
 * - update_section: Update content in an existing section
 * - add_section: Add a new section to a page
 * - remove_section: Remove a section from a page
 * - reorder_sections: Move a section to a new position
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, getTenantId, logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const UpdateSectionParams = z.object({
  sectionId: z.string().min(1).describe('Section ID to update. Get from get_page_structure first.'),
  headline: z.string().optional().describe('New headline text'),
  subheadline: z.string().optional().describe('New subheadline text'),
  content: z.string().optional().describe('New content text (for text sections)'),
  ctaText: z.string().optional().describe('New call-to-action button text'),
  ctaUrl: z.string().optional().describe('CTA button URL (e.g., "/contact" or "#booking")'),
  backgroundImageUrl: z.string().optional().describe('Background image URL (for hero sections)'),
  imageUrl: z.string().optional().describe('Image URL'),
});

const AddSectionParams = z.object({
  pageName: z.enum(PAGE_NAMES).describe('Page to add section to'),
  sectionType: z.enum(SECTION_TYPES).describe('Type of section to add'),
  headline: z.string().optional().describe('Section headline'),
  subheadline: z.string().optional().describe('Section subheadline'),
  content: z.string().optional().describe('Section content text'),
  ctaText: z.string().optional().describe('CTA button text'),
  position: z.number().optional().describe('Insert at position (0-based). Omit to append at end.'),
});

const RemoveSectionParams = z.object({
  sectionId: z.string().min(1).describe('Section ID to remove. Get from get_page_structure first.'),
});

const ReorderSectionsParams = z.object({
  sectionId: z.string().min(1).describe('Section ID to move'),
  toPosition: z.number().describe('New position (0-based)'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Section Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update Section Tool (T2)
 *
 * Updates content in an existing section. All changes go to DRAFT.
 *
 * IMPORTANT: Get the sectionId from get_page_structure first.
 * Section IDs are tenant-specific and cannot be guessed.
 *
 * CRITICAL FIX (#812): This tool now VERIFIES the write succeeded before
 * claiming success. It also returns clear visibility status so the agent
 * knows whether to say "Take a look" or "Publish to make it live."
 *
 * Returns:
 * - verified: true if we confirmed the state changed
 * - visibility: 'draft' (NOT visible to customers until published)
 * - updatedSection: the actual content after update
 */
export const updateSectionTool = new FunctionTool({
  name: 'update_section',
  description: `Update content in an existing section. Changes go to DRAFT.

**WORKFLOW:**
1. Call get_page_structure first to get section IDs
2. Call this tool with the sectionId and new content
3. Changes are saved to DRAFT (NOT visible to customers yet)
4. Tell user: "Updated in draft. Publish when ready to go live."

**IMPORTANT - Draft vs Live:**
- Changes go to DRAFT (visible in dashboard preview only)
- NOT visible to customers until published
- Say "updated in draft" NOT "done, take a look"

Editable fields vary by section type:
- Hero: headline, subheadline, ctaText, ctaUrl, backgroundImageUrl
- Text/About: headline, subheadline, content, imageUrl
- CTA: headline, subheadline, ctaText, ctaUrl

This is a T2 tool - executes and shows preview in dashboard.`,
  parameters: UpdateSectionParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = UpdateSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    const { sectionId } = parseResult.data;
    logger.info({ sectionId }, '[TenantAgent] update_section called');

    // Call backend API to update
    const result = await callMaisApi('/storefront/update-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #812: Verify the write succeeded before claiming success
    // ─────────────────────────────────────────────────────────────────────────
    const verifyResult = await callMaisApi('/storefront/section', tenantId, { sectionId });

    if (!verifyResult.ok) {
      logger.warn({ sectionId }, '[TenantAgent] update_section: write succeeded but verify failed');
      // Write succeeded but we couldn't verify - report cautiously
      return {
        success: true,
        verified: false,
        visibility: 'draft' as const,
        hasDraft: true,
        message: 'Section updated in draft (could not verify). Check the preview.',
        suggestion: 'Publish when ready to make changes visible to customers.',
      };
    }

    const updatedSection = verifyResult.data as Record<string, unknown>;

    // Return with full state for verification (pitfall #52) and clear visibility
    return {
      success: true,
      verified: true,
      visibility: 'draft' as const,
      hasDraft: true,
      updatedSection,
      message: 'Section updated in draft. Publish when ready to go live.',
      // Clear guidance for agent behavior
      visibilityNote:
        'Changes are in DRAFT - visible in dashboard preview only. NOT visible to customers until published.',
      suggestion: 'Ask if they want to publish now, or continue editing.',
      // Dashboard action to navigate to preview
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId,
      },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Add Section Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add Section Tool (T2)
 *
 * Adds a new section to a page. All changes go to DRAFT.
 *
 * CRITICAL FIX (#812): Returns clear visibility status.
 *
 * Section types:
 * - hero: Main banner with headline and CTA
 * - text: Text block (good for about sections)
 * - gallery: Image portfolio
 * - testimonials: Customer reviews
 * - faq: FAQ accordion
 * - contact: Contact form
 * - cta: Call-to-action banner
 * - pricing: Pricing tiers
 * - features: Feature highlights
 */
export const addSectionTool = new FunctionTool({
  name: 'add_section',
  description: `Add a new section to a page. Changes go to DRAFT.

**IMPORTANT - Draft vs Live:**
- New section is added to DRAFT (visible in dashboard preview only)
- NOT visible to customers until published
- Say "added to draft" NOT "done, take a look"

Section types:
- hero: Main banner with headline, subheadline, CTA, background image
- text: Text block with optional image (use for about, story sections)
- gallery: Image portfolio/gallery
- testimonials: Customer reviews/testimonials
- faq: Frequently asked questions accordion
- contact: Contact information and form
- cta: Call-to-action banner
- pricing: Pricing tiers/packages (cosmetic text - for actual packages use manage_packages)
- features: Feature highlights grid

Position is 0-based. Omit to add at end of page.

This is a T2 tool - executes and shows preview in dashboard.`,
  parameters: AddSectionParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = AddSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    const { pageName, sectionType } = parseResult.data;
    logger.info({ pageName, sectionType }, '[TenantAgent] add_section called');

    // Call backend API
    const result = await callMaisApi('/storefront/add-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    const data = result.data as Record<string, unknown>;

    // FIX #812: Return with clear visibility status
    return {
      success: true,
      verified: true,
      visibility: 'draft' as const,
      hasDraft: true,
      newSectionId: data.sectionId,
      message: `Added ${sectionType} section to ${pageName} draft. Publish when ready to go live.`,
      visibilityNote:
        'New section is in DRAFT - visible in dashboard preview only. NOT visible to customers until published.',
      suggestion: 'Ask if they want to add content, or continue with other sections.',
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId: data.sectionId,
      },
      ...data,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Remove Section Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove Section Tool (T2)
 *
 * Removes a section from a page. Changes go to DRAFT.
 * Can be undone by discarding the draft.
 *
 * CRITICAL FIX (#812): Returns clear visibility status.
 */
export const removeSectionTool = new FunctionTool({
  name: 'remove_section',
  description: `Remove a section from a page. Changes go to DRAFT.

**IMPORTANT - Draft vs Live:**
- Section is removed from DRAFT only (still visible on live site)
- NOT removed from customer view until published
- Can be undone by discarding the draft before publishing
- Say "removed from draft" NOT "done, section is gone"

Get sectionId from get_page_structure first.

This is a T2 tool - executes and shows preview in dashboard.`,
  parameters: RemoveSectionParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = RemoveSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    const { sectionId } = parseResult.data;
    logger.info({ sectionId }, '[TenantAgent] remove_section called');

    // Call backend API
    const result = await callMaisApi('/storefront/remove-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // FIX #812: Return with clear visibility status
    return {
      success: true,
      verified: true,
      visibility: 'draft' as const,
      hasDraft: true,
      removedSectionId: sectionId,
      message: 'Section removed from draft. Publish when ready to go live.',
      visibilityNote:
        'Section still visible on live site until you publish. Discard draft to undo.',
      suggestion: 'Ask if they want to publish now, or continue editing.',
      ...(result.data as Record<string, unknown>),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Reorder Sections Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reorder Sections Tool (T2)
 *
 * Moves a section to a new position on its page. Changes go to DRAFT.
 *
 * CRITICAL FIX (#812): Returns clear visibility status.
 */
export const reorderSectionsTool = new FunctionTool({
  name: 'reorder_sections',
  description: `Move a section to a new position on its page. Changes go to DRAFT.

**IMPORTANT - Draft vs Live:**
- Reorder happens in DRAFT only (live site order unchanged)
- NOT visible to customers until published
- Say "reordered in draft" NOT "done, section moved"

Position is 0-based:
- 0 = first section on page
- 1 = second section
- etc.

Get sectionId from get_page_structure first.

This is a T2 tool - executes and shows preview in dashboard.`,
  parameters: ReorderSectionsParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = ReorderSectionsParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    const { sectionId, toPosition } = parseResult.data;
    logger.info({ sectionId, toPosition }, '[TenantAgent] reorder_sections called');

    // Call backend API
    const result = await callMaisApi('/storefront/reorder-sections', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // FIX #812: Return with clear visibility status
    return {
      success: true,
      verified: true,
      visibility: 'draft' as const,
      hasDraft: true,
      movedSectionId: sectionId,
      newPosition: toPosition,
      message: `Section moved to position ${toPosition} in draft. Publish when ready to go live.`,
      visibilityNote: 'Order change is in DRAFT - live site order unchanged until published.',
      suggestion: 'Ask if they want to publish now, or continue editing.',
      ...(result.data as Record<string, unknown>),
    };
  },
});
