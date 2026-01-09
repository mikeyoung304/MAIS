/**
 * UI Control Tools
 *
 * Tools for agent-controlled dashboard UI navigation and state management.
 * These tools enable the AI chatbot to control what's displayed in the content area,
 * implementing the Agent-First Dashboard Architecture.
 *
 * Trust Tiers:
 * - T1: Auto-confirm (navigation, view changes - no data modification)
 * - T3: Hard-confirm (publish_draft, discard_draft - critical actions)
 *
 * Note: These tools don't perform database operations directly. Instead, they return
 * `uiAction` payloads that the frontend interprets to update the Zustand store.
 *
 * @see plans/agent-first-dashboard-architecture.md
 */

import type { AgentTool, ToolContext, AgentToolResult } from './types';
import type { PageName } from '@macon/contracts';

// Valid page names for navigation
const PAGE_NAMES = ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'];

// Valid dashboard destinations for navigate_to
const DASHBOARD_DESTINATIONS = [
  'dashboard',
  'settings',
  'bookings',
  'services',
  'calendar',
  'analytics',
  'billing',
] as const;

// ============================================================================
// T1 Tools - Auto-confirm (UI state only, no data changes)
// ============================================================================

/**
 * show_preview - Display the storefront preview in the content area
 *
 * Trust Tier: T1 (auto-confirm)
 * Use this after making changes to sections or when the user wants to see their site.
 */
export const showPreviewTool: AgentTool = {
  name: 'show_preview',
  trustTier: 'T1',
  description: `Show the storefront preview in the content area so the user can see their website.

Use this:
- After making changes to sections
- When the user asks to see their site
- When discussing visual changes

Pages: home, about, services, faq, contact, gallery, testimonials`,
  inputSchema: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        description: 'Which page to show (defaults to home)',
        enum: PAGE_NAMES,
      },
    },
    required: [],
  },
  async execute(_context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const page = (params.page as PageName) || 'home';

    // Validate page name
    if (!PAGE_NAMES.includes(page)) {
      return {
        success: false,
        error: `Invalid page "${page}". Valid pages: ${PAGE_NAMES.join(', ')}`,
      };
    }

    return {
      success: true,
      data: {
        message: `Showing ${page} page preview.`,
        uiAction: { type: 'SHOW_PREVIEW', page },
      },
    };
  },
};

/**
 * hide_preview - Hide the preview and return to the dashboard view
 *
 * Trust Tier: T1 (auto-confirm)
 */
export const hidePreviewTool: AgentTool = {
  name: 'hide_preview',
  trustTier: 'T1',
  description: `Hide the storefront preview and return to the dashboard view.

Use this when the user wants to:
- Return to the main dashboard
- Stop editing their storefront
- Access other dashboard features`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(): Promise<AgentToolResult> {
    return {
      success: true,
      data: {
        message: 'Returning to dashboard.',
        uiAction: { type: 'SHOW_DASHBOARD' },
      },
    };
  },
};

/**
 * navigate_to - Navigate the user to a specific dashboard page
 *
 * Trust Tier: T1 (auto-confirm)
 */
export const navigateToTool: AgentTool = {
  name: 'navigate_to',
  trustTier: 'T1',
  description: `Navigate the user to a specific page in the dashboard.

Use this to help users find:
- Settings (account settings, payment settings)
- Bookings (view and manage bookings)
- Services (manage packages and add-ons)
- Calendar (availability and blackout dates)
- Analytics (business metrics)
- Billing (subscription and invoices)`,
  inputSchema: {
    type: 'object',
    properties: {
      destination: {
        type: 'string',
        description: 'The dashboard page to navigate to',
        enum: DASHBOARD_DESTINATIONS as unknown as string[],
      },
    },
    required: ['destination'],
  },
  async execute(_context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const destination = params.destination as string;

    // Validate destination
    if (!DASHBOARD_DESTINATIONS.includes(destination as (typeof DASHBOARD_DESTINATIONS)[number])) {
      return {
        success: false,
        error: `Invalid destination "${destination}". Valid destinations: ${DASHBOARD_DESTINATIONS.join(', ')}`,
      };
    }

    // Map destination to path
    const paths: Record<string, string> = {
      dashboard: '/tenant/dashboard',
      settings: '/tenant/settings',
      bookings: '/tenant/bookings',
      services: '/tenant/services',
      calendar: '/tenant/calendar',
      analytics: '/tenant/analytics',
      billing: '/tenant/billing',
    };

    return {
      success: true,
      data: {
        message: `Navigating to ${destination}.`,
        uiAction: { type: 'NAVIGATE', path: paths[destination] },
      },
    };
  },
};

/**
 * get_current_view - Get information about what the user is currently viewing
 *
 * Trust Tier: T1 (read-only)
 */
export const getCurrentViewTool: AgentTool = {
  name: 'get_current_view',
  trustTier: 'T1',
  description: `Get information about what the user is currently viewing in the dashboard.

Returns:
- Current view type (dashboard or preview)
- Current page if in preview mode
- Whether there are unpublished draft changes

Use this to understand context before making suggestions.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    // Get draft status to provide context
    const tenant = await context.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: {
        landingPageConfigDraft: true,
      },
    });

    const hasDraft = tenant?.landingPageConfigDraft !== null;

    // Note: Actual current view state comes from frontend Zustand store
    // This tool provides server-side context that complements the frontend state
    return {
      success: true,
      data: {
        hasDraft,
        note: hasDraft
          ? 'There are unpublished draft changes. Use show_preview to see them.'
          : 'No draft changes. The live version is being shown.',
      },
    };
  },
};

/**
 * highlight_section - Highlight a specific section in the preview
 *
 * Trust Tier: T1 (auto-confirm)
 */
export const highlightSectionTool: AgentTool = {
  name: 'highlight_section',
  trustTier: 'T1',
  description: `Highlight a specific section in the storefront preview.

Use this when:
- Referencing a section you just edited
- Helping the user locate a section
- Pointing out where changes were made

Section ID format: {page}-{type}-{qualifier}
Examples: home-hero-main, about-text-main, services-cta-main

Get section IDs from list_section_ids tool first.`,
  inputSchema: {
    type: 'object',
    properties: {
      sectionId: {
        type: 'string',
        description: 'Section ID to highlight (e.g., "home-hero-main")',
      },
    },
    required: ['sectionId'],
  },
  async execute(_context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const sectionId = params.sectionId as string;

    if (!sectionId) {
      return {
        success: false,
        error: 'sectionId is required. Use list_section_ids to find available sections.',
      };
    }

    // Extract page from section ID for auto-navigation
    const page = sectionId.split('-')[0] as PageName;

    return {
      success: true,
      data: {
        message: `Highlighting section ${sectionId}.`,
        uiAction: { type: 'HIGHLIGHT_SECTION', sectionId, page },
      },
    };
  },
};

// ============================================================================
// Export
// ============================================================================

/**
 * All UI control tools exported as array for registration
 */
export const uiTools: AgentTool[] = [
  showPreviewTool,
  hidePreviewTool,
  navigateToTool,
  getCurrentViewTool,
  highlightSectionTool,
];
