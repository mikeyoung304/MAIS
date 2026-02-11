/**
 * Storefront Read Tools
 *
 * T1 tools for reading storefront structure and content.
 * These are read-only operations that execute immediately.
 *
 * Tools:
 * - get_page_structure: Read sections/pages layout
 * - get_section_content: Read full content of a section
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  callMaisApiTyped,
  requireTenantId,
  validateParams,
  wrapToolExecute,
  logger,
} from '../utils.js';
import { GenericRecordResponse, SectionContentResponse } from '../types/api-responses.js';
import { PAGE_NAMES } from '../constants/shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const GetPageStructureParams = z.object({
  pageName: z
    .enum(PAGE_NAMES)
    .optional()
    .describe('Filter by specific page, or omit for all pages'),
  includeOnlyPlaceholders: z
    .boolean()
    .optional()
    .describe('Only return sections with placeholder content'),
});

const GetSectionContentParams = z.object({
  sectionId: z
    .string()
    .min(1)
    .describe('Section ID (e.g., "home-hero-main"). Get from get_page_structure.'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Page Structure Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Page Structure Tool (T1)
 *
 * Returns the structure of the storefront including all pages and sections.
 * This tool should be called FIRST before making any edits to get section IDs.
 *
 * Returns:
 * - Page names and enabled status
 * - Section IDs, types, and headlines
 * - Placeholder indicators for sections needing content
 * - hasDraft flag indicating if there are unpublished changes
 */
export const getPageStructureTool = new FunctionTool({
  name: 'get_page_structure',
  description: `Get the structure of the storefront pages and sections.

**CALL THIS FIRST** before making any changes to understand the current layout.

Returns:
- Section IDs (required for update_section, remove_section, etc.)
- Section types and headlines
- Page enabled/disabled status
- Whether sections have placeholder content
- hasDraft flag (true if unpublished changes exist)

This is a T1 tool - executes immediately.`,
  parameters: GetPageStructureParams,
  execute: wrapToolExecute(async (params, context) => {
    const validatedParams = validateParams(GetPageStructureParams, params);
    const tenantId = requireTenantId(context);

    logger.info({ pageName: validatedParams.pageName }, '[TenantAgent] get_page_structure called');

    // Call backend API
    const result = await callMaisApiTyped(
      '/storefront/structure',
      tenantId,
      validatedParams,
      GenericRecordResponse
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      ...result.data,
    };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Section Content Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Section Content Tool (T1)
 *
 * Returns the full content of a specific section by ID.
 * Use this when you need to see the complete content of a section,
 * not just the summary from get_page_structure.
 *
 * Returns all editable fields for the section type:
 * - headline, subheadline
 * - content text
 * - ctaText, ctaUrl
 * - imageUrl, backgroundImageUrl
 * - items (for testimonials, FAQ, gallery)
 */
export const getSectionContentTool = new FunctionTool({
  name: 'get_section_content',
  description: `Get the full content of a specific section by its ID.

Use this when:
- You need to see complete section content before editing
- The user asks "what does my about section say?"
- You need to read existing content for enhancement

The sectionId comes from get_page_structure - call that first.

This is a T1 tool - executes immediately.`,
  parameters: GetSectionContentParams,
  execute: wrapToolExecute(async (params, context) => {
    const validatedParams = validateParams(GetSectionContentParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      { sectionId: validatedParams.sectionId },
      '[TenantAgent] get_section_content called'
    );

    // Call backend API
    const result = await callMaisApiTyped(
      '/storefront/section',
      tenantId,
      validatedParams,
      SectionContentResponse
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      ...result.data,
    };
  }),
});
