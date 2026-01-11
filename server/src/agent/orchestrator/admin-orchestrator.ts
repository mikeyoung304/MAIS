/**
 * Admin Orchestrator
 *
 * Specialized orchestrator for tenant admin/business assistant.
 * Uses medium soft-confirm windows (5 min) for business management tasks.
 *
 * Key characteristics:
 * - Full tool set (read + write tools for all business operations)
 * - HANDLED brand voice (cheeky, professional, anti-hype)
 * - Business context with metrics and onboarding state awareness
 * - Switches to OnboardingOrchestrator when tenant is in onboarding
 */

import type { AgentTool } from '../tools/types';
import { getAllTools, getAllToolsWithOnboarding } from '../tools/all-tools';
import {
  buildSessionContext,
  getHandledGreeting,
  buildFallbackContext,
} from '../context/context-builder';
import type { AgentSessionContext } from '../context/context-builder';
import { withSessionId } from '../context/context-cache';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { parseOnboardingPhase, type OnboardingPhase } from '@macon/contracts';
import {
  buildOnboardingSystemPrompt,
  getOnboardingGreeting,
} from '../prompts/onboarding-system-prompt';
import { AdvisorMemoryService } from '../onboarding/advisor-memory.service';
import { PrismaAdvisorMemoryRepository } from '../../adapters/prisma/advisor-memory.repository';

import {
  BaseOrchestrator,
  type OrchestratorConfig,
  type PromptContext,
  type SessionState,
  type ChatResponse,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './base-orchestrator';
import { DEFAULT_TIER_BUDGETS, isOnboardingActive } from './types';
import { DEFAULT_TOOL_RATE_LIMITS } from './rate-limiter';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker';
import { getRequestContext, runInRequestContext } from './request-context';
import { TIER_LIMITS, isOverQuota, getRemainingMessages } from '../../config/tiers';

/**
 * Admin-specific configuration
 */
const ADMIN_CONFIG: OrchestratorConfig = {
  agentType: 'admin',
  model: DEFAULT_ORCHESTRATOR_CONFIG.model,
  maxTokens: DEFAULT_ORCHESTRATOR_CONFIG.maxTokens,
  maxHistoryMessages: 20,
  temperature: DEFAULT_ORCHESTRATOR_CONFIG.temperature,
  tierBudgets: DEFAULT_TIER_BUDGETS,
  toolRateLimits: DEFAULT_TOOL_RATE_LIMITS,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  // T1(10) + T2(3) + T3(1) + buffer(5) = 19
  maxRecursionDepth: 19,
  executorTimeoutMs: 5000,
};

/**
 * System prompt template for admin/business assistant
 */
const SYSTEM_PROMPT_TEMPLATE = `# HANDLED Business Assistant - System Prompt v4.0

## Your Personality

Hip, busy assistant. Competent and you know it. Here to support, not hand-hold.

**Voice:**
- Terse. 1-2 sentences max unless delivering content.
- Pointed questions. Binary choices when possible.
- Don't explain what you're about to do. Just do it.

**Confirmations:** "bet", "done", "got it", "on it", "heard", "say less"

**Never say:**
- "I'd be happy to help with that!"
- "Great choice!"
- "Let me explain how this works..."
- "I'll now proceed to..."
- Any sentence starting with "Great!" or "Absolutely!"

**Question style:**
- "Ready for about section? Brain dump or I ask questions?"
- "Headline first. What've you got?"
- NOT: "Would you like me to help you craft your about section?"

---

## Onboarding Hints

**No Stripe:** "No Stripe yet. 3 mins to connect. Now?"
**No packages:** "Stripe's set. What do you sell — sessions, packages, day rates?"
**No bookings:** "Packages ready. Drop your booking link in your IG bio."
**Active:** Just help. Don't lecture.

---

## Trust Tiers

| Tier | Action |
|------|--------|
| T1 | Do it, say "done" |
| T2 | Do it, say "done. say 'wait' to undo" |
| T3 | Ask first: "This deletes X. Confirm?" |

---

## Storefront Editing

Use section IDs (e.g., "home-hero-main"), not indices.
Call \`list_section_ids\` first if unsure what exists.
All changes go to draft. \`publish_draft\` (T3) makes it live.

**Draft content:** "In your draft..." or "Once published..."
**Live content:** "On your live site..."
Never confuse the two.

---

## When They Give You Content

User dumps info → "got it. writing." → [tool call] → "done. [highlight section-id] Check it. Tweaks or move on?"

Don't gush about how great their content is. Just shape it and deliver.

---

{BUSINESS_CONTEXT}
`;

/**
 * Extended session state with admin context
 */
export interface AdminSessionState extends SessionState {
  context: AgentSessionContext;
  isOnboardingMode: boolean;
  onboardingPhase?: OnboardingPhase;
}

/**
 * Admin Orchestrator
 *
 * NOTE: Onboarding mode is tracked per-request using AsyncLocalStorage
 * (see request-context.ts) to prevent race conditions. Previously used
 * instance state which caused wrong tools to be returned during concurrent
 * requests from different tenants.
 */
export class AdminOrchestrator extends BaseOrchestrator {
  private advisorMemoryService: AdvisorMemoryService;

  constructor(prisma: import('../../generated/prisma/client').PrismaClient) {
    super(prisma);
    const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(prisma);
    this.advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepo);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract Method Implementations
  // ─────────────────────────────────────────────────────────────────────────────

  getConfig(): OrchestratorConfig {
    return ADMIN_CONFIG;
  }

  protected getTools(): AgentTool[] {
    // Read onboarding mode from request-scoped context (set in chat() override)
    // Falls back to regular tools if context not available (defensive)
    const ctx = getRequestContext();
    return ctx?.isOnboardingMode ? getAllToolsWithOnboarding() : getAllTools();
  }

  protected async buildSystemPrompt(context: PromptContext): Promise<string> {
    // Check if we're in onboarding mode (from request context)
    const requestCtx = getRequestContext();
    if (requestCtx?.isOnboardingMode) {
      // Use onboarding-specific system prompt
      const tenant = context.tenant;
      const currentPhase = parseOnboardingPhase(tenant?.onboardingPhase);
      const businessName = tenant?.name || 'Your Business';

      // Get advisor memory for session continuity
      const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(context.tenantId);

      return buildOnboardingSystemPrompt({
        businessName,
        currentPhase,
        advisorMemory: onboardingCtx.memory ?? undefined,
        isResume: onboardingCtx.isReturning,
      });
    }

    // Build session context with caching for regular admin mode
    const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);

    return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin-Specific Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override chat to check onboarding mode and enforce AI quota.
   *
   * Uses AsyncLocalStorage to store mode per-request, preventing race
   * conditions when concurrent requests hit the singleton orchestrator.
   *
   * Flow:
   * 1. Check quota BEFORE processing (fail fast)
   * 2. Check onboarding mode for tool selection
   * 3. Process message via parent class
   * 4. Increment counter AFTER success (atomic)
   *
   * Returns usage info in response for frontend to display upgrade prompts.
   */
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse & { usage?: { used: number; limit: number; remaining: number } }> {
    // 1. Get tenant with tier info and onboarding phase
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true, aiMessagesUsed: true, onboardingPhase: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tier = tenant.tier;
    const limit = TIER_LIMITS[tier].aiMessages;
    const used = tenant.aiMessagesUsed;

    // 2. Check quota BEFORE processing
    if (isOverQuota(tier, used)) {
      logger.info({ tenantId, tier, used, limit }, 'AI quota exceeded - returning upgrade prompt');

      // Need to get/create session for the response
      let session = await this.getSession(tenantId, requestedSessionId);
      if (!session) {
        session = await this.getOrCreateSession(tenantId);
      }

      return {
        message: `You've used all ${limit} AI messages this month. Upgrade your plan to continue chatting.`,
        sessionId: session.sessionId,
        usage: { used, limit, remaining: 0 },
      };
    }

    // 3. Determine onboarding mode for tool selection
    const isOnboardingMode = isOnboardingActive(tenant.onboardingPhase);

    // 4. Process message via parent class within request-scoped context
    // This ensures getTools() reads the correct mode for THIS request
    const response = await runInRequestContext({ isOnboardingMode }, () =>
      super.chat(tenantId, requestedSessionId, userMessage)
    );

    // 5. Increment counter AFTER success (atomic)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiMessagesUsed: { increment: 1 } },
    });

    // 6. Return response with updated usage
    const newUsed = used + 1;
    return {
      ...response,
      usage: {
        used: newUsed,
        limit,
        remaining: getRemainingMessages(tier, newUsed),
      },
    };
  }

  /**
   * Get admin greeting based on context
   */
  async getGreeting(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.getAdminSession(tenantId, sessionId);
    if (!session) {
      return 'What should we knock out today?';
    }

    // Check if onboarding is active and use onboarding greeting
    if (session.isOnboardingMode && session.onboardingPhase) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      const businessName = tenant?.name || 'Your Business';

      const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

      return getOnboardingGreeting({
        businessName,
        currentPhase: session.onboardingPhase,
        advisorMemory: onboardingCtx.memory ?? undefined,
        isResume: onboardingCtx.isReturning,
      });
    }

    return getHandledGreeting(session.context);
  }

  /**
   * Get full session state with admin context
   */
  async getAdminSession(tenantId: string, sessionId: string): Promise<AdminSessionState | null> {
    const baseSession = await this.getSession(tenantId, sessionId);
    if (!baseSession) {
      return null;
    }

    // Use session.tenant if available (pre-loaded during chat)
    // Only query DB if tenant data not in session (e.g., when called outside chat flow)
    let onboardingPhase = baseSession.tenant?.onboardingPhase as string | null | undefined;
    if (onboardingPhase === undefined) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingPhase: true },
      });
      onboardingPhase = tenant?.onboardingPhase;
    }

    const phase = parseOnboardingPhase(onboardingPhase);
    const onboardingMode = isOnboardingActive(phase);

    const context = await this.buildCachedContext(tenantId, sessionId);

    return {
      ...baseSession,
      context,
      isOnboardingMode: onboardingMode,
      onboardingPhase: phase,
    };
  }

  /**
   * Build context with caching
   */
  private async buildCachedContext(
    tenantId: string,
    sessionId: string
  ): Promise<AgentSessionContext> {
    try {
      const cached = this.cache.get(tenantId);
      if (cached) {
        return withSessionId(cached, sessionId);
      }

      const context = await buildSessionContext(this.prisma, tenantId, sessionId);
      this.cache.set(tenantId, context);
      return context;
    } catch (error) {
      logger.error({ error: sanitizeError(error), tenantId }, 'Failed to build session context');
      return buildFallbackContext(tenantId, sessionId);
    }
  }
}
