/**
 * Advisor Memory Service
 *
 * Computes context summaries from projected advisor memory for session resumption.
 * These summaries are injected into the system prompt for context continuity.
 *
 * Architecture:
 * - Wraps AdvisorMemoryRepository (data access)
 * - Computes deterministic string summaries (no LLM calls)
 * - Follows agent-native pattern: context injection for prompts
 *
 * @see agent-native-architecture skill - dynamic-context-injection.md
 */

import type { AdvisorMemoryRepository, AdvisorMemory as AdvisorMemoryType } from '../../lib/ports';
import type { OnboardingPhase } from '@macon/contracts';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

/**
 * Summarized advisor memory for prompt injection
 * These are the "remembered context" strings
 */
export interface AdvisorMemorySummary {
  /** Business identity summary */
  discovery: string;
  /** Market positioning summary */
  marketContext: string;
  /** Client preferences and style */
  preferences: string;
  /** Actions taken summary */
  decisions: string;
  /** Incomplete items or open questions */
  pendingQuestions: string;
}

/**
 * Complete onboarding context for session initialization
 */
export interface OnboardingContext {
  tenantId: string;
  currentPhase: OnboardingPhase;
  memory: AdvisorMemoryType | null;
  summaries: AdvisorMemorySummary;
  isReturning: boolean;
  lastActiveAt: Date | null;
}

/**
 * Advisor Memory Service
 *
 * Provides context summaries for onboarding agent sessions.
 * Used by orchestrator for system prompt injection.
 */
export class AdvisorMemoryService {
  constructor(private readonly repository: AdvisorMemoryRepository) {}

  /**
   * Get full onboarding context for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns Onboarding context with projected memory and summaries
   */
  async getOnboardingContext(tenantId: string): Promise<OnboardingContext> {
    try {
      const memory = await this.repository.getMemory(tenantId);

      if (!memory) {
        // No memory = new user
        return {
          tenantId,
          currentPhase: 'NOT_STARTED',
          memory: null,
          summaries: this.getEmptySummaries(),
          isReturning: false,
          lastActiveAt: null,
        };
      }

      // Project summaries from memory data
      const summaries = this.projectSummaries(memory);

      // Determine if returning user (has events older than current session)
      const isReturning = memory.lastEventVersion > 0;
      const lastActiveAt = memory.lastEventTimestamp ? new Date(memory.lastEventTimestamp) : null;

      return {
        tenantId,
        currentPhase: memory.currentPhase,
        memory,
        summaries,
        isReturning,
        lastActiveAt,
      };
    } catch (error) {
      // Differentiate between "no data" and "retrieval failed"
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log sanitized error (don't expose full error object in production)
      logger.error({ error: sanitizeError(error), tenantId }, 'Error getting onboarding context');

      // If it's a "not found" type error, return default (new user)
      // Otherwise, propagate the error - database failures should not be hidden
      if (
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('no record')
      ) {
        return {
          tenantId,
          currentPhase: 'NOT_STARTED',
          memory: null,
          summaries: this.getEmptySummaries(),
          isReturning: false,
          lastActiveAt: null,
        };
      }

      // Re-throw actual errors (database connection, permission, etc.)
      throw new Error(
        `Failed to retrieve onboarding context for tenant ${tenantId}: ${errorMessage}`
      );
    }
  }

  /**
   * Generate resume message for returning user
   *
   * @param tenantId - Tenant ID
   * @returns Human-friendly resume message or null if new user
   */
  async getResumeSummary(tenantId: string): Promise<string | null> {
    const context = await this.getOnboardingContext(tenantId);

    if (!context.isReturning || !context.memory) {
      return null;
    }

    return this.buildResumeSummary(context);
  }

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete(tenantId: string): Promise<boolean> {
    const context = await this.getOnboardingContext(tenantId);
    return context.currentPhase === 'COMPLETED' || context.currentPhase === 'SKIPPED';
  }

  /**
   * Check if onboarding is in progress
   */
  async isOnboardingInProgress(tenantId: string): Promise<boolean> {
    const context = await this.getOnboardingContext(tenantId);
    const inProgressPhases: OnboardingPhase[] = [
      'DISCOVERY',
      'MARKET_RESEARCH',
      'SERVICES',
      'MARKETING',
    ];
    return inProgressPhases.includes(context.currentPhase);
  }

  /**
   * Clear memory (for testing or reset)
   */
  async clearMemory(tenantId: string): Promise<void> {
    await this.repository.clearMemory(tenantId);
    logger.info({ tenantId }, 'Cleared advisor memory');
  }

  // ============================================================================
  // Private: Summary Projection
  // ============================================================================

  /**
   * Project string summaries from memory data
   */
  private projectSummaries(memory: AdvisorMemoryType): AdvisorMemorySummary {
    return {
      discovery: this.summarizeDiscovery(memory),
      marketContext: this.summarizeMarket(memory),
      preferences: this.summarizePreferences(memory),
      decisions: this.summarizeDecisions(memory),
      pendingQuestions: this.identifyPending(memory),
    };
  }

  /**
   * Summarize discovery data
   * "Wedding photographer in Austin, TX. 5 years experience. Specializes in elopements."
   */
  private summarizeDiscovery(memory: AdvisorMemoryType): string {
    if (!memory.discoveryData) {
      return '';
    }

    const d = memory.discoveryData;
    const parts: string[] = [];

    // Business type and location
    if (d.businessType && d.location) {
      parts.push(`${d.businessType} in ${d.location.city}, ${d.location.state}`);
    } else if (d.businessType) {
      parts.push(d.businessType);
    }

    // Experience
    if (d.yearsInBusiness !== undefined) {
      if (d.yearsInBusiness === 0) {
        parts.push('Just starting out');
      } else if (d.yearsInBusiness === 1) {
        parts.push('1 year experience');
      } else {
        parts.push(`${d.yearsInBusiness} years experience`);
      }
    }

    // Target market
    if (d.targetMarket) {
      const marketLabels: Record<string, string> = {
        luxury: 'Luxury market',
        premium: 'Premium positioning',
        mid_range: 'Mid-market',
        budget_friendly: 'Budget-friendly',
        mixed: 'Mixed market segments',
      };
      parts.push(marketLabels[d.targetMarket] || d.targetMarket);
    }

    // Services offered
    if (d.servicesOffered && d.servicesOffered.length > 0) {
      const services = d.servicesOffered.slice(0, 3).join(', ');
      parts.push(`Offers: ${services}${d.servicesOffered.length > 3 ? '...' : ''}`);
    }

    return parts.join('. ') + (parts.length > 0 ? '.' : '');
  }

  /**
   * Summarize market research data
   * "Market pricing: $3,500-$8,000. Found 5 competitors. Opportunity: limited elopement specialists."
   */
  private summarizeMarket(memory: AdvisorMemoryType): string {
    if (!memory.marketResearchData) {
      return '';
    }

    const m = memory.marketResearchData;
    const parts: string[] = [];

    // Pricing range
    if (m.pricingBenchmarks) {
      const low = (m.pricingBenchmarks.marketLowCents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
      const high = (m.pricingBenchmarks.marketHighCents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
      parts.push(`Market pricing: ${low}-${high}`);

      if (m.pricingBenchmarks.source === 'industry_benchmark') {
        parts.push('(industry averages)');
      }

      // Competitors - from pricingBenchmarks
      const competitorCount = m.pricingBenchmarks.competitorCount;
      if (competitorCount !== undefined && competitorCount > 0) {
        parts.push(`${competitorCount} competitor${competitorCount !== 1 ? 's' : ''} found`);
      }
    }

    // Top insight
    if (m.marketInsights && m.marketInsights.length > 0) {
      parts.push(`Insight: ${m.marketInsights[0]}`);
    }

    return parts.join('. ') + (parts.length > 0 ? '.' : '');
  }

  /**
   * Summarize preferences from marketing data
   * "Brand voice: professional. Prefers elegant naming."
   */
  private summarizePreferences(memory: AdvisorMemoryType): string {
    if (!memory.marketingData) {
      return '';
    }

    const m = memory.marketingData;
    const parts: string[] = [];

    if (m.brandVoice) {
      const voiceLabels: Record<string, string> = {
        professional: 'Professional tone',
        friendly: 'Friendly tone',
        luxurious: 'Luxurious tone',
        approachable: 'Approachable tone',
        bold: 'Bold tone',
      };
      parts.push(voiceLabels[m.brandVoice] || `${m.brandVoice} tone`);
    }

    if (m.primaryColor) {
      parts.push(`Brand color: ${m.primaryColor}`);
    }

    return parts.join('. ') + (parts.length > 0 ? '.' : '');
  }

  /**
   * Summarize decisions made
   * "Created 3 packages in 'Family Sessions' segment. Set up storefront headline."
   */
  private summarizeDecisions(memory: AdvisorMemoryType): string {
    const parts: string[] = [];

    // Services created
    if (memory.servicesData) {
      const s = memory.servicesData;
      const pkgCount = s.createdPackageIds?.length || 0;
      const segCount = s.segments?.length || 0;

      if (pkgCount > 0) {
        if (segCount > 0 && s.segments?.[0]?.segmentName) {
          parts.push(
            `Created ${pkgCount} package${pkgCount !== 1 ? 's' : ''} in "${s.segments[0].segmentName}" segment`
          );
        } else {
          parts.push(`Created ${pkgCount} package${pkgCount !== 1 ? 's' : ''}`);
        }
      }
    }

    // Storefront updated
    if (memory.marketingData?.headline) {
      parts.push(`Set storefront headline: "${memory.marketingData.headline}"`);
    }

    return parts.join('. ') + (parts.length > 0 ? '.' : '');
  }

  /**
   * Identify pending items based on current phase
   */
  private identifyPending(memory: AdvisorMemoryType): string {
    switch (memory.currentPhase) {
      case 'NOT_STARTED':
        return 'Needs to share business info to get started.';

      case 'DISCOVERY':
        // Check what's missing
        if (!memory.discoveryData) {
          return 'Still learning about the business.';
        }
        if (!memory.discoveryData.location) {
          return 'Need to know their location for market research.';
        }
        if (!memory.discoveryData.targetMarket) {
          return 'Need to understand their market positioning.';
        }
        return 'Ready for market research.';

      case 'MARKET_RESEARCH':
        if (!memory.marketResearchData) {
          return 'About to research their local market.';
        }
        return 'Ready to design services.';

      case 'SERVICES':
        if (!memory.servicesData || (memory.servicesData.createdPackageIds?.length || 0) === 0) {
          return 'Ready to create service packages.';
        }
        return 'Packages created. Ready for storefront setup.';

      case 'MARKETING':
        if (!memory.marketingData?.headline) {
          return 'Need to write storefront copy.';
        }
        return 'Almost done! Finishing up storefront.';

      case 'COMPLETED':
        return 'Onboarding complete!';

      case 'SKIPPED':
        return 'Onboarding skipped.';

      default:
        return '';
    }
  }

  /**
   * Build human-friendly resume summary
   */
  private buildResumeSummary(context: OnboardingContext): string {
    const { summaries, currentPhase, lastActiveAt } = context;
    const parts: string[] = [];

    // Time context if more than a day ago
    if (lastActiveAt) {
      const daysSince = Math.floor((Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 1) {
        parts.push(
          daysSince === 1
            ? 'Last time we talked yesterday'
            : `Last time we talked ${daysSince} days ago`
        );
      }
    }

    // What we remember
    if (summaries.discovery) {
      parts.push(`I remember: ${summaries.discovery}`);
    }

    // What we've done
    if (summaries.decisions) {
      parts.push(`So far we've: ${summaries.decisions.toLowerCase()}`);
    }

    // What's next
    if (summaries.pendingQuestions) {
      parts.push(`Next up: ${summaries.pendingQuestions}`);
    }

    if (parts.length === 0) {
      return 'Welcome back! Ready to continue?';
    }

    return `Welcome back! ${parts.join(' ')} Ready to continue?`;
  }

  /**
   * Get empty summaries for new users
   */
  private getEmptySummaries(): AdvisorMemorySummary {
    return {
      discovery: '',
      marketContext: '',
      preferences: '',
      decisions: '',
      pendingQuestions: "Let's get started!",
    };
  }
}
