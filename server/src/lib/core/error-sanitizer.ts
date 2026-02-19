/**
 * Error Sanitization Utility
 *
 * Extracts only safe fields from error objects for logging.
 * Prevents sensitive data (API keys, headers, request bodies) from being logged.
 *
 * NOTE: This file uses getConfig() for NODE_ENV checks instead of process.env directly.
 *
 * @see docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md
 */

import { getConfig } from './config';

/**
 * Safe fields extracted from an error for logging
 */
export interface SanitizedError {
  message: string;
  name?: string;
  code?: string | number;
  status?: number;
  type?: string;
  // Stack traces only in development
  stack?: string;
}

/**
 * Extracts safe fields from an error for logging.
 * Removes potentially sensitive data like headers, request bodies, and stack traces.
 *
 * Fields explicitly omitted:
 * - config (may contain API keys)
 * - request (full request body, headers)
 * - response.headers (auth tokens)
 * - response.data (full response body)
 * - headers.authorization (bearer tokens)
 * - headers.x-api-key (API keys)
 *
 * @param error - Any error object (Error, object, or primitive)
 * @returns SanitizedError with only safe fields
 *
 * @example
 * ```typescript
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   logger.error({ error: sanitizeError(error), tenantId }, 'API call failed');
 * }
 * ```
 */
export function sanitizeError(error: unknown): SanitizedError {
  if (!error) {
    return { message: 'Unknown error' };
  }

  // Handle Error instances
  if (error instanceof Error) {
    const result: SanitizedError = {
      message: error.message,
      name: error.name,
    };

    // Include stack only in development
    if (getConfig().NODE_ENV === 'development' && error.stack) {
      result.stack = error.stack;
    }

    // Check for common error properties (e.g., from HTTP clients)
    const errorWithProps = error as Error & {
      code?: string | number;
      status?: number;
      statusCode?: number;
      type?: string;
    };

    if (errorWithProps.code !== undefined) {
      result.code = errorWithProps.code;
    }
    if (errorWithProps.status !== undefined) {
      result.status = errorWithProps.status;
    } else if (errorWithProps.statusCode !== undefined) {
      result.status = errorWithProps.statusCode;
    }
    if (errorWithProps.type !== undefined) {
      result.type = errorWithProps.type;
    }

    return result;
  }

  // Handle plain objects (e.g., API error responses)
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;

    const result: SanitizedError = {
      message: typeof err.message === 'string' ? err.message : String(error),
    };

    if (typeof err.name === 'string') {
      result.name = err.name;
    }
    if (typeof err.code === 'string' || typeof err.code === 'number') {
      result.code = err.code;
    }
    if (typeof err.status === 'number') {
      result.status = err.status;
    } else if (typeof err.statusCode === 'number') {
      result.status = err.statusCode;
    }
    if (typeof err.type === 'string') {
      result.type = err.type;
    }

    return result;
  }

  // Handle primitives (string, number, etc.)
  return { message: String(error) };
}
