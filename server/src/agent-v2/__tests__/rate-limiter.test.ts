/**
 * Rate Limiter Tests
 *
 * Tests for the in-memory sliding window rate limiter used by Cloud Run agents.
 * Validates:
 * 1. Requests within limit succeed
 * 2. Exceeding limit throws with correct message
 * 3. Counter resets after window expires
 * 4. Different operation keys are tracked independently
 * 5. resetRateLimits() clears all state
 * 6. RATE_LIMITS constants match system prompt documentation
 *
 * @see server/src/agent-v2/shared/rate-limiter.ts
 * @see todos/5194-deferred-p2-no-rate-limiting.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimits,
  getRateLimitStatus,
  RATE_LIMITS,
} from '../shared/rate-limiter';

describe('checkRateLimit()', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requests within limit', () => {
    it('allows first request', () => {
      expect(() => checkRateLimit('test-op', 10)).not.toThrow();
    });

    it('allows requests up to the limit', () => {
      for (let i = 0; i < 10; i++) {
        expect(() => checkRateLimit('test-op', 10)).not.toThrow();
      }
    });

    it('allows exactly maxPerHour requests', () => {
      const max = 5;
      for (let i = 0; i < max; i++) {
        expect(() => checkRateLimit('exact-limit', max)).not.toThrow();
      }
      // The next one should fail
      expect(() => checkRateLimit('exact-limit', max)).toThrow(/Rate limit exceeded/);
    });
  });

  describe('exceeding limit', () => {
    it('throws when limit is exceeded', () => {
      const max = 3;
      for (let i = 0; i < max; i++) {
        checkRateLimit('over-limit', max);
      }
      expect(() => checkRateLimit('over-limit', max)).toThrow();
    });

    it('includes operation name in error message', () => {
      const max = 1;
      checkRateLimit('my-operation', max);
      expect(() => checkRateLimit('my-operation', max)).toThrow(/my-operation/);
    });

    it('includes limit value in error message', () => {
      const max = 1;
      checkRateLimit('op', max);
      expect(() => checkRateLimit('op', max)).toThrow(/1\/hr/);
    });

    it('includes reset time in error message', () => {
      const max = 1;
      checkRateLimit('op2', max);
      expect(() => checkRateLimit('op2', max)).toThrow(/Resets in \d+ min/);
    });

    it('continues to throw on subsequent attempts', () => {
      const max = 2;
      checkRateLimit('persist', max);
      checkRateLimit('persist', max);

      // Multiple attempts after limit should all fail
      expect(() => checkRateLimit('persist', max)).toThrow(/Rate limit exceeded/);
      expect(() => checkRateLimit('persist', max)).toThrow(/Rate limit exceeded/);
      expect(() => checkRateLimit('persist', max)).toThrow(/Rate limit exceeded/);
    });
  });

  describe('window expiry', () => {
    it('resets counter after the hour window expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const max = 2;
      checkRateLimit('expiry-test', max);
      checkRateLimit('expiry-test', max);
      expect(() => checkRateLimit('expiry-test', max)).toThrow(/Rate limit exceeded/);

      // Advance time by 61 minutes (past the hour window)
      vi.setSystemTime(now + 61 * 60 * 1000);

      // Should succeed again after window resets
      expect(() => checkRateLimit('expiry-test', max)).not.toThrow();
    });

    it('resets counter exactly at the boundary', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const max = 1;
      checkRateLimit('boundary', max);
      expect(() => checkRateLimit('boundary', max)).toThrow(/Rate limit exceeded/);

      // Advance to just before the reset (59 min 59 sec)
      vi.setSystemTime(now + 59 * 60 * 1000 + 59 * 1000);
      expect(() => checkRateLimit('boundary', max)).toThrow(/Rate limit exceeded/);

      // Advance past the 1 hour window
      vi.setSystemTime(now + 60 * 60 * 1000 + 1);
      expect(() => checkRateLimit('boundary', max)).not.toThrow();
    });
  });

  describe('independent operation tracking', () => {
    it('tracks different operations independently', () => {
      const max = 2;

      // Fill up operation A
      checkRateLimit('op-a', max);
      checkRateLimit('op-a', max);
      expect(() => checkRateLimit('op-a', max)).toThrow(/Rate limit exceeded/);

      // Operation B should still work
      expect(() => checkRateLimit('op-b', max)).not.toThrow();
      expect(() => checkRateLimit('op-b', max)).not.toThrow();
    });

    it('does not cross-contaminate between scraping and search', () => {
      // Fill up scraping
      for (let i = 0; i < RATE_LIMITS.SCRAPING.maxPerHour; i++) {
        checkRateLimit(RATE_LIMITS.SCRAPING.operation, RATE_LIMITS.SCRAPING.maxPerHour);
      }
      expect(() =>
        checkRateLimit(RATE_LIMITS.SCRAPING.operation, RATE_LIMITS.SCRAPING.maxPerHour)
      ).toThrow(/Rate limit exceeded/);

      // Search should still work
      expect(() =>
        checkRateLimit(RATE_LIMITS.SEARCH.operation, RATE_LIMITS.SEARCH.maxPerHour)
      ).not.toThrow();
    });
  });

  describe('different limits per operation', () => {
    it('allows different maxPerHour values', () => {
      // Operation with limit of 1
      checkRateLimit('tight', 1);
      expect(() => checkRateLimit('tight', 1)).toThrow();

      // Operation with limit of 100
      for (let i = 0; i < 100; i++) {
        expect(() => checkRateLimit('loose', 100)).not.toThrow();
      }
      expect(() => checkRateLimit('loose', 100)).toThrow();
    });
  });
});

describe('resetRateLimits()', () => {
  it('clears all rate limit state', () => {
    const max = 1;
    checkRateLimit('reset-a', max);
    checkRateLimit('reset-b', max);
    expect(() => checkRateLimit('reset-a', max)).toThrow();
    expect(() => checkRateLimit('reset-b', max)).toThrow();

    resetRateLimits();

    // Both should work again
    expect(() => checkRateLimit('reset-a', max)).not.toThrow();
    expect(() => checkRateLimit('reset-b', max)).not.toThrow();
  });

  it('is safe to call when no limits are tracked', () => {
    expect(() => resetRateLimits()).not.toThrow();
  });
});

describe('getRateLimitStatus()', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('returns null for unknown operations', () => {
    expect(getRateLimitStatus('nonexistent')).toBeNull();
  });

  it('returns current count for tracked operations', () => {
    checkRateLimit(RATE_LIMITS.SCRAPING.operation, RATE_LIMITS.SCRAPING.maxPerHour);
    checkRateLimit(RATE_LIMITS.SCRAPING.operation, RATE_LIMITS.SCRAPING.maxPerHour);

    const status = getRateLimitStatus(RATE_LIMITS.SCRAPING.operation);
    expect(status).not.toBeNull();
    expect(status!.count).toBe(2);
    expect(status!.maxPerHour).toBe(RATE_LIMITS.SCRAPING.maxPerHour);
    expect(status!.minutesLeft).toBeGreaterThan(0);
    expect(status!.minutesLeft).toBeLessThanOrEqual(60);
  });

  it('returns null after window expires', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    checkRateLimit('status-expiry', 10);
    expect(getRateLimitStatus('status-expiry')).not.toBeNull();

    // Advance past the window
    vi.setSystemTime(now + 61 * 60 * 1000);
    expect(getRateLimitStatus('status-expiry')).toBeNull();

    vi.useRealTimers();
  });
});

describe('RATE_LIMITS constants', () => {
  it('has scraping limit matching system prompt (100/hr)', () => {
    expect(RATE_LIMITS.SCRAPING.operation).toBe('scraping');
    expect(RATE_LIMITS.SCRAPING.maxPerHour).toBe(100);
  });

  it('has search limit matching system prompt (200/hr)', () => {
    expect(RATE_LIMITS.SEARCH.operation).toBe('search');
    expect(RATE_LIMITS.SEARCH.maxPerHour).toBe(200);
  });

  it('has research delegation limit (50/hr)', () => {
    expect(RATE_LIMITS.RESEARCH_DELEGATION.operation).toBe('research_delegation');
    expect(RATE_LIMITS.RESEARCH_DELEGATION.maxPerHour).toBe(50);
  });
});
