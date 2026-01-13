/**
 * Unit Tests for Gemini Retry Logic
 *
 * Tests retry behavior including exponential backoff,
 * error classification integration, and retry configurations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withGeminiRetry,
  withGeminiRetryThrow,
  GeminiApiError,
  DEFAULT_GEMINI_RETRY_CONFIG,
  AGGRESSIVE_RETRY_CONFIG,
  QUICK_RETRY_CONFIG,
  type GeminiRetryConfig,
} from '../../src/llm/retry';
import { GeminiErrorType } from '../../src/llm/errors';

describe('Gemini Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withGeminiRetry', () => {
    describe('successful operations', () => {
      it('should return success on first attempt', async () => {
        const operation = vi.fn().mockResolvedValue('success');

        const promise = withGeminiRetry(operation);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
        expect(result.attempts).toBe(1);
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should track total time', async () => {
        const operation = vi.fn().mockResolvedValue('success');

        const promise = withGeminiRetry(operation);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('retryable errors', () => {
      it('should retry on rate limit (429)', async () => {
        const operation = vi
          .fn()
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockResolvedValue('success');

        const promise = withGeminiRetry(operation, {
          ...DEFAULT_GEMINI_RETRY_CONFIG,
          baseDelayMs: 100,
        });

        // Advance through the retry delay
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
        expect(operation).toHaveBeenCalledTimes(2);
      });

      it('should retry on service unavailable (503)', async () => {
        const operation = vi
          .fn()
          .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
          .mockResolvedValue('success');

        const promise = withGeminiRetry(operation, {
          ...DEFAULT_GEMINI_RETRY_CONFIG,
          baseDelayMs: 100,
        });

        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      });

      it('should exhaust retries and return error', async () => {
        const operation = vi.fn().mockRejectedValue({ status: 429, message: 'Rate limited' });

        const promise = withGeminiRetry(operation, {
          ...DEFAULT_GEMINI_RETRY_CONFIG,
          maxRetries: 2,
          baseDelayMs: 100,
        });

        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.type).toBe(GeminiErrorType.RATE_LIMITED);
        expect(result.attempts).toBe(3); // Initial + 2 retries
        expect(operation).toHaveBeenCalledTimes(3);
      });
    });

    describe('non-retryable errors', () => {
      it('should not retry content blocked errors', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Content blocked by safety filter'));

        const promise = withGeminiRetry(operation);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error!.type).toBe(GeminiErrorType.CONTENT_BLOCKED);
        expect(result.attempts).toBe(1);
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should not retry authentication errors', async () => {
        const operation = vi.fn().mockRejectedValue({ status: 403, message: 'Forbidden' });

        const promise = withGeminiRetry(operation);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error!.type).toBe(GeminiErrorType.AUTHENTICATION_ERROR);
        expect(result.attempts).toBe(1);
      });

      it('should not retry quota exceeded errors', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Billing quota exceeded'));

        const promise = withGeminiRetry(operation);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error!.type).toBe(GeminiErrorType.QUOTA_EXCEEDED);
        expect(result.attempts).toBe(1);
      });
    });

    describe('context logging', () => {
      it('should pass context to logging', async () => {
        const operation = vi.fn().mockResolvedValue('success');
        const context = { tenantId: 'test-tenant', sessionId: 'test-session', operation: 'chat' };

        const promise = withGeminiRetry(operation, DEFAULT_GEMINI_RETRY_CONFIG, context);
        await vi.runAllTimersAsync();
        await promise;

        // Context is used for logging - operation should still succeed
        expect(operation).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('withGeminiRetryThrow', () => {
    it('should return data on success', async () => {
      const operation = vi.fn().mockResolvedValue({ result: 'data' });

      const promise = withGeminiRetryThrow(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ result: 'data' });
    });

    it('should throw GeminiApiError on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Content blocked'));

      // Run timers first, then check the rejection
      const promise = withGeminiRetryThrow(operation);
      vi.runAllTimers();

      await expect(promise).rejects.toBeInstanceOf(GeminiApiError);
    });

    it('should include classified error info in exception', async () => {
      const operation = vi.fn().mockRejectedValue({ status: 429, message: 'Rate limited' });

      const promise = withGeminiRetryThrow(operation, {
        ...DEFAULT_GEMINI_RETRY_CONFIG,
        maxRetries: 0,
      });
      vi.runAllTimers();

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiApiError);
        const geminiError = error as GeminiApiError;
        expect(geminiError.type).toBe(GeminiErrorType.RATE_LIMITED);
        expect(geminiError.isRetryable).toBe(true);
        expect(geminiError.userMessage).toBeDefined();
      }
    });
  });

  describe('GeminiApiError', () => {
    it('should have correct properties', () => {
      const classifiedError = {
        type: GeminiErrorType.RATE_LIMITED,
        isRetryable: true,
        retryAfterMs: 60000,
        userMessage: 'Please try again',
        originalError: new Error('Original'),
        statusCode: 429,
      };

      const error = new GeminiApiError(classifiedError);

      expect(error.name).toBe('GeminiApiError');
      expect(error.type).toBe(GeminiErrorType.RATE_LIMITED);
      expect(error.isRetryable).toBe(true);
      expect(error.userMessage).toBe('Please try again');
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('Please try again');
    });

    it('should serialize to JSON', () => {
      const error = new GeminiApiError({
        type: GeminiErrorType.SERVICE_UNAVAILABLE,
        isRetryable: true,
        userMessage: 'Service down',
        originalError: new Error('Original'),
        statusCode: 503,
      });

      const json = error.toJSON();

      expect(json.name).toBe('GeminiApiError');
      expect(json.type).toBe(GeminiErrorType.SERVICE_UNAVAILABLE);
      expect(json.statusCode).toBe(503);
      expect(json).not.toHaveProperty('originalError'); // Should not include original
    });
  });

  describe('retry configurations', () => {
    describe('DEFAULT_GEMINI_RETRY_CONFIG', () => {
      it('should have reasonable defaults', () => {
        expect(DEFAULT_GEMINI_RETRY_CONFIG.maxRetries).toBe(3);
        expect(DEFAULT_GEMINI_RETRY_CONFIG.baseDelayMs).toBe(1000);
        expect(DEFAULT_GEMINI_RETRY_CONFIG.maxDelayMs).toBe(30000);
        expect(DEFAULT_GEMINI_RETRY_CONFIG.backoffMultiplier).toBe(2);
        expect(DEFAULT_GEMINI_RETRY_CONFIG.jitterFraction).toBe(0.2);
      });
    });

    describe('AGGRESSIVE_RETRY_CONFIG', () => {
      it('should have more retries and longer max delay', () => {
        expect(AGGRESSIVE_RETRY_CONFIG.maxRetries).toBeGreaterThan(
          DEFAULT_GEMINI_RETRY_CONFIG.maxRetries
        );
        expect(AGGRESSIVE_RETRY_CONFIG.maxDelayMs).toBeGreaterThan(
          DEFAULT_GEMINI_RETRY_CONFIG.maxDelayMs
        );
      });
    });

    describe('QUICK_RETRY_CONFIG', () => {
      it('should have fewer retries and shorter delays', () => {
        expect(QUICK_RETRY_CONFIG.maxRetries).toBeLessThan(DEFAULT_GEMINI_RETRY_CONFIG.maxRetries);
        expect(QUICK_RETRY_CONFIG.maxDelayMs).toBeLessThan(DEFAULT_GEMINI_RETRY_CONFIG.maxDelayMs);
      });
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay with each attempt', async () => {
      let attemptDelays: number[] = [];
      let lastAttemptTime = Date.now();

      const operation = vi.fn().mockImplementation(async () => {
        const now = Date.now();
        attemptDelays.push(now - lastAttemptTime);
        lastAttemptTime = now;
        throw { status: 503, message: 'Unavailable' };
      });

      const promise = withGeminiRetry(operation, {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterFraction: 0, // No jitter for predictable testing
      });

      await vi.runAllTimersAsync();
      await promise;

      // First attempt has no delay (0), second should be ~100ms, third ~200ms
      expect(attemptDelays[1]).toBeGreaterThanOrEqual(90); // ~100ms
      expect(attemptDelays[2]).toBeGreaterThanOrEqual(180); // ~200ms (2x)
    });

    it('should cap delay at maxDelayMs', async () => {
      let attemptCount = 0;

      const operation = vi.fn().mockImplementation(async () => {
        attemptCount++;
        throw { status: 503, message: 'Unavailable' };
      });

      const promise = withGeminiRetry(operation, {
        maxRetries: 5,
        baseDelayMs: 100,
        maxDelayMs: 200, // Low cap
        backoffMultiplier: 10, // Would grow quickly without cap
        jitterFraction: 0,
      });

      await vi.runAllTimersAsync();
      await promise;

      // With base=100, multiplier=10, without cap delays would be 100, 1000, 10000...
      // With cap=200, delays should be 100, 200, 200, 200, 200
      expect(attemptCount).toBe(6); // Initial + 5 retries
    });
  });

  describe('API-provided retry hints', () => {
    it('should use retry-after hint from error', async () => {
      let retryDelay = 0;
      let originalNow = Date.now();

      const operation = vi
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          message: 'Rate limited',
          headers: { 'retry-after': '2' }, // 2 seconds
        })
        .mockImplementation(async () => {
          retryDelay = Date.now() - originalNow;
          return 'success';
        });

      const promise = withGeminiRetry(operation, {
        ...DEFAULT_GEMINI_RETRY_CONFIG,
        baseDelayMs: 100, // Would be 100ms without hint
        jitterFraction: 0,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Should use the 2000ms hint instead of 100ms base
      expect(retryDelay).toBeGreaterThanOrEqual(1900); // ~2000ms
    });
  });
});
