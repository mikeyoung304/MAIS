/**
 * Gemini/Vertex AI Error Classification
 *
 * Maps Vertex AI error codes to actionable categories.
 * Determines retry strategy and user-facing messages.
 *
 * Key design decisions:
 * - Complements existing retry.ts in agent/utils (which handles generic retry logic)
 * - Provides LLM-specific error types for better UX and observability
 * - User messages are friendly and actionable (no technical jargon)
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#troubleshooting
 */

import { logger } from '../lib/core/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vertex AI error classification for orchestrator decision-making.
 *
 * Categories map to specific handling strategies:
 * - RATE_LIMITED: Retry with backoff (temporary)
 * - QUOTA_EXCEEDED: Alert ops, no retry (billing issue)
 * - CONTENT_BLOCKED: Return safe message, no retry (safety filter)
 * - CONTEXT_TOO_LONG: Truncate history and retry (recoverable)
 * - INVALID_REQUEST: Log bug, no retry (developer error)
 * - SERVICE_UNAVAILABLE: Retry with backoff (temporary)
 * - AUTHENTICATION_ERROR: Alert ops, no retry (config issue)
 * - MODEL_NOT_FOUND: Alert ops, no retry (config issue)
 * - UNKNOWN: Log for investigation, limited retry
 */
export enum GeminiErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CONTENT_BLOCKED = 'CONTENT_BLOCKED',
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classified error with retry hints and user-facing message.
 */
export interface ClassifiedGeminiError {
  /** Error category for handling decisions */
  type: GeminiErrorType;
  /** Whether this error can be retried */
  isRetryable: boolean;
  /** Suggested wait time before retry (from API or default) */
  retryAfterMs?: number;
  /** User-friendly message (no technical details) */
  userMessage: string;
  /** Original error for logging */
  originalError: unknown;
  /** HTTP status code if available */
  statusCode?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract retry-after hint from error response.
 *
 * Vertex AI may include retry hints in error responses.
 * Returns milliseconds or undefined if not found.
 */
function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const errorObj = error as Record<string, unknown>;

  // Check for retry-after header (common in rate limit responses)
  const headers = errorObj.headers as Record<string, unknown> | undefined;
  if (headers?.['retry-after']) {
    const retryAfter = Number(headers['retry-after']);
    if (!isNaN(retryAfter)) {
      // Header is in seconds, convert to ms
      return retryAfter * 1000;
    }
  }

  // Check for retryDelay in error body (Vertex AI specific)
  const retryDelay = errorObj.retryDelay as number | undefined;
  if (typeof retryDelay === 'number') {
    return retryDelay * 1000;
  }

  return undefined;
}

/**
 * Extract HTTP status code from error.
 */
function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const errorObj = error as Record<string, unknown>;

  // Direct status property
  if (typeof errorObj.status === 'number') {
    return errorObj.status;
  }

  // Nested status (common in SDK errors)
  if (typeof errorObj.code === 'number') {
    return errorObj.code;
  }

  // Check response.status
  const response = errorObj.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === 'number') {
    return response.status;
  }

  return undefined;
}

/**
 * Classify a Gemini/Vertex AI error for appropriate handling.
 *
 * Uses pattern matching on error messages and status codes to determine
 * the error type. This classification drives:
 * - Retry decisions (should we retry?)
 * - Backoff timing (how long to wait?)
 * - User messaging (what to tell the user?)
 * - Alerting (should ops be notified?)
 *
 * Error patterns based on Vertex AI documentation:
 * - RESOURCE_EXHAUSTED: Rate limiting (429)
 * - QUOTA_EXCEEDED: Billing/quota issues
 * - INVALID_ARGUMENT: Bad request format (400)
 * - UNAVAILABLE: Service issues (503)
 * - PERMISSION_DENIED: Auth issues (403)
 * - NOT_FOUND: Model/resource not found (404)
 *
 * @param error - The error to classify
 * @returns Classified error with handling hints
 */
export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  const statusCode = extractStatusCode(error);
  const retryAfterHint = extractRetryAfter(error);

  // Rate limiting (429 or RESOURCE_EXHAUSTED)
  // Most common error - Vertex AI has per-minute quotas
  if (
    statusCode === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded per minute')
  ) {
    return {
      type: GeminiErrorType.RATE_LIMITED,
      isRetryable: true,
      retryAfterMs: retryAfterHint ?? 60000, // Default: 1 minute
      userMessage: 'Our AI assistant is temporarily busy. Please try again in a moment.',
      originalError: error,
      statusCode,
    };
  }

  // Context too long (token limit exceeded)
  // IMPORTANT: Check this BEFORE quota exceeded to avoid "limit exceeded" false positive
  // Can be recovered by truncating history
  if (
    message.includes('context') ||
    message.includes('token limit') ||
    message.includes('too long') ||
    message.includes('max_tokens') ||
    message.includes('input too large') ||
    message.includes('exceeds maximum') ||
    (message.includes('token') && message.includes('limit'))
  ) {
    return {
      type: GeminiErrorType.CONTEXT_TOO_LONG,
      isRetryable: false, // Needs history truncation, not simple retry
      userMessage: 'The conversation is too long. Please start a new session.',
      originalError: error,
      statusCode,
    };
  }

  // Quota exceeded (billing issues - different from rate limiting)
  // This is a hard limit, not a rate limit - requires billing action
  if (
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('budget') ||
    (message.includes('limit') && message.includes('exceeded') && !message.includes('rate'))
  ) {
    return {
      type: GeminiErrorType.QUOTA_EXCEEDED,
      isRetryable: false, // Requires billing action
      userMessage: 'Service temporarily unavailable. Please contact support.',
      originalError: error,
      statusCode,
    };
  }

  // Content blocked by safety filters
  // Gemini's safety filters may block content generation
  if (
    message.includes('safety') ||
    message.includes('blocked') ||
    message.includes('harm') ||
    message.includes('finish_reason') ||
    message.includes('recitation') ||
    message.includes('prohibited')
  ) {
    return {
      type: GeminiErrorType.CONTENT_BLOCKED,
      isRetryable: false, // Different input needed
      userMessage: "I can't help with that request. Please rephrase your question.",
      originalError: error,
      statusCode,
    };
  }

  // Invalid request (400, INVALID_ARGUMENT)
  // Usually a developer error - needs code fix
  if (
    statusCode === 400 ||
    message.includes('invalid_argument') ||
    message.includes('invalid argument') ||
    message.includes('invalid request') ||
    message.includes('malformed') ||
    message.includes('bad request')
  ) {
    logger.error({ error, message }, 'Invalid request error - likely a bug');
    return {
      type: GeminiErrorType.INVALID_REQUEST,
      isRetryable: false, // Needs code fix
      userMessage: 'Something went wrong. Please try again.',
      originalError: error,
      statusCode,
    };
  }

  // Service unavailable (503, UNAVAILABLE)
  // Temporary issue - retry with backoff
  if (
    statusCode === 503 ||
    statusCode === 502 ||
    statusCode === 504 ||
    message.includes('unavailable') ||
    message.includes('deadline') ||
    message.includes('timeout') ||
    message.includes('internal error') ||
    message.includes('server error')
  ) {
    return {
      type: GeminiErrorType.SERVICE_UNAVAILABLE,
      isRetryable: true,
      retryAfterMs: retryAfterHint ?? 5000, // Default: 5 seconds
      userMessage: 'Our AI assistant is temporarily unavailable. Please try again.',
      originalError: error,
      statusCode,
    };
  }

  // Authentication errors (403, PERMISSION_DENIED)
  // Configuration issue - needs ops intervention
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('authentication') ||
    message.includes('credentials') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('access denied')
  ) {
    logger.error({ error, message }, 'Authentication error - check ADC configuration');
    return {
      type: GeminiErrorType.AUTHENTICATION_ERROR,
      isRetryable: false, // Needs config fix
      userMessage: 'Service configuration error. Please contact support.',
      originalError: error,
      statusCode,
    };
  }

  // Model not found (404)
  // Configuration issue - wrong model ID
  if (
    statusCode === 404 ||
    (message.includes('model') && message.includes('not found')) ||
    message.includes('unknown model') ||
    message.includes('does not exist')
  ) {
    logger.error({ error, message }, 'Model not found - check model ID configuration');
    return {
      type: GeminiErrorType.MODEL_NOT_FOUND,
      isRetryable: false, // Needs config fix
      userMessage: 'Service configuration error. Please contact support.',
      originalError: error,
      statusCode,
    };
  }

  // Unknown error - log for investigation
  logger.warn(
    { error, message, statusCode },
    'Unknown Gemini error - investigate and add classification'
  );
  return {
    type: GeminiErrorType.UNKNOWN,
    isRetryable: false, // Conservative: don't retry unknown errors
    userMessage: 'Something went wrong. Please try again.',
    originalError: error,
    statusCode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Type Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if error type requires ops alerting.
 */
export function requiresAlert(errorType: GeminiErrorType): boolean {
  return [
    GeminiErrorType.QUOTA_EXCEEDED,
    GeminiErrorType.AUTHENTICATION_ERROR,
    GeminiErrorType.MODEL_NOT_FOUND,
  ].includes(errorType);
}

/**
 * Check if error type is a temporary failure.
 */
export function isTemporaryFailure(errorType: GeminiErrorType): boolean {
  return [GeminiErrorType.RATE_LIMITED, GeminiErrorType.SERVICE_UNAVAILABLE].includes(errorType);
}

/**
 * Check if error type needs user to change their input.
 */
export function needsUserAction(errorType: GeminiErrorType): boolean {
  return [GeminiErrorType.CONTENT_BLOCKED, GeminiErrorType.CONTEXT_TOO_LONG].includes(errorType);
}
