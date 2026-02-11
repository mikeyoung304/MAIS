/**
 * Branding Tool
 *
 * T2 tool for updating storefront branding (colors, fonts, logo).
 * Branding changes take effect immediately (not draft-based).
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, requireTenantId, validateParams, wrapToolExecute, logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

const UpdateBrandingParams = z.object({
  primaryColor: z.string().optional().describe('Primary brand color (hex, e.g., "#1a365d")'),
  secondaryColor: z.string().optional().describe('Secondary color (hex)'),
  accentColor: z.string().optional().describe('Accent color (hex)'),
  backgroundColor: z.string().optional().describe('Background color (hex)'),
  fontFamily: z
    .string()
    .optional()
    .describe('Font family name (e.g., "Inter", "Playfair Display")'),
  logoUrl: z.string().optional().describe('Logo image URL'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Branding Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update Branding Tool (T2)
 *
 * Updates storefront branding including colors, fonts, and logo.
 *
 * NOTE: Unlike section edits, branding changes take effect immediately
 * on the live site. This is because branding affects the entire site
 * and users expect to see changes right away.
 *
 * Color parameters should be hex values (e.g., "#1a365d").
 */
export const updateBrandingTool = new FunctionTool({
  name: 'update_branding',
  description: `Update storefront branding (colors, fonts, logo).

**NOTE:** Branding changes take effect IMMEDIATELY on the live site.
This is different from section edits which go to draft.

Editable branding:
- primaryColor: Main brand color (hex, e.g., "#1a365d")
- secondaryColor: Secondary brand color (hex)
- accentColor: Accent/highlight color (hex)
- backgroundColor: Site background color (hex)
- fontFamily: Font for headings (e.g., "Inter", "Playfair Display")
- logoUrl: URL to logo image

Color format: hex with # (e.g., "#1a365d", "#ffffff")

This is a T2 tool - executes and shows result.`,
  parameters: UpdateBrandingParams,
  execute: wrapToolExecute(async (params, context) => {
    const validatedParams = validateParams(UpdateBrandingParams, params);
    const tenantId = requireTenantId(context);

    // Check that at least one field is being updated
    const { primaryColor, secondaryColor, accentColor, backgroundColor, fontFamily, logoUrl } =
      validatedParams;
    if (
      !primaryColor &&
      !secondaryColor &&
      !accentColor &&
      !backgroundColor &&
      !fontFamily &&
      !logoUrl
    ) {
      return {
        success: false,
        error: 'At least one branding field must be provided',
      };
    }

    logger.info(
      {
        hasColors: !!(primaryColor || secondaryColor || accentColor || backgroundColor),
        hasFont: !!fontFamily,
        hasLogo: !!logoUrl,
      },
      '[TenantAgent] update_branding called'
    );

    // Call backend API
    const result = await callMaisApi('/storefront/update-branding', tenantId, validatedParams);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      message: 'Branding updated. Changes are live.',
      ...(result.data as Record<string, unknown>),
    };
  }),
});
