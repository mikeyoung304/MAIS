/**
 * CircuitBreaker Tests
 *
 * Tests session-level circuit breaker for preventing runaway agents.
 * Based on Cox Automotive pattern with P95 cost controls.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
} from '../../../src/agent/orchestrator/circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('check()', () => {
    it('should allow operations on fresh circuit breaker', () => {
      const result = cb.check();
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should trip after max turns exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 3,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 5,
      };
      cb = new CircuitBreaker(config);

      cb.recordTurn(100);
      expect(cb.check().allowed).toBe(true);

      cb.recordTurn(100);
      expect(cb.check().allowed).toBe(true);

      cb.recordTurn(100);
      // Now at max turns (3)
      const result = cb.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max turns');
      expect(result.reason).toContain('3');
    });

    it('should trip after max tokens exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 1000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 5,
      };
      cb = new CircuitBreaker(config);

      cb.recordTurn(500);
      expect(cb.check().allowed).toBe(true);

      cb.recordTurn(500);
      // Now at max tokens (1000)
      const result = cb.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max tokens');
      expect(result.reason).toContain('1000');
    });

    it('should trip after max time exceeded', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 1000, // 1 second
        maxConsecutiveErrors: 5,
      };
      cb = new CircuitBreaker(config);

      expect(cb.check().allowed).toBe(true);

      // Advance time past limit
      vi.useFakeTimers();
      vi.advanceTimersByTime(1001);

      const result = cb.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max session time');

      vi.useRealTimers();
    });

    it('should remain tripped after being tripped', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 5,
      };
      cb = new CircuitBreaker(config);

      cb.recordTurn(100);
      cb.check(); // Trip the breaker

      // Multiple checks should all return false with same reason
      for (let i = 0; i < 5; i++) {
        const result = cb.check();
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Max turns');
      }
    });
  });

  describe('recordTurn()', () => {
    it('should track turn count correctly', () => {
      cb.recordTurn(100);
      cb.recordTurn(200);
      cb.recordTurn(50);

      const state = cb.getState();
      expect(state.turns).toBe(3);
    });

    it('should accumulate token count correctly', () => {
      cb.recordTurn(100);
      cb.recordTurn(200);
      cb.recordTurn(50);

      const state = cb.getState();
      expect(state.tokens).toBe(350);
    });
  });

  describe('recordError() and recordSuccess()', () => {
    it('should trip after consecutive errors', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 3,
      };
      cb = new CircuitBreaker(config);

      cb.recordError();
      expect(cb.check().allowed).toBe(true);

      cb.recordError();
      expect(cb.check().allowed).toBe(true);

      cb.recordError();
      // Now at max consecutive errors (3)
      const result = cb.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max consecutive errors');
      expect(result.reason).toContain('3');
    });

    it('should reset error count on success', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 3,
      };
      cb = new CircuitBreaker(config);

      cb.recordError();
      cb.recordError();
      // 2 consecutive errors

      cb.recordSuccess();
      // Error count reset

      cb.recordError();
      cb.recordError();
      // Back to 2 consecutive errors

      expect(cb.check().allowed).toBe(true);

      cb.recordError();
      // Now 3 consecutive errors
      expect(cb.check().allowed).toBe(false);
    });

    it('should not reset error count on turn recording', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 100,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 3,
      };
      cb = new CircuitBreaker(config);

      cb.recordError();
      cb.recordError();
      cb.recordTurn(100); // Recording turn should NOT reset errors
      cb.recordError();

      expect(cb.check().allowed).toBe(false);
    });
  });

  describe('getState()', () => {
    it('should return correct initial state', () => {
      const state = cb.getState();

      expect(state.turns).toBe(0);
      expect(state.tokens).toBe(0);
      expect(state.consecutiveErrors).toBe(0);
      expect(state.isTripped).toBe(false);
      expect(state.tripReason).toBeUndefined();
      expect(state.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should return correct state after operations', () => {
      cb.recordTurn(100);
      cb.recordTurn(200);
      cb.recordError();
      cb.recordSuccess();
      cb.recordError();

      const state = cb.getState();

      expect(state.turns).toBe(2);
      expect(state.tokens).toBe(300);
      expect(state.consecutiveErrors).toBe(1);
      expect(state.isTripped).toBe(false);
    });

    it('should return correct state after trip', () => {
      const config: CircuitBreakerConfig = {
        maxTurnsPerSession: 1,
        maxTokensPerSession: 100_000,
        maxTimePerSessionMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 5,
      };
      cb = new CircuitBreaker(config);

      cb.recordTurn(100);
      cb.check(); // Trip

      const state = cb.getState();
      expect(state.isTripped).toBe(true);
      expect(state.tripReason).toBeDefined();
    });

    it('should return frozen state object', () => {
      cb.recordTurn(100);
      const state = cb.getState();

      // Attempt to modify should throw or be ignored
      expect(() => {
        (state as { turns: number }).turns = 999;
      }).toThrow();
    });
  });

  describe('default configuration', () => {
    it('should use default config values', () => {
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTurnsPerSession).toBe(20);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTokensPerSession).toBe(100_000);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxTimePerSessionMs).toBe(30 * 60 * 1000);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxConsecutiveErrors).toBe(3);
    });
  });
});
