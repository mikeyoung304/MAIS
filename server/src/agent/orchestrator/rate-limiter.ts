/**
 * Tool Rate Limiter
 *
 * Per-tool rate limiting using token bucket pattern.
 * Prevents any single tool from dominating a conversation turn.
 *
 * Based on DoorDash "Budgeting the Loop" pattern.
 */

import { logger } from '../../lib/core/logger';

export interface ToolRateLimit {
  readonly maxPerTurn: number;
  readonly maxPerSession: number;
}

export interface ToolRateLimits {
  readonly [toolName: string]: ToolRateLimit;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface RateLimitStats {
  readonly turn: Record<string, number>;
  readonly session: Record<string, number>;
}

// Default rate limits per tool
export const DEFAULT_TOOL_RATE_LIMITS: ToolRateLimits = {
  // T1 tools - metadata, can be called more often
  update_onboarding_state: { maxPerTurn: 1, maxPerSession: 10 },
  get_market_research: { maxPerTurn: 2, maxPerSession: 5 },
  get_services: { maxPerTurn: 3, maxPerSession: 20 },
  check_availability: { maxPerTurn: 5, maxPerSession: 50 },
  get_business_info: { maxPerTurn: 2, maxPerSession: 10 },

  // T2 tools - writes, limited
  upsert_services: { maxPerTurn: 1, maxPerSession: 5 },
  update_storefront: { maxPerTurn: 1, maxPerSession: 3 },
  upsert_package: { maxPerTurn: 2, maxPerSession: 10 },

  // T3 tools - critical, heavily limited
  book_service: { maxPerTurn: 1, maxPerSession: 3 },
  create_booking: { maxPerTurn: 1, maxPerSession: 5 },
} as const;

// Default limits for tools not in the config
const DEFAULT_TOOL_LIMIT: ToolRateLimit = {
  maxPerTurn: 5,
  maxPerSession: 50,
};

/**
 * Per-tool rate limiter using token bucket pattern.
 */
export class ToolRateLimiter {
  private turnCounts: Map<string, number> = new Map();
  private sessionCounts: Map<string, number> = new Map();

  constructor(private readonly limits: ToolRateLimits = DEFAULT_TOOL_RATE_LIMITS) {}

  /**
   * Check if a tool can be called
   */
  canCall(toolName: string): RateLimitResult {
    const limit = this.limits[toolName] || DEFAULT_TOOL_LIMIT;
    const turnCount = this.turnCounts.get(toolName) || 0;
    const sessionCount = this.sessionCounts.get(toolName) || 0;

    if (turnCount >= limit.maxPerTurn) {
      return {
        allowed: false,
        reason: `${toolName} max per turn (${limit.maxPerTurn}) reached`,
      };
    }

    if (sessionCount >= limit.maxPerSession) {
      return {
        allowed: false,
        reason: `${toolName} max per session (${limit.maxPerSession}) reached`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a tool call (call after successful execution)
   */
  recordCall(toolName: string): void {
    this.turnCounts.set(toolName, (this.turnCounts.get(toolName) || 0) + 1);
    this.sessionCounts.set(toolName, (this.sessionCounts.get(toolName) || 0) + 1);

    logger.debug(
      { toolName, turn: this.turnCounts.get(toolName), session: this.sessionCounts.get(toolName) },
      'Tool call recorded'
    );
  }

  /**
   * Reset turn counts (call at start of each chat turn)
   */
  resetTurn(): void {
    this.turnCounts.clear();
  }

  /**
   * Reset all counts (call when session resets)
   */
  reset(): void {
    this.turnCounts.clear();
    this.sessionCounts.clear();
  }

  /**
   * Get current stats for debugging
   */
  getStats(): RateLimitStats {
    return {
      turn: Object.fromEntries(this.turnCounts),
      session: Object.fromEntries(this.sessionCounts),
    };
  }
}
