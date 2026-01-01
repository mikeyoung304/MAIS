/**
 * ToolRateLimiter Tests
 *
 * Tests per-tool rate limiting using token bucket pattern.
 * Based on DoorDash "Budgeting the Loop" pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRateLimiter,
  DEFAULT_TOOL_RATE_LIMITS,
} from '../../../src/agent/orchestrator/rate-limiter';

describe('ToolRateLimiter', () => {
  let limiter: ToolRateLimiter;

  beforeEach(() => {
    limiter = new ToolRateLimiter(DEFAULT_TOOL_RATE_LIMITS);
  });

  describe('canCall()', () => {
    it('should allow first call to any tool', () => {
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);
      expect(limiter.canCall('get_services').allowed).toBe(true);
      expect(limiter.canCall('book_service').allowed).toBe(true);
    });

    it('should allow calls to unknown tools with default limits', () => {
      const result = limiter.canCall('unknown_tool');
      expect(result.allowed).toBe(true);
    });

    it('should block tool after max per turn reached', () => {
      // update_onboarding_state has maxPerTurn: 1
      limiter.recordCall('update_onboarding_state');

      const result = limiter.canCall('update_onboarding_state');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max per turn');
      expect(result.reason).toContain('1');
    });

    it('should block tool after max per session reached', () => {
      // update_onboarding_state has maxPerSession: 10
      for (let i = 0; i < 10; i++) {
        expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);
        limiter.recordCall('update_onboarding_state');
        limiter.resetTurn(); // Reset turn to test session limit
      }

      const result = limiter.canCall('update_onboarding_state');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max per session');
      expect(result.reason).toContain('10');
    });

    it('should allow different tools when one is rate limited', () => {
      // Block update_onboarding_state
      limiter.recordCall('update_onboarding_state');
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(false);

      // Other tools should still work
      expect(limiter.canCall('get_services').allowed).toBe(true);
      expect(limiter.canCall('get_business_info').allowed).toBe(true);
    });

    it('should respect per-tool limits independently', () => {
      // get_services has maxPerTurn: 3
      limiter.recordCall('get_services');
      limiter.recordCall('get_services');
      expect(limiter.canCall('get_services').allowed).toBe(true);

      limiter.recordCall('get_services');
      expect(limiter.canCall('get_services').allowed).toBe(false);

      // update_onboarding_state has maxPerTurn: 1
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);
      limiter.recordCall('update_onboarding_state');
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(false);
    });
  });

  describe('recordCall()', () => {
    it('should increment turn and session counts', () => {
      limiter.recordCall('get_services');
      const stats = limiter.getStats();

      expect(stats.turn['get_services']).toBe(1);
      expect(stats.session['get_services']).toBe(1);
    });

    it('should increment counts for multiple calls', () => {
      limiter.recordCall('get_services');
      limiter.recordCall('get_services');
      limiter.recordCall('get_services');

      const stats = limiter.getStats();
      expect(stats.turn['get_services']).toBe(3);
      expect(stats.session['get_services']).toBe(3);
    });

    it('should track different tools separately', () => {
      limiter.recordCall('get_services');
      limiter.recordCall('get_services');
      limiter.recordCall('check_availability');

      const stats = limiter.getStats();
      expect(stats.turn['get_services']).toBe(2);
      expect(stats.turn['check_availability']).toBe(1);
    });
  });

  describe('resetTurn()', () => {
    it('should reset turn counts but keep session counts', () => {
      limiter.recordCall('update_onboarding_state');
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(false);

      limiter.resetTurn();

      // Should allow again after turn reset
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);

      // But session count is preserved
      const stats = limiter.getStats();
      expect(stats.turn['update_onboarding_state']).toBeUndefined();
      expect(stats.session['update_onboarding_state']).toBe(1);
    });

    it('should clear all turn counts', () => {
      limiter.recordCall('get_services');
      limiter.recordCall('check_availability');
      limiter.recordCall('update_onboarding_state');

      limiter.resetTurn();

      const stats = limiter.getStats();
      expect(Object.keys(stats.turn).length).toBe(0);
      expect(stats.session['get_services']).toBe(1);
      expect(stats.session['check_availability']).toBe(1);
      expect(stats.session['update_onboarding_state']).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should reset both turn and session counts', () => {
      limiter.recordCall('get_services');
      limiter.recordCall('check_availability');

      limiter.reset();

      const stats = limiter.getStats();
      expect(Object.keys(stats.turn).length).toBe(0);
      expect(Object.keys(stats.session).length).toBe(0);
    });

    it('should allow previously blocked tools after reset', () => {
      // Exhaust session limit
      for (let i = 0; i < 10; i++) {
        limiter.recordCall('update_onboarding_state');
        limiter.resetTurn();
      }
      expect(limiter.canCall('update_onboarding_state').allowed).toBe(false);

      limiter.reset();

      expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return empty stats for new limiter', () => {
      const stats = limiter.getStats();
      expect(Object.keys(stats.turn).length).toBe(0);
      expect(Object.keys(stats.session).length).toBe(0);
    });

    it('should return accurate stats after calls', () => {
      limiter.recordCall('get_services');
      limiter.recordCall('get_services');
      limiter.recordCall('check_availability');
      limiter.resetTurn();
      limiter.recordCall('get_services');

      const stats = limiter.getStats();
      expect(stats.turn['get_services']).toBe(1);
      expect(stats.session['get_services']).toBe(3);
      expect(stats.session['check_availability']).toBe(1);
    });
  });

  describe('custom limits', () => {
    it('should respect custom tool limits', () => {
      const customLimiter = new ToolRateLimiter({
        custom_tool: { maxPerTurn: 2, maxPerSession: 3 },
      });

      expect(customLimiter.canCall('custom_tool').allowed).toBe(true);
      customLimiter.recordCall('custom_tool');
      expect(customLimiter.canCall('custom_tool').allowed).toBe(true);
      customLimiter.recordCall('custom_tool');
      expect(customLimiter.canCall('custom_tool').allowed).toBe(false);
    });

    it('should use default limits for tools not in custom config', () => {
      const customLimiter = new ToolRateLimiter({
        custom_tool: { maxPerTurn: 1, maxPerSession: 1 },
      });

      // Unknown tools get default: maxPerTurn: 5, maxPerSession: 50
      for (let i = 0; i < 5; i++) {
        expect(customLimiter.canCall('unknown').allowed).toBe(true);
        customLimiter.recordCall('unknown');
      }
      expect(customLimiter.canCall('unknown').allowed).toBe(false);
    });
  });
});
