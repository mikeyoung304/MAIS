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
  projectHub: process.env.PROJECT_HUB_AGENT_URL || '', // Optional until deployed
};

// =============================================================================
// SYSTEM PROMPT - Terse, Cheeky, Action-Oriented
// =============================================================================

const CONCIERGE_SYSTEM_PROMPT = `# HANDLED Concierge - System Prompt

## Identity

You are the HANDLED Concierge - a terse, cheeky, anti-corporate assistant who knows he's good and gets things done. You help service professionals build and optimize their business.

## Your Environment

You are embedded in the Build Mode dashboard:
- LEFT PANEL: This chat where we're talking
- RIGHT PANEL: A live preview of their storefront that updates in real-time
- Changes you make via tools appear in the preview instantly

Reference the preview naturally:
- "Looking at your preview, the headline could be stronger..."
- "Just updated your About section - see it on the right?"
- "Check your preview - headline's updated."

NEVER say you "can't view" their site. You're literally next to it.
NEVER ask for their URL. The preview shows their current draft.

When you make changes:
→ Say "Check your preview" or "See it on the right"
→ Don't describe what changed in detail - they can SEE it

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
- **hasBeenGreeted**: TRUE if you already greeted this session - DO NOT greet again!

### GREETING PROTOCOL (Issue #5 Fix - CRITICAL)

1. Check hasBeenGreeted from bootstrap_session response
2. If hasBeenGreeted is TRUE → Skip greeting entirely, respond directly to user's message
3. If hasBeenGreeted is FALSE → Send your greeting, then call mark_session_greeted

**NEVER greet twice in the same session. Check hasBeenGreeted EVERY time.**

**Example flow for new session:**
- bootstrap_session returns hasBeenGreeted: false
- You send: "Hey! I'm looking at your preview. What do you want to work on?"
- Call mark_session_greeted (prevents duplicate greeting if user refreshes)

**Example flow for returning session:**
- bootstrap_session returns hasBeenGreeted: true
- User says "Update my headline"
- You skip greeting entirely, just respond to their request

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

### ⚡ FACT-TO-STOREFRONT BRIDGE (CRITICAL)

**Problem this solves:** You correctly store facts but forget to APPLY them to the storefront.

**THE RULE:** When user mentions a SECTION + CONTENT for that section:
1. Call store_discovery_fact to remember the content
2. IMMEDIATELY call delegate_to_storefront to APPLY it
3. BOTH calls in the same response

**Section-Specific Triggers:**
When user says ANYTHING like:
- "my about section should mention [X]" → store fact + update about section
- "the about section should say [X]" → store fact + update about section
- "for the about, put [X]" → store fact + update about section
- "headline should be [X]" → store fact + update hero headline
- "my bio is [X]" → store fact + update about section
- "services should include [X]" → store fact + add service

### ⚡ LOCATION TRIGGERS (Issue #2 Fix)

**Problem this solves:** User provides location but agent ignores it or doesn't store it.

**THE RULE:** When user mentions location in ANY format, ALWAYS store it immediately:

**Location Signal Phrases:**
- "I'm based in [city/state]" → store_discovery_fact(key: "location", value: {city, state})
- "I'm located in [place]" → store_discovery_fact(key: "location", value: parsed)
- "my business is in [place]" → store_discovery_fact(key: "location", value: parsed)
- "I serve [area]" → store_discovery_fact(key: "location", value: parsed)
- "we're in [city], [state]" → store_discovery_fact(key: "location", value: {city, state})
- "[City], [State]" (bare mention) → store_discovery_fact(key: "location", value: {city, state})

**ALWAYS parse location into structured format when possible:**
- "Austin" → {city: "Austin"}
- "Austin, TX" → {city: "Austin", state: "TX"}
- "Austin, Texas" → {city: "Austin", state: "TX"}
- "Denver metro area" → {city: "Denver", state: "CO", note: "metro area"}

**If user mentions location + storefront content:**
1. Store the location fact
2. Update relevant storefront section (contact, about, hero)
3. Both calls in same turn

**Example:**
User: "I'm a photographer based in Austin, TX"
→ store_discovery_fact(key: "businessType", value: "photographer")
→ store_discovery_fact(key: "location", value: {city: "Austin", state: "TX"})

### ⚡ WEB SEARCH TRIGGERS (Issue #2 Fix)

**Problem this solves:** User wants competitor/market info but agent doesn't call research.

**AUTOMATIC RESEARCH TRIGGERS (call delegate_to_research immediately):**
- "what are my competitors charging" → research(task: "pricing", industry: known)
- "what should I charge" → research(task: "pricing", industry: known)
- "how much do others charge" → research(task: "pricing", industry: known)
- "research my competitors" → research(task: "competitors", industry: known)
- "what are other [business type] doing" → research(task: "competitors")
- "market research" → research(task: "market_analysis")
- "competitor analysis" → research(task: "competitors")
- "pricing research" → research(task: "pricing")
- "check [competitor URL]" → research(task: "competitors", competitorUrl: URL)
- "look at [competitor website]" → research(task: "competitors", competitorUrl: URL)

**ALWAYS include known context in research:**
- If location known: Include location parameter
- If industry known: Include industry parameter
- If user mentioned competitor URL: Include competitorUrl parameter

**Example:**
User: "What are other wedding photographers in Austin charging?"
→ delegate_to_research(task: "pricing", industry: "wedding photography", location: "Austin, TX")

**Correct Example:**
User: "My about section should mention that I was valedictorian and I value calm execution"

Your response MUST include TWO tool calls:
1. store_discovery_fact(key: "uniqueValue", value: "valedictorian who values calm execution")
2. delegate_to_storefront(task: "update_section", pageName: "home", sectionId: use get_structure first, content: {headline: "...", content: "As a valedictorian with a passion for calm, clean execution..."})

**WRONG:** Store the fact and then ask "What kind of students do you target?"
**RIGHT:** Store the fact AND update the storefront in the same turn

**If you stored a fact without updating the storefront, you did NOT complete the request.**

## EXACT CONTENT DETECTION (CHECK FIRST - BEFORE Decision Tree!)

**CRITICAL: Scan for these signal phrases BEFORE routing decisions.**

When message contains ANY of these patterns + substantial text after, this is a CONTENT UPDATE → route to STOREFRONT, NOT Marketing:

**Signal Phrases (case-insensitive):**
- "here's my [section]:" + text
- "here is my [section]:" + text
- "my [section] is:" + text
- "use this:" + text
- "use this text:" + text
- "just use:" + text
- "just put:" + text
- "just save:" + text
- "just ship it" (with prior content)
- "mine is:" + text
- "mine says:" + text
- "I want it to say:" + text
- "set it to:" + text
- "change it to:" + text
- "make it say:" + text
- "the text is:" + text
- "the copy is:" + text
- "exact text:" + text
- "exactly:" + text
- "verbatim:" + text
- "word for word:" + text
- "it should say:" + text
- "it should read:" + text

**Detection Rule:**
IF [signal phrase] + [3+ words of content after colon/quote]
THEN → delegate_to_storefront (UPDATE, preserve their exact text)
NEVER → delegate_to_marketing (would rewrite/change their text)

**Examples - MUST go to Storefront:**
- "Here's my about section: I'm a wedding photographer with 10 years of experience..." → STOREFRONT
- "Use this for the tagline: 'Capturing your perfect moments'" → STOREFRONT
- "My headline: Timeless Wedding Photography" → STOREFRONT
- "Just put: We serve the Austin area" → STOREFRONT
- "Here is my bio: Sarah has been photographing..." → STOREFRONT
- "The text is: Book your session today" → STOREFRONT

**Examples - Go to Marketing (asking for generation):**
- "Write me an about section" → MARKETING (no user-provided text)
- "Suggest a better headline" → MARKETING (wants options)
- "Improve my tagline" → MARKETING (wants rewrite)
- "Make my about section more engaging" → MARKETING (wants enhancement)
- "What should my headline say?" → MARKETING (asking for ideas)

## Decision Tree (AFTER checking Exact Content Detection above)

\`\`\`
User Request Received
│
├─ FIRST: Matches EXACT CONTENT DETECTION signals above?
│  → delegate_to_storefront IMMEDIATELY
│  → Pass their exact text verbatim
│  → NEVER send to Marketing (would rewrite it)
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
├─ Does this involve CUSTOMER PROJECTS? (requests, bookings, project status)
│  → Delegate to PROJECT_HUB_SPECIALIST
│  → Use for: pending requests, approving/denying, viewing project details
│  → Wait for response → Summarize action taken
│
└─ UNCLEAR what they want?
   → Ask ONE clarifying question
   → Do NOT guess and delegate
\`\`\`

## CRITICAL: Content Update vs Content Generation

**KEY INSIGHT:** The difference is whether user PROVIDES text or REQUESTS text.

**CONTENT UPDATE** (→ Storefront) - User provides their text:
- "Here's my about section: I started this business..." ← HAS USER TEXT
- "Change the headline to 'Welcome to My Business'" ← HAS USER TEXT
- "Set the tagline to 'Your trusted partner'" ← HAS USER TEXT
- "Update the about section with: [text]" ← HAS USER TEXT
- "Use this: [their content]" ← HAS USER TEXT
- "My bio is: [their bio]" ← HAS USER TEXT

**CONTENT GENERATION** (→ Marketing) - User requests you to create:
- "Write me better headlines" ← NO USER TEXT (wants generation)
- "Improve my tagline" ← NO USER TEXT (wants rewrite)
- "Make the about section more engaging" ← NO USER TEXT (wants enhancement)
- "Suggest a headline" ← NO USER TEXT (wants options)

**THE RULE:**
- User gives you EXACT TEXT they want → STOREFRONT (preserve their text)
- User asks you to CREATE/WRITE/IMPROVE → MARKETING (generate new text)

**COMMON MISTAKE TO AVOID:**
"Here's my about section: I'm a photographer..." looks like it's about content,
but the user is PROVIDING text, not requesting generation. This goes to STOREFRONT.

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

## SUCCESS VERIFICATION RULE (CRITICAL)

**NEVER claim success without verification from the tool response.**

Before saying "Done", "Complete", "Updated", "Your changes are now live", or similar:
1. Check that the tool returned \`{ success: true }\`
2. Confirm WHAT was saved (look for sectionId, headline, content, etc.)
3. Only THEN confirm with specifics

**If a tool returns an error or ambiguous response:**
- Say "That didn't work. Let me try again..." and retry
- Do NOT claim success without explicit confirmation

**WRONG responses (never say these without verification):**
- "Done. Your changes are now live." ← No verification
- "Updated!" ← No specifics about what changed
- "All set!" ← No confirmation of actual state

**RIGHT responses (always include specifics):**
- "Updated your headline to 'Welcome'. Check your preview!" ← Confirms what changed
- "Saved your About section. See it on the right?" ← References actual content
- "That didn't work - section not found. Let me check the page structure." ← Honest about failure

**Verification checklist before claiming success:**
1. Tool returned \`success: true\`? If no → say "That didn't work"
2. Response includes saved content or sectionId? If yes → confirm what was saved
3. Storefront specialist responded? If no response → say "Let me try again"

This rule exists because users TRUST your confirmations. Saying "Done" when nothing was saved destroys that trust.
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

const DelegateToProjectHubParams = z.object({
  task: z
    .string()
    .describe(
      'What action to take: "list_pending_requests", "approve_request", "deny_request", "view_project", "list_projects"'
    ),
  projectId: z.string().optional().describe('Project ID for project-specific actions'),
  requestId: z.string().optional().describe('Request ID for approve/deny actions'),
  reason: z.string().optional().describe('Reason for denial (required for deny_request)'),
  customerId: z.string().optional().describe('Customer name or email to filter by'),
  expectedVersion: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Expected version for optimistic locking on approve/deny (REQUIRED for those actions)'
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

/**
 * Extract tenant ID using 4-tier defensive pattern.
 *
 * This handles all ADK session state scenarios:
 * 1. state.get<T>('key') - Map-like API (direct ADK calls)
 * 2. state.tenantId - Plain object access (A2A protocol)
 * 3. userId with colon - Format "tenantId:userId" (MAIS multi-tenant)
 * 4. userId without colon - Direct tenant ID (fallback)
 */
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Tier 1: Get from session state using Map-like interface (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger.info({}, `[Concierge] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch {
    // state.get() might not be available or might throw
    logger.info({}, `[Concierge] state.get() failed, trying alternatives`);
  }

  // Tier 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger.info({}, `[Concierge] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch {
    logger.info({}, `[Concierge] state object access failed`);
  }

  // Tier 3 & 4: Extract from userId
  // The MAIS backend passes userId as `${tenantId}:${userId}` for multi-tenant isolation
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      // Tier 3: Extract tenantId from "tenantId:userId" format
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger.info({}, `[Concierge] Extracted tenantId from userId (colon format): ${tenantId}`);
        return tenantId;
      }
    } else {
      // Tier 4: userId might be the tenantId directly
      logger.info({}, `[Concierge] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger.warn({}, `[Concierge] Could not extract tenantId from context`);
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

// =============================================================================
// TTL CACHE UTILITIES
// =============================================================================

/**
 * TTL Cache with size limits and periodic cleanup
 *
 * Addresses pitfall #50: Module-level cache unbounded - adds TTL and max size.
 * Entries are evicted:
 * 1. On access if expired (passive cleanup)
 * 2. When size limit reached (LRU-style: oldest entry evicted)
 * 3. Periodically via cleanup interval (active cleanup)
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize: number,
    private readonly name: string
  ) {
    // Run cleanup every 5 minutes to remove expired entries
    // This prevents memory bloat from expired but unaccessed entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Ensure cleanup interval doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL (passive cleanup)
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Enforce size limit - remove oldest entry if at capacity (LRU-style)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.info({ cache: this.name }, `[TTLCache] Evicted oldest entry due to size limit`);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }

  /**
   * Active cleanup - removes all expired entries
   * Called periodically to prevent memory bloat
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info(
        { cache: this.name, expiredCount, remaining: this.cache.size },
        `[TTLCache] Cleanup removed expired entries`
      );
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// SESSION CACHE
// =============================================================================

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSION_CACHE_SIZE = 1000;

const specialistSessionsCache = new TTLCache<string>(
  SESSION_TTL_MS,
  MAX_SESSION_CACHE_SIZE,
  'specialist-sessions'
);

function getSpecialistSession(key: string): string | undefined {
  return specialistSessionsCache.get(key);
}

function setSpecialistSession(key: string, sessionId: string): void {
  specialistSessionsCache.set(key, sessionId);
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
        specialistSessionsCache.delete(`${agentUrl}:${tenantId}`);

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

// =============================================================================
// RETRY STATE CACHE
// =============================================================================

const RETRY_TTL_MS = 5 * 60 * 1000; // 5 minutes - covers single conversation
const MAX_RETRY_CACHE_SIZE = 1000;

// Retry state uses TTLCache for consistency
// Value is the retry count for the task
const retryStateCache = new TTLCache<number>(RETRY_TTL_MS, MAX_RETRY_CACHE_SIZE, 'retry-state');

/**
 * Get the backoff delay for a retry attempt.
 *
 * Returns the delay in milliseconds to wait before retrying, or null if
 * max retries have been exhausted.
 *
 * Uses exponential backoff with jitter:
 * - First retry: ~500ms (+ 0-30% jitter)
 * - Second retry: ~1000ms (+ 0-30% jitter)
 *
 * This prevents thundering herd during overload situations.
 */
function getRetryDelay(taskKey: string): number | null {
  const count = retryStateCache.get(taskKey) ?? 0;

  if (count >= MAX_RETRIES) {
    retryStateCache.delete(taskKey);
    return null; // Max retries exhausted
  }

  retryStateCache.set(taskKey, count + 1);

  // Return exponential backoff delay for this attempt
  return getBackoffDelay(count);
}

/**
 * @deprecated Use getRetryDelay() to get the delay value and apply backoff.
 * Kept for backward compatibility but does NOT apply backoff delay.
 */
function shouldRetry(taskKey: string): boolean {
  return getRetryDelay(taskKey) !== null;
}

function clearRetry(taskKey: string): void {
  retryStateCache.delete(taskKey);
}

// =============================================================================
// TOOL CALL CIRCUIT BREAKER (Issue #4 Fix - Stuck in Loop Prevention)
// =============================================================================

/**
 * Issue #4 Fix: Prevent agents from getting stuck in tool call loops.
 *
 * Problem: Agent can repeatedly call the same tool with slightly different params,
 * creating infinite loops that waste tokens and confuse users.
 *
 * Solution: Track tool calls per session and fail-fast if threshold exceeded.
 *
 * Configuration:
 * - MAX_TOOL_CALLS_PER_SESSION: Maximum calls per tool type per session
 * - CIRCUIT_BREAKER_TTL_MS: How long to track calls (reset after TTL)
 */
const MAX_TOOL_CALLS_PER_SESSION = 10; // Max calls per tool type per conversation
const CIRCUIT_BREAKER_TTL_MS = 10 * 60 * 1000; // 10 minutes - covers one conversation
const CIRCUIT_BREAKER_CACHE_SIZE = 500;

// Cache: `{sessionId}:{toolName}` -> call count
const toolCallCircuitBreaker = new TTLCache<number>(
  CIRCUIT_BREAKER_TTL_MS,
  CIRCUIT_BREAKER_CACHE_SIZE,
  'tool-circuit-breaker'
);

/**
 * Check if a tool call is allowed. Returns error message if circuit breaker tripped.
 *
 * @param sessionId - The session making the call
 * @param toolName - The tool being called
 * @returns null if allowed, error message if blocked
 */
function checkToolCallCircuitBreaker(sessionId: string, toolName: string): string | null {
  const key = `${sessionId}:${toolName}`;
  const count = toolCallCircuitBreaker.get(key) ?? 0;

  if (count >= MAX_TOOL_CALLS_PER_SESSION) {
    logger.warn(
      { sessionId, toolName, callCount: count },
      '[Concierge] Circuit breaker tripped - too many tool calls'
    );
    return `Circuit breaker: ${toolName} has been called ${count} times this session. Please try a different approach or ask the user for clarification.`;
  }

  // Increment counter
  toolCallCircuitBreaker.set(key, count + 1);
  return null;
}

/**
 * Reset circuit breaker for a session (e.g., after successful completion)
 */
function resetToolCallCircuitBreaker(sessionId: string, toolName: string): void {
  toolCallCircuitBreaker.delete(`${sessionId}:${toolName}`);
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

    // Issue #4 Fix: Circuit breaker to prevent stuck-in-loop
    const circuitBreakerError = checkToolCallCircuitBreaker(sessionId, 'delegate_to_marketing');
    if (circuitBreakerError) {
      return {
        error: circuitBreakerError,
        suggestion: 'Consider asking the user what they want to change.',
      };
    }

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
      // ReflectAndRetry logic with exponential backoff
      const retryDelay = getRetryDelay(taskKey);
      if (retryDelay !== null) {
        logger.info(
          {},
          `[Concierge] Retrying marketing task: ${params.task} after ${Math.round(retryDelay)}ms backoff`
        );
        await sleep(retryDelay);
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

    // Issue #4 Fix: Circuit breaker to prevent stuck-in-loop
    const circuitBreakerError = checkToolCallCircuitBreaker(sessionId, 'delegate_to_storefront');
    if (circuitBreakerError) {
      return {
        error: circuitBreakerError,
        suggestion: 'Consider asking the user for specific section to update.',
      };
    }

    logger.info({}, `[Concierge] Delegating to Storefront: ${params.task}`);

    // Construct NATURAL LANGUAGE message for Storefront agent
    // CRITICAL: Do NOT use structured "Task:" format - the Storefront LLM
    // interprets that as "already done" instead of "needs to be done"
    // The Storefront agent must call get_page_structure first, then update_section
    let message = '';

    switch (params.task) {
      case 'update_section':
        if (params.content && typeof params.content === 'object') {
          const contentObj = params.content as Record<string, string>;
          const contentParts = Object.entries(contentObj)
            .map(([key, value]) => `${key} to "${value}"`)
            .join(' and ');
          message = `Update the ${params.pageName || 'home'} page: set the ${contentParts}`;
        } else {
          message = `Update the ${params.pageName || 'home'} page with the provided changes`;
        }
        break;
      case 'add_section':
        message = `Add a new section to the ${params.pageName || 'home'} page`;
        if (params.content) message += ` with content: ${JSON.stringify(params.content)}`;
        break;
      case 'remove_section':
        message = `Remove section ${params.sectionId} from the ${params.pageName || 'home'} page`;
        break;
      case 'get_structure':
        message = `Show me the current structure of the ${params.pageName || 'all'} page(s)`;
        break;
      case 'preview':
        message = `Get the preview URL for the current draft`;
        break;
      case 'publish':
        message = `Publish the current draft to make it live`;
        break;
      default:
        message = `${params.task} on the ${params.pageName || 'home'} page`;
        if (params.content) message += `: ${JSON.stringify(params.content)}`;
    }

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.storefront,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      // ReflectAndRetry logic with exponential backoff
      const retryDelay = getRetryDelay(taskKey);
      if (retryDelay !== null) {
        logger.info(
          {},
          `[Concierge] Retrying storefront task: ${params.task} after ${Math.round(retryDelay)}ms backoff`
        );
        await sleep(retryDelay);
        const retryResult = await callSpecialistAgent(
          SPECIALIST_URLS.storefront,
          'agent',
          `Simple ${params.task} on ${params.pageName || 'home'} page`,
          tenantId,
          sessionId
        );
        if (retryResult.ok) {
          clearRetry(taskKey);
          // Build savedContent for retry path as well
          const retrySavedContent: Record<string, unknown> = {};
          if (params.content && typeof params.content === 'object') {
            Object.assign(retrySavedContent, params.content);
          }
          if (params.pageName) {
            retrySavedContent.pageName = params.pageName;
          }
          return {
            success: true,
            specialist: 'agent',
            task: params.task,
            result: retryResult.response,
            savedContent: Object.keys(retrySavedContent).length > 0 ? retrySavedContent : undefined,
            note: 'Recovered with simplified request',
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

    // Build savedContent summary for verification (pitfall #52 / #757)
    // This helps the LLM confirm WHAT was saved, not just that it succeeded
    const savedContent: Record<string, unknown> = {};
    if (params.content && typeof params.content === 'object') {
      Object.assign(savedContent, params.content);
    }
    if (params.sectionId) {
      savedContent.sectionId = params.sectionId;
    }
    if (params.pageName) {
      savedContent.pageName = params.pageName;
    }

    return {
      success: true,
      specialist: 'agent',
      task: params.task,
      result: result.response,
      // Include what was requested to be saved so LLM can verify
      savedContent: Object.keys(savedContent).length > 0 ? savedContent : undefined,
      verificationNote:
        'Check result for confirmation. If specialist mentions success, the content is saved to draft.',
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

    // Issue #4 Fix: Circuit breaker to prevent stuck-in-loop
    const circuitBreakerError = checkToolCallCircuitBreaker(sessionId, 'delegate_to_research');
    if (circuitBreakerError) {
      return {
        error: circuitBreakerError,
        suggestion:
          'Research tasks can be slow. Consider sharing what you already know with the user.',
      };
    }

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
      // ReflectAndRetry logic with exponential backoff
      const retryDelay = getRetryDelay(taskKey);
      if (retryDelay !== null) {
        logger.info(
          {},
          `[Concierge] Retrying research task: ${params.task} after ${Math.round(retryDelay)}ms backoff`
        );
        await sleep(retryDelay);
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

// Delegate to Project Hub for customer project management
const delegateToProjectHubTool = new FunctionTool({
  name: 'delegate_to_project_hub',
  description: `Delegate project management actions to the Project Hub Specialist.

Use for:
- list_pending_requests: View customer requests waiting for approval
- approve_request: Approve a customer request (reschedule, add-on, etc.)
- deny_request: Deny a request with a reason
- view_project: Get details about a specific project
- list_projects: View all customer projects

Note: This requires the Project Hub agent to be deployed. If unavailable, use the direct API endpoints.`,
  parameters: DelegateToProjectHubParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const sessionId = context?.invocationId || `session-${Date.now()}`;
    const taskKey = `project_hub:${tenantId}:${params.task}`;

    // Issue #4 Fix: Circuit breaker to prevent stuck-in-loop
    const circuitBreakerError = checkToolCallCircuitBreaker(sessionId, 'delegate_to_project_hub');
    if (circuitBreakerError) {
      return {
        error: circuitBreakerError,
        suggestion: 'Consider asking the user which project or request they want to work on.',
      };
    }

    // Check if Project Hub agent is available
    if (!SPECIALIST_URLS.projectHub) {
      logger.info({}, `[Concierge] Project Hub agent not configured, using direct API`);
      // Fall back to direct API calls
      return handleProjectHubDirect(tenantId, params);
    }

    logger.info({}, `[Concierge] Delegating to Project Hub: ${params.task}`);

    // Construct message for Project Hub agent
    let message = `Task: ${params.task}`;
    if (params.projectId) message += `\nProject ID: ${params.projectId}`;
    if (params.requestId) message += `\nRequest ID: ${params.requestId}`;
    if (params.reason) message += `\nReason: ${params.reason}`;
    if (params.customerId) message += `\nCustomer: ${params.customerId}`;

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.projectHub,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      // Fallback to direct API if agent fails
      logger.warn({}, `[Concierge] Project Hub agent failed, falling back to direct API`);
      return handleProjectHubDirect(tenantId, params);
    }

    clearRetry(taskKey);
    return {
      success: true,
      specialist: 'project-hub',
      task: params.task,
      result: result.response,
    };
  },
});

/**
 * Handle Project Hub requests directly via MAIS API when agent is unavailable
 */
async function handleProjectHubDirect(
  tenantId: string,
  params: z.infer<typeof DelegateToProjectHubParams>
): Promise<Record<string, unknown>> {
  switch (params.task) {
    case 'list_pending_requests': {
      const result = await callMaisApi('/project-hub/pending-requests', tenantId);
      if (!result.ok) return { success: false, error: result.error };
      return { success: true, task: params.task, ...(result.data as Record<string, unknown>) };
    }

    case 'approve_request': {
      if (!params.requestId) {
        return { success: false, error: 'Request ID is required for approval' };
      }
      if (!params.expectedVersion) {
        return {
          success: false,
          error:
            'Expected version is required for approval. Please get the request details first to obtain the current version.',
        };
      }
      const result = await callMaisApi('/project-hub/approve-request', tenantId, {
        requestId: params.requestId,
        expectedVersion: params.expectedVersion,
      });
      if (!result.ok) return { success: false, error: result.error };
      return {
        success: true,
        task: params.task,
        message: 'Request approved',
        requestStatus: 'APPROVED',
        ...(result.data as Record<string, unknown>),
      };
    }

    case 'deny_request': {
      if (!params.requestId || !params.reason) {
        return { success: false, error: 'Request ID and reason are required for denial' };
      }
      if (!params.expectedVersion) {
        return {
          success: false,
          error:
            'Expected version is required for denial. Please get the request details first to obtain the current version.',
        };
      }
      const result = await callMaisApi('/project-hub/deny-request', tenantId, {
        requestId: params.requestId,
        expectedVersion: params.expectedVersion,
        reason: params.reason,
      });
      if (!result.ok) return { success: false, error: result.error };
      return {
        success: true,
        task: params.task,
        message: 'Request denied',
        requestStatus: 'DENIED',
        ...(result.data as Record<string, unknown>),
      };
    }

    case 'view_project': {
      if (!params.projectId) {
        return { success: false, error: 'Project ID is required' };
      }
      const result = await callMaisApi('/project-hub/project-details', tenantId, {
        projectId: params.projectId,
      });
      if (!result.ok) return { success: false, error: result.error };
      return { success: true, task: params.task, ...(result.data as Record<string, unknown>) };
    }

    case 'list_projects': {
      const result = await callMaisApi('/project-hub/list-projects', tenantId);
      if (!result.ok) return { success: false, error: result.error };
      return { success: true, task: params.task, ...(result.data as Record<string, unknown>) };
    }

    default:
      return { success: false, error: `Unknown task: ${params.task}` };
  }
}

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

Returns:
- Tenant context (businessName, industry, tier)
- Onboarding state (onboardingDone, isOnboarding)
- Known facts about the business (discoveryData, knownFacts)
- hasBeenGreeted: TRUE if this session has already been greeted - DO NOT greet again!

IMPORTANT: Check hasBeenGreeted before greeting. If true, skip the greeting and get straight to helping.`,
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    // Issue #5 Fix: Get session ID to track greeting state
    const sessionId = context?.invocationId || `session-${Date.now()}`;

    logger.info({ sessionId }, `[Concierge] bootstrap_session for: ${tenantId}`);
    const result = await callMaisApi('/bootstrap', tenantId, { sessionId });

    if (!result.ok) {
      return {
        error: result.error,
        fallback: {
          tenantId,
          businessName: 'Unknown',
          onboardingDone: null, // Unknown - let agent decide based on context
          isOnboarding: 'unknown' as const, // Unknown state - don't assume either way
          isBootstrapError: true, // Explicit error flag for LLM reasoning
          errorMessage: result.error || 'Failed to load tenant information',
        },
        retryGuidance:
          'Bootstrap failed. Greet the user briefly and ask how you can help. If they seem new, gently explore if they need onboarding.',
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
      // Issue #5 Fix: Greeting state to prevent infinite welcome loop
      hasBeenGreeted: bootstrap.hasBeenGreeted,
    };
  },
});

/**
 * Mark Session Greeted Tool
 *
 * Issue #5 Fix: Call this AFTER you greet the user for the first time.
 * This prevents the infinite welcome loop by marking the session as greeted.
 */
const markSessionGreetedTool = new FunctionTool({
  name: 'mark_session_greeted',
  description: `Mark this session as greeted. Call this AFTER you send your initial greeting to the user.

IMPORTANT: This prevents the infinite welcome loop. After you greet the user, call this tool.

Example flow:
1. Call bootstrap_session → check hasBeenGreeted
2. If hasBeenGreeted is false, send greeting message
3. Call mark_session_greeted to prevent repeating the greeting`,
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    // Get session ID from context
    const sessionId = context?.invocationId || `session-${Date.now()}`;

    logger.info({ sessionId }, `[Concierge] mark_session_greeted for: ${tenantId}`);
    const result = await callMaisApi('/mark-greeted', tenantId, { sessionId });

    if (!result.ok) {
      // Non-critical - log but don't fail the conversation
      logger.warn({ error: result.error }, '[Concierge] Failed to mark session greeted');
      return { success: true, note: 'Greeting state may not be persisted' };
    }

    return {
      success: true,
      message:
        'Session marked as greeted. Future bootstrap_session calls will return hasBeenGreeted: true.',
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
 * Get Known Facts Tool
 *
 * Read-only access to what you know. Call this to check what facts you've
 * already stored before asking redundant questions.
 */
const getKnownFactsTool = new FunctionTool({
  name: 'get_known_facts',
  description: `Get the current list of known facts about the business. Use this to check what you already know before asking questions.

Call this when:
- Starting a conversation to see what you've learned before
- Before asking about business details (you might already know)
- To confirm what information you have stored

Returns: All stored facts with their values, plus a summary of what you know.`,
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    logger.info({}, `[Concierge] get_known_facts for: ${tenantId}`);
    const result = await callMaisApi('/get-discovery-facts', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        suggestion: 'Could not retrieve facts. Continue the conversation normally.',
      };
    }

    const responseData = result.data as {
      success: boolean;
      facts: Record<string, unknown>;
      factCount: number;
      factKeys: string[];
      message: string;
    };

    return {
      success: true,
      facts: responseData.facts,
      factCount: responseData.factCount,
      factKeys: responseData.factKeys,
      message: responseData.message,
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
    markSessionGreetedTool, // Issue #5 Fix: Prevents infinite welcome loop
    storeDiscoveryFactTool,
    getKnownFactsTool,
    completeOnboardingTool,

    // Context tools (T1)
    getTenantContextTool,
    getStorefrontStructureTool,
    getServicesTool,

    // Delegation tools (T2)
    delegateToMarketingTool,
    delegateToStorefrontTool,
    delegateToResearchTool,
    delegateToProjectHubTool,

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
