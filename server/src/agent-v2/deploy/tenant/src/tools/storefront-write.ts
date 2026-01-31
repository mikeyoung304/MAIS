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
 * Returns:
 * - Updated section content
 * - previewUrl for viewing changes
 * - hasDraft: true (since we just made changes)
 */
export const updateSectionTool = new FunctionTool({
  name: 'update_section',
  description: `Update content in an existing section. Changes go to DRAFT.

**WORKFLOW:**
1. Call get_page_structure first to get section IDs
2. Call this tool with the sectionId and new content
3. Changes are saved to draft (not live)
4. Tell user to check the preview

Editable fields vary by section type:
- Hero: headline, subheadline, ctaText, ctaUrl, backgroundImageUrl
- Text/About: headline, subheadline, content, imageUrl
- CTA: headline, subheadline, ctaText, ctaUrl

This is a T2 tool - executes and shows preview. User sees changes immediately in dashboard preview.`,
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

    logger.info({ sectionId: parseResult.data.sectionId }, '[TenantAgent] update_section called');

    // Call backend API
    const result = await callMaisApi('/storefront/update-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Return with hasDraft flag for proper LLM communication (pitfall #52)
    return {
      success: true,
      hasDraft: true,
      message: 'Section updated in draft',
      ...(result.data as Record<string, unknown>),
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

Section types:
- hero: Main banner with headline, subheadline, CTA, background image
- text: Text block with optional image (use for about, story sections)
- gallery: Image portfolio/gallery
- testimonials: Customer reviews/testimonials
- faq: Frequently asked questions accordion
- contact: Contact information and form
- cta: Call-to-action banner
- pricing: Pricing tiers/packages
- features: Feature highlights grid

Position is 0-based. Omit to add at end of page.

This is a T2 tool - executes and shows preview.`,
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

    logger.info(
      { pageName: parseResult.data.pageName, sectionType: parseResult.data.sectionType },
      '[TenantAgent] add_section called'
    );

    // Call backend API
    const result = await callMaisApi('/storefront/add-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      hasDraft: true,
      message: `Added ${parseResult.data.sectionType} section to ${parseResult.data.pageName}`,
      ...(result.data as Record<string, unknown>),
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
 */
export const removeSectionTool = new FunctionTool({
  name: 'remove_section',
  description: `Remove a section from a page. Changes go to DRAFT.

The section is removed from draft only. Can be undone by discarding the draft
before publishing.

Get sectionId from get_page_structure first.

This is a T2 tool - executes and shows preview.`,
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

    logger.info({ sectionId: parseResult.data.sectionId }, '[TenantAgent] remove_section called');

    // Call backend API
    const result = await callMaisApi('/storefront/remove-section', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      hasDraft: true,
      message: 'Section removed from draft',
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
 */
export const reorderSectionsTool = new FunctionTool({
  name: 'reorder_sections',
  description: `Move a section to a new position on its page. Changes go to DRAFT.

Position is 0-based:
- 0 = first section on page
- 1 = second section
- etc.

Get sectionId from get_page_structure first.

This is a T2 tool - executes and shows preview.`,
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

    logger.info(
      { sectionId: parseResult.data.sectionId, toPosition: parseResult.data.toPosition },
      '[TenantAgent] reorder_sections called'
    );

    // Call backend API
    const result = await callMaisApi('/storefront/reorder-sections', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      hasDraft: true,
      message: `Section moved to position ${parseResult.data.toPosition}`,
      ...(result.data as Record<string, unknown>),
    };
  },
});
