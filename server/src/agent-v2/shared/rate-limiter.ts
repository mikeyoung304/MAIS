/**
 * In-memory sliding window rate limiter for Cloud Run agents.
 *
 * Enforces the rate limits documented in the research agent system prompt:
 * - Scraping: 100 requests/hour
 * - Search: 200 requests/hour
 *
 * Resets on cold start (acceptable — Cloud Run instances are short-lived).
 *
 * @see server/src/agent-v2/deploy/research/src/agent.ts (system prompt rate limits)
 * @see todos/5194-deferred-p2-no-rate-limiting.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const limits = new Map<string, RateLimitEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// Constants — match the system prompt documentation
// ─────────────────────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  SCRAPING: { operation: 'scraping', maxPerHour: 100 },
  SEARCH: { operation: 'search', maxPerHour: 200 },
  RESEARCH_DELEGATION: { operation: 'research_delegation', maxPerHour: 50 },
} as const;

const HOUR_MS = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check and increment rate limit for an operation.
 *
 * @param operation - Unique operation key (e.g., 'scraping', 'search')
 * @param maxPerHour - Maximum allowed requests per hour
 * @throws Error if rate limit exceeded, with time until reset
 */
export function checkRateLimit(operation: string, maxPerHour: number): void {
  const now = Date.now();
  let entry = limits.get(operation);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + HOUR_MS };
  }

  if (entry.count >= maxPerHour) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    throw new Error(
      `Rate limit exceeded for ${operation} (${maxPerHour}/hr). Resets in ${minutesLeft} min.`
    );
  }

  entry.count++;
  limits.set(operation, entry);
}

/**
 * Get current usage for an operation (for diagnostics/logging).
 *
 * @returns Current count and reset time, or null if no usage tracked
 */
export function getRateLimitStatus(operation: string): {
  count: number;
  maxPerHour: number;
  resetAt: number;
  minutesLeft: number;
} | null {
  const entry = limits.get(operation);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.resetAt) return null;

  // Look up the max from known limits, default to 0 if unknown
  const knownLimit = Object.values(RATE_LIMITS).find((l) => l.operation === operation);

  return {
    count: entry.count,
    maxPerHour: knownLimit?.maxPerHour ?? 0,
    resetAt: entry.resetAt,
    minutesLeft: Math.ceil((entry.resetAt - now) / 60000),
  };
}

/**
 * Clear all rate limit state. For testing only.
 */
export function resetRateLimits(): void {
  limits.clear();
}
