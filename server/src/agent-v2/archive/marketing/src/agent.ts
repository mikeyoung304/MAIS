/**
 * Marketing Specialist Agent - Standalone Deployment Package
 *
 * This is a COMPLETELY STANDALONE agent deployment for Vertex AI Agent Engine.
 * It has NO imports to the main MAIS codebase - all code is inlined.
 *
 * Purpose:
 * - Generate marketing copy (headlines, descriptions, taglines)
 * - Refine existing copy based on feedback
 * - Adapt content to different tones and contexts
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for fast, creative text generation
 * - Tools call MAIS backend via HTTP for tenant context
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

// The agent endpoint path - defaults to /v1/internal/agent (MAIS convention)
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

const MARKETING_AGENT_SYSTEM_PROMPT = `# Marketing Specialist Agent - System Prompt

## Identity

You are a marketing copywriting specialist for service professionals (photographers, coaches, therapists, wedding planners, etc.). You excel at creating compelling, authentic copy that converts visitors into clients.

## Your Personality
- Calm ops lead who texts fast
- Decisive — defaults to best practice
- Not precious — if user overrides: "Cool. Next."

## Operating Mode
Do → report → offer next step. No preambles.

Good:
- "Got it. Writing."
- "Done. Pick A or B."
- "Draft ready. Want tweaks?"

Never:
- "Great!" "Absolutely!" "I'd be happy to..."
- "Let me explain..."

## Confirmation Vocabulary
Use these: got it | done | on it | heard | draft ready
Never: Perfect! | Wonderful! | Amazing! | Awesome!

## Answer-to-Tone Translation

When generating copy, use the tenant's brand voice style from discovery facts:

| brandVoiceStyle | Copy Approach |
|-----------------|---------------|
| punchy (tequila/john-wick) | Short sentences. Active voice. Bold. "Wake Up Your Wardrobe." |
| warm (craft-beer/ted-lasso) | Friendly. Local. Approachable. "Your neighborhood partner." |
| clinical (water/nasa) | Precise. Reliable. Trust-focused. "99.9% uptime. Zero drama." |
| sophisticated (martini) | Elegant. Exclusive. Aspirational. "By invitation only." |

Check discoveryFacts for: brandVoiceStyle, technicalLevel, outcomeEmotion, archetype

## Core Capabilities

1. **Headline Generation**: Create attention-grabbing headlines for websites and landing pages
2. **Service Descriptions**: Write compelling descriptions that highlight value and benefits
3. **Taglines**: Craft memorable, concise brand taglines
4. **About Content**: Write authentic "about" sections that build trust
5. **Copy Refinement**: Improve existing copy based on feedback

## Writing Style Guidelines

### Tone Profiles

**Professional**: Clean, authoritative, confident. Good for consultants, coaches, B2B services.
**Warm**: Friendly, approachable, personable. Good for family photographers, therapists, wellness.
**Creative**: Bold, distinctive, memorable. Good for artists, designers, unique brands.
**Luxury**: Elegant, exclusive, refined. Good for high-end weddings, premium services.

### Copy Principles

1. **Benefits over features**: "Memories you'll treasure forever" not "Full-day coverage"
2. **Specificity beats vague**: "Austin-based newborn photographer" not "Professional photographer"
3. **Social proof when available**: Weave in testimonials, numbers, credibility markers
4. **Clear call-to-action**: Every piece should guide toward booking/contact
5. **Authentic voice**: Match the business owner's personality, not generic corporate

### Industry Nuances

- **Photographers**: Emphasize emotion, storytelling, lasting memories
- **Coaches/Consultants**: Focus on transformation, results, expertise
- **Therapists**: Lead with empathy, safety, understanding
- **Wedding vendors**: Romance, once-in-a-lifetime, stress-free experience

## Output Requirements

ALWAYS return structured output with:
1. **Primary content**: The main copy you're recommending
2. **Variants**: 2-3 alternative options with slightly different angles
3. **Rationale**: Brief explanation of your approach (1-2 sentences)

## Trust Tier

All marketing operations are T1 (read/generate) or T2 (preview). You never directly publish - the Concierge handles publishing decisions.

## Constraints

- Never use clichés like "passion for excellence" or "world-class service"
- Avoid superlatives without substantiation ("best", "leading", "top")
- Keep headlines under 10 words
- Keep taglines under 7 words
- Service descriptions should be 50-150 words
- Don't make up facts about the business - use context provided

## Context Injection

You will receive tenant context including:
- Business name and industry
- Current website copy (if any)
- Target audience
- Unique selling points
- Brand voice preferences

Use this to personalize all output.
`;

// =============================================================================
// TOOL PARAMETER SCHEMAS
// =============================================================================

const GenerateHeadlineParams = z.object({
  context: z
    .string()
    .describe('What the headline is for (e.g., "homepage hero section", "services page")'),
  currentHeadline: z.string().optional().describe('Current headline to improve upon, if any'),
  tone: z
    .enum(['professional', 'warm', 'creative', 'luxury'])
    .default('warm')
    .describe('Desired tone for the copy'),
  keywords: z.array(z.string()).optional().describe('Keywords to incorporate if possible'),
});

const GenerateServiceDescriptionParams = z.object({
  serviceName: z.string().describe('Name of the service/package'),
  serviceType: z
    .string()
    .describe('Type of service (e.g., "wedding photography", "life coaching session")'),
  priceRange: z
    .string()
    .optional()
    .describe('Price range for context (e.g., "premium", "accessible", "$500-1000")'),
  keyFeatures: z.array(z.string()).optional().describe('Key features/inclusions to highlight'),
  targetAudience: z.string().optional().describe('Who this service is for'),
  tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
});

const GenerateTaglineParams = z.object({
  businessContext: z
    .string()
    .describe('Brief description of the business and what makes it unique'),
  existingTagline: z.string().optional().describe('Current tagline to improve upon'),
  tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
});

const RefineCopyParams = z.object({
  originalCopy: z.string().describe('The original copy text to refine'),
  feedback: z.string().describe('Specific feedback or direction for refinement'),
  copyType: z
    .enum(['headline', 'tagline', 'description', 'about'])
    .describe('Type of copy being refined'),
});

const GetBusinessContextParams = z.object({});

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

/**
 * Helper to get tenant ID from tool context with proper null handling.
 * Uses 4-tier defensive pattern to handle both ADK session state and A2A protocol.
 */
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Get from session state using Map-like interface
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger.info({}, `[MarketingAgent] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch (e) {
    // state.get() might not be available or might throw
    logger.info({}, '[MarketingAgent] state.get() failed, trying alternatives');
  }

  // Try 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger.info({}, `[MarketingAgent] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch (e) {
    logger.info({}, '[MarketingAgent] state object access failed');
  }

  // Try 3: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger.info({}, `[MarketingAgent] Extracted tenantId from userId: ${tenantId}`);
        return tenantId;
      }
    } else {
      // userId might be the tenantId itself
      logger.info({}, `[MarketingAgent] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger.error({}, '[MarketingAgent] Could not extract tenantId from context');
  return null;
}

/**
 * Make an authenticated request to the MAIS backend API.
 */
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
      logger.error({}, `[MarketingAgent] API error: ${response.status} - ${errorText}`);
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({}, '[MarketingAgent] Backend API timeout after ${TIMEOUTS.BACKEND_API}ms');
      return { ok: false, error: 'Request timed out. Please try again.' };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '[MarketingAgent] Network error'
    );
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

// T1: Get business context for personalization
const getBusinessContextTool = new FunctionTool({
  name: 'get_business_context',
  description:
    'Get business information for personalizing marketing copy. Call this FIRST before generating any content.',
  parameters: GetBusinessContextParams,
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available. Session may not be properly initialized.' };
    }

    logger.info({}, `[MarketingAgent] get_business_context called for tenant: ${tenantId}`);
    const result = await callMaisApi('/business-info', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Generate headlines
const generateHeadlineTool = new FunctionTool({
  name: 'generate_headline',
  description:
    'Generate compelling headlines for website sections. Returns multiple variants to choose from.',
  parameters: GenerateHeadlineParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[MarketingAgent] generate_headline called with context: ${params.context}`);

    // Call backend endpoint to generate actual content
    const result = await callMaisApi('/marketing/generate-headline', tenantId, {
      context: params.context,
      currentHeadline: params.currentHeadline,
      tone: params.tone,
      keywords: params.keywords,
    });

    if (!result.ok) {
      return { error: result.error || 'Failed to generate headline' };
    }

    // Return actual generated content
    return result.data;
  },
});

// T1: Generate service descriptions
const generateServiceDescriptionTool = new FunctionTool({
  name: 'generate_service_description',
  description:
    'Generate compelling service/package descriptions that highlight value and convert visitors.',
  parameters: GenerateServiceDescriptionParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info(
      {},
      `[MarketingAgent] generate_service_description called for: ${params.serviceName}`
    );

    // Call backend endpoint to generate actual content
    const result = await callMaisApi('/marketing/generate-service-description', tenantId, {
      serviceName: params.serviceName,
      serviceType: params.serviceType,
      priceRange: params.priceRange,
      keyFeatures: params.keyFeatures,
      targetAudience: params.targetAudience,
      tone: params.tone,
    });

    if (!result.ok) {
      return { error: result.error || 'Failed to generate service description' };
    }

    // Return actual generated content
    return result.data;
  },
});

// T1: Generate taglines
const generateTaglineTool = new FunctionTool({
  name: 'generate_tagline',
  description:
    'Generate memorable brand taglines (under 7 words) that capture the essence of the business.',
  parameters: GenerateTaglineParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, '[MarketingAgent] generate_tagline called');

    // Call backend endpoint to generate actual content
    const result = await callMaisApi('/marketing/generate-tagline', tenantId, {
      businessContext: params.businessContext,
      existingTagline: params.existingTagline,
      tone: params.tone,
    });

    if (!result.ok) {
      return { error: result.error || 'Failed to generate tagline' };
    }

    // Return actual generated content
    return result.data;
  },
});

// T1: Refine existing copy
const refineCopyTool = new FunctionTool({
  name: 'refine_copy',
  description: 'Refine and improve existing copy based on specific feedback.',
  parameters: RefineCopyParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[MarketingAgent] refine_copy called for ${params.copyType}`);

    // Call backend endpoint to generate actual content
    const result = await callMaisApi('/marketing/refine-copy', tenantId, {
      originalCopy: params.originalCopy,
      feedback: params.feedback,
      copyType: params.copyType,
    });

    if (!result.ok) {
      return { error: result.error || 'Failed to refine copy' };
    }

    // Return actual generated content
    return result.data;
  },
});

// =============================================================================
// MARKETING SPECIALIST AGENT DEFINITION
// =============================================================================

/**
 * Marketing Specialist Agent
 *
 * Generates and refines marketing copy for service professionals.
 * This is a specialist agent that accepts delegated tasks from the Concierge.
 */
export const marketingAgent = new LlmAgent({
  name: 'marketing_specialist',
  description:
    'Marketing copywriting specialist that generates headlines, service descriptions, taglines, and refines existing copy. Expert in service professional industries.',

  // Model configuration - using Gemini 2.0 Flash for creative generation
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.7, // Higher temperature for more creative output
    maxOutputTokens: 2048,
  },

  // System prompt - defines personality and capabilities
  instruction: MARKETING_AGENT_SYSTEM_PROMPT,

  // Register all tools
  tools: [
    getBusinessContextTool,
    generateHeadlineTool,
    generateServiceDescriptionTool,
    generateTaglineTool,
    refineCopyTool,
  ],

  // Lifecycle callbacks for debugging
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { args: JSON.stringify(args).substring(0, 200) },
      `[MarketingAgent] Calling tool: ${tool.name}`
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    logger.info(
      {
        toolName: tool.name,
        result:
          typeof response === 'object'
            ? JSON.stringify(response).substring(0, 200)
            : String(response).substring(0, 200),
      },
      `[MarketingAgent] Tool result`
    );
    return undefined;
  },
});

// Default export for ADK deploy command
export default marketingAgent;
