/**
 * Customer Chat Orchestrator
 *
 * Specialized orchestrator for customer-facing chatbot.
 * Uses shorter soft-confirm windows (2 min) for quick booking interactions.
 *
 * Key characteristics:
 * - Limited tool set (booking-focused: get_services, check_availability, book_service)
 * - Prompt injection detection
 * - Public-facing context (no business metrics)
 * - Shorter session TTL (1 hour vs 24 hours for admin)
 */

import type { AgentTool } from '../tools/types';
import { CUSTOMER_TOOLS } from '../customer/customer-tools';
import { buildCustomerSystemPrompt } from '../customer/customer-prompt';
import {
  BaseOrchestrator,
  type OrchestratorConfig,
  type PromptContext,
  type ChatResponse,
  type SessionState,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './base-orchestrator';
import { TIER_LIMITS, isOverQuota, getRemainingMessages } from '../../config/tiers';
import { logger } from '../../lib/core/logger';

/**
 * Customer-specific configuration
 */
const CUSTOMER_CONFIG: OrchestratorConfig = {
  agentType: 'customer',
  model: DEFAULT_ORCHESTRATOR_CONFIG.model,
  maxTokens: 2048, // Shorter responses for customer chat
  maxHistoryMessages: 10, // Shorter history
  temperature: DEFAULT_ORCHESTRATOR_CONFIG.temperature,
  tierBudgets: {
    T1: 5, // Limited reads
    T2: 2, // Minimal writes
    T3: 1, // One booking at a time
  },
  toolRateLimits: {
    get_services: { maxPerTurn: 3, maxPerSession: 20 },
    check_availability: { maxPerTurn: 5, maxPerSession: 30 },
    get_business_info: { maxPerTurn: 2, maxPerSession: 10 },
    book_service: { maxPerTurn: 1, maxPerSession: 3 },
    confirm_proposal: { maxPerTurn: 1, maxPerSession: 5 }, // Match book_service limits
  },
  circuitBreaker: {
    maxTurnsPerSession: 20, // Shorter sessions
    maxTokensPerSession: 50_000, // Cost control
    maxTimePerSessionMs: 15 * 60 * 1000, // 15 minutes
    maxConsecutiveErrors: 3,
    maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes idle timeout
  },
  // T1(5) + T2(2) + T3(1) + buffer(5) = 13
  maxRecursionDepth: 13,
  executorTimeoutMs: 5000,
};

/**
 * Customer Chat Orchestrator
 */
export class CustomerChatOrchestrator extends BaseOrchestrator {
  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract Method Implementations
  // ─────────────────────────────────────────────────────────────────────────────

  getConfig(): OrchestratorConfig {
    return CUSTOMER_CONFIG;
  }

  protected getTools(): AgentTool[] {
    return CUSTOMER_TOOLS;
  }

  protected getSessionType(): 'ADMIN' | 'CUSTOMER' {
    return 'CUSTOMER';
  }

  protected getSessionTtlMs(): number {
    return 60 * 60 * 1000; // 1 hour for customer sessions
  }

  /**
   * Override to include packages and subscription tier for customer chat context
   */
  protected getTenantSelectFields(): Record<string, unknown> {
    return {
      id: true,
      name: true,
      email: true,
      onboardingPhase: true,
      // Subscription tier and usage for quota checking
      tier: true,
      aiMessagesUsed: true,
      aiMessagesResetAt: true,
      // Include active packages for service listing
      packages: {
        where: { active: true },
        select: { name: true, basePrice: true, description: true },
        orderBy: { name: 'asc' },
        take: 10,
      },
    };
  }

  protected async buildSystemPrompt(context: PromptContext): Promise<string> {
    // Use pre-loaded tenant data from session (avoids N+1 query)
    const tenant = context.tenant;

    if (!tenant) {
      return buildCustomerSystemPrompt('Business', 'Business information unavailable.');
    }

    // Packages are included via getTenantSelectFields() override
    const packages =
      (tenant.packages as Array<{ name: string; basePrice: number; description?: string }>) || [];
    const packageList = packages
      .map(
        (p) =>
          `- ${p.name}: $${(p.basePrice / 100).toFixed(2)}${p.description ? ` - ${p.description.slice(0, 100)}` : ''}`
      )
      .join('\n');

    const businessContext = `
## Business: ${tenant.name}

### Available Services
${packageList || 'No services listed yet.'}

### Contact
${tenant.email || 'Contact information not available.'}
`;

    return buildCustomerSystemPrompt(tenant.name, businessContext);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Customer-Specific Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override injection block message for customer context
   */
  protected getInjectionBlockMessage(): string {
    return "I'm here to help you with booking questions. How can I assist you today?";
  }

  /**
   * Get greeting for customer chat
   */
  async getGreeting(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      return 'Hi! I can help you book an appointment. What are you looking for?';
    }

    return `Hi! I can help you book an appointment with ${tenant.name}. What are you looking for?`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Quota-Limited Chat Override
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override chat to add AI quota checking.
   *
   * Flow:
   * 1. Check quota BEFORE processing (fail fast)
   * 2. Process message via parent class
   * 3. Increment counter AFTER success (atomic)
   *
   * Returns usage info in response for frontend to display upgrade prompts.
   *
   * PERF-2: Reuses tenant data loaded by loadTenantData() to avoid duplicate DB query.
   * The parent's loadTenantData() is called again in super.chat(), but since we've
   * already loaded the same fields (tier, aiMessagesUsed via getTenantSelectFields),
   * we avoid the initial separate query that was here before.
   */
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse & { usage?: { used: number; limit: number; remaining: number } }> {
    // 1. Get tenant with tier info (reuses getTenantSelectFields which includes tier/aiMessagesUsed)
    // PERF-2: Uses loadTenantData instead of separate prisma query
    const tenantData = await this.loadTenantData(tenantId);

    if (!tenantData) {
      throw new Error('Tenant not found');
    }

    const tier = tenantData.tier as keyof typeof TIER_LIMITS;
    const limit = TIER_LIMITS[tier].aiMessages;
    const used = tenantData.aiMessagesUsed as number;

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

    // 3. Process message via parent class
    const response = await super.chat(tenantId, requestedSessionId, userMessage);

    // 4. Increment counter AFTER success (atomic)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiMessagesUsed: { increment: 1 } },
    });

    // 5. Return response with updated usage
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Isolation Override (ARCH-2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override to ALWAYS create new sessions for customer chat.
   *
   * SECURITY FIX: The base implementation reuses recent sessions within TTL,
   * which could allow different customers to share sessions:
   * 1. Customer A visits → gets session X
   * 2. Customer B visits within TTL → would also get session X!
   *
   * For customer-facing chat, we MUST create isolated sessions per visitor.
   * The client is responsible for storing and sending back its session ID;
   * if it doesn't have one, it gets a brand new session.
   */
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    const newSession = await this.prisma.agentSession.create({
      data: {
        tenant: { connect: { id: tenantId } },
        sessionType: 'CUSTOMER',
        messages: [],
      },
    });

    logger.info(
      { tenantId, sessionId: newSession.id, agentType: 'customer' },
      'New isolated customer session created (ARCH-2 fix)'
    );

    return {
      sessionId: newSession.id,
      tenantId,
      messages: [],
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }
}
