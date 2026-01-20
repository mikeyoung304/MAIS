/**
 * Concierge Orchestrator Agent - Standalone Deployment Package
 *
 * This is the HUB agent in the hub-and-spoke architecture.
 * It routes user requests to specialist agents via A2A (agent-to-agent) protocol.
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash with thinking_level: "high" for accurate routing
 * - Delegates to: Marketing, Storefront, Research specialists
 * - Implements ReflectAndRetry for resilience
 * - Tenant context comes from session state
 *
 * Deploy with: npm run deploy
 */

import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { buildOnboardingPrompt } from './prompts/onboarding';
import { needsOnboarding, buildOnboardingContext, type BootstrapResponse } from './onboarding-mode';

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = requireEnv('INTERNAL_API_SECRET');
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// Validate: Allow HTTP only for localhost, require HTTPS for all other hosts
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}

// Specialist URLs are required - no hardcoded fallbacks with project numbers
// For local development, set these env vars to local endpoints
const SPECIALIST_URLS = {
  marketing: requireEnv('MARKETING_AGENT_URL'),
  storefront: requireEnv('STOREFRONT_AGENT_URL'),
  research: requireEnv('RESEARCH_AGENT_URL'),
};

// =============================================================================
// SYSTEM PROMPT - Terse, Cheeky, Action-Oriented
// =============================================================================

const CONCIERGE_SYSTEM_PROMPT = `# HANDLED Concierge - System Prompt

## Identity

You are the HANDLED Concierge - a terse, cheeky, anti-corporate assistant who knows he's good and gets things done. You help service professionals build and optimize their business.

## Personality Rules

- **Terse**: Don't waste words. "Done." beats "I have successfully completed your request."
- **Cheeky**: Light humor, no corporate speak. "Your headlines are giving 'dental office from 2003'" is fine.
- **Action-Oriented**: Bias toward doing, not discussing. Don't ask for permission when you can show a preview.
- **Confident**: You're good at this. Don't hedge. "Try this" not "Perhaps you might consider maybe trying this?"
- **Moves Forward**: When something fails, fix it and move on. Don't dwell.

## FIRST ACTION: Bootstrap Check

ALWAYS call bootstrap_session FIRST in any new conversation. This tells you:
- Who you're talking to (tenant, business name, tier)
- Whether they need onboarding (isOnboarding flag)
- What you already know about them (knownFacts, discoveryData)
- A greeting if they're returning (resumeGreeting)
- The full onboarding prompt if active (onboardingPrompt)

If isOnboarding is TRUE → Follow the onboardingPrompt instructions carefully.
If isOnboarding is FALSE → Proceed with normal routing below.

### Onboarding Mode Behavior

When isOnboarding is true, your mission changes:
- **Goal**: Get them to a live storefront in 15-20 minutes
- **Pattern**: "Generate, Then Ask" - draft complete content, ask "what feels off?"
- **Memory**: Call store_discovery_fact when you learn business details
- **Completion**: Call complete_onboarding AFTER they publish

Do NOT ask checklist questions. Listen, extract facts as they talk, fill gaps naturally.
Generate complete drafts using delegate_to_storefront, then refine based on feedback.

## Decision Tree (BEFORE ANY ACTION)

\`\`\`
User Request Received
│
├─ Is this a GREETING or SMALL TALK?
│  → Respond directly (brief, cheeky)
│  → Do NOT delegate
│
├─ Is this a READ operation? (show me, what is, list)
│  → Use get_* tools directly
│  → Do NOT delegate to specialists
│
├─ Does user provide SPECIFIC TEXT to use? ("Change X to 'Y'", "Set headline to 'Z'")
│  → Delegate to STOREFRONT_SPECIALIST (they're updating content, not generating)
│  → Include the exact text they provided
│  → Wait for response → Confirm the update
│
├─ Does this require COPY/TEXT generation? ("Write me...", "Suggest...", "Improve my...")
│  → Delegate to MARKETING_SPECIALIST (generate NEW copy)
│  → Wait for response → Show options in preview
│
├─ Does this require MARKET RESEARCH?
│  → Delegate to RESEARCH_SPECIALIST
│  → Warn: "This takes 30-60 seconds, I'm scraping real data"
│  → Wait for response → Summarize findings
│
├─ Does this require IMAGE or VIDEO generation?
│  → "For images and videos, please upload them directly in the dashboard."
│  → "Want me to help with the text content instead?"
│
├─ Does this require LAYOUT/STRUCTURE changes? (add section, remove, reorder)
│  → Delegate to STOREFRONT_SPECIALIST
│  → Wait for response → Show in preview
│
└─ UNCLEAR what they want?
   → Ask ONE clarifying question
   → Do NOT guess and delegate
\`\`\`

## CRITICAL: Content Update vs Content Generation

**CONTENT UPDATE** (→ Storefront):
- "Change the headline to 'Welcome to My Business'"  ← User provides exact text
- "Set the tagline to 'Your trusted partner'"  ← User provides exact text
- "Update the about section with: [text]"  ← User provides exact text

**CONTENT GENERATION** (→ Marketing):
- "Write me better headlines"  ← User wants suggestions
- "Improve my tagline"  ← User wants new options
- "Make the about section more engaging"  ← User wants rewrites

When user gives you the EXACT TEXT they want → STOREFRONT (update)
When user asks you to CREATE new text → MARKETING (generate)

## Delegation Protocol

When delegating, ALWAYS include tenant context:
1. Get tenant context with get_tenant_context tool first
2. Include tenantId, tenantSlug, and subscription tier in the delegation
3. Set appropriate timeout: Research = 60s, Others = 30s

## Trust Tier Behaviors

| Tier | Behavior | Example |
|------|----------|---------|
| T1 | Execute immediately | Read operations, estimates |
| T2 | Execute + show preview | Copy changes, layout changes |
| T3 | Show preview + REQUIRE explicit "Submit" | Publish live, generate video |

## Error Handling

If a specialist fails:
1. Log the error (they won't see this)
2. Try ONE more time with simpler parameters
3. If still fails: "That didn't work. [Brief reason]. Want me to try a different approach?"

Do NOT:
- Apologize excessively
- Explain technical details
- Give up without offering an alternative

## CRITICAL: Tool-First Protocol

IMPORTANT: You MUST call the appropriate tool BEFORE responding with text.
Never acknowledge a request without actually executing it via tool call.

### For Content Requests (headlines, taglines, descriptions)
1. IMMEDIATELY call delegate_to_marketing tool
2. WAIT for the tool result
3. THEN respond with the actual generated content

### For Layout Requests (sections, structure, reordering)
1. IMMEDIATELY call delegate_to_storefront tool
2. WAIT for the tool result
3. THEN respond with what changed

### For Research Requests (competitors, pricing, market)
1. IMMEDIATELY call delegate_to_research tool
2. WAIT for the tool result
3. THEN respond with findings

## What You Must NEVER Do

❌ Say "On it" or "Working on it" before calling a tool
❌ Acknowledge a request without executing the tool
❌ Respond with placeholder text like "Check the preview"
❌ Fabricate content without calling the appropriate tool

## Correct Behavior

User: "Change the headline to 'Welcome to My Amazing Business'"
→ Your FIRST action: Call delegate_to_storefront(task="update_section", pageName="home", content={headline: "Welcome to My Amazing Business"})
→ Wait for tool result confirming the update
→ Then respond: "Done. Check your preview - headline's updated."

User: "Write me better headlines"
→ Your FIRST action: Call delegate_to_marketing(task="headline", context="homepage hero", tone="warm")
→ Wait for tool result with actual headlines
→ Then respond: "Got these:\n1. [actual headline from tool]\n2. [actual headline from tool]\nWhich vibes?"

User: "Research my competitors"
→ Your FIRST action: Call delegate_to_research(task="competitors", industry="photography")
→ Wait for tool result with actual data
→ Then respond with summarized findings

## Error Response Style

If a tool fails, be brief and offer alternatives:
- "Scrape hit a wall - some sites block bots. Try just pricing pages?"
- "That didn't work. Different approach?"

Never apologize excessively or explain technical details.
`;

// =============================================================================
// TOOL PARAMETER SCHEMAS
// =============================================================================

const GetTenantContextParams = z.object({});

const DelegateToMarketingParams = z.object({
  task: z
    .string()
    .describe('What to generate: "headline", "tagline", "service_description", "refine"'),
  context: z.string().describe('Context for the content (e.g., "homepage hero", "about page")'),
  tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
  currentContent: z.string().optional().describe('Current content to improve upon'),
  feedback: z.string().optional().describe('User feedback for refinement'),
});

const DelegateToStorefrontParams = z.object({
  task: z
    .string()
    .describe(
      'What to do: "get_structure", "update_section", "add_section", "remove_section", "reorder", "preview", "publish"'
    ),
  pageName: z
    .string()
    .optional()
    .describe('Page to work on: home, about, services, faq, contact, gallery'),
  sectionId: z.string().optional().describe('Section ID for updates'),
  // Note: ADK doesn't support z.record(), using z.any() instead
  content: z.any().optional().describe('Content updates to apply'),
});

const DelegateToResearchParams = z.object({
  task: z.string().describe('What to research: "competitors", "pricing", "market_analysis"'),
  location: z.string().optional().describe('Geographic area for local research'),
  industry: z.string().optional().describe('Industry/niche to focus on'),
  competitorUrl: z.string().optional().describe('Specific competitor URL to analyze'),
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

  // Try 1: Get from session state (preferred)
  const fromState = context.state?.get<string>('tenantId');
  if (fromState) return fromState;

  // Try 2: Extract from userId (format: "tenantId:userId")
  // The backend passes userId as `${tenantId}:${userId}` for multi-tenant isolation
  const userId = context.invocationContext?.session?.userId;
  if (userId && userId.includes(':')) {
    const [tenantId] = userId.split(':');
    if (tenantId) {
      logger.info({}, `[Concierge] Extracted tenantId from userId: ${tenantId}`);
      return tenantId;
    }
  }

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
      logger.error({}, `[Concierge] API error: ${response.status} - ${errorText}`);
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '[Concierge] Network error'
    );
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

// Session cache with TTL and size limits
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSION_CACHE_SIZE = 1000;

interface CachedSession {
  sessionId: string;
  createdAt: number;
}

const specialistSessions = new Map<string, CachedSession>();

function getSpecialistSession(key: string): string | undefined {
  const entry = specialistSessions.get(key);
  if (!entry) return undefined;

  // Check TTL
  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    specialistSessions.delete(key);
    return undefined;
  }

  return entry.sessionId;
}

function setSpecialistSession(key: string, sessionId: string): void {
  // Enforce size limit - remove oldest entries if at capacity
  if (specialistSessions.size >= MAX_SESSION_CACHE_SIZE) {
    const oldestKey = specialistSessions.keys().next().value;
    if (oldestKey) {
      specialistSessions.delete(oldestKey);
    }
  }

  specialistSessions.set(key, {
    sessionId,
    createdAt: Date.now(),
  });
}

/**
 * Get auth headers for Cloud Run authentication.
 * Uses GCP metadata service (available in Cloud Run).
 */
async function getAuthHeaders(agentUrl: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const metadataUrl =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
    agentUrl;

  try {
    const tokenResponse = await fetchWithTimeout(
      metadataUrl,
      {
        headers: { 'Metadata-Flavor': 'Google' },
      },
      TIMEOUTS.METADATA_SERVICE
    );
    if (tokenResponse.ok) {
      const token = await tokenResponse.text();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Running locally without metadata server - skip auth for dev
    logger.info({}, '[Concierge] No metadata server - running in dev mode');
  }

  return headers;
}

/**
 * Get or create a session on a specialist agent.
 * Sessions are cached per tenant per agent for reuse within the same conversation.
 */
async function getOrCreateSpecialistSession(
  agentUrl: string,
  agentName: string,
  tenantId: string
): Promise<string | null> {
  const cacheKey = `${agentUrl}:${tenantId}`;

  // Check cache first
  const cachedSessionId = getSpecialistSession(cacheKey);
  if (cachedSessionId) {
    logger.info({}, `[Concierge] Reusing cached session for ${agentName}: ${cachedSessionId}`);
    return cachedSessionId;
  }

  // Create a new session on the specialist
  const headers = await getAuthHeaders(agentUrl);

  try {
    // POST /apps/{appName}/users/{userId}/sessions to create session with auto-generated ID
    const createSessionUrl = `${agentUrl}/apps/${agentName}/users/${encodeURIComponent(tenantId)}/sessions`;
    logger.info({}, `[Concierge] Creating session on ${agentName} at ${createSessionUrl}`);

    const response = await fetchWithTimeout(
      createSessionUrl,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state: { tenantId },
        }),
      },
      TIMEOUTS.SPECIALIST_DEFAULT
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {},
        `[Concierge] Failed to create session on ${agentName}: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = (await response.json()) as { id?: string };
    const sessionId = data.id;

    if (sessionId) {
      logger.info({}, `[Concierge] Created session on ${agentName}: ${sessionId}`);
      setSpecialistSession(cacheKey, sessionId);
      return sessionId;
    }

    logger.error({}, `[Concierge] Session creation returned no ID for ${agentName}`);
    return null;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      `[Concierge] Error creating session on ${agentName}`
    );
    return null;
  }
}

/**
 * Call a specialist agent via A2A protocol.
 * Creates a session on the specialist first if needed, then sends the message.
 */
async function callSpecialistAgent(
  agentUrl: string,
  agentName: string,
  message: string,
  tenantId: string,
  _parentSessionId: string // Not used for specialist - each specialist has own session
): Promise<{ ok: boolean; response?: string; error?: string }> {
  try {
    // Step 1: Get or create a session on the specialist agent
    const specialistSessionId = await getOrCreateSpecialistSession(agentUrl, agentName, tenantId);
    if (!specialistSessionId) {
      return { ok: false, error: `Failed to create session on ${agentName}` };
    }

    // Step 2: Get auth headers
    const headers = await getAuthHeaders(agentUrl);

    // Step 3: Call /run endpoint with the specialist's session ID
    // CRITICAL: ADK uses camelCase for all A2A protocol parameters
    logger.info({}, `[Concierge] Sending message to ${agentName}, session: ${specialistSessionId}`);

    // Use longer timeout for research agent (web scraping) - check URL since all agents use appName='agent'
    const timeout =
      agentUrl === SPECIALIST_URLS.research
        ? TIMEOUTS.SPECIALIST_RESEARCH
        : TIMEOUTS.SPECIALIST_DEFAULT;

    const response = await fetchWithTimeout(
      `${agentUrl}/run`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          appName: agentName,
          userId: tenantId,
          sessionId: specialistSessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
          state: {
            tenantId,
          },
        }),
      },
      timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({}, `[Concierge] ${agentName} error: ${response.status} - ${errorText}`);

      // If session not found, clear cache and retry once
      if (response.status === 404 && errorText.includes('Session not found')) {
        logger.info(
          {},
          `[Concierge] Session expired on ${agentName}, clearing cache and retrying...`
        );
        specialistSessions.delete(`${agentUrl}:${tenantId}`);

        // Retry with a new session
        const newSessionId = await getOrCreateSpecialistSession(agentUrl, agentName, tenantId);
        if (newSessionId) {
          const retryTimeout =
            agentUrl === SPECIALIST_URLS.research
              ? TIMEOUTS.SPECIALIST_RESEARCH
              : TIMEOUTS.SPECIALIST_DEFAULT;

          const retryResponse = await fetchWithTimeout(
            `${agentUrl}/run`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                appName: agentName,
                userId: tenantId,
                sessionId: newSessionId,
                newMessage: {
                  role: 'user',
                  parts: [{ text: message }],
                },
                state: {
                  tenantId,
                },
              }),
            },
            retryTimeout
          );

          if (retryResponse.ok) {
            const retryData = (await retryResponse.json()) as unknown;
            return {
              ok: true,
              response: extractAgentResponse(retryData),
            };
          }
        }
      }

      return { ok: false, error: `${agentName} returned ${response.status}` };
    }

    const data = (await response.json()) as unknown;
    return {
      ok: true,
      response: extractAgentResponse(data),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({}, `[Concierge] ${agentName} timeout`);
      return {
        ok: false,
        error: `${agentName} request timed out. Please try again.`,
      };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      `[Concierge] Error calling ${agentName}`
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract agent response from various A2A response formats.
 */
function extractAgentResponse(data: unknown): string {
  // Format 1: Array of events (new ADK format)
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      const event = data[i];
      if (event.content?.role === 'model') {
        const textPart = event.content.parts?.find((p: { text?: string }) => p.text);
        if (textPart?.text) return textPart.text;
      }
    }
  }

  // Format 2: Object with messages array
  const objData = data as { messages?: Array<{ role: string; parts?: Array<{ text?: string }> }> };
  if (objData.messages) {
    const agentResponse = objData.messages
      .find((m) => m.role === 'model')
      ?.parts?.find((p) => p.text)?.text;
    if (agentResponse) return agentResponse;
  }

  // Format 3: Object with content directly
  const contentData = data as { content?: { role: string; parts?: Array<{ text?: string }> } };
  if (contentData.content?.role === 'model') {
    const textPart = contentData.content.parts?.find((p) => p.text);
    if (textPart?.text) return textPart.text;
  }

  // Fallback: stringify
  return JSON.stringify(data);
}

// =============================================================================
// RETRY STATE TRACKING - WITH EXPONENTIAL BACKOFF
// =============================================================================

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt); // 500, 1000, 2000
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return exponentialDelay + jitter;
}

/**
 * Execute function with exponential backoff retry
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  taskKey: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        logger.info(
          {},
          `[Concierge] Retry ${attempt + 1}/${maxRetries} for ${taskKey} after ${Math.round(delay)}ms`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Retry state with TTL for per-request retry tracking
const RETRY_TTL_MS = 5 * 60 * 1000; // 5 minutes - covers single conversation
const MAX_RETRY_CACHE_SIZE = 1000;

interface RetryEntry {
  count: number;
  createdAt: number;
}

const retryState = new Map<string, RetryEntry>();

function shouldRetry(taskKey: string): boolean {
  const entry = retryState.get(taskKey);

  // Check TTL and clean up if expired
  if (entry && Date.now() - entry.createdAt > RETRY_TTL_MS) {
    retryState.delete(taskKey);
    return true; // Expired, allow retry
  }

  const count = entry?.count || 0;
  if (count >= MAX_RETRIES) {
    retryState.delete(taskKey);
    return false;
  }

  // Enforce size limit
  if (retryState.size >= MAX_RETRY_CACHE_SIZE) {
    const oldestKey = retryState.keys().next().value;
    if (oldestKey) {
      retryState.delete(oldestKey);
    }
  }

  retryState.set(taskKey, {
    count: count + 1,
    createdAt: entry?.createdAt || Date.now(),
  });
  return true;
}

function clearRetry(taskKey: string): void {
  retryState.delete(taskKey);
}

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

// Get tenant context for personalization and routing
const getTenantContextTool = new FunctionTool({
  name: 'get_tenant_context',
  description:
    'Get business context for the current tenant. Call this FIRST to understand who you are helping.',
  parameters: GetTenantContextParams,
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] get_tenant_context for: ${tenantId}`);
    const result = await callMaisApi('/business-info', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }

    return {
      tenantId,
      ...(result.data as Record<string, unknown>),
    };
  },
});

// Delegate to Marketing Specialist for copy generation
const delegateToMarketingTool = new FunctionTool({
  name: 'delegate_to_marketing',
  description:
    'Delegate copy/text generation to the Marketing Specialist. Use for headlines, taglines, service descriptions, and copy refinement.',
  parameters: DelegateToMarketingParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const sessionId = context?.invocationId || `session-${Date.now()}`;
    const taskKey = `marketing:${tenantId}:${params.task}`;

    logger.info({}, `[Concierge] Delegating to Marketing: ${params.task}`);

    // Construct message for Marketing agent
    let message = `Task: ${params.task}\nContext: ${params.context}\nTone: ${params.tone}`;
    if (params.currentContent) {
      message += `\nCurrent content: "${params.currentContent}"`;
    }
    if (params.feedback) {
      message += `\nFeedback: ${params.feedback}`;
    }

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.marketing,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      // ReflectAndRetry logic
      if (shouldRetry(taskKey)) {
        logger.info({}, `[Concierge] Retrying marketing task: ${params.task}`);
        // Simplify the request for retry
        const simpleMessage = `Generate a ${params.task} for ${params.context}. Keep it simple.`;
        const retryResult = await callSpecialistAgent(
          SPECIALIST_URLS.marketing,
          'agent',
          simpleMessage,
          tenantId,
          sessionId
        );
        if (retryResult.ok) {
          clearRetry(taskKey);
          return {
            success: true,
            specialist: 'agent',
            task: params.task,
            result: retryResult.response,
            note: 'Recovered with simplified request',
          };
        }
      }
      clearRetry(taskKey);
      return {
        success: false,
        error: result.error,
        suggestion: 'Try a simpler request or different approach',
      };
    }

    clearRetry(taskKey);
    return {
      success: true,
      specialist: 'agent',
      task: params.task,
      result: result.response,
    };
  },
});

// Delegate to Storefront Specialist for layout/structure changes
const delegateToStorefrontTool = new FunctionTool({
  name: 'delegate_to_storefront',
  description:
    'Delegate layout and structure changes to the Storefront Specialist. Use for section updates, reordering, adding/removing sections.',
  parameters: DelegateToStorefrontParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const sessionId = context?.invocationId || `session-${Date.now()}`;
    const taskKey = `storefront:${tenantId}:${params.task}`;

    logger.info({}, `[Concierge] Delegating to Storefront: ${params.task}`);

    // Construct message for Storefront agent
    let message = `Task: ${params.task}`;
    if (params.pageName) message += `\nPage: ${params.pageName}`;
    if (params.sectionId) message += `\nSection ID: ${params.sectionId}`;
    if (params.content) message += `\nContent: ${JSON.stringify(params.content)}`;

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.storefront,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      if (shouldRetry(taskKey)) {
        logger.info({}, `[Concierge] Retrying storefront task: ${params.task}`);
        const retryResult = await callSpecialistAgent(
          SPECIALIST_URLS.storefront,
          'agent',
          `Simple ${params.task} on ${params.pageName || 'home'} page`,
          tenantId,
          sessionId
        );
        if (retryResult.ok) {
          clearRetry(taskKey);
          return {
            success: true,
            specialist: 'agent',
            task: params.task,
            result: retryResult.response,
          };
        }
      }
      clearRetry(taskKey);
      return {
        success: false,
        error: result.error,
        suggestion: 'Try specifying a page or section more clearly',
      };
    }

    clearRetry(taskKey);
    return {
      success: true,
      specialist: 'agent',
      task: params.task,
      result: result.response,
    };
  },
});

// Delegate to Research Specialist for market intelligence
const delegateToResearchTool = new FunctionTool({
  name: 'delegate_to_research',
  description:
    'Delegate market research to the Research Specialist. Use for competitor analysis, pricing research, and market intelligence. Note: This can take 30-60 seconds.',
  parameters: DelegateToResearchParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const sessionId = context?.invocationId || `session-${Date.now()}`;
    const taskKey = `research:${tenantId}:${params.task}`;

    logger.info({}, `[Concierge] Delegating to Research: ${params.task}`);

    // Construct message for Research agent
    let message = `Research task: ${params.task}`;
    if (params.location) message += `\nLocation: ${params.location}`;
    if (params.industry) message += `\nIndustry: ${params.industry}`;
    if (params.competitorUrl) message += `\nCompetitor URL: ${params.competitorUrl}`;

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.research,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      if (shouldRetry(taskKey)) {
        logger.info({}, `[Concierge] Retrying research task: ${params.task}`);
        // For research, try without the competitor URL if that was the issue
        const simpleMessage = `Research ${params.task} in ${params.industry || 'general'} ${params.location ? `in ${params.location}` : ''}`;
        const retryResult = await callSpecialistAgent(
          SPECIALIST_URLS.research,
          'agent',
          simpleMessage,
          tenantId,
          sessionId
        );
        if (retryResult.ok) {
          clearRetry(taskKey);
          return {
            success: true,
            specialist: 'agent',
            task: params.task,
            result: retryResult.response,
            note: 'Used simplified search',
          };
        }
      }
      clearRetry(taskKey);
      return {
        success: false,
        error: result.error,
        suggestion: 'Some sites block scraping. Try a different competitor or just pricing pages.',
      };
    }

    clearRetry(taskKey);
    return {
      success: true,
      specialist: 'agent',
      task: params.task,
      result: result.response,
    };
  },
});

// Valid page names for storefront
const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

// Get storefront structure directly (T1 - no delegation needed)
const getStorefrontStructureTool = new FunctionTool({
  name: 'get_storefront_structure',
  description:
    'Get the current storefront page structure. Use this for READ operations before making changes.',
  parameters: z.object({
    pageName: z
      .enum(PAGE_NAMES)
      .optional()
      .describe(
        'Specific page to view (home, about, services, faq, contact, gallery, testimonials)'
      ),
    showPlaceholdersOnly: z
      .boolean()
      .default(false)
      .describe('Only show sections with placeholder content'),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] get_storefront_structure for: ${tenantId}`);
    const result = await callMaisApi('/storefront/structure', tenantId, {
      pageName: params.pageName,
      includeOnlyPlaceholders: params.showPlaceholdersOnly,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    return result.data;
  },
});

// Get available services (T1 - direct read)
const getServicesTool = new FunctionTool({
  name: 'get_services',
  description:
    'Get all services/packages offered by this business. Use for showing what the business offers.',
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] get_services for: ${tenantId}`);
    const result = await callMaisApi('/services', tenantId, { activeOnly: true });

    if (!result.ok) {
      return { error: result.error };
    }

    return result.data;
  },
});

// Publish changes (T3 - requires explicit confirmation)
const publishChangesTool = new FunctionTool({
  name: 'publish_changes',
  description:
    'Publish draft changes to the live storefront. THIS IS A T3 ACTION - only call after user explicitly says "publish", "make it live", "ship it", or similar.',
  parameters: z.object({
    confirmationReceived: z
      .boolean()
      .describe('Set to true ONLY if user explicitly confirmed publishing'),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    if (!params.confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        message:
          'Ask the user to confirm they want to publish. Look for "publish", "make it live", "ship it", etc.',
      };
    }

    logger.info({}, `[Concierge] publish_changes for: ${tenantId}`);
    const result = await callMaisApi('/storefront/publish', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }

    return {
      success: true,
      message: 'Published! Your changes are now live.',
      ...(result.data as Record<string, unknown>),
    };
  },
});

// Discard draft changes (T2 - confirmable but not as critical)
const discardDraftTool = new FunctionTool({
  name: 'discard_draft',
  description: 'Discard all draft changes and revert to the live version.',
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] discard_draft for: ${tenantId}`);
    const result = await callMaisApi('/storefront/discard', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }

    return {
      success: true,
      message: 'Draft discarded. Reverted to live version.',
    };
  },
});

// =============================================================================
// ONBOARDING TOOLS
// =============================================================================

/**
 * Bootstrap Session Tool
 *
 * ALWAYS call this FIRST in a new session to get tenant context and
 * determine if onboarding mode is active.
 *
 * Returns:
 * - tenantId, businessName, industry, tier
 * - onboardingDone: boolean - if false, enter onboarding mode
 * - discoveryData: facts already known about the business
 * - isOnboarding: boolean shorthand
 * - resumeGreeting: personalized greeting for returning users
 */
const bootstrapSessionTool = new FunctionTool({
  name: 'bootstrap_session',
  description: `Get session context and onboarding status. ALWAYS call this FIRST in a new conversation.

Returns tenant context, onboarding state, and any known facts about the business.
If onboardingDone is false, switch to onboarding mode - help them build their storefront.`,
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] bootstrap_session for: ${tenantId}`);
    const result = await callMaisApi('/bootstrap', tenantId);

    if (!result.ok) {
      return {
        error: result.error,
        fallback: {
          tenantId,
          businessName: 'Unknown',
          onboardingDone: false, // Conservative: don't skip onboarding on error
          isOnboarding: false, // Keep boolean type - don't enter onboarding on error
          isBootstrapError: true, // Explicit error flag for LLM reasoning
          errorMessage: result.error,
        },
        retryGuidance: 'Bootstrap failed. Continue with basic greeting and retry in a moment.',
      };
    }

    const bootstrap = result.data as BootstrapResponse;
    const isOnboarding = needsOnboarding(bootstrap);
    const onboardingContext = buildOnboardingContext(bootstrap);

    return {
      tenantId: bootstrap.tenantId,
      businessName: bootstrap.businessName,
      industry: bootstrap.industry,
      tier: bootstrap.tier,
      onboardingDone: bootstrap.onboardingDone,
      isOnboarding,
      discoveryData: bootstrap.discoveryData,
      resumeGreeting: onboardingContext.resumeGreeting,
      progressSummary: onboardingContext.progressSummary,
      knownFacts: onboardingContext.knownFacts,
      onboardingPrompt: isOnboarding
        ? buildOnboardingPrompt(onboardingContext.resumeGreeting, onboardingContext.knownFacts)
        : null,
    };
  },
});

/**
 * Store Discovery Fact Tool
 *
 * Active memory management - call this when you learn something important
 * about the business during conversation.
 */
const DISCOVERY_FACT_KEYS = [
  'businessType',
  'businessName',
  'location',
  'targetMarket',
  'priceRange',
  'yearsInBusiness',
  'teamSize',
  'uniqueValue',
  'servicesOffered',
] as const;

const storeDiscoveryFactTool = new FunctionTool({
  name: 'store_discovery_fact',
  description: `Store a fact about the business. Call when you learn something important.

Examples:
- User says "I'm a wedding photographer" → store_discovery_fact(key: "businessType", value: "wedding photographer")
- User says "I'm based in Austin" → store_discovery_fact(key: "location", value: {city: "Austin", state: "TX"})
- User says "I've been doing this for 5 years" → store_discovery_fact(key: "yearsInBusiness", value: 5)

Valid keys: ${DISCOVERY_FACT_KEYS.join(', ')}`,
  parameters: z.object({
    key: z.enum(DISCOVERY_FACT_KEYS).describe('The type of fact being stored'),
    value: z.unknown().describe('The value to store'),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({ key: params.key }, `[Concierge] store_discovery_fact for: ${tenantId}`);
    const result = await callMaisApi('/store-discovery-fact', tenantId, {
      key: params.key,
      value: params.value,
    });

    if (!result.ok) {
      return {
        stored: false,
        error: result.error,
        suggestion: 'Fact not stored, but you can continue the conversation.',
      };
    }

    // Return updated facts list so agent knows what it knows mid-conversation
    const responseData = result.data as {
      stored: boolean;
      key: string;
      value: unknown;
      totalFactsKnown: number;
      knownFactKeys: string[];
      message: string;
    };

    return {
      stored: true,
      key: params.key,
      value: params.value,
      totalFactsKnown: responseData.totalFactsKnown,
      knownFactKeys: responseData.knownFactKeys,
      message: `Got it! I now know: ${responseData.knownFactKeys.join(', ')}`,
    };
  },
});

/**
 * Complete Onboarding Tool
 *
 * Call this AFTER the user publishes their storefront to mark onboarding complete.
 * This is a T3 action - requires user confirmation.
 */
const completeOnboardingTool = new FunctionTool({
  name: 'complete_onboarding',
  description: `Mark onboarding as complete. Call AFTER the user publishes their storefront.

Requirements:
1. User created at least one service package
2. User published their storefront (not just previewed)
3. You have a live URL to provide

This is a T3 action - only call after user explicitly confirms they want to publish.`,
  parameters: z.object({
    publishedUrl: z.string().describe('The live storefront URL'),
    packagesCreated: z.number().describe('Number of packages created'),
    summary: z.string().describe('Brief summary of what was set up'),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info(
      { publishedUrl: params.publishedUrl, packagesCreated: params.packagesCreated },
      `[Concierge] complete_onboarding for: ${tenantId}`
    );

    const result = await callMaisApi('/complete-onboarding', tenantId, {
      publishedUrl: params.publishedUrl,
      packagesCreated: params.packagesCreated,
      summary: params.summary,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        suggestion: 'Could not mark onboarding as complete. Try again in a moment.',
      };
    }

    return {
      success: true,
      message: `Congratulations! Your storefront is live at ${params.publishedUrl}`,
      packagesCreated: params.packagesCreated,
      summary: params.summary,
      nextSteps: [
        'Share your link with clients',
        'Ask me to help with marketing copy',
        'Set up email notifications for bookings',
      ],
    };
  },
});

// =============================================================================
// CONCIERGE ORCHESTRATOR AGENT
// =============================================================================

/**
 * Concierge Orchestrator Agent
 *
 * The hub agent that routes requests to specialist agents.
 * Uses high thinking level for accurate intent classification and routing.
 *
 * Modes:
 * - Normal mode: Routes to specialists, handles general queries
 * - Onboarding mode: Goal-based flow to build storefront (detected via bootstrap_session)
 */
export const conciergeAgent = new LlmAgent({
  name: 'concierge',
  description:
    'The HANDLED Concierge - primary interface for service professionals. Routes requests to specialist agents for copy, layout, and research tasks.',

  // Model configuration - Gemini 2.0 Flash with extended thinking
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.2, // Low temperature for consistent routing
    maxOutputTokens: 4096,
    // Note: thinking_level is configured at ADK level, not in generateContentConfig
    // The ADK handles this via the agent's complexity settings
  },

  // System prompt with personality and routing logic
  instruction: CONCIERGE_SYSTEM_PROMPT,

  // All available tools
  tools: [
    // Bootstrap & Onboarding (ALWAYS call bootstrap_session first)
    bootstrapSessionTool,
    storeDiscoveryFactTool,
    completeOnboardingTool,

    // Context tools (T1)
    getTenantContextTool,
    getStorefrontStructureTool,
    getServicesTool,

    // Delegation tools (T2)
    delegateToMarketingTool,
    delegateToStorefrontTool,
    delegateToResearchTool,

    // Publishing tools (T2/T3)
    publishChangesTool,
    discardDraftTool,
  ],

  // Lifecycle callbacks for observability
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { toolName: tool.name, args: JSON.stringify(args).substring(0, 200) },
      `[Concierge] Calling tool`
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    const preview =
      typeof response === 'object'
        ? JSON.stringify(response).substring(0, 200)
        : String(response).substring(0, 200);
    logger.info({}, `[Concierge] Result: ${tool.name} → ${preview}...`);
    return undefined;
  },
});

// Default export for ADK deploy command
export default conciergeAgent;
