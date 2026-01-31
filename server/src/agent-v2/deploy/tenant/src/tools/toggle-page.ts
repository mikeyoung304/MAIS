/**
 * Toggle Page Tool
 *
 * T1 tool for enabling/disabling entire pages on the storefront.
 *
 * Note: The home page cannot be disabled.
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

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

const TogglePageParams = z.object({
  pageName: z.enum(PAGE_NAMES).describe('Page to enable/disable'),
  enabled: z.boolean().describe('true to enable the page, false to disable it'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Page Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle Page Tool (T1)
 *
 * Enables or disables an entire page on the storefront.
 *
 * When a page is disabled:
 * - It won't appear in navigation
 * - Direct links will show 404
 * - All sections on that page are hidden
 *
 * When a page is enabled:
 * - It appears in navigation
 * - Visitors can access it
 * - All sections on that page are visible
 *
 * NOTE: The home page cannot be disabled - it's always required.
 */
export const togglePageTool = new FunctionTool({
  name: 'toggle_page',
  description: `Enable or disable an entire page on the storefront.

Available pages:
- home (cannot be disabled)
- about
- services
- faq
- contact
- gallery
- testimonials

When disabled:
- Page won't appear in navigation
- Direct links show 404
- All sections on that page are hidden

When enabled:
- Page appears in navigation
- Visitors can access it

This is a T1 tool - executes immediately.`,
  parameters: TogglePageParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = TogglePageParams.safeParse(params);
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

    const { pageName, enabled } = parseResult.data;

    // Prevent disabling home page
    if (pageName === 'home' && !enabled) {
      return {
        success: false,
        error: 'The home page cannot be disabled. It is always required.',
      };
    }

    logger.info({ pageName, enabled }, '[TenantAgent] toggle_page called');

    // Call backend API
    const result = await callMaisApi('/storefront/toggle-page', tenantId, parseResult.data);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `${pageName} page ${enabled ? 'enabled' : 'disabled'}`,
      ...(result.data as Record<string, unknown>),
    };
  },
});
