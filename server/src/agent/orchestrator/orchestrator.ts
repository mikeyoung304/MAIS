/**
 * Agent Orchestrator
 *
 * Connects Claude API to MAIS agent tools.
 * Handles conversation history, tool execution, and T2 soft-confirm.
 *
 * Architecture:
 * - Uses Anthropic SDK with tool_use feature
 * - Sliding window conversation history (last N messages)
 * - Server-side proposal mechanism for write operations
 * - Audit logging for all interactions
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { PrismaClient, Prisma } from '../../generated/prisma';
import type { ToolContext, AgentToolResult, AgentTool } from '../tools/types';
import { getAllTools, getAllToolsWithOnboarding } from '../tools/all-tools';
import {
  buildSessionContext,
  buildFallbackContext,
  getHandledGreeting,
} from '../context/context-builder';
import type { AgentSessionContext } from '../context/context-builder';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';
import { getProposalExecutor } from '../proposals/executor-registry';
import { validateExecutorPayload } from '../proposals/executor-schemas';
import { ErrorMessages } from '../errors';
import { AdvisorMemoryService } from '../onboarding/advisor-memory.service';
import { PrismaAdvisorMemoryRepository } from '../../adapters/prisma/advisor-memory.repository';
import {
  buildOnboardingSystemPrompt,
  getOnboardingGreeting,
} from '../prompts/onboarding-system-prompt';
import type { OnboardingPhase } from '@macon/contracts';
import { withRetry, CLAUDE_API_RETRY_CONFIG } from '../utils/retry';
import { contextCache, withSessionId } from '../context/context-cache';

// Guardrail imports - Phase 2 code-level controls
import type { AgentType, BudgetTracker, TierBudgets } from './types';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker } from './types';
import { ToolRateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';

/**
 * Validate and parse messages from database JSON to ChatMessage[]
 * Prisma stores messages as JsonValue, this safely converts them
 */
function parseChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.filter((msg): msg is ChatMessage => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    );
  });
}

/**
 * System prompt template
 * Updated for HANDLED brand voice - cheeky, professional, anti-hype
 */
const SYSTEM_PROMPT_TEMPLATE = `# HANDLED Business Assistant - System Prompt v3.0

## Your Personality

You're the AI assistant for HANDLED — a membership platform for service professionals who'd rather focus on their craft than configure tech.

**Voice guidelines:**
- Be cheeky but professional. Self-aware about being AI without being obnoxious.
- Speak to competent pros, not beginners. They're photographers, coaches, therapists — excellent at their jobs.
- Anti-hype: No "revolutionary," "cutting-edge," "transform your business." Just be helpful.
- Focus on what you HANDLE for them, not features.
- When in doubt, be direct: "Want to knock this out?" not "Would you like me to assist you with this task?"

**Words to use:** handle, handled, clients, what's worth knowing, actually, no pitch
**Words to avoid:** revolutionary, game-changing, solutions, synergy, leverage, optimize, amazing

---

## Onboarding Behavior

Based on the user's state, guide them appropriately. Suggest ONE thing at a time.

**No Stripe connected:**
Help them connect Stripe first. It's the foundation — they can't accept payments without it.
→ "Takes about 3 minutes, then you never touch it again."

**Stripe connected, no packages:**
Help them create their first package. Ask what they offer (sessions, packages, day rates).
→ "What do you offer — sessions, packages, day rates?"

**Packages exist, no bookings:**
Help them share their booking link. Be specific about where to put it.
→ "Drop it in your Instagram bio. One click, they're in."
→ "Add it to your email signature. Every email you send."

**Active business (getting bookings):**
They know what they're doing. Just be helpful. If they want more clients:
→ "After a great session, ask: 'Know anyone else who'd want this?'"

---

## Business Coaching

### Three-Tier Framework (Good/Better/Best)

Most service businesses succeed with three price points:

- **Starter/Good:** Entry point. Lets clients test the waters.
- **Core/Better:** Your bread and butter. 60-70% of clients land here.
- **Premium/Best:** High-touch, high-value. For clients who want the works.

**Example for a photographer:**
- Mini Session: $350 (20 min, 5 photos) — headshots, quick updates
- Standard Session: $650 (60 min, 15 photos, wardrobe help) — most popular
- Full Experience: $1,200 (2 hours, 30 photos, styling consult) — weddings, big events

When helping with pricing, explain your reasoning: "I'd price this at $X because..."

---

## Capability Hints

**Proactively mention what you can help with** when relevant to the conversation:

### After Discussing Pricing
- "Want me to update those prices?" or "I can set up tiered pricing for you."
- "I can adjust your deposit settings too — currently you're requiring [X]%."

### After Discussing Marketing or Branding
- "I can update your landing page headline or hero section."
- "Want me to draft some package descriptions?"
- "I can tweak your brand colors if you want a different vibe."

### After Discussing Scheduling or Availability
- "I can block off those dates for you." (add_blackout_date)
- "Want me to check your upcoming bookings?" (get_bookings)
- "I can reschedule that booking to a new date." (update_booking)

### After Discussing Customers or Bookings
- "I can look up that customer's booking history." (get_customers)
- "Want me to pull up the details on that booking?" (get_booking)

### When Users Seem Stuck
- "I can help with packages, pricing, your landing page, schedule, or just chat about strategy."
- "Some things I'm good at: creating packages, adjusting prices, blocking off dates, and updating your storefront."

### For Long Conversations
- Use **refresh_context** to get current stats if the session has been going for a while.

---

## What I Can't Do (Honesty Section)

Be upfront about limitations:

- **Email:** "I can't send emails directly, but I can draft the message for you to copy."
- **Social media:** "I can't connect your Instagram or post for you, but I can help write content."
- **Direct Stripe operations:** "For refunds, you'll need to use your Stripe dashboard directly — I can show you what to refund but can't process it myself."
- **Calendar integrations:** "I can't sync with Google Calendar, but I can block dates and check availability here."
- **Payment collection:** "I can't charge cards directly — that happens when clients book through your storefront."

When something is outside your capabilities, be direct: "That's not something I can do, but here's what I can help with instead..."

---

## Core Rules

### ALWAYS
- **Propose before changing:** Show what you'll do, get confirmation based on trust tier
- **Be specific:** "$3,500" not "competitive pricing"
- **Explain your reasoning:** "I'd price this at $X because..."
- **Use tools for current data:** Don't guess - call get_dashboard or get_packages

### NEVER
- Execute T3 operations without explicit "yes"/"confirm"/"do it"
- Make promises about revenue or guarantees
- Pretend to know things - ask clarifying questions instead
- Retry failed operations without asking

---

## Trust Tiers

| Tier | When | Your Behavior |
|------|------|---------------|
| **T1** | Blackouts, branding, file uploads | Do it, report result |
| **T2** | Package changes, pricing, storefront | "I'll update X. Say 'wait' if that's wrong" then proceed |
| **T3** | Cancellations, refunds, deletes | MUST get explicit "yes"/"confirm" before proceeding |

For T3 operations, always explain consequences first:
"To cancel Sarah's booking, I'll issue a $500 refund and notify her. Confirm?"

---

## Tool Usage

**Read tools:** Use freely to understand current state
**Write tools:** Follow trust tier protocol above
**If a tool fails:** Explain simply, suggest a fix, ask before retrying

### Refreshing Context in Long Sessions

Your initial business context (Stripe status, package count, bookings, revenue) is loaded once at session start.
For long-running sessions, data may become stale. Use **refresh_context** to get current stats when:
- The user mentions recent changes ("I just added a package" or "I got a new booking")
- You're about to give advice based on package count or revenue
- The session has been active for several exchanges without fresh data

---

## Error Handling

When tools fail:
"I couldn't [action] because [reason].
[Suggested fix]. Want me to try that?"

---

## Anti-Patterns (Don't Do These)

❌ **Vague:** "You could raise your prices" → Be specific: "I'd raise Wedding Day to $4,000"
❌ **Assume approval:** "I'll update that now" → Follow trust tier protocol
❌ **Over-explain:** "As an AI, I can help you..." → Just help them
❌ **Hype words:** "This will revolutionize your workflow" → "This saves you 20 minutes per booking"

---

## Domain Vocabulary

Users often use different terms for the same concepts. Map these to the correct HANDLED terminology:

| User Says | Means | Notes |
|-----------|-------|-------|
| "storefront", "my website", "my site", "my page" | Landing page | Located at /t/{slug} or their custom domain |
| "sessions", "appointments", "time slots" | Packages | Time-based services they sell |
| "offerings", "services", "products" | Packages | What they sell to clients |
| "deposit", "upfront payment" | depositPercent | Percentage collected at booking (0-100) |
| "balance due", "remaining payment", "final payment" | balanceDueDays | Days before event to collect remainder |
| "clients", "customers", "bookings" | People who have booked | Use get_bookings or get_dashboard tools |
| "availability", "calendar", "schedule" | Blackout dates | Days they're unavailable (use blackout tools) |

**When users mention these terms, translate internally but respond using their language.** If a photographer asks about "sessions," talk about sessions — just know you're working with packages.

---

{BUSINESS_CONTEXT}
`;

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  model: string;
  maxTokens: number;
  maxHistoryMessages: number;
  temperature?: number;
  /** Agent type for context-aware behavior (windows, rate limits) */
  agentType?: AgentType;
  /** Custom tier budgets (default: T1=10, T2=3, T3=1) */
  tierBudgets?: TierBudgets;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  maxHistoryMessages: 20, // Sliding window
  temperature: 0.7,
  agentType: 'admin', // Default to admin for backwards compatibility
};

/**
 * Maximum recursion depth for tool calls.
 * Prevents unbounded API costs and stack overflow from malicious prompts.
 */
const MAX_RECURSION_DEPTH = 5;

/**
 * Default timeout for proposal executors in milliseconds.
 * Prevents slow executors (e.g., Stripe API calls) from blocking Claude response.
 * If an executor exceeds this timeout, the proposal is marked as failed and execution continues.
 */
const EXECUTOR_TIMEOUT_MS = 5000;

/**
 * Tools that modify tenant data and require cache invalidation after execution.
 * When these tools succeed, the context cache is invalidated so subsequent
 * messages reflect the fresh state.
 */
const WRITE_TOOLS = new Set([
  'upsert_services', // Creates segments and packages
  'update_storefront', // Updates landing page config
  'update_onboarding_state', // Updates onboarding phase/data
  'create_booking', // Creates bookings
  'update_package', // Updates package details
]);

/**
 * Execute a promise with a timeout.
 * Returns the result if successful, throws TimeoutError if timeout exceeded.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Executor timeout: ${operationName} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Chat message for conversation history
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUses?: {
    toolName: string;
    input: Record<string, unknown>;
    result: AgentToolResult;
  }[];
}

/**
 * Onboarding-specific session context
 */
export interface OnboardingSessionContext {
  isOnboardingMode: boolean;
  currentPhase: OnboardingPhase;
  isReturning: boolean;
  memorySummary?: string;
}

/**
 * Session state stored in database
 */
export interface SessionState {
  sessionId: string;
  tenantId: string;
  messages: ChatMessage[];
  context: AgentSessionContext;
  onboarding?: OnboardingSessionContext;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat response from orchestrator
 */
export interface ChatResponse {
  message: string;
  proposals?: {
    proposalId: string;
    operation: string;
    preview: Record<string, unknown>;
    trustTier: string;
    requiresApproval: boolean;
  }[];
  toolResults?: {
    toolName: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }[];
}

/**
 * Agent Orchestrator
 *
 * Supports two modes:
 * - Business Assistant Mode: Regular chat with business tools
 * - Onboarding Mode: Guided setup with onboarding tools
 *
 * Mode is auto-detected based on tenant's onboarding phase.
 */
export class AgentOrchestrator {
  private anthropic: Anthropic;
  private config: OrchestratorConfig;
  private proposalService: ProposalService;
  private auditService: AuditService;
  private advisorMemoryService: AdvisorMemoryService;

  // Guardrails - Phase 2 code-level controls
  private readonly agentType: AgentType;
  private readonly rateLimiter: ToolRateLimiter;
  private readonly tierBudgets: TierBudgets;

  // Per-session state (reset per session, not per turn)
  private circuitBreaker: CircuitBreaker | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.proposalService = new ProposalService(prisma);
    this.auditService = new AuditService(prisma);

    // Initialize guardrails
    this.agentType = this.config.agentType || 'admin';
    this.rateLimiter = new ToolRateLimiter();
    this.tierBudgets = this.config.tierBudgets || DEFAULT_TIER_BUDGETS;

    // Initialize advisor memory service for onboarding mode
    const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(prisma);
    this.advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepo);

    logger.debug(
      { agentType: this.agentType, tierBudgets: this.tierBudgets },
      'AgentOrchestrator initialized with guardrails'
    );
  }

  /**
   * Create or get session for a tenant
   */
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    // Look for existing active session (within last 24 hours)
    const existingSession = await this.prisma.agentSession.findFirst({
      where: {
        tenantId,
        updatedAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get onboarding context (needed for both existing and new sessions)
    const onboardingContext = await this.buildOnboardingContext(tenantId);

    if (existingSession) {
      const context = await this.buildContext(tenantId, existingSession.id);
      return {
        sessionId: existingSession.id,
        tenantId,
        messages: parseChatMessages(existingSession.messages),
        context,
        onboarding: onboardingContext,
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
      };
    }

    // Create new session
    const newSession = await this.prisma.agentSession.create({
      data: {
        tenantId,
        messages: [],
      },
    });

    const context = await this.buildContext(tenantId, newSession.id);

    logger.info(
      {
        tenantId,
        sessionId: newSession.id,
        isOnboardingMode: onboardingContext.isOnboardingMode,
        onboardingPhase: onboardingContext.currentPhase,
      },
      'New agent session created'
    );

    return {
      sessionId: newSession.id,
      tenantId,
      messages: [],
      context,
      onboarding: onboardingContext,
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }

  /**
   * Get existing session by ID
   */
  async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Tenant isolation
      },
    });

    if (!session) {
      return null;
    }

    const context = await this.buildContext(tenantId, sessionId);
    const onboardingContext = await this.buildOnboardingContext(tenantId);

    return {
      sessionId: session.id,
      tenantId,
      messages: parseChatMessages(session.messages),
      context,
      onboarding: onboardingContext,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Send a message and get response
   *
   * @param tenantId - The tenant ID
   * @param requestedSessionId - The session ID from the request (may be stale/expired)
   * @param userMessage - The user's message
   */
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // Get or validate session - IMPORTANT: Use the resolved session's ID, not the requested one
    let session = await this.getSession(tenantId, requestedSessionId);
    if (!session) {
      session = await this.getOrCreateSession(tenantId);
    }

    // Determine agent type for this session (onboarding mode uses different windows)
    const isOnboardingMode = session.onboarding?.isOnboardingMode ?? false;
    const effectiveAgentType: AgentType = isOnboardingMode ? 'onboarding' : this.agentType;

    // Initialize or reset guardrails for this turn
    this.rateLimiter.resetTurn();
    if (!this.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker();
    }

    // Check circuit breaker before proceeding
    const circuitCheck = this.circuitBreaker.check();
    if (!circuitCheck.allowed) {
      logger.warn(
        { tenantId, sessionId: session.sessionId, reason: circuitCheck.reason },
        'Circuit breaker tripped - session limit reached'
      );
      return {
        message: `I've reached my session limit. ${circuitCheck.reason}. Please start a new conversation to continue.`,
      };
    }

    // T2 soft-confirm: Process pending proposals if user doesn't say "wait"
    // FIX: Use session.sessionId (the actual session) not requestedSessionId (which may be stale)
    const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
      tenantId,
      session.sessionId, // FIX: Use resolved session ID
      userMessage,
      effectiveAgentType // Pass agent type for context-aware window
    );

    // Track failed proposals to inform Claude so it can apologize and offer alternatives
    const failedProposals: Array<{ id: string; toolName: string; reason: string }> = [];

    if (softConfirmedIds.length > 0) {
      logger.info(
        { tenantId, sessionId, count: softConfirmedIds.length, proposalIds: softConfirmedIds },
        'T2 proposals soft-confirmed by user message'
      );

      // Batch-fetch all proposals in a single query (avoids N sequential database calls)
      // CRITICAL: Filter by tenantId to prevent cross-tenant execution
      const proposals = await this.prisma.agentProposal.findMany({
        where: {
          id: { in: softConfirmedIds },
          tenantId, // Multi-tenant isolation
        },
      });

      // Build a map for fast lookup
      const proposalMap = new Map(proposals.map((p) => [p.id, p]));

      // Track proposals that weren't found (possible security issue or race condition)
      for (const proposalId of softConfirmedIds) {
        if (!proposalMap.has(proposalId)) {
          logger.warn(
            { proposalId, tenantId },
            'Proposal not found or tenant mismatch - possible security issue'
          );
          failedProposals.push({
            id: proposalId,
            toolName: 'unknown',
            reason: 'Unable to process this action. Please try again.',
          });
        }
      }

      // Prepare execution tasks for valid proposals
      type ExecutionTask = {
        proposalId: string;
        toolName: string;
        executor: (tenantId: string, payload: Record<string, unknown>) => Promise<unknown>;
        payload: Record<string, unknown>;
      };

      const executionTasks: ExecutionTask[] = [];
      const skippedProposals: Array<{ id: string; toolName: string; reason: string }> = [];

      for (const proposal of proposals) {
        const executor = getProposalExecutor(proposal.toolName);
        if (!executor) {
          logger.error(
            { proposalId: proposal.id, toolName: proposal.toolName },
            'No executor registered for tool'
          );
          skippedProposals.push({
            id: proposal.id,
            toolName: proposal.toolName,
            reason: `No executor registered for ${proposal.toolName}`,
          });
          continue;
        }

        // Validate payload schema before execution (prevents malformed/malicious payloads)
        const rawPayload = (proposal.payload as Record<string, unknown>) || {};
        let payload: Record<string, unknown>;
        try {
          payload = validateExecutorPayload(proposal.toolName, rawPayload);
        } catch (validationError) {
          const errorMessage =
            validationError instanceof Error ? validationError.message : String(validationError);
          logger.error(
            { proposalId: proposal.id, toolName: proposal.toolName, error: errorMessage },
            'Proposal payload validation failed'
          );
          skippedProposals.push({
            id: proposal.id,
            toolName: proposal.toolName,
            reason: errorMessage,
          });
          continue;
        }

        executionTasks.push({
          proposalId: proposal.id,
          toolName: proposal.toolName,
          executor,
          payload,
        });
      }

      // Mark skipped proposals as failed (batch operation would be nice but markFailed is per-proposal)
      await Promise.all(
        skippedProposals.map(async (skipped) => {
          await this.proposalService.markFailed(skipped.id, skipped.reason);
          failedProposals.push(skipped);
        })
      );

      // Execute all valid proposals in parallel with timeout
      if (executionTasks.length > 0) {
        logger.info(
          { tenantId, count: executionTasks.length, timeoutMs: EXECUTOR_TIMEOUT_MS },
          'Executing T2 soft-confirmed proposals in parallel'
        );

        const results = await Promise.allSettled(
          executionTasks.map(async (task) => {
            const result = await withTimeout(
              task.executor(tenantId, task.payload),
              EXECUTOR_TIMEOUT_MS,
              task.toolName
            );
            return { task, result };
          })
        );

        // Process results and update proposal statuses
        await Promise.all(
          results.map(async (settledResult, index) => {
            const task = executionTasks[index];

            if (settledResult.status === 'fulfilled') {
              const executionResult = settledResult.value.result as Record<string, unknown>;
              await this.proposalService.markExecuted(task.proposalId, executionResult);
              logger.info(
                {
                  proposalId: task.proposalId,
                  toolName: task.toolName,
                  result: settledResult.value.result,
                },
                'T2 proposal executed successfully'
              );
            } else {
              const errorMessage =
                settledResult.reason instanceof Error
                  ? settledResult.reason.message
                  : String(settledResult.reason);
              logger.error(
                { proposalId: task.proposalId, toolName: task.toolName, error: errorMessage },
                'Failed to execute T2 soft-confirmed proposal'
              );
              await this.proposalService.markFailed(task.proposalId, errorMessage);
              failedProposals.push({
                id: task.proposalId,
                toolName: task.toolName,
                reason: errorMessage,
              });
            }
          })
        );
      }
    }

    // Build system prompt based on mode (isOnboardingMode already determined above)
    let systemPrompt: string;
    if (isOnboardingMode && session.onboarding) {
      // Get tenant for business name
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      // Get advisor memory for context
      const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

      // Build onboarding-specific system prompt
      systemPrompt = buildOnboardingSystemPrompt({
        businessName: tenant?.name || 'Your Business',
        currentPhase: session.onboarding.currentPhase,
        advisorMemory: onboardingCtx.memory ?? undefined,
        isResume: onboardingCtx.isReturning,
      });

      logger.debug(
        {
          tenantId,
          sessionId,
          phase: session.onboarding.currentPhase,
          isReturning: onboardingCtx.isReturning,
        },
        'Using onboarding system prompt'
      );
    } else {
      // Use regular business assistant prompt
      systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
        '{BUSINESS_CONTEXT}',
        session.context.contextPrompt
      );
    }

    // If there were failed proposals, add context so Claude can apologize and offer alternatives
    if (failedProposals.length > 0) {
      const failureContext = failedProposals.map((f) => `- ${f.toolName}: ${f.reason}`).join('\n');
      systemPrompt += `\n\n---\n\n## Recent Action Failures\n\nSome actions I tried to execute failed:\n${failureContext}\n\nPlease acknowledge these failures to the user, apologize briefly, and offer alternatives or ask how to proceed.`;
      logger.info(
        { tenantId, sessionId, failedCount: failedProposals.length },
        'Added failure context to system prompt for user feedback'
      );
    }

    // Convert session history to API format with sliding window
    const historyMessages = this.buildHistoryMessages(session.messages);

    // Add user message
    const messages: MessageParam[] = [...historyMessages, { role: 'user', content: userMessage }];

    // Build tools for API - use onboarding tools when in onboarding mode
    const tools = this.buildToolsForAPI(isOnboardingMode);

    // Call Claude API with retry logic for transient failures
    let response: Anthropic.Messages.Message;
    try {
      response = await withRetry(
        () =>
          this.anthropic.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: systemPrompt,
            messages,
            tools,
          }),
        'claude-api-chat',
        CLAUDE_API_RETRY_CONFIG
      );
    } catch (error) {
      logger.error({ error, tenantId, sessionId }, 'Claude API call failed after retries');
      throw new Error('Failed to communicate with AI assistant. Please try again in a moment.');
    }

    // Create budget tracker for this turn
    const budgetTracker = createBudgetTracker(this.tierBudgets);

    // Process response - handle tool calls if any
    const { finalMessage, toolResults, proposals } = await this.processResponse(
      response,
      tenantId,
      sessionId,
      messages,
      session.context,
      systemPrompt,
      isOnboardingMode,
      0, // depth
      budgetTracker
    );

    // Record turn completion for circuit breaker
    // Estimate tokens: input + output (rough approximation)
    const estimatedTokens = Math.ceil(
      (userMessage.length + finalMessage.length) / 4 + // ~4 chars per token
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0)
    );
    this.circuitBreaker?.recordTurn(estimatedTokens);
    this.circuitBreaker?.recordSuccess();

    logger.debug(
      {
        tenantId,
        sessionId: session.sessionId,
        budgetUsed: budgetTracker.used,
        rateLimitStats: this.rateLimiter.getStats(),
        circuitBreakerState: this.circuitBreaker?.getState(),
      },
      'Turn completed with guardrail stats'
    );

    // Update session with new messages
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };

    // Ensure we never store empty content (Claude API rejects empty non-final assistant messages)
    // If tools were executed but no text was returned, provide a placeholder
    const messageContent =
      finalMessage || (toolResults && toolResults.length > 0 ? '[Tools executed]' : 'Done.');

    const newAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: messageContent,
      toolUses: toolResults?.map((r) => ({
        toolName: r.toolName,
        input: r.input || {},
        result: r.result,
      })),
    };

    const updatedMessages = [...session.messages, newUserMessage, newAssistantMessage].slice(
      -this.config.maxHistoryMessages
    );

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.logToolCall({
      tenantId,
      sessionId,
      toolName: 'chat',
      inputSummary: userMessage.slice(0, 500),
      outputSummary: finalMessage.slice(0, 500),
      trustTier: 'T1',
      approvalStatus: 'AUTO',
      durationMs: Date.now() - startTime,
      success: true,
    });

    return {
      message: finalMessage,
      proposals,
      toolResults: toolResults?.map((r) => ({
        toolName: r.toolName,
        success: r.result.success,
        data: 'data' in r.result ? r.result.data : undefined,
        error: 'error' in r.result ? r.result.error : undefined,
      })),
    };
  }

  /**
   * Get initial greeting based on user context
   * Uses HANDLED-voice greetings, or onboarding greeting if in onboarding mode
   */
  async getGreeting(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.getSession(tenantId, sessionId);
    if (!session) {
      return `What should we knock out today?`;
    }

    // Use onboarding greeting if in onboarding mode
    if (session.onboarding?.isOnboardingMode) {
      // Get tenant for business name
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      // Get advisor memory for resume context
      const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

      return getOnboardingGreeting({
        businessName: tenant?.name || 'Your Business',
        currentPhase: session.onboarding.currentPhase,
        advisorMemory: onboardingCtx.memory ?? undefined,
        isResume: onboardingCtx.isReturning,
      });
    }

    return getHandledGreeting(session.context);
  }

  /**
   * Build context for session with caching
   *
   * Uses in-memory cache with 5-minute TTL to reduce database load.
   * Context is per-tenant, sessionId is updated on retrieval.
   */
  private async buildContext(tenantId: string, sessionId: string): Promise<AgentSessionContext> {
    try {
      // Check cache first
      const cached = contextCache.get(tenantId);
      if (cached) {
        // Update sessionId since cache is per-tenant, not per-session
        return withSessionId(cached, sessionId);
      }

      // Build fresh context and cache it
      const context = await buildSessionContext(this.prisma, tenantId, sessionId);
      contextCache.set(tenantId, context);
      return context;
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to build session context');
      return buildFallbackContext(tenantId, sessionId);
    }
  }

  /**
   * Invalidate cached context for a tenant
   * Call after write operations that modify tenant data
   */
  invalidateContextCache(tenantId: string): void {
    contextCache.invalidate(tenantId);
  }

  /**
   * Build onboarding context for session
   *
   * Determines if tenant is in onboarding mode and gets relevant context.
   * Onboarding mode is active when tenant.onboardingPhase is NOT 'COMPLETED' or 'SKIPPED'.
   */
  private async buildOnboardingContext(tenantId: string): Promise<OnboardingSessionContext> {
    try {
      // Get tenant's onboarding phase
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingPhase: true },
      });

      if (!tenant) {
        return {
          isOnboardingMode: false,
          currentPhase: 'NOT_STARTED',
          isReturning: false,
        };
      }

      const currentPhase = (tenant.onboardingPhase as OnboardingPhase) || 'NOT_STARTED';

      // Onboarding is active if not completed or skipped
      const isOnboardingMode = currentPhase !== 'COMPLETED' && currentPhase !== 'SKIPPED';

      // Get advisor memory context for returning users
      const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);
      const resumeSummary = onboardingCtx.isReturning
        ? await this.advisorMemoryService.getResumeSummary(tenantId)
        : undefined;

      return {
        isOnboardingMode,
        currentPhase,
        isReturning: onboardingCtx.isReturning,
        memorySummary: resumeSummary ?? undefined,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to build onboarding context');
      // Fallback to non-onboarding mode on error
      return {
        isOnboardingMode: false,
        currentPhase: 'NOT_STARTED',
        isReturning: false,
      };
    }
  }

  /**
   * Build history messages for API call
   */
  private buildHistoryMessages(messages: ChatMessage[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Build tools in Anthropic API format
   *
   * @param includeOnboarding - Whether to include onboarding-specific tools
   */
  private buildToolsForAPI(includeOnboarding: boolean = false): Anthropic.Messages.Tool[] {
    const allTools = includeOnboarding ? getAllToolsWithOnboarding() : getAllTools();

    return allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
    }));
  }

  /**
   * Get tools list for tool execution
   */
  private getToolsList(includeOnboarding: boolean = false): AgentTool[] {
    return includeOnboarding ? getAllToolsWithOnboarding() : getAllTools();
  }

  /**
   * Process Claude response, executing tool calls as needed.
   * @param cachedContext - Pre-built session context to avoid redundant rebuilds
   * @param cachedSystemPrompt - Pre-built system prompt to avoid redundant rebuilds
   * @param isOnboardingMode - Whether to use onboarding tools
   * @param depth - Current recursion depth (prevents unbounded tool call loops)
   * @param budgetTracker - Per-tier budget tracker for this turn
   */
  private async processResponse(
    response: Anthropic.Messages.Message,
    tenantId: string,
    sessionId: string,
    messages: MessageParam[],
    cachedContext: AgentSessionContext,
    cachedSystemPrompt: string,
    isOnboardingMode: boolean = false,
    depth: number = 0,
    budgetTracker?: BudgetTracker
  ): Promise<{
    finalMessage: string;
    toolResults?: {
      toolName: string;
      input?: Record<string, unknown>;
      result: AgentToolResult;
    }[];
    proposals?: {
      proposalId: string;
      operation: string;
      preview: Record<string, unknown>;
      trustTier: string;
      requiresApproval: boolean;
    }[];
  }> {
    // Check recursion depth limit (legacy, kept for backwards compatibility)
    if (depth >= MAX_RECURSION_DEPTH) {
      logger.warn(
        { tenantId, sessionId, depth },
        'Tool recursion depth limit reached - preventing further tool calls'
      );
      return {
        finalMessage:
          "I've reached my limit for tool operations in a single request. Let me summarize what I've done so far. If you need more actions, please send another message.",
      };
    }

    // Create default budget tracker if not provided (backwards compatibility)
    const budget = budgetTracker || createBudgetTracker(this.tierBudgets);

    // Check if response has tool calls
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls - extract text response
      const textContent = response.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return { finalMessage: textContent };
    }

    // Execute tool calls
    const toolResults: {
      toolName: string;
      input?: Record<string, unknown>;
      result: AgentToolResult;
    }[] = [];
    const proposals: {
      proposalId: string;
      operation: string;
      preview: Record<string, unknown>;
      trustTier: string;
      requiresApproval: boolean;
    }[] = [];
    const toolResultBlocks: ToolResultBlockParam[] = [];

    const toolContext: ToolContext = {
      tenantId,
      sessionId,
      prisma: this.prisma,
    };

    // Get the appropriate tool list based on mode
    const availableTools = this.getToolsList(isOnboardingMode);

    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      const tool = availableTools.find((t) => t.name === toolUse.name);

      if (!tool) {
        logger.warn({ toolName: toolUse.name }, 'Unknown tool requested');
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: "I don't recognize that action. Please try a different request.",
          }),
        });
        continue;
      }

      // Check rate limits before execution
      const rateLimitCheck = this.rateLimiter.canCall(toolUse.name);
      if (!rateLimitCheck.allowed) {
        logger.warn({ toolName: toolUse.name, reason: rateLimitCheck.reason }, 'Tool rate limited');
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: `Rate limit reached: ${rateLimitCheck.reason}. Please try again in your next message.`,
          }),
        });
        continue;
      }

      // Check tier budget before execution
      const toolTier = tool.trustTier || 'T1';
      if (!budget.consume(toolTier as keyof TierBudgets)) {
        logger.warn(
          { toolName: toolUse.name, tier: toolTier, remaining: budget.remaining },
          'Tier budget exhausted'
        );
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: `I've reached my limit for ${toolTier} operations this turn. Please continue in your next message.`,
          }),
        });
        continue;
      }

      try {
        const result = await tool.execute(toolContext, toolUse.input as Record<string, unknown>);

        // Record successful call in rate limiter
        this.rateLimiter.recordCall(toolUse.name);

        toolResults.push({
          toolName: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          result,
        });

        // Check if result is a proposal
        if ('proposalId' in result && result.success) {
          proposals.push({
            proposalId: result.proposalId,
            operation: result.operation,
            preview: result.preview,
            trustTier: result.trustTier,
            requiresApproval: result.requiresApproval,
          });
        }

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Audit log
        if (result.success) {
          if ('proposalId' in result) {
            await this.auditService.logProposalCreated(
              tenantId,
              sessionId,
              toolUse.name,
              result.proposalId,
              result.trustTier as any,
              JSON.stringify(toolUse.input).slice(0, 500),
              Date.now() - startTime
            );
          } else {
            await this.auditService.logRead(
              tenantId,
              sessionId,
              toolUse.name,
              JSON.stringify(toolUse.input).slice(0, 500),
              JSON.stringify(result).slice(0, 500),
              Date.now() - startTime
            );
          }

          // Invalidate context cache after successful write tool execution
          // This ensures subsequent messages see fresh data (e.g., new packages)
          if (WRITE_TOOLS.has(toolUse.name)) {
            this.invalidateContextCache(tenantId);
            logger.debug(
              { tenantId, toolName: toolUse.name },
              'Context cache invalidated after write tool'
            );
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, toolName: toolUse.name }, 'Tool execution failed');

        toolResults.push({
          toolName: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          result: { success: false, error: errorMessage },
        });

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: false, error: errorMessage }),
        });

        await this.auditService.logError(
          tenantId,
          sessionId,
          toolUse.name,
          JSON.stringify(toolUse.input).slice(0, 500),
          errorMessage,
          Date.now() - startTime
        );
      }
    }

    // Continue conversation with tool results
    const continuedMessages: MessageParam[] = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResultBlocks },
    ];

    // Get final response from Claude with retry logic (use cached prompt to avoid redundant rebuilds)
    const finalResponse = await withRetry(
      () =>
        this.anthropic.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: cachedSystemPrompt,
          messages: continuedMessages,
          tools: this.buildToolsForAPI(isOnboardingMode),
        }),
      'claude-api-tool-continuation',
      CLAUDE_API_RETRY_CONFIG
    );

    // Check for more tool calls (recursive with depth limit and shared budget)
    if (finalResponse.content.some((block) => block.type === 'tool_use')) {
      // Recursively handle more tool calls (increment depth, pass same budget tracker)
      const recursiveResult = await this.processResponse(
        finalResponse,
        tenantId,
        sessionId,
        continuedMessages,
        cachedContext,
        cachedSystemPrompt,
        isOnboardingMode,
        depth + 1,
        budget // Pass the same budget tracker for consistent enforcement across recursion
      );
      return {
        finalMessage: recursiveResult.finalMessage,
        toolResults: [...toolResults, ...(recursiveResult.toolResults || [])],
        proposals: [...proposals, ...(recursiveResult.proposals || [])],
      };
    }

    // Extract final text
    const finalText = finalResponse.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      finalMessage: finalText,
      toolResults,
      proposals,
    };
  }
}
