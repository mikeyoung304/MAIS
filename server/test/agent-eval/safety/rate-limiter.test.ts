/**
 * Rate Limiter Tests
 *
 * Verifies per-tool rate limiting behavior.
 * Based on DoorDash "Budgeting the Loop" pattern.
 *
 * Philosophy:
 * - Each tool has independent limits (per-turn and per-session)
 * - T1 tools get more calls than T2/T3
 * - Prevent any single tool from dominating a conversation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRateLimiter,
  DEFAULT_TOOL_RATE_LIMITS,
  type ToolRateLimits,
} from '../../../src/agent/orchestrator/rate-limiter';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('ToolRateLimiter', () => {
  let rateLimiter: ToolRateLimiter;

  beforeEach(() => {
    rateLimiter = new ToolRateLimiter();
  });

  describe('canCall()', () => {
    it('should allow first call for any tool', () => {
      const result = rateLimiter.canCall('get_services');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow calls up to per-turn limit', () => {
      const toolName = 'check_availability';
      const limit = DEFAULT_TOOL_RATE_LIMITS[toolName];

      // Make calls up to the limit
      for (let i = 0; i < limit.maxPerTurn; i++) {
        expect(rateLimiter.canCall(toolName).allowed).toBe(true);
        rateLimiter.recordCall(toolName);
      }

      // Next call should be blocked
      const result = rateLimiter.canCall(toolName);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max per turn');
    });

    it('should allow calls up to per-session limit', () => {
      const toolName = 'upsert_services';
      const limit = DEFAULT_TOOL_RATE_LIMITS[toolName];

      // Exhaust session limit across multiple turns
      for (let i = 0; i < limit.maxPerSession; i++) {
        expect(rateLimiter.canCall(toolName).allowed).toBe(true);
        rateLimiter.recordCall(toolName);
        // Reset turn counts to simulate new turns
        if (i < limit.maxPerSession - 1) {
          rateLimiter.resetTurn();
        }
      }

      // Even after turn reset, session limit should block
      rateLimiter.resetTurn();
      const result = rateLimiter.canCall(toolName);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max per session');
    });

    it('should use default limits for unknown tools', () => {
      const unknownTool = 'some_unknown_tool';

      // Default limit is 5 per turn, 50 per session
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.canCall(unknownTool).allowed).toBe(true);
        rateLimiter.recordCall(unknownTool);
      }

      const result = rateLimiter.canCall(unknownTool);
      expect(result.allowed).toBe(false);
    });
  });

  describe('recordCall()', () => {
    it('should increment both turn and session counts', () => {
      const toolName = 'get_business_info';

      rateLimiter.recordCall(toolName);
      const stats = rateLimiter.getStats();

      expect(stats.turn[toolName]).toBe(1);
      expect(stats.session[toolName]).toBe(1);
    });

    it('should accumulate counts across calls', () => {
      const toolName = 'get_services';

      rateLimiter.recordCall(toolName);
      rateLimiter.recordCall(toolName);
      rateLimiter.recordCall(toolName);

      const stats = rateLimiter.getStats();
      expect(stats.turn[toolName]).toBe(3);
      expect(stats.session[toolName]).toBe(3);
    });
  });

  describe('resetTurn()', () => {
    it('should reset turn counts only', () => {
      const toolName = 'check_availability';

      rateLimiter.recordCall(toolName);
      rateLimiter.recordCall(toolName);

      rateLimiter.resetTurn();

      const stats = rateLimiter.getStats();
      expect(stats.turn[toolName]).toBeUndefined();
      expect(stats.session[toolName]).toBe(2);
    });

    it('should allow per-turn calls again after reset', () => {
      const toolName = 'update_onboarding_state';
      const limit = DEFAULT_TOOL_RATE_LIMITS[toolName];

      // Exhaust turn limit
      for (let i = 0; i < limit.maxPerTurn; i++) {
        rateLimiter.recordCall(toolName);
      }
      expect(rateLimiter.canCall(toolName).allowed).toBe(false);

      // Reset and try again
      rateLimiter.resetTurn();
      expect(rateLimiter.canCall(toolName).allowed).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return empty stats initially', () => {
      const stats = rateLimiter.getStats();

      expect(Object.keys(stats.turn)).toHaveLength(0);
      expect(Object.keys(stats.session)).toHaveLength(0);
    });

    it('should track multiple tools independently', () => {
      rateLimiter.recordCall('get_services');
      rateLimiter.recordCall('get_services');
      rateLimiter.recordCall('check_availability');

      const stats = rateLimiter.getStats();

      expect(stats.session['get_services']).toBe(2);
      expect(stats.session['check_availability']).toBe(1);
    });
  });

  describe('Custom rate limits', () => {
    it('should accept custom rate limit configuration', () => {
      const customLimits: ToolRateLimits = {
        custom_tool: { maxPerTurn: 2, maxPerSession: 5 },
      };

      const customLimiter = new ToolRateLimiter(customLimits);

      // Should work with custom limit
      expect(customLimiter.canCall('custom_tool').allowed).toBe(true);
      customLimiter.recordCall('custom_tool');
      customLimiter.recordCall('custom_tool');

      // Should be blocked after 2 calls
      const result = customLimiter.canCall('custom_tool');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max per turn (2)');
    });
  });

  describe('Trust tier limits verification', () => {
    it('T1 tools should have higher limits than T2/T3', () => {
      // T1: metadata tools
      const t1Tool = 'get_services';
      const t1Limits = DEFAULT_TOOL_RATE_LIMITS[t1Tool];

      // T2: write tools
      const t2Tool = 'upsert_package';
      const t2Limits = DEFAULT_TOOL_RATE_LIMITS[t2Tool];

      // T3: booking tools
      const t3Tool = 'book_service';
      const t3Limits = DEFAULT_TOOL_RATE_LIMITS[t3Tool];

      // T1 should have higher per-session limits than T3
      expect(t1Limits.maxPerSession).toBeGreaterThan(t3Limits.maxPerSession);
    });

    it('T3 tools should have the lowest per-turn limits', () => {
      const t3Tool = 'book_service';
      const t3Limits = DEFAULT_TOOL_RATE_LIMITS[t3Tool];

      // T3 should only allow 1 booking per turn
      expect(t3Limits.maxPerTurn).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle tool not in config gracefully', () => {
      const result = rateLimiter.canCall('nonexistent_tool');

      expect(result.allowed).toBe(true);
    });

    it('should handle rapid successive calls', () => {
      const toolName = 'check_availability';
      const limit = DEFAULT_TOOL_RATE_LIMITS[toolName];

      // Rapid fire calls
      for (let i = 0; i < limit.maxPerTurn + 5; i++) {
        if (rateLimiter.canCall(toolName).allowed) {
          rateLimiter.recordCall(toolName);
        }
      }

      const stats = rateLimiter.getStats();
      expect(stats.turn[toolName]).toBe(limit.maxPerTurn);
    });

    it('should isolate tool limits from each other', () => {
      // Exhaust limit for one tool
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordCall('tool_a');
      }

      // Another tool should still be callable
      expect(rateLimiter.canCall('tool_b').allowed).toBe(true);
    });
  });
});
