/**
 * Storefront Specialist Agent - Standalone Deployment Package
 *
 * This is a COMPLETELY STANDALONE agent deployment for Vertex AI Agent Engine.
 * It has NO imports to the main MAIS codebase - all code is inlined.
 *
 * Purpose:
 * - Read and modify landing page structure (sections, pages)
 * - Update content in sections (headlines, text, CTAs)
 * - Manage page visibility and ordering
 * - Preview draft changes
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for fast, structured responses
 * - Tools call MAIS backend via HTTP to read/write tenant storefront
 * - All changes go to draft first - publishing requires explicit action
 * - Tenant context comes from session state
 *
 * Deploy with: npm run deploy
 */

import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

/**
 * Lightweight structured logger for Cloud Run agents
 * Outputs JSON for easy parsing in Cloud Logging
 */
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(
      JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// Validate: Allow HTTP only for localhost, require HTTPS for all other hosts
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}

// =============================================================================
// SYSTEM PROMPT (Inlined)
// =============================================================================

const STOREFRONT_AGENT_SYSTEM_PROMPT = `# Storefront Specialist Agent - System Prompt

## Identity

You are a storefront editing specialist for service professionals. You help modify landing page structure, update content, and manage page layouts. You work with a draft system - changes are saved to draft until explicitly published.

## Core Capabilities

1. **Page Structure Discovery**: List sections and their IDs across all pages
2. **Section Content Updates**: Modify headlines, text, CTAs in specific sections
3. **Section Management**: Add, remove, reorder sections on pages
4. **Page Management**: Enable/disable entire pages
5. **Branding Updates**: Modify colors, fonts, logo
6. **Draft Preview**: Show preview URLs for draft changes

## Draft System Rules

**CRITICAL**: All changes go to DRAFT first. This protects the live site.

1. Changes via update_section, add_section, remove_section, reorder_sections → Saved to DRAFT
2. Draft changes are NOT visible to visitors until published
3. User must explicitly approve publishing (T3 action)
4. User can discard draft to revert all changes

## Communication Rules

Based on draft state returned by tools:
- If **hasDraft=true**: Say "In your unpublished draft..." or "Your draft shows..."
- If **hasDraft=false**: Say "On your live storefront..." or "Visitors currently see..."
- **NEVER** say "live" or "on your storefront" when hasDraft=true

## Workflow Pattern

1. **Always call get_page_structure first** to understand current layout
2. Use section IDs (not indices) for reliable targeting
3. After making changes, mention the preview URL
4. Group related changes together before suggesting publish

## Trust Tiers

| Operation | Tier | Behavior |
|-----------|------|----------|
| get_page_structure, get_section_content | T1 | Execute immediately |
| update_section, add_section, remove_section, reorder_sections | T2 | Execute + show preview |
| publish_draft, discard_draft | T3 | Require explicit approval |

## Section Types

Available section types:
- **hero**: Main banner with headline, subheadline, CTA, background image
- **text**: Text block with optional image
- **gallery**: Image gallery/portfolio
- **testimonials**: Customer testimonials/reviews
- **faq**: FAQ accordion
- **contact**: Contact information and form
- **cta**: Call-to-action banner
- **pricing**: Pricing tiers/packages
- **features**: Feature highlights

## Page Names

Available pages: home, about, services, faq, contact, gallery, testimonials

Note: Home page cannot be disabled.

## Things You Should NEVER Do

- Never publish without explicit user confirmation
- Never assume section indices - always use get_page_structure first
- Never make changes without explaining what will change
- Never forget to mention the preview URL after changes

## Example Conversation

User: "Change my homepage headline to 'Capturing Your Story'"

You should:
1. Call get_page_structure to find the hero section ID
2. Call update_section with the correct sectionId
3. Respond: "Done! Updated the headline in your draft. Check the preview: /t/your-slug?preview=draft"
`;

// =============================================================================
// CONSTANTS
// =============================================================================

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

// =============================================================================
// TOOL PARAMETER SCHEMAS
// =============================================================================

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
    .describe('Section ID (e.g., "home-hero-main"). Get from get_page_structure.'),
});

const UpdateSectionParams = z.object({
  sectionId: z.string().describe('Section ID to update. Get from get_page_structure first.'),
  headline: z.string().optional().describe('New headline text'),
  subheadline: z.string().optional().describe('New subheadline text'),
  content: z.string().optional().describe('New content text (for text sections)'),
  ctaText: z.string().optional().describe('New call-to-action button text'),
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
  sectionId: z.string().describe('Section ID to remove. Get from get_page_structure first.'),
});

const ReorderSectionsParams = z.object({
  sectionId: z.string().describe('Section ID to move'),
  toPosition: z.number().describe('New position (0-based)'),
});

const TogglePageParams = z.object({
  pageName: z.enum(PAGE_NAMES).describe('Page to enable/disable'),
  enabled: z.boolean().describe('true to enable, false to disable'),
});

const UpdateBrandingParams = z.object({
  primaryColor: z.string().optional().describe('Primary brand color (hex, e.g., "#1a365d")'),
  secondaryColor: z.string().optional().describe('Secondary color (hex)'),
  accentColor: z.string().optional().describe('Accent color (hex)'),
  backgroundColor: z.string().optional().describe('Background color (hex)'),
  fontFamily: z.string().optional().describe('Font family name'),
  logoUrl: z.string().optional().describe('Logo image URL'),
});

const PreviewDraftParams = z.object({});
const PublishDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "publish", "make it live", "ship it", or similar confirmation'
    ),
});
const DiscardDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "discard", "revert", "cancel changes", or similar confirmation'
    ),
});

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

const TIMEOUTS = {
  BACKEND_API: 15_000, // 15s for backend calls
  SPECIALIST_DEFAULT: 30_000, // 30s for marketing/storefront
  SPECIALIST_RESEARCH: 90_000, // 90s for research (web scraping)
  METADATA_SERVICE: 5_000, // 5s for GCP metadata
} as const;

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Get from session state using Map-like interface
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger.info({}, `[StorefrontAgent] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch (e) {
    // state.get() might not be available or might throw
    logger.info({}, '[StorefrontAgent] state.get() failed, trying alternatives');
  }

  // Try 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger.info({}, `[StorefrontAgent] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch (e) {
    logger.info({}, '[StorefrontAgent] state object access failed');
  }

  // Try 3: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger.info({}, `[StorefrontAgent] Extracted tenantId from userId: ${tenantId}`);
        return tenantId;
      }
    } else {
      // userId might be the tenantId itself
      logger.info({}, `[StorefrontAgent] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger.error({}, '[StorefrontAgent] Could not extract tenantId from context');
  return null;
}

async function callMaisApi(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ tenantId, ...params }),
      },
      TIMEOUTS.BACKEND_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({}, `[StorefrontAgent] API error: ${response.status} - ${errorText}`);
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({}, '[StorefrontAgent] Backend API timeout after ${TIMEOUTS.BACKEND_API}ms');
      return { ok: false, error: 'Request timed out. Please try again.' };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '[StorefrontAgent] Network error'
    );
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

// T1: Get page structure
const getPageStructureTool = new FunctionTool({
  name: 'get_page_structure',
  description: `Get the structure of the storefront pages and sections.
CALL THIS FIRST before making any changes to understand the current layout.
Returns section IDs, types, headlines, and whether content has placeholders.`,
  parameters: GetPageStructureParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, '[StorefrontAgent] get_page_structure called');
    const result = await callMaisApi('/storefront/structure', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Get section content
const getSectionContentTool = new FunctionTool({
  name: 'get_section_content',
  description: 'Get the full content of a specific section by its ID.',
  parameters: GetSectionContentParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[StorefrontAgent] get_section_content called for: ${params.sectionId}`);
    const result = await callMaisApi('/storefront/section', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T2: Update section
const updateSectionTool = new FunctionTool({
  name: 'update_section',
  description: `Update content in an existing section. Changes go to DRAFT.
Get the sectionId from get_page_structure first.`,
  parameters: UpdateSectionParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[StorefrontAgent] update_section called for: ${params.sectionId}`);
    const result = await callMaisApi('/storefront/update-section', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T2: Add section
const addSectionTool = new FunctionTool({
  name: 'add_section',
  description: `Add a new section to a page. Changes go to DRAFT.`,
  parameters: AddSectionParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info(
      {},
      `[StorefrontAgent] add_section called: ${params.sectionType} to ${params.pageName}`
    );
    const result = await callMaisApi('/storefront/add-section', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T2: Remove section
const removeSectionTool = new FunctionTool({
  name: 'remove_section',
  description: `Remove a section from a page. Changes go to DRAFT. Can be undone by discarding draft.`,
  parameters: RemoveSectionParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[StorefrontAgent] remove_section called: ${params.sectionId}`);
    const result = await callMaisApi('/storefront/remove-section', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T2: Reorder sections
const reorderSectionsTool = new FunctionTool({
  name: 'reorder_sections',
  description: `Move a section to a new position on its page. Changes go to DRAFT.`,
  parameters: ReorderSectionsParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info(
      {},
      `[StorefrontAgent] reorder_sections called: ${params.sectionId} to position ${params.toPosition}`
    );
    const result = await callMaisApi('/storefront/reorder-sections', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Toggle page
const togglePageTool = new FunctionTool({
  name: 'toggle_page',
  description: `Enable or disable an entire page. Home page cannot be disabled.`,
  parameters: TogglePageParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[StorefrontAgent] toggle_page called: ${params.pageName} = ${params.enabled}`);
    const result = await callMaisApi('/storefront/toggle-page', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T2: Update branding
const updateBrandingTool = new FunctionTool({
  name: 'update_branding',
  description: `Update storefront branding (colors, fonts, logo). Takes effect immediately.`,
  parameters: UpdateBrandingParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, '[StorefrontAgent] update_branding called');
    const result = await callMaisApi('/storefront/update-branding', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Preview draft
const previewDraftTool = new FunctionTool({
  name: 'preview_draft',
  description: 'Get the preview URL for the current draft.',
  parameters: PreviewDraftParams,
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, '[StorefrontAgent] preview_draft called');
    const result = await callMaisApi('/storefront/preview', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T3: Publish draft
const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: `Publish draft changes to make them live. REQUIRES explicit user confirmation.
This is a T3 action - only call after user says "yes", "publish it", or similar.`,
  parameters: PublishDraftParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    if (!params.confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        requiresConfirmation: true,
        message: 'Please confirm you want to publish these changes to your live site.',
      };
    }

    logger.info({}, '[StorefrontAgent] publish_draft called with confirmation');
    const result = await callMaisApi('/storefront/publish', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return {
      ...(result.data as Record<string, unknown>),
      published: true,
      message: 'Changes are now live!',
    };
  },
});

// T3: Discard draft
const discardDraftTool = new FunctionTool({
  name: 'discard_draft',
  description: `Discard all draft changes and revert to the live version. REQUIRES confirmation.`,
  parameters: DiscardDraftParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    if (!params.confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        requiresConfirmation: true,
        message:
          'Please confirm you want to discard all draft changes and revert to the live version.',
      };
    }

    logger.info({}, '[StorefrontAgent] discard_draft called with confirmation');
    const result = await callMaisApi('/storefront/discard', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return {
      ...(result.data as Record<string, unknown>),
      discarded: true,
      message: 'Draft changes discarded. Your live site is unchanged.',
    };
  },
});

// =============================================================================
// STOREFRONT SPECIALIST AGENT DEFINITION
// =============================================================================

/**
 * Storefront Specialist Agent
 *
 * Manages storefront structure, layout, sections, and branding.
 * This is a specialist agent that accepts delegated tasks from the Concierge.
 */
export const storefrontAgent = new LlmAgent({
  name: 'storefront_specialist',
  description:
    'Storefront editing specialist that manages landing page structure, sections, content, and branding. Expert in page layouts and content organization.',

  // Model configuration
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.3, // Lower temperature for more precise structural operations
    maxOutputTokens: 2048,
  },

  // System prompt
  instruction: STOREFRONT_AGENT_SYSTEM_PROMPT,

  // Register all tools
  tools: [
    getPageStructureTool,
    getSectionContentTool,
    updateSectionTool,
    addSectionTool,
    removeSectionTool,
    reorderSectionsTool,
    togglePageTool,
    updateBrandingTool,
    previewDraftTool,
    publishDraftTool,
    discardDraftTool,
  ],

  // Lifecycle callbacks
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { args: JSON.stringify(args).substring(0, 200) },
      `[StorefrontAgent] Calling tool: ${tool.name}`
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    const preview =
      typeof response === 'object'
        ? JSON.stringify(response).substring(0, 200)
        : String(response).substring(0, 200);
    logger.info({ result: preview }, `[StorefrontAgent] Tool result: ${tool.name}`);
    return undefined;
  },
});

// Default export for ADK deploy command
export default storefrontAgent;
