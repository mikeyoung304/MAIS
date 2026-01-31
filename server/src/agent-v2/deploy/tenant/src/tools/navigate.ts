/**
 * Navigate Tool
 *
 * T1 tool for dashboard navigation. Instructs the frontend to navigate
 * to a specific dashboard section or scroll to a section on the website preview.
 *
 * This tool doesn't make API calls - it returns a dashboardAction that the
 * frontend interprets to perform the navigation.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { logger } from '../utils.js';
import type { BlockType } from '../context-builder.js';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Sections
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_SECTIONS = ['website', 'bookings', 'projects', 'settings', 'analytics'] as const;
type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Action Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashboard action types that the frontend knows how to handle.
 *
 * The agent returns these in tool responses, and the frontend
 * interprets them to perform UI actions.
 */
export type DashboardAction =
  | { type: 'NAVIGATE'; section: DashboardSection }
  | { type: 'SCROLL_TO_SECTION'; blockType: BlockType; highlight?: boolean }
  | { type: 'SHOW_PREVIEW'; fullScreen?: boolean }
  | { type: 'SHOW_CONFIRMATION'; message: string; confirmAction: string }
  | { type: 'REFRESH' };

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

const NavigateToDashboardSectionParams = z.object({
  section: z
    .enum(DASHBOARD_SECTIONS)
    .describe(
      'Dashboard section to navigate to: "website" (storefront editor), "bookings" (calendar & appointments), "projects" (customer projects), "settings" (account settings), "analytics" (metrics & reports)'
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigate to Dashboard Section Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigate to Dashboard Section Tool (T1)
 *
 * Navigates the user to a specific section of the dashboard.
 * This is a T1 tool - executes immediately without confirmation.
 */
export const navigateToDashboardSectionTool = new FunctionTool({
  name: 'navigate_to_section',
  description: `Navigate the user to a specific dashboard section.

Use this when:
- User asks to see their bookings → navigate to "bookings"
- User asks about analytics → navigate to "analytics"
- User wants to work on their website → navigate to "website"
- User needs to access settings → navigate to "settings"
- User wants to view projects → navigate to "projects"

This is a T1 tool - executes immediately.`,
  parameters: NavigateToDashboardSectionParams,
  execute: async (params) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = NavigateToDashboardSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const { section } = parseResult.data;

    logger.info({ section }, '[TenantAgent] Navigating to dashboard section');

    return {
      success: true,
      message: `Navigating to ${section}`,
      dashboardAction: {
        type: 'NAVIGATE',
        section,
      } as DashboardAction,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Scroll to Website Section Tool
// ─────────────────────────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  'HERO',
  'ABOUT',
  'SERVICES',
  'PRICING',
  'TESTIMONIALS',
  'FAQ',
  'CONTACT',
  'CTA',
  'GALLERY',
  'CUSTOM',
] as const;

const ScrollToWebsiteSectionParams = z.object({
  blockType: z
    .enum(BLOCK_TYPES)
    .describe(
      'Section type to scroll to in the website preview: HERO, ABOUT, SERVICES, PRICING, TESTIMONIALS, FAQ, CONTACT, CTA, GALLERY, CUSTOM'
    ),
  highlight: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to highlight the section after scrolling (default true)'),
});

/**
 * Scroll to Website Section Tool (T1)
 *
 * Scrolls the website preview to a specific section and optionally highlights it.
 * Used after making changes to show the user what was updated.
 */
export const scrollToWebsiteSectionTool = new FunctionTool({
  name: 'scroll_to_website_section',
  description: `Scroll the website preview to a specific section.

Use this when:
- After updating a section, to show the user the changes
- When user asks to see a specific section of their website
- To point out what section you're talking about

This is a T1 tool - executes immediately.`,
  parameters: ScrollToWebsiteSectionParams,
  execute: async (params) => {
    const parseResult = ScrollToWebsiteSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const { blockType, highlight } = parseResult.data;

    logger.info({ blockType, highlight }, '[TenantAgent] Scrolling to website section');

    return {
      success: true,
      message: `Scrolling to ${blockType} section`,
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        blockType: blockType as BlockType,
        highlight,
      } as DashboardAction,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Show Preview Tool
// ─────────────────────────────────────────────────────────────────────────────

const ShowPreviewParams = z.object({
  fullScreen: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to show the preview in full screen mode'),
});

/**
 * Show Preview Tool (T1)
 *
 * Shows or refreshes the website preview.
 */
export const showPreviewTool = new FunctionTool({
  name: 'show_preview',
  description: `Show or refresh the website preview.

Use this when:
- User asks to see their current website
- After making multiple changes, to refresh the preview
- User wants to see how things look before publishing

This is a T1 tool - executes immediately.`,
  parameters: ShowPreviewParams,
  execute: async (params) => {
    const parseResult = ShowPreviewParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const { fullScreen } = parseResult.data;

    logger.info({ fullScreen }, '[TenantAgent] Showing preview');

    return {
      success: true,
      message: fullScreen ? 'Showing full-screen preview' : 'Showing preview',
      dashboardAction: {
        type: 'SHOW_PREVIEW',
        fullScreen,
      } as DashboardAction,
    };
  },
});
