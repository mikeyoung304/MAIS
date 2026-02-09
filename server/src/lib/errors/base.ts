/**
 * Base error classes for the application
 * Provides a comprehensive error hierarchy with proper inheritance
 */

// ============================================================================
// Base Application Error
// ============================================================================

/**
 * Base application error class
 * All custom errors should extend from this class or its descendants
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Legacy alias for AppError (for backward compatibility)
 * @deprecated Use AppError instead
 */
export class DomainError extends AppError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode, true);
    this.name = 'DomainError';
  }
}

// ============================================================================
// Infrastructure Errors
// ============================================================================

/**
 * Database error - for issues with database operations
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, 'DATABASE_ERROR', 500, false);
    this.name = 'DatabaseError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * External service error - for issues with third-party services
 */
export class ExternalServiceError extends AppError {
  constructor(
    public readonly service: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 503, true);
    this.name = 'ExternalServiceError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Configuration error - for missing or invalid configuration
 */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500, false);
    this.name = 'ConfigurationError';
  }
}

/**
 * File system error - for issues with file operations
 */
export class FileSystemError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, 'FILESYSTEM_ERROR', 500, true);
    this.name = 'FileSystemError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

// ============================================================================
// Network/Communication Errors
// ============================================================================

/**
 * Network error - for network-related issues
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, 'NETWORK_ERROR', 503, true);
    this.name = 'NetworkError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Timeout error - for operations that exceed time limits
 */
export class TimeoutError extends AppError {
  constructor(
    message: string,
    public readonly timeoutMs?: number
  ) {
    super(message, 'TIMEOUT_ERROR', 504, true);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Checks if an error is operational (safe to show to users)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Checks if an error is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Checks if an error is a DatabaseError instance
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Checks if an error is an ExternalServiceError instance
 */
export function isExternalServiceError(error: unknown): error is ExternalServiceError {
  return error instanceof ExternalServiceError;
}
