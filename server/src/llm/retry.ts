/**
 * Gemini/Vertex AI Retry Logic
 *
 * Provides LLM-specific retry behavior with error classification.
 * Builds on the generic retry utility in agent/utils/retry.ts but adds:
 * - Vertex AI error classification for smarter retry decisions
 * - API-provided retry-after hints
 * - User-friendly error transformation
 *
 * Design notes:
 * - This module is for NEW code that wants classified errors
 * - Existing code using withRetry from agent/utils continues to work
 * - Both can coexist - this just adds more intelligence
 */

import { logger } from '../lib/core/logger';
import {
  classifyGeminiError,
  GeminiErrorType,
  type ClassifiedGeminiError,
  requiresAlert,
} from './errors';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for Gemini retry logic.
 */
export interface GeminiRetryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Jitter range as fraction of delay (default: 0.2 = ±20%) */
  jitterFraction: number;
}

/**
 * Default retry configuration for Gemini API.
 *
 * Tuned for Vertex AI's behavior:
 * - 1s base delay (Google's recommendation)
 * - 30s max for quota-related delays
 * - 20% jitter to prevent thundering herd
 */
export const DEFAULT_GEMINI_RETRY_CONFIG: GeminiRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFraction: 0.2,
};

/**
 * Result of a retry operation.
 */
export interface GeminiRetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result if successful */
  data?: T;
  /** The classified error if failed */
  error?: ClassifiedGeminiError;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in ms */
  totalTimeMs: number;
}

/**
 * Context for retry logging.
 */
export interface RetryContext {
  tenantId?: string;
  sessionId?: string;
  operation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @param apiHintMs - Optional API-provided retry-after hint
 */
function calculateDelay(attempt: number, config: GeminiRetryConfig, apiHintMs?: number): number {
  // Use API hint if available (rate limit responses often include this)
  const baseDelay = apiHintMs ?? config.baseDelayMs;

  // Exponential backoff
  const exponentialDelay = baseDelay * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (±jitterFraction of delay)
  const jitterRange = cappedDelay * config.jitterFraction;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, Math.round(cappedDelay + jitter));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Retry Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a Gemini API operation with intelligent retry logic.
 *
 * Features:
 * - Error classification for smarter retry decisions
 * - API-provided retry-after hints
 * - Exponential backoff with jitter
 * - Detailed logging for observability
 *
 * @param operation - Async function to execute
 * @param config - Retry configuration
 * @param context - Optional context for logging
 * @returns Result with success/error and metadata
 *
 * @example
 * ```typescript
 * const result = await withGeminiRetry(
 *   () => gemini.models.generateContent({ ... }),
 *   DEFAULT_GEMINI_RETRY_CONFIG,
 *   { tenantId, sessionId, operation: 'chat' }
 * );
 *
 * if (!result.success) {
 *   // Handle error with classified info
 *   return { message: result.error.userMessage };
 * }
 * ```
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  config: GeminiRetryConfig = DEFAULT_GEMINI_RETRY_CONFIG,
  context?: RetryContext
): Promise<GeminiRetryResult<T>> {
  const startTime = Date.now();
  let lastError: ClassifiedGeminiError | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const data = await operation();
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Classify the error
      lastError = classifyGeminiError(error);

      logger.warn(
        {
          ...context,
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          errorType: lastError.type,
          isRetryable: lastError.isRetryable,
          statusCode: lastError.statusCode,
        },
        'Gemini API call failed'
      );

      // Alert ops for critical errors
      if (requiresAlert(lastError.type)) {
        logger.error(
          {
            ...context,
            errorType: lastError.type,
            userMessage: lastError.userMessage,
          },
          'ALERT: Gemini error requires ops attention'
        );
      }

      // Don't retry non-retryable errors
      if (!lastError.isRetryable) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalTimeMs: Date.now() - startTime,
        };
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        logger.error(
          {
            ...context,
            errorType: lastError.type,
            attempts: attempt + 1,
          },
          'All retry attempts exhausted'
        );
        break;
      }

      // Calculate delay (use API hint if available)
      const delay = calculateDelay(attempt, config, lastError.retryAfterMs);

      logger.info(
        {
          ...context,
          delayMs: delay,
          nextAttempt: attempt + 2,
          apiHintMs: lastError.retryAfterMs,
        },
        'Scheduling Gemini API retry'
      );

      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: config.maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Execute a Gemini API operation with retry, throwing on failure.
 *
 * Use this when you want exception-based error handling rather than
 * result-based. The thrown error will be a GeminiApiError with
 * classified error info.
 *
 * @param operation - Async function to execute
 * @param config - Retry configuration
 * @param context - Optional context for logging
 * @returns The operation result
 * @throws GeminiApiError if all retries fail
 */
export async function withGeminiRetryThrow<T>(
  operation: () => Promise<T>,
  config: GeminiRetryConfig = DEFAULT_GEMINI_RETRY_CONFIG,
  context?: RetryContext
): Promise<T> {
  const result = await withGeminiRetry(operation, config, context);

  if (!result.success) {
    throw new GeminiApiError(result.error!);
  }

  return result.data!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error class for Gemini API failures with classification info.
 *
 * Use this when you need to throw classified errors.
 */
export class GeminiApiError extends Error {
  readonly type: GeminiErrorType;
  readonly isRetryable: boolean;
  readonly userMessage: string;
  readonly statusCode?: number;
  readonly originalError: unknown;

  constructor(classified: ClassifiedGeminiError) {
    super(classified.userMessage);
    this.name = 'GeminiApiError';
    this.type = classified.type;
    this.isRetryable = classified.isRetryable;
    this.userMessage = classified.userMessage;
    this.statusCode = classified.statusCode;
    this.originalError = classified.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GeminiApiError);
    }
  }

  /**
   * Get a JSON-serializable representation for logging.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialized Retry Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retry configuration for high-priority operations.
 *
 * Use for critical paths where we want more aggressive retry.
 * - More retries
 * - Longer max delay
 */
export const AGGRESSIVE_RETRY_CONFIG: GeminiRetryConfig = {
  maxRetries: 5,
  baseDelayMs: 500, // Start faster
  maxDelayMs: 60000, // Wait up to 1 minute
  backoffMultiplier: 2,
  jitterFraction: 0.2,
};

/**
 * Retry configuration for background/batch operations.
 *
 * Use for non-urgent operations where we prefer to wait than fail.
 * - Even more retries
 * - Very long max delay
 */
export const PATIENT_RETRY_CONFIG: GeminiRetryConfig = {
  maxRetries: 7,
  baseDelayMs: 2000,
  maxDelayMs: 120000, // Wait up to 2 minutes
  backoffMultiplier: 1.5, // Slower backoff
  jitterFraction: 0.3,
};

/**
 * Retry configuration for quick operations.
 *
 * Use for operations where fast failure is preferred over waiting.
 * - Fewer retries
 * - Shorter delays
 */
export const QUICK_RETRY_CONFIG: GeminiRetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFraction: 0.1,
};
