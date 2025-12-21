/**
 * Business/Domain-specific error classes
 * Represents errors specific to business logic and domain rules
 */

import { AppError } from './base';

// ============================================================================
// Business Logic Errors
// ============================================================================

/**
 * Business rule violation error
 * Use this when business logic constraints are violated
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'BUSINESS_RULE_VIOLATION', 422, true);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Booking-specific errors
 */
export class BookingError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'BOOKING_ERROR', 422, true);
    this.name = 'BookingError';
  }
}

/**
 * Invalid booking state transition
 */
export class InvalidStateTransitionError extends BookingError {
  constructor(from: string, to: string) {
    super(`Cannot transition from ${from} to ${to}`, 'INVALID_STATE_TRANSITION');
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Booking already confirmed/completed
 */
export class BookingAlreadyConfirmedError extends BookingError {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} is already confirmed`, 'BOOKING_ALREADY_CONFIRMED');
    this.name = 'BookingAlreadyConfirmedError';
  }
}

/**
 * Booking is expired
 */
export class BookingExpiredError extends BookingError {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} has expired`, 'BOOKING_EXPIRED');
    this.name = 'BookingExpiredError';
  }
}

/**
 * Booking conflict - date is already booked
 */
export class BookingConflictError extends AppError {
  constructor(date: string, message?: string) {
    super(message ?? `Date ${date} is already booked`, 'BOOKING_CONFLICT', 409, true);
    this.name = 'BookingConflictError';
  }
}

/**
 * Booking lock timeout - could not acquire lock on booking date
 */
export class BookingLockTimeoutError extends BookingError {
  constructor(date: string) {
    super(`Could not acquire lock on booking date (timeout): ${date}`, 'BOOKING_LOCK_TIMEOUT');
    this.name = 'BookingLockTimeoutError';
  }
}

/**
 * Booking already cancelled - cannot perform operation on cancelled booking
 */
export class BookingAlreadyCancelledError extends BookingError {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} is already cancelled`, 'BOOKING_ALREADY_CANCELLED');
    this.name = 'BookingAlreadyCancelledError';
  }
}

/**
 * Booking cannot be rescheduled (status or policy violation)
 */
export class BookingCannotBeRescheduledError extends BookingError {
  constructor(bookingId: string, reason: string) {
    super(`Booking ${bookingId} cannot be rescheduled: ${reason}`, 'BOOKING_CANNOT_BE_RESCHEDULED');
    this.name = 'BookingCannotBeRescheduledError';
  }
}

/**
 * Payment-specific errors
 */
export class PaymentError extends AppError {
  constructor(
    message: string,
    code?: string,
    public readonly originalError?: Error
  ) {
    super(message, code || 'PAYMENT_ERROR', 402, true);
    this.name = 'PaymentError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Payment already processed
 */
export class PaymentAlreadyProcessedError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} has already been processed`, 'PAYMENT_ALREADY_PROCESSED');
    this.name = 'PaymentAlreadyProcessedError';
  }
}

/**
 * Payment failed
 */
export class PaymentFailedError extends PaymentError {
  constructor(
    message: string,
    public readonly reason?: string
  ) {
    super(message, 'PAYMENT_FAILED');
    this.name = 'PaymentFailedError';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      reason: this.reason,
    };
  }
}

/**
 * Insufficient funds
 */
export class InsufficientFundsError extends PaymentError {
  constructor(message: string = 'Insufficient funds') {
    super(message, 'INSUFFICIENT_FUNDS');
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Catalog/Package errors
 */
export class PackageError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'PACKAGE_ERROR', 422, true);
    this.name = 'PackageError';
  }
}

/**
 * Package not available
 */
export class PackageNotAvailableError extends PackageError {
  constructor(packageId: string) {
    super(`Package ${packageId} is not available`, 'PACKAGE_NOT_AVAILABLE');
    this.name = 'PackageNotAvailableError';
  }
}

/**
 * Invalid booking type for package
 * Use when a package doesn't support the requested booking type (DATE vs TIMESLOT)
 */
export class InvalidBookingTypeError extends PackageError {
  constructor(packageTitle: string, expectedType: string) {
    super(
      `Package "${packageTitle}" does not support ${expectedType} booking type`,
      'INVALID_BOOKING_TYPE'
    );
    this.name = 'InvalidBookingTypeError';
  }
}

/**
 * Package quota exceeded
 */
export class PackageQuotaExceededError extends PackageError {
  constructor(packageId: string) {
    super(`Package ${packageId} quota has been exceeded`, 'PACKAGE_QUOTA_EXCEEDED');
    this.name = 'PackageQuotaExceededError';
  }
}

/**
 * Tenant/Multi-tenancy errors
 */
export class TenantError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'TENANT_ERROR', 422, true);
    this.name = 'TenantError';
  }
}

/**
 * Tenant not active
 */
export class TenantNotActiveError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} is not active`, 'TENANT_NOT_ACTIVE');
    this.name = 'TenantNotActiveError';
  }
}

/**
 * Tenant quota exceeded
 */
export class TenantQuotaExceededError extends TenantError {
  constructor(message: string) {
    super(message, 'TENANT_QUOTA_EXCEEDED');
    this.name = 'TenantQuotaExceededError';
  }
}

/**
 * Invalid tenant key
 */
export class InvalidTenantKeyError extends TenantError {
  constructor() {
    super('Invalid or missing tenant key', 'INVALID_TENANT_KEY');
    this.name = 'InvalidTenantKeyError';
  }
}

/**
 * Idempotency errors
 */
export class IdempotencyError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'IDEMPOTENCY_ERROR', 409, true);
    this.name = 'IdempotencyError';
  }
}

/**
 * Duplicate idempotency key with different parameters
 */
export class IdempotencyConflictError extends IdempotencyError {
  constructor(key: string) {
    super(
      `Request with idempotency key ${key} conflicts with a previous request`,
      'IDEMPOTENCY_CONFLICT'
    );
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
  constructor(message: string, code?: string, statusCode: number = 401) {
    super(message, code || 'AUTH_ERROR', statusCode, true);
    this.name = 'AuthError';
  }
}

/**
 * Invalid credentials
 */
export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS', 401);
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Token expired
 */
export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED', 401);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Invalid token
 */
export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid token') {
    super(message, 'INVALID_TOKEN', 401);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Insufficient permissions
 */
export class InsufficientPermissionsError extends AuthError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'INSUFFICIENT_PERMISSIONS', 403);
    this.name = 'InsufficientPermissionsError';
  }
}

// ============================================================================
// Webhook Errors
// ============================================================================

/**
 * Webhook validation error
 */
export class WebhookValidationError extends AppError {
  constructor(message: string) {
    super(`Webhook validation failed: ${message}`, 'WEBHOOK_VALIDATION_ERROR', 422, true);
    this.name = 'WebhookValidationError';
  }
}

/**
 * Webhook processing error
 */
export class WebhookProcessingError extends AppError {
  constructor(message: string) {
    super(`Webhook processing failed: ${message}`, 'WEBHOOK_PROCESSING_ERROR', 500, true);
    this.name = 'WebhookProcessingError';
  }
}
