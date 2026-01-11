# Retry Utility and Context Cache Patterns

**Problem:** External API calls (Claude, Stripe, etc.) and database queries need graceful error handling with retries, while session context needs caching to reduce database load.

**Solution:** Implement a retry utility with exponential backoff and error classification, plus an in-memory context cache with TTL-based expiration.

**Date:** 2025-12-31
**Status:** Active
**Tags:** retry, cache, exponential-backoff, API-resilience, testing

---

## Pattern 1: Retry Utility with Exponential Backoff

### Core Implementation

Location: `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts`

```typescript
/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        logger.warn(
          { error, operationName, attempt },
          'Non-retryable error encountered, not retrying'
        );
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= fullConfig.maxRetries) {
        logger.error(
          { error, operationName, attempt, maxRetries: fullConfig.maxRetries },
          'All retry attempts exhausted'
        );
        throw error;
      }

      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempt, fullConfig);
      logger.warn(
        { error, operationName, attempt, nextAttempt: attempt + 1, delayMs: delay },
        'Retryable error encountered, scheduling retry'
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Error Classification

The key insight is classifying which errors are worth retrying:

```typescript
/**
 * Error types that should trigger a retry
 */
const RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i, // Rate limiting (429)
  /too.?many.?requests/i, // Rate limiting variant
  /overloaded/i, // Server overloaded (Claude 529)
  /503/, // Service unavailable
  /502/, // Bad gateway
  /timeout/i, // Request timeout
  /ECONNRESET/, // Connection reset
  /ECONNREFUSED/, // Connection refused
  /ETIMEDOUT/, // Connection timed out
  /network/i, // Network errors
  /temporarily.?unavailable/i, // Transient unavailability
];

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Check for API error with status code
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check status code (top-level)
    if (typeof errorObj.status === 'number') {
      if (RETRYABLE_STATUS_CODES.includes(errorObj.status)) {
        return true;
      }
    }

    // Check nested error.status (Anthropic SDK pattern)
    if (typeof errorObj.error === 'object' && errorObj.error !== null) {
      const nestedError = errorObj.error as Record<string, unknown>;
      if (
        typeof nestedError.status === 'number' &&
        RETRYABLE_STATUS_CODES.includes(nestedError.status)
      ) {
        return true;
      }
    }
  }

  // Check error message patterns
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
```

### Exponential Backoff with Jitter

Prevents thundering herd when services recover:

```typescript
/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );

  if (!config.jitter) {
    return baseDelay;
  }

  // Add random jitter (+/-25% of base delay)
  const jitterRange = baseDelay * 0.25;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  return Math.max(0, baseDelay + jitter);
}
```

### Claude API Preset Configuration

```typescript
/**
 * Configuration for Claude API retries
 * More conservative than default for rate limiting
 */
export const CLAUDE_API_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 2000, // Start with 2s for rate limits
  maxDelayMs: 30000, // Up to 30s for severe rate limiting
  backoffMultiplier: 2,
  jitter: true,
};
```

---

## Pattern 2: Context Cache with TTL

### Core Implementation

Location: `/Users/mikeyoung/CODING/MAIS/server/src/agent/context/context-cache.ts`

```typescript
/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  context: AgentSessionContext;
  cachedAt: number;
}

/**
 * Cache configuration
 */
export interface ContextCacheConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs: number;
  /** Maximum entries to keep (default: 1000) */
  maxEntries: number;
}

const DEFAULT_CONFIG: ContextCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
};

class ContextCache {
  private cache = new Map<string, CacheEntry>();
  private config: ContextCacheConfig;

  constructor(config: Partial<ContextCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached context if valid
   */
  get(tenantId: string): AgentSessionContext | null {
    const key = this.getCacheKey(tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.cachedAt;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      logger.debug({ tenantId, ageMs: age }, 'Context cache entry expired');
      return null;
    }

    logger.debug({ tenantId, ageMs: age }, 'Context cache hit');
    return entry.context;
  }

  /**
   * Set cached context
   */
  set(tenantId: string, context: AgentSessionContext): void {
    const key = this.getCacheKey(tenantId);

    // Evict old entries if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      context,
      cachedAt: Date.now(),
    });

    logger.debug({ tenantId }, 'Context cached');
  }

  /**
   * Invalidate cached context for a tenant
   * Call this when tenant data changes (e.g., after tool execution)
   */
  invalidate(tenantId: string): void {
    const key = this.getCacheKey(tenantId);
    if (this.cache.delete(key)) {
      logger.debug({ tenantId }, 'Context cache invalidated');
    }
  }

  private getCacheKey(tenantId: string): string {
    return `ctx:${tenantId}`;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instance
export const contextCache = new ContextCache();
```

### Session ID Handling

Cache is per-tenant, but sessions vary - update sessionId on retrieval:

```typescript
/**
 * Update the session ID in a cached context
 */
export function withSessionId(
  context: AgentSessionContext,
  sessionId: string
): AgentSessionContext {
  return {
    ...context,
    sessionId,
  };
}
```

### Orchestrator Integration

Location: `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts`

```typescript
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
```

---

## Pattern 3: Testing with Fake Timers

### Test Setup Pattern

Location: `/Users/mikeyoung/CODING/MAIS/server/test/agent/utils/retry.test.ts`

```typescript
describe('withRetry()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns result on retry success', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success');

    const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });

    // Advance time without waiting
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
```

### Critical Bug Fix: Retryable Pattern in Error Messages

**Problem:** Test used "timeout" in the final error message, which matches a retryable pattern. This caused the test to retry unexpectedly.

**Wrong:**

```typescript
it('throws the last error encountered', async () => {
  const error1 = new Error('First timeout'); // Retryable!
  const error2 = new Error('Second timeout'); // Retryable!
  const error3 = new Error('Final timeout'); // Retryable! Will keep retrying

  const mockFn = vi
    .fn()
    .mockRejectedValueOnce(error1)
    .mockRejectedValueOnce(error2)
    .mockRejectedValueOnce(error3);

  // This test is flaky because "timeout" is retryable
});
```

**Correct:**

```typescript
it('throws the last error encountered', async () => {
  // Use "overloaded" - it's retryable but the test exhausts retries
  const error1 = new Error('First overloaded');
  const error2 = new Error('Second overloaded');
  const error3 = new Error('Final overloaded');

  const mockFn = vi
    .fn()
    .mockRejectedValueOnce(error1)
    .mockRejectedValueOnce(error2)
    .mockRejectedValueOnce(error3);

  const promise = withRetry(mockFn, 'test-operation', { maxRetries: 2, jitter: false });
  await vi.advanceTimersByTimeAsync(3000);
  await expect(promise).rejects.toThrow('Final overloaded');
});
```

**Key Insight:** When testing retry exhaustion, use an error message that IS retryable (so retries happen), but ensure `maxRetries` is configured so all retries are exhausted.

---

## Pattern 4: Test Retry Helpers

Location: `/Users/mikeyoung/CODING/MAIS/server/test/helpers/retry.ts`

For integration tests (not mocking the retry utility itself):

```typescript
/**
 * Retry wrapper for database operations
 * Handles Prisma-specific transient errors
 */
export async function withDatabaseRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 5,
    delayMs: 50,
    onRetry: (attempt, error) => {
      const isPrismaConflict =
        error?.code === 'P2034' || // Transaction conflict
        error?.message?.includes('deadlock') ||
        error?.message?.includes('write conflict');

      if (isPrismaConflict) {
        console.log(`[Retry] Database conflict on attempt ${attempt}, retrying...`);
      }
    },
  });
}

/**
 * Retry wrapper for timing-sensitive assertions
 */
export async function withTimingRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 2,
    delayMs: 500,
    backoffMultiplier: 1, // No exponential backoff
    onRetry: (attempt) => {
      console.log(`[Retry] Timing assertion failed on attempt ${attempt}, retrying...`);
    },
  });
}
```

---

## Decision Guide

| Scenario              | Pattern             | Configuration                            |
| --------------------- | ------------------- | ---------------------------------------- |
| Claude API calls      | `withRetry`         | `CLAUDE_API_RETRY_CONFIG`                |
| Stripe API calls      | `withRetry`         | Default config                           |
| Email sending         | `withRetry`         | `{ maxRetries: 2, initialDelayMs: 500 }` |
| Session context       | `contextCache`      | Default (5min TTL, 1000 entries)         |
| Test assertions       | `withTimingRetry`   | `{ maxAttempts: 2, delayMs: 500 }`       |
| Database ops in tests | `withDatabaseRetry` | `{ maxAttempts: 5, delayMs: 50 }`        |

---

## Anti-Patterns to Avoid

1. **Retrying non-retryable errors:** 401, 403, 404, validation errors - these won't fix themselves
2. **No jitter:** All clients retry at same time after recovery = thundering herd
3. **Infinite retries:** Always have a maxRetries limit
4. **Caching without invalidation:** Call `invalidate()` after write operations
5. **Testing retries without fake timers:** Real delays make tests slow and flaky
6. **Using retryable patterns in test error messages:** Can cause unexpected retries

---

## Related Files

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts` - Retry utility
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/context/context-cache.ts` - Context cache
- `/Users/mikeyoung/CODING/MAIS/server/test/agent/utils/retry.test.ts` - Retry tests
- `/Users/mikeyoung/CODING/MAIS/server/test/helpers/retry.ts` - Test retry helpers
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts` - Integration point
