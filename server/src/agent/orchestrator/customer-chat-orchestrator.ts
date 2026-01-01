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

import type { PrismaClient } from '../../generated/prisma';
import type { AgentTool } from '../tools/types';
import { CUSTOMER_TOOLS } from '../customer/customer-tools';
import { buildCustomerSystemPrompt } from '../customer/customer-prompt';
import {
  BaseOrchestrator,
  type OrchestratorConfig,
  type PromptContext,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './base-orchestrator';

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
  },
  maxRecursionDepth: 3,
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
   * Override to include packages for customer chat context
   */
  protected getTenantSelectFields(): Record<string, unknown> {
    return {
      id: true,
      name: true,
      email: true,
      onboardingPhase: true,
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
}
