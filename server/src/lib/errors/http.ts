/**
 * HTTP-specific error classes
 * Provides standard HTTP error responses with proper status codes
 */

import { AppError } from './base';

// ============================================================================
// Client Errors (4xx)
// ============================================================================

/**
 * Bad Request (400) - Request cannot be processed due to client error
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 'BAD_REQUEST', 400, true);
    this.name = 'BadRequestError';
  }
}

/**
 * Validation Error (400) - Request validation failed
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true);
    this.name = 'ValidationError';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.fieldErrors,
    };
  }
}

/**
 * Unauthorized (401) - Authentication is required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, true);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden (403) - User doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not Found (404) - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Method Not Allowed (405) - HTTP method not supported for this endpoint
 */
export class MethodNotAllowedError extends AppError {
  constructor(method: string) {
    super(`Method ${method} not allowed`, 'METHOD_NOT_ALLOWED', 405, true);
    this.name = 'MethodNotAllowedError';
  }
}

/**
 * Conflict (409) - Request conflicts with current state
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409, true);
    this.name = 'ConflictError';
  }
}

/**
 * Gone (410) - Resource is permanently unavailable
 */
export class GoneError extends AppError {
  constructor(message: string = 'Resource is gone') {
    super(message, 'GONE', 410, true);
    this.name = 'GoneError';
  }
}

/**
 * Unprocessable Entity (422) - Request is well-formed but semantically invalid
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(message, 'UNPROCESSABLE_ENTITY', 422, true);
    this.name = 'UnprocessableEntityError';
  }
}

/**
 * Too Many Requests (429) - Rate limit exceeded
 */
export class TooManyRequestsError extends AppError {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(message, 'TOO_MANY_REQUESTS', 429, true);
    this.name = 'TooManyRequestsError';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

// ============================================================================
// Server Errors (5xx)
// ============================================================================

/**
 * Internal Server Error (500) - Generic server error
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = 'Internal server error',
    public readonly originalError?: Error
  ) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, false);
    this.name = 'InternalServerError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Not Implemented (501) - Functionality not implemented
 */
export class NotImplementedError extends AppError {
  constructor(message: string = 'Not implemented') {
    super(message, 'NOT_IMPLEMENTED', 501, false);
    this.name = 'NotImplementedError';
  }
}

/**
 * Bad Gateway (502) - Invalid response from upstream server
 */
export class BadGatewayError extends AppError {
  constructor(
    message: string = 'Bad gateway',
    public readonly originalError?: Error
  ) {
    super(message, 'BAD_GATEWAY', 502, true);
    this.name = 'BadGatewayError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Service Unavailable (503) - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = 'Service unavailable',
    public readonly retryAfter?: number
  ) {
    super(message, 'SERVICE_UNAVAILABLE', 503, true);
    this.name = 'ServiceUnavailableError';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Gateway Timeout (504) - Upstream server timeout
 */
export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Gateway timeout') {
    super(message, 'GATEWAY_TIMEOUT', 504, true);
    this.name = 'GatewayTimeoutError';
  }
}
