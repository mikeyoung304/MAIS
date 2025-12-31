/**
 * Unit tests for retry utility with exponential backoff
 *
 * Covers:
 * - withRetry() success and retry behavior
 * - isRetryableError() error classification
 * - Exponential backoff timing
 * - Jitter implementation
 * - Max retries limit
 *
 * Note: These tests use fake timers to test retry delays. The combination of
 * fake timers + async retry loops can trigger Vitest's unhandled rejection
 * detection. We suppress these expected rejections during tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  withRetry,
  isRetryableError,
  CLAUDE_API_RETRY_CONFIG,
  type RetryConfig,
} from '../../../src/agent/utils/retry';

// Suppress unhandled rejections during retry tests - these are expected
// when testing retry logic with fake timers
let originalHandler: NodeJS.UnhandledRejectionListener | undefined;

beforeAll(() => {
  originalHandler = process.listeners('unhandledRejection')[0] as
    | NodeJS.UnhandledRejectionListener
    | undefined;
  process.removeAllListeners('unhandledRejection');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  process.on('unhandledRejection', (_reason, _promise) => {
    // Suppress during retry tests - these are expected test rejections
  });
});

afterAll(() => {
  process.removeAllListeners('unhandledRejection');
  if (originalHandler) {
    process.on('unhandledRejection', originalHandler);
  }
});

describe('Retry Utility', () => {
  describe('isRetryableError()', () => {
    describe('rate limit errors', () => {
      it('returns true for 429 status code', () => {
        const error = { status: 429 };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for nested 429 status code', () => {
        const error = { error: { status: 429 } };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "rate limit" in message', () => {
        const error = new Error('Rate limit exceeded');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "rate-limit" with hyphen', () => {
        const error = new Error('API rate-limit reached');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "too many requests" message', () => {
        const error = new Error('Too many requests');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "too-many-requests" with hyphens', () => {
        const error = new Error('Error: Too-many-requests');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "overloaded" message', () => {
        const error = new Error('Server is overloaded');
        expect(isRetryableError(error)).toBe(true);
      });
    });

    describe('server errors', () => {
      it('returns true for 500 status code', () => {
        const error = { status: 500 };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for 502 status code', () => {
        const error = { status: 502 };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for 503 status code', () => {
        const error = { status: 503 };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for 504 status code', () => {
        const error = { status: 504 };
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "503" in message', () => {
        const error = new Error('HTTP 503: Service Unavailable');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "502" in message', () => {
        const error = new Error('502 Bad Gateway');
        expect(isRetryableError(error)).toBe(true);
      });
    });

    describe('timeout errors', () => {
      it('returns true for "timeout" in message', () => {
        const error = new Error('Request timeout');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "timeout" case-insensitive', () => {
        const error = new Error('CONNECTION TIMEOUT');
        expect(isRetryableError(error)).toBe(true);
      });
    });

    describe('network errors', () => {
      it('returns true for ECONNRESET error', () => {
        const error = new Error('ECONNRESET: Connection reset by peer');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for ECONNREFUSED error', () => {
        const error = new Error('ECONNREFUSED: Connection refused');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for ETIMEDOUT error', () => {
        const error = new Error('ETIMEDOUT: Connection timed out');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "network" in message', () => {
        const error = new Error('Network error');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "temporarily unavailable" message', () => {
        const error = new Error('Service temporarily unavailable');
        expect(isRetryableError(error)).toBe(true);
      });

      it('returns true for "temporarily-unavailable" with hyphens', () => {
        const error = new Error('temporarily-unavailable');
        expect(isRetryableError(error)).toBe(true);
      });
    });

    describe('non-retryable errors', () => {
      it('returns false for 400 status code', () => {
        const error = { status: 400 };
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for 401 status code', () => {
        const error = { status: 401 };
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for 403 status code', () => {
        const error = { status: 403 };
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for 404 status code', () => {
        const error = { status: 404 };
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for validation error message', () => {
        const error = new Error('Validation failed: invalid email');
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for generic error message', () => {
        const error = new Error('Something went wrong');
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for null error', () => {
        expect(isRetryableError(null)).toBe(false);
      });

      it('returns false for undefined error', () => {
        expect(isRetryableError(undefined)).toBe(false);
      });

      it('returns false for empty object', () => {
        const error = {};
        expect(isRetryableError(error)).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(isRetryableError('')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for non-Error objects with error property but no status', () => {
        const error = { error: { message: 'Something failed' } };
        expect(isRetryableError(error)).toBe(false);
      });

      it('handles Error objects without status correctly', () => {
        const error = new Error('No status here');
        expect(isRetryableError(error)).toBe(false);
      });

      it('checks both top-level and nested status codes', () => {
        const error = { error: { status: 429 }, status: 400 };
        // Should check nested status first (based on code logic)
        expect(isRetryableError(error)).toBe(true);
      });
    });
  });

  describe('withRetry()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      // Clear pending timers to prevent unhandled rejections from dangling retries
      vi.clearAllTimers();
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    describe('success cases', () => {
      it('returns result on first success', async () => {
        const mockFn = vi.fn(async () => 'success');

        const result = await withRetry(mockFn, 'test-operation');

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledOnce();
      });

      it('returns result on retry success', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('succeeds after multiple retries', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockRejectedValueOnce(new Error('503 Service Unavailable'))
          .mockRejectedValueOnce(new Error('rate limit'))
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 3, jitter: false });
        // Advance through all retries: 1000 + 2000 + 4000
        await vi.advanceTimersByTimeAsync(7000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(4);
      });
    });

    describe('non-retryable error handling', () => {
      it('throws non-retryable error immediately (400)', async () => {
        const mockFn = vi.fn(async () => {
          throw { status: 400 };
        });

        await expect(withRetry(mockFn, 'test-operation')).rejects.toMatchObject({ status: 400 });

        expect(mockFn).toHaveBeenCalledOnce();
      });

      it('throws non-retryable error immediately (401)', async () => {
        const mockFn = vi.fn(async () => {
          throw new Error('Unauthorized');
        });

        await expect(withRetry(mockFn, 'test-operation')).rejects.toThrow('Unauthorized');

        expect(mockFn).toHaveBeenCalledOnce();
      });

      it('throws non-retryable error immediately (403)', async () => {
        const mockFn = vi.fn(async () => {
          throw { status: 403 };
        });

        await expect(withRetry(mockFn, 'test-operation')).rejects.toMatchObject({ status: 403 });

        expect(mockFn).toHaveBeenCalledOnce();
      });

      it('throws validation error immediately', async () => {
        const mockFn = vi.fn(async () => {
          throw new Error('Invalid request body');
        });

        await expect(withRetry(mockFn, 'test-operation')).rejects.toThrow('Invalid request body');

        expect(mockFn).toHaveBeenCalledOnce();
      });
    });

    describe('retryable error handling', () => {
      it('retries on 429 rate limit', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce({ status: 429 })
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('retries on 503 service unavailable', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce({ status: 503 })
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('retries on timeout error', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('retries on network connection errors', async () => {
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success');

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 1, jitter: false });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('max retries limit', () => {
      it('stops retrying after maxRetries is reached', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 2, jitter: false });
        await vi.advanceTimersByTimeAsync(3000); // 1000 + 2000 for 2 retries
        await expect(promise).rejects.toThrow('timeout');

        expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
      });

      it('respects maxRetries of 0 (one attempt only)', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        await expect(withRetry(mockFn, 'test-operation', { maxRetries: 0 })).rejects.toThrow(
          'timeout'
        );

        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('respects maxRetries of 5', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 5, jitter: false });
        // Advance through all retries: 1000 + 2000 + 4000 + 8000 + 16000
        await vi.advanceTimersByTimeAsync(31000);
        await expect(promise).rejects.toThrow('timeout');

        expect(mockFn).toHaveBeenCalledTimes(6); // initial + 5 retries
      });

      it('defaults to 3 retries', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const promise = withRetry(mockFn, 'test-operation', { jitter: false });
        // Advance through 3 retries: 1000 + 2000 + 4000
        await vi.advanceTimersByTimeAsync(7000);
        await expect(promise).rejects.toThrow('timeout');

        expect(mockFn).toHaveBeenCalledTimes(4); // initial + 3 retries
      });
    });

    describe('exponential backoff timing', () => {
      it('increases delay exponentially with default multiplier (2)', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const config: Partial<RetryConfig> = {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // After first attempt fails, should wait 1000ms (1 * 2^0)
        await vi.advanceTimersByTimeAsync(1000);
        expect(mockFn).toHaveBeenCalledTimes(2);

        // After second attempt fails, should wait 2000ms (1000 * 2^1)
        await vi.advanceTimersByTimeAsync(2000);
        expect(mockFn).toHaveBeenCalledTimes(3);

        // After third attempt fails, should wait 4000ms (1000 * 2^2)
        await vi.advanceTimersByTimeAsync(4000);
        expect(mockFn).toHaveBeenCalledTimes(4);

        await promise.catch(() => {});
      });

      it('respects custom backoff multiplier', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const config: Partial<RetryConfig> = {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 10000,
          backoffMultiplier: 3,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // First retry: 100ms (100 * 3^0)
        await vi.advanceTimersByTimeAsync(100);
        expect(mockFn).toHaveBeenCalledTimes(2);

        // Second retry: 300ms (100 * 3^1)
        await vi.advanceTimersByTimeAsync(300);
        expect(mockFn).toHaveBeenCalledTimes(3);

        await promise.catch(() => {});
      });

      it('caps delay at maxDelayMs', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const config: Partial<RetryConfig> = {
          maxRetries: 5,
          initialDelayMs: 1000,
          maxDelayMs: 5000, // Cap at 5000ms
          backoffMultiplier: 2,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // Attempt 1: 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        expect(mockFn).toHaveBeenCalledTimes(2);

        // Attempt 2: 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        expect(mockFn).toHaveBeenCalledTimes(3);

        // Attempt 3: 4000ms
        await vi.advanceTimersByTimeAsync(4000);
        expect(mockFn).toHaveBeenCalledTimes(4);

        // Attempt 4: would be 8000ms, but capped at 5000ms
        await vi.advanceTimersByTimeAsync(5000);
        expect(mockFn).toHaveBeenCalledTimes(5);

        // Attempt 5: still capped at 5000ms
        await vi.advanceTimersByTimeAsync(5000);
        expect(mockFn).toHaveBeenCalledTimes(6);

        await promise.catch(() => {});
      });

      it('respects custom initial delay', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        const config: Partial<RetryConfig> = {
          maxRetries: 1,
          initialDelayMs: 500,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // First retry: 500ms (custom initial)
        await vi.advanceTimersByTimeAsync(500);
        expect(mockFn).toHaveBeenCalledTimes(2);

        await promise.catch(() => {});
      });
    });

    describe('jitter behavior', () => {
      it('adds jitter when enabled (default)', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('rate limit'));

        const config: Partial<RetryConfig> = {
          maxRetries: 2,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          jitter: true,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // Use runAllTimersAsync to handle unpredictable jitter timing
        await vi.runAllTimersAsync();

        await promise.catch(() => {});

        // Just verify it tried the expected number of times
        // (jitter means we can't test exact delays with fake timers)
        expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
      });

      it('does not add jitter when disabled', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('rate limit'));

        const config: Partial<RetryConfig> = {
          maxRetries: 2,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', config);

        // Advance enough time for all retries (1000 + 2000)
        await vi.advanceTimersByTimeAsync(3000);

        await promise.catch(() => {});

        // Verify expected call count
        expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
      });
    });

    describe('custom config override', () => {
      it('merges custom config with defaults', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('rate limit'));

        const customConfig: Partial<RetryConfig> = {
          maxRetries: 1,
          initialDelayMs: 500,
          jitter: false,
        };

        const promise = withRetry(mockFn, 'test-operation', customConfig);

        // Should use custom maxRetries (1) and initialDelayMs (500)
        // but defaults for other values
        await vi.advanceTimersByTimeAsync(500);
        expect(mockFn).toHaveBeenCalledTimes(2);

        // Continue to finish the promise
        await vi.advanceTimersByTimeAsync(1000);
        await promise.catch(() => {});
      });

      it('supports CLAUDE_API_RETRY_CONFIG preset', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('rate limit'));

        // CLAUDE_API_RETRY_CONFIG: maxRetries: 3, initialDelayMs: 2000, jitter: true
        const promise = withRetry(mockFn, 'test-operation', CLAUDE_API_RETRY_CONFIG);

        // Use runAllTimersAsync because CLAUDE_API_RETRY_CONFIG has jitter: true
        await vi.runAllTimersAsync();
        await promise.catch(() => {});

        // Should have made 4 calls (initial + 3 retries)
        expect(mockFn).toHaveBeenCalledTimes(4);
      });
    });

    describe('error propagation', () => {
      it('throws the last error encountered', async () => {
        // Use retryable errors to test error propagation after maxRetries
        const error1 = new Error('rate limit 1');
        const error2 = new Error('rate limit 2');
        const error3 = new Error('rate limit 3');

        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(error1)
          .mockRejectedValueOnce(error2)
          .mockRejectedValueOnce(error3);

        const promise = withRetry(mockFn, 'test-operation', { maxRetries: 2, jitter: false });

        // Advance through all retries: 1000 + 2000
        await vi.advanceTimersByTimeAsync(3000);

        await expect(promise).rejects.toThrow('rate limit 3');
      });

      it('preserves error type (object vs Error)', async () => {
        const error = { status: 500, code: 'INTERNAL_ERROR' };
        const mockFn = vi.fn(async () => {
          throw error;
        });

        await expect(withRetry(mockFn, 'test-operation', { maxRetries: 0 })).rejects.toMatchObject({
          status: 500,
          code: 'INTERNAL_ERROR',
        });
      });
    });

    describe('operation naming for logging', () => {
      it('accepts operation name for context', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));

        await expect(
          withRetry(mockFn, 'fetch-claude-response', { maxRetries: 0 })
        ).rejects.toThrow();

        // Should have been called with the right context
        expect(mockFn).toHaveBeenCalled();
      });
    });

    describe('concurrent retry operations', () => {
      it('handles multiple concurrent retries independently', async () => {
        const mockFn1 = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValueOnce('result1');

        const mockFn2 = vi
          .fn()
          .mockRejectedValueOnce(new Error('503'))
          .mockResolvedValueOnce('result2');

        const promise1 = withRetry(mockFn1, 'operation1', {
          maxRetries: 1,
          initialDelayMs: 1000,
          jitter: false,
        });
        const promise2 = withRetry(mockFn2, 'operation2', {
          maxRetries: 1,
          initialDelayMs: 500,
          jitter: false,
        });

        // Advance time for operation2 (shorter delay)
        await vi.advanceTimersByTimeAsync(500);
        expect(mockFn2).toHaveBeenCalledTimes(2);

        // Advance time for operation1
        await vi.advanceTimersByTimeAsync(500);
        expect(mockFn1).toHaveBeenCalledTimes(2);

        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1).toBe('result1');
        expect(result2).toBe('result2');
      });
    });
  });

  describe('integration tests', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      // Clear pending timers to prevent unhandled rejections from dangling retries
      vi.clearAllTimers();
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('retries once then succeeds on second attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValueOnce({ data: 'success' });

      const promise = withRetry(mockFn, 'api-call', { maxRetries: 1, jitter: false });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual({ data: 'success' });
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('handles nested error objects with status codes', async () => {
      // This error has status in nested .error field
      const wrappedError = {
        error: { status: 503 },
        message: 'Wrapped error',
      };

      const mockFn = vi.fn().mockRejectedValueOnce(wrappedError).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, 'test', { maxRetries: 1, jitter: false });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
    });

    it('correctly identifies and retries transient failures', async () => {
      const errors = [
        new Error('ECONNRESET'),
        new Error('timeout'),
        new Error('503 Service Unavailable'),
      ];

      const mockFn = vi.fn();
      errors.forEach((error) => {
        mockFn.mockRejectedValueOnce(error);
      });
      mockFn.mockResolvedValueOnce('recovered');

      const promise = withRetry(mockFn, 'flaky-api', {
        maxRetries: 5,
        jitter: false,
      });

      // Advance time for all retries: 1000 + 2000 + 4000 + 8000 + 16000
      await vi.advanceTimersByTimeAsync(31000);
      const result = await promise;

      expect(result).toBe('recovered');
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('fails immediately on permanent errors without retrying', async () => {
      const mockFn = vi.fn(async () => {
        throw { status: 401, message: 'Unauthorized' };
      });

      await expect(withRetry(mockFn, 'auth-api')).rejects.toMatchObject({ status: 401 });

      expect(mockFn).toHaveBeenCalledOnce();
    });
  });
});
