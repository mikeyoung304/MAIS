/**
 * Onboarding Orchestrator
 *
 * Specialized orchestrator for tenant onboarding.
 * Uses longer soft-confirm windows (10 min) for thoughtful decisions.
 *
 * Key characteristics:
 * - Uses onboarding-specific tools (discovery, market research, service creation)
 * - Phase-aware system prompt with HANDLED brand voice
 * - Session continuity via AdvisorMemory
 * - Higher tier budgets for service creation workflows
 */

import type { PrismaClient } from '../../generated/prisma';
import type { AgentTool } from '../tools/types';
import { getAllToolsWithOnboarding } from '../tools/all-tools';
import {
  buildOnboardingSystemPrompt,
  getOnboardingGreeting,
} from '../prompts/onboarding-system-prompt';
import { AdvisorMemoryService } from '../onboarding/advisor-memory.service';
import { PrismaAdvisorMemoryRepository } from '../../adapters/prisma/advisor-memory.repository';
import { logger } from '../../lib/core/logger';
import { parseOnboardingPhase, type OnboardingPhase } from '@macon/contracts';

import {
  BaseOrchestrator,
  type OrchestratorConfig,
  type PromptContext,
  type SessionState,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './base-orchestrator';
import { DEFAULT_TIER_BUDGETS } from './types';
import { DEFAULT_TOOL_RATE_LIMITS } from './rate-limiter';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker';

/**
 * Onboarding-specific configuration
 */
const ONBOARDING_CONFIG: OrchestratorConfig = {
  agentType: 'onboarding',
  model: DEFAULT_ORCHESTRATOR_CONFIG.model,
  maxTokens: DEFAULT_ORCHESTRATOR_CONFIG.maxTokens,
  maxHistoryMessages: 20, // Longer history for context
  temperature: DEFAULT_ORCHESTRATOR_CONFIG.temperature,
  tierBudgets: {
    T1: 10, // Generous for discovery/research
    T2: 5, // More T2 budget for service creation
    T3: 1, // Minimal T3 (no bookings in onboarding)
  },
  toolRateLimits: {
    ...DEFAULT_TOOL_RATE_LIMITS,
    // Onboarding-specific limits
    update_onboarding_state: { maxPerTurn: 2, maxPerSession: 20 },
    get_market_research: { maxPerTurn: 3, maxPerSession: 10 },
    upsert_services: { maxPerTurn: 2, maxPerSession: 10 },
  },
  circuitBreaker: {
    maxTurnsPerSession: 50, // Longer sessions for onboarding
    maxTokensPerSession: 200_000, // More tokens for detailed discussions
    maxTimePerSessionMs: 60 * 60 * 1000, // 1 hour
    maxConsecutiveErrors: 5,
  },
  maxRecursionDepth: 5,
  executorTimeoutMs: 5000,
};

/**
 * Extended session state with onboarding context
 */
export interface OnboardingSessionState extends SessionState {
  currentPhase: OnboardingPhase;
  isReturning: boolean;
  businessName: string;
}

/**
 * Onboarding Orchestrator
 */
export class OnboardingOrchestrator extends BaseOrchestrator {
  private advisorMemoryService: AdvisorMemoryService;

  constructor(prisma: PrismaClient) {
    super(prisma);

    const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(prisma);
    this.advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepo);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract Method Implementations
  // ─────────────────────────────────────────────────────────────────────────────

  getConfig(): OrchestratorConfig {
    return ONBOARDING_CONFIG;
  }

  protected getTools(): AgentTool[] {
    return getAllToolsWithOnboarding();
  }

  protected async buildSystemPrompt(context: PromptContext): Promise<string> {
    // Use pre-loaded tenant data from session (avoids N+1 query)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Onboarding-Specific Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get onboarding greeting for new or returning users
   */
  async getGreeting(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, onboardingPhase: true },
    });

    const currentPhase = parseOnboardingPhase(tenant?.onboardingPhase);
    const businessName = tenant?.name || 'Your Business';

    const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

    return getOnboardingGreeting({
      businessName,
      currentPhase,
      advisorMemory: onboardingCtx.memory ?? undefined,
      isResume: onboardingCtx.isReturning,
    });
  }

  /**
   * Get full session state with onboarding context
   */
  async getOnboardingSession(
    tenantId: string,
    sessionId: string
  ): Promise<OnboardingSessionState | null> {
    const baseSession = await this.getSession(tenantId, sessionId);
    if (!baseSession) {
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, onboardingPhase: true },
    });

    const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

    return {
      ...baseSession,
      currentPhase: parseOnboardingPhase(tenant?.onboardingPhase),
      isReturning: onboardingCtx.isReturning,
      businessName: tenant?.name || 'Your Business',
    };
  }

  /**
   * Check if tenant is in active onboarding
   */
  async isOnboardingActive(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingPhase: true },
    });

    if (!tenant) return false;

    const phase = parseOnboardingPhase(tenant.onboardingPhase);
    return phase !== 'COMPLETED' && phase !== 'SKIPPED';
  }
}
