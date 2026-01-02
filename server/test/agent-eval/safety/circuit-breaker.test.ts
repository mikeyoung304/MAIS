/**
 * Circuit Breaker Tests
 *
 * Verifies session-level circuit breaker behavior.
 * Based on Cox Automotive pattern with P95 cost controls.
 *
 * Philosophy:
 * - Prevent runaway agents from consuming excessive resources
 * - Multiple trip conditions: turns, tokens, time, consecutive errors
 * - Once tripped, stays tripped until session ends
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
} from '../../../src/agent/orchestrator/circuit-breaker';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('check()', () => {
    it('should allow operations initially', () => {
      const result = circuitBreaker.check();

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow operations below all limits', () => {
      // Record some turns below limits
      circuitBreaker.recordTurn(1000);
      circuitBreaker.recordTurn(2000);
      circuitBreaker.recordTurn(3000);

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(true);
    });
  });

  describe('Turn limit enforcement', () => {
    it('should trip when max turns exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 3,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 10,
      };
      circuitBreaker = new CircuitBreaker(config);

      // Make exactly 3 turns
      circuitBreaker.recordTurn(100);
      circuitBreaker.recordTurn(100);
      circuitBreaker.recordTurn(100);

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max turns');
    });

    it('should stay tripped after turn limit exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 2,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 10,
      };
      circuitBreaker = new CircuitBreaker(config);

      circuitBreaker.recordTurn(100);
      circuitBreaker.recordTurn(100);

      // First check trips it
      circuitBreaker.check();

      // Subsequent checks should remain blocked
      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
    });
  });

  describe('Token limit enforcement', () => {
    it('should trip when max tokens exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1000,
        maxTokensPerSession: 5000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 10,
      };
      circuitBreaker = new CircuitBreaker(config);

      // Record turns totaling more than 5000 tokens
      circuitBreaker.recordTurn(3000);
      circuitBreaker.recordTurn(3000);

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max tokens');
    });

    it('should track cumulative tokens correctly', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1000,
        maxTokensPerSession: 10000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 10,
      };
      circuitBreaker = new CircuitBreaker(config);

      circuitBreaker.recordTurn(2500);
      circuitBreaker.recordTurn(2500);
      circuitBreaker.recordTurn(2500);

      // 7500 tokens, still under limit
      expect(circuitBreaker.check().allowed).toBe(true);

      circuitBreaker.recordTurn(3000);

      // 10500 tokens, over limit
      expect(circuitBreaker.check().allowed).toBe(false);
    });
  });

  describe('Time limit enforcement', () => {
    it('should trip when session time exceeded', () => {
      vi.useFakeTimers();
      const startTime = Date.now();

      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1000,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 5000, // 5 seconds
        maxConsecutiveErrors: 10,
      };
      circuitBreaker = new CircuitBreaker(config);

      // Check immediately - should be allowed
      expect(circuitBreaker.check().allowed).toBe(true);

      // Advance time by 6 seconds
      vi.advanceTimersByTime(6000);

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max session time');

      vi.useRealTimers();
    });
  });

  describe('Consecutive error enforcement', () => {
    it('should trip after max consecutive errors', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1000,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 3,
      };
      circuitBreaker = new CircuitBreaker(config);

      circuitBreaker.recordError();
      circuitBreaker.recordError();
      expect(circuitBreaker.check().allowed).toBe(true);

      circuitBreaker.recordError();

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max consecutive errors');
    });

    it('should reset error count on success', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1000,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 3,
      };
      circuitBreaker = new CircuitBreaker(config);

      circuitBreaker.recordError();
      circuitBreaker.recordError();
      circuitBreaker.recordSuccess();

      // Error count should be reset
      circuitBreaker.recordError();
      circuitBreaker.recordError();

      // Still under limit after reset
      expect(circuitBreaker.check().allowed).toBe(true);
    });
  });

  describe('getState()', () => {
    it('should return initial state', () => {
      const state = circuitBreaker.getState();

      expect(state.turns).toBe(0);
      expect(state.tokens).toBe(0);
      expect(state.consecutiveErrors).toBe(0);
      expect(state.isTripped).toBe(false);
      expect(state.tripReason).toBeUndefined();
    });

    it('should track state changes', () => {
      circuitBreaker.recordTurn(1500);
      circuitBreaker.recordError();

      const state = circuitBreaker.getState();

      expect(state.turns).toBe(1);
      expect(state.tokens).toBe(1500);
      expect(state.consecutiveErrors).toBe(1);
    });

    it('should return frozen state object', () => {
      const state = circuitBreaker.getState();

      // Attempting to modify should either throw or have no effect
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        state.turns = 999;
      }).toThrow();
    });
  });

  describe('Default configuration', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTurnsPerSession).toBe(20);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTokensPerSession).toBe(100_000);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTimePerSessionMs).toBe(30 * 60 * 1000);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxConsecutiveErrors).toBe(3);
    });

    it('defaults should prevent runaway agents', () => {
      // 20 turns is reasonable for a conversation
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTurnsPerSession).toBeLessThanOrEqual(50);

      // 100k tokens ~= $3 per session (reasonable cost cap)
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTokensPerSession).toBeLessThanOrEqual(200_000);

      // 30 min session limit
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTimePerSessionMs).toBeLessThanOrEqual(
        60 * 60 * 1000
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle zero token turns', () => {
      circuitBreaker.recordTurn(0);
      circuitBreaker.recordTurn(0);

      const state = circuitBreaker.getState();
      expect(state.turns).toBe(2);
      expect(state.tokens).toBe(0);
    });

    it('should handle large token counts', () => {
      circuitBreaker.recordTurn(50000);
      circuitBreaker.recordTurn(50000);

      const state = circuitBreaker.getState();
      expect(state.tokens).toBe(100000);
    });

    it('should handle multiple trip conditions simultaneously', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 5,
        maxTokensPerSession: 10000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 3,
      };
      circuitBreaker = new CircuitBreaker(config);

      // Exceed both turns and tokens
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordTurn(3000);
      }

      const result = circuitBreaker.check();
      expect(result.allowed).toBe(false);
      // Should report one of the trip reasons
      expect(result.reason).toBeTruthy();
    });
  });

  describe('Integration behavior', () => {
    it('should simulate realistic session flow', () => {
      // Simulate a realistic session with varying token counts
      const tokenCounts = [1500, 2000, 1800, 2500, 1000, 1500, 2000];

      for (const tokens of tokenCounts) {
        const checkResult = circuitBreaker.check();
        if (!checkResult.allowed) break;

        circuitBreaker.recordTurn(tokens);
        circuitBreaker.recordSuccess();
      }

      const state = circuitBreaker.getState();

      // Should have processed all turns without tripping
      expect(state.turns).toBe(tokenCounts.length);
      expect(state.isTripped).toBe(false);
    });

    it('should handle error recovery pattern', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 1_000_000,
        maxTimePerSessionMs: 1_000_000,
        maxConsecutiveErrors: 3,
      };
      circuitBreaker = new CircuitBreaker(config);

      // Simulate: 2 errors, success, 2 errors, success, 3 errors (trip)
      circuitBreaker.recordError();
      circuitBreaker.recordError();
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.check().allowed).toBe(true);

      circuitBreaker.recordError();
      circuitBreaker.recordError();
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.check().allowed).toBe(true);

      circuitBreaker.recordError();
      circuitBreaker.recordError();
      circuitBreaker.recordError();
      expect(circuitBreaker.check().allowed).toBe(false);
    });
  });
});
