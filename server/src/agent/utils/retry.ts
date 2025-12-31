/**
 * Retry Utility with Exponential Backoff
 *
 * Provides graceful degradation for external API calls (Claude, etc.).
 * Implements:
 * - Exponential backoff with jitter to prevent thundering herd
 * - Configurable retry counts and delays
 * - Error classification (retryable vs non-retryable)
 */

import { logger } from '../../lib/core/logger';

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
 * Error types that should trigger a retry
 */
const RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i,
  /too.?many.?requests/i,
  /overloaded/i,
  /503/,
  /502/,
  /timeout/i,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /network/i,
  /temporarily.?unavailable/i,
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

  // Check for Anthropic API error with status
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check status code
    if (typeof errorObj.status === 'number') {
      if (RETRYABLE_STATUS_CODES.includes(errorObj.status)) {
        return true;
      }
    }

    // Check error.status (nested)
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

  // Add random jitter (±25% of base delay)
  const jitterRange = baseDelay * 0.25;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  return Math.max(0, baseDelay + jitter);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param operationName - Name for logging purposes
 * @param config - Retry configuration (optional, uses defaults)
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
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

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

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
