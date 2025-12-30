/**
 * Agent Error Classes
 *
 * Structured error types for the agent system.
 * Provides user-friendly messages for chatbot responses while preserving
 * technical details for logging and debugging.
 *
 * Design principles:
 * 1. User-facing message should be non-technical
 * 2. Technical details in error.cause or logged
 * 3. Consistent format: "Unable to [action]: [reason]"
 * 4. Error codes for programmatic handling and localization
 */

import { logger } from '../../lib/core/logger';

/**
 * Error codes for agent operations
 * Organized by category for easier maintenance
 */
export const AgentErrorCode = {
  // Validation errors (1xx)
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_EMAIL: 'INVALID_EMAIL',

  // Resource errors (2xx)
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_INACTIVE: 'RESOURCE_INACTIVE',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',

  // Availability errors (3xx)
  DATE_UNAVAILABLE: 'DATE_UNAVAILABLE',
  DATE_BLOCKED: 'DATE_BLOCKED',
  DATE_IN_PAST: 'DATE_IN_PAST',
  ALREADY_BOOKED: 'ALREADY_BOOKED',

  // State errors (4xx)
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  ALREADY_REFUNDED: 'ALREADY_REFUNDED',
  INVALID_STATE: 'INVALID_STATE',

  // System errors (5xx)
  TOOL_UNKNOWN: 'TOOL_UNKNOWN',
  API_ERROR: 'API_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
} as const;

export type AgentErrorCodeType = (typeof AgentErrorCode)[keyof typeof AgentErrorCode];

/**
 * Base class for all agent errors
 * Provides user-friendly messages while preserving technical context
 */
export class AgentError extends Error {
  /**
   * @param code - Error code for programmatic handling
   * @param userMessage - User-friendly message to show in chatbot
   * @param details - Optional technical details for logging
   * @param cause - Optional underlying error
   */
  constructor(
    public readonly code: AgentErrorCodeType,
    public readonly userMessage: string,
    public readonly details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(userMessage);
    this.name = 'AgentError';
    this.cause = cause;

    // Log error with full context for debugging
    logger.debug({ code, userMessage, details, cause: cause?.message }, 'AgentError created');
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: this.userMessage,
      code: this.code,
    };
  }
}

/**
 * Error for missing required fields
 */
export class MissingFieldError extends AgentError {
  constructor(fieldName: string, resourceType: string, details?: Record<string, unknown>) {
    super(
      AgentErrorCode.MISSING_FIELD,
      `Unable to create ${resourceType}: ${fieldName} is required.`,
      { field: fieldName, resourceType, ...details }
    );
    this.name = 'MissingFieldError';
  }
}

/**
 * Error for resource not found (with tenant isolation context)
 */
export class ResourceNotFoundError extends AgentError {
  constructor(
    resourceType: string,
    resourceId: string,
    suggestion?: string,
    details?: Record<string, unknown>
  ) {
    const message = suggestion
      ? `Unable to find ${resourceType}: it may not exist or you may not have access. ${suggestion}`
      : `Unable to find ${resourceType}: it may not exist or you may not have access.`;

    super(AgentErrorCode.NOT_FOUND, message, { resourceType, resourceId, ...details });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Error for date availability issues
 */
export class DateUnavailableError extends AgentError {
  constructor(
    date: string,
    reason: 'booked' | 'blocked' | 'past',
    suggestion?: string,
    details?: Record<string, unknown>
  ) {
    const reasonMessages = {
      booked:
        'This date is already booked. Please try a different date or use check_availability to find open dates.',
      blocked:
        'This date is not available for bookings. Please try a different date or use check_availability to find open dates.',
      past: 'Unable to book a date in the past. Please choose an upcoming date.',
    };

    const message = suggestion || reasonMessages[reason];

    const codeMap = {
      booked: AgentErrorCode.ALREADY_BOOKED,
      blocked: AgentErrorCode.DATE_BLOCKED,
      past: AgentErrorCode.DATE_IN_PAST,
    } as const;

    super(codeMap[reason], message, { date, reason, ...details });
    this.name = 'DateUnavailableError';
  }
}

/**
 * Error for invalid state transitions (already cancelled, already refunded, etc.)
 */
export class InvalidStateError extends AgentError {
  constructor(
    resourceType: string,
    currentState: string,
    attemptedAction: string,
    details?: Record<string, unknown>
  ) {
    const message = `Unable to ${attemptedAction}: this ${resourceType} is already ${currentState.toLowerCase()}.`;

    super(AgentErrorCode.INVALID_STATE, message, {
      resourceType,
      currentState,
      attemptedAction,
      ...details,
    });
    this.name = 'InvalidStateError';
  }
}

/**
 * Error for unknown tools
 */
export class UnknownToolError extends AgentError {
  constructor(toolName: string) {
    super(
      AgentErrorCode.TOOL_UNKNOWN,
      "I don't recognize that action. Please try a different request.",
      { toolName }
    );
    this.name = 'UnknownToolError';
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends AgentError {
  constructor(feature: string, suggestion?: string, details?: Record<string, unknown>) {
    const message = suggestion
      ? `${feature} is not available right now. ${suggestion}`
      : `${feature} is not available right now. Please contact support for assistance.`;

    super(AgentErrorCode.CONFIGURATION_ERROR, message, { feature, ...details });
    this.name = 'ConfigurationError';
  }
}

/**
 * Error for API failures
 */
export class ApiError extends AgentError {
  constructor(action: string, cause?: Error) {
    super(
      AgentErrorCode.API_ERROR,
      `Unable to ${action}. Please try again in a moment.`,
      undefined,
      cause
    );
    this.name = 'ApiError';
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(AgentErrorCode.INVALID_FORMAT, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Helper to convert unknown errors to user-friendly messages
 */
export function toUserFriendlyError(error: unknown, action: string): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message, action }, 'Unexpected error in agent operation');

  return new AgentError(
    AgentErrorCode.UNEXPECTED_ERROR,
    `Unable to ${action}. Please try again or contact support if the problem persists.`,
    { originalError: message },
    error instanceof Error ? error : undefined
  );
}

/**
 * Standard user-friendly error messages for common scenarios
 * These can be used directly in error responses
 */
export const ErrorMessages = {
  // Services
  LOAD_SERVICES: 'Unable to load services. Please try again.',
  SERVICE_NOT_FOUND: 'Unable to find this service. It may no longer be available.',
  SERVICE_UNAVAILABLE: 'This service is currently unavailable.',

  // Availability
  CHECK_AVAILABILITY: 'Unable to check availability. Please try again.',
  DATE_UNAVAILABLE: 'This date is not available. Please choose another date.',

  // Booking
  CREATE_BOOKING: 'Unable to complete your booking. Please try again.',
  BOOKING_NOT_FOUND: 'Unable to find this booking. Please verify the booking details.',

  // Business info
  BUSINESS_INFO: 'Unable to load business information. Please try again.',

  // General
  TRY_AGAIN: 'Something went wrong. Please try again.',
  CONTACT_SUPPORT: 'Please contact support for assistance.',
} as const;
