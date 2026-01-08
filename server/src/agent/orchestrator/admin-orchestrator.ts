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
  maxRecursionDepth: 5,
  executorTimeoutMs: 5000,
};

/**
 * System prompt template for admin/business assistant
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

When helping with pricing, explain your reasoning: "I'd price this at $X because..."

---

## Capability Hints

**Proactively mention what you can help with** when relevant to the conversation.

---

## Trust Tiers

| Tier | When | Your Behavior |
|------|------|---------------|
| **T1** | Blackouts, branding, file uploads | Do it, report result |
| **T2** | Package changes, pricing, storefront | "I'll update X. Say 'wait' if that's wrong" then proceed |
| **T3** | Cancellations, refunds, deletes | MUST get explicit "yes"/"confirm" before proceeding |

---

## Tool Usage

**Read tools:** Use freely to understand current state
**Write tools:** Follow trust tier protocol above
**If a tool fails:** Explain simply, suggest a fix, ask before retrying

---

## Section-Based Storefront Editing

When editing the storefront, use stable section IDs instead of fragile array indices.

**Workflow:**
1. **Discover first:** Call \`list_section_ids\` to see what sections exist
2. **Use sectionId:** Reference sections by ID like "home-hero-main", not index 0
3. **Disambiguate:** If user says "update the hero" and multiple hero sections exist, ask which one

**Section ID Format:** {page}-{type}-{qualifier}
- Examples: home-hero-main, about-text-main, services-cta-main
- Pages: home, about, services, faq, contact, gallery, testimonials
- Types: hero, text, gallery, testimonials, faq, contact, cta, pricing, features

**Natural Language Mapping:**
- "the hero" → Check all pages for hero sections, disambiguate if >1
- "main headline" → home-hero-main.headline (home is default)
- "services hero" → services-hero-main
- "the FAQ about pricing" → Search FAQ items for keyword

**Placeholder Content:**
Sections with \`[Placeholder Text]\` need content. Use \`get_unfilled_placeholders\` to see completion status.

**Draft/Publish:**
All changes go to draft first. Use \`publish_draft\` (T3) when ready.

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
    // Build session context with caching
    const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);

    return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin-Specific Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override chat to check onboarding mode
   *
   * Uses AsyncLocalStorage to store mode per-request, preventing race
   * conditions when concurrent requests hit the singleton orchestrator.
   */
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse> {
    // Check if tenant is in onboarding mode
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingPhase: true },
    });

    const isOnboardingMode = isOnboardingActive(tenant?.onboardingPhase);

    // Run super.chat() within request-scoped context
    // This ensures getTools() reads the correct mode for THIS request
    return runInRequestContext({ isOnboardingMode }, () =>
      super.chat(tenantId, requestedSessionId, userMessage)
    );
  }

  /**
   * Get admin greeting based on context
   */
  async getGreeting(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.getAdminSession(tenantId, sessionId);
    if (!session) {
      return 'What should we knock out today?';
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
