/**
 * Request Context Tests
 *
 * Verifies that AsyncLocalStorage properly isolates request-scoped state,
 * preventing race conditions when concurrent requests share orchestrator instances.
 */

import { describe, it, expect } from 'vitest';
import {
  requestContext,
  getRequestContext,
  runInRequestContext,
} from '../../../src/agent/orchestrator/request-context';

describe('OrchestratorRequestContext', () => {
  describe('getRequestContext', () => {
    it('should return undefined when not in request scope', () => {
      const ctx = getRequestContext();
      expect(ctx).toBeUndefined();
    });

    it('should return context when inside runInRequestContext', () => {
      runInRequestContext({ isOnboardingMode: true }, () => {
        const ctx = getRequestContext();
        expect(ctx).toBeDefined();
        expect(ctx?.isOnboardingMode).toBe(true);
      });
    });

    it('should return undefined after exiting runInRequestContext', () => {
      runInRequestContext({ isOnboardingMode: true }, () => {
        // Inside context
      });
      // Outside context
      expect(getRequestContext()).toBeUndefined();
    });
  });

  describe('runInRequestContext', () => {
    it('should return the callback result', () => {
      const result = runInRequestContext({ isOnboardingMode: false }, () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });

    it('should propagate async results', async () => {
      const result = await runInRequestContext({ isOnboardingMode: true }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });
      expect(result).toBe('async-result');
    });

    it('should maintain context across async boundaries', async () => {
      await runInRequestContext({ isOnboardingMode: true }, async () => {
        // Before await
        expect(getRequestContext()?.isOnboardingMode).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 10));

        // After await
        expect(getRequestContext()?.isOnboardingMode).toBe(true);
      });
    });
  });

  describe('concurrent request isolation', () => {
    it('should isolate context between concurrent requests', async () => {
      // Simulate two concurrent requests with different modes
      const results: boolean[] = [];

      const request1 = runInRequestContext({ isOnboardingMode: true }, async () => {
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(getRequestContext()?.isOnboardingMode ?? false);
        return 'request1';
      });

      const request2 = runInRequestContext({ isOnboardingMode: false }, async () => {
        // This runs while request1 is awaiting
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(getRequestContext()?.isOnboardingMode ?? true);
        return 'request2';
      });

      await Promise.all([request1, request2]);

      // Each request should see its own context
      // request2 finishes first (10ms), so results[0] = false
      // request1 finishes second (20ms), so results[1] = true
      expect(results).toContain(true);
      expect(results).toContain(false);
      expect(results.length).toBe(2);
    });

    it('should not leak state between nested contexts', () => {
      runInRequestContext({ isOnboardingMode: true }, () => {
        expect(getRequestContext()?.isOnboardingMode).toBe(true);

        // Nested context with different value
        runInRequestContext({ isOnboardingMode: false }, () => {
          expect(getRequestContext()?.isOnboardingMode).toBe(false);
        });

        // Back to outer context
        expect(getRequestContext()?.isOnboardingMode).toBe(true);
      });
    });
  });
});
