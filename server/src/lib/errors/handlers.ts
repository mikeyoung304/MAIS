/**
 * Error handler utilities
 * Converts third-party errors to AppError instances
 */

import { AppError, DatabaseError, ExternalServiceError, NetworkError, TimeoutError } from './base';
import { ConflictError, NotFoundError, ValidationError, InternalServerError } from './http';
import { PaymentError, PaymentFailedError, InsufficientFundsError } from './business';

// Duck-typed Prisma error interface (compatible with Prisma 6+)
interface PrismaKnownError {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

// Duck-typed Stripe error interface (compatible with Stripe 19+)
interface StripeError {
  type: string;
  code?: string;
  message?: string;
  decline_code?: string;
}

// ============================================================================
// Prisma Error Handler
// ============================================================================

/**
 * Maps Prisma errors to appropriate AppError instances
 */
export function handlePrismaError(error: unknown): AppError {
  // Not a Prisma error - wrap as DatabaseError
  if (!isPrismaError(error)) {
    return new DatabaseError('Database operation failed', error as Error);
  }

  // P2002: Unique constraint violation
  if (error.code === 'P2002') {
    const fields = (error.meta?.target as string[]) || [];
    const fieldList = fields.join(', ');
    return new ConflictError(`A record with the same ${fieldList} already exists`);
  }

  // P2025: Record not found
  if (error.code === 'P2025') {
    return new NotFoundError('Record');
  }

  // P2003: Foreign key constraint violation
  if (error.code === 'P2003') {
    const field = error.meta?.field_name as string;
    return new ValidationError(`Invalid reference: ${field || 'related record'} does not exist`);
  }

  // P2014: Relation violation
  if (error.code === 'P2014') {
    return new ConflictError('Cannot delete record due to existing related records');
  }

  // P2015: Related record not found
  if (error.code === 'P2015') {
    return new NotFoundError('Related record');
  }

  // P2016: Query interpretation error
  if (error.code === 'P2016') {
    return new ValidationError('Invalid query parameters');
  }

  // P2021: Table does not exist
  if (error.code === 'P2021') {
    return new DatabaseError('Database schema error: table does not exist');
  }

  // P2022: Column does not exist
  if (error.code === 'P2022') {
    return new DatabaseError('Database schema error: column does not exist');
  }

  // P2024: Connection timeout
  if (error.code === 'P2024') {
    return new TimeoutError('Database connection timeout');
  }

  // P1001: Can't reach database server
  if (error.code === 'P1001') {
    return new DatabaseError('Cannot connect to database server');
  }

  // P1002: Database server timeout
  if (error.code === 'P1002') {
    return new TimeoutError('Database server timeout');
  }

  // P1008: Operations timed out
  if (error.code === 'P1008') {
    return new TimeoutError('Database operation timeout');
  }

  // P1017: Server closed connection
  if (error.code === 'P1017') {
    return new NetworkError('Database connection closed');
  }

  // Default: Generic database error
  return new DatabaseError(error.message || 'Database operation failed', error as unknown as Error);
}

/**
 * Type guard for Prisma errors
 */
function isPrismaError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    ((error as Record<string, unknown>).code as string).startsWith('P')
  );
}

// ============================================================================
// Stripe Error Handler
// ============================================================================

/**
 * Maps Stripe errors to appropriate AppError instances
 */
export function handleStripeError(error: unknown): AppError {
  // Not a Stripe error - wrap as ExternalServiceError
  if (!isStripeError(error)) {
    return new ExternalServiceError('Stripe', 'Payment processing failed', error as Error);
  }

  const stripeError = error as StripeError;

  // Card errors
  if (stripeError.type === 'card_error' || stripeError.type === 'StripeCardError') {
    switch (stripeError.code) {
      case 'card_declined':
        return new PaymentFailedError('Card was declined', stripeError.decline_code);

      case 'insufficient_funds':
        return new InsufficientFundsError('Insufficient funds on card');

      case 'expired_card':
        return new PaymentFailedError('Card has expired', 'expired_card');

      case 'incorrect_cvc':
        return new ValidationError('Incorrect card security code (CVC)');

      case 'processing_error':
        return new PaymentError('Payment processing error - please try again');

      case 'incorrect_number':
        return new ValidationError('Incorrect card number');

      default:
        return new PaymentFailedError(stripeError.message || 'Card error', stripeError.code);
    }
  }

  // Invalid request errors
  if (
    stripeError.type === 'invalid_request_error' ||
    stripeError.type === 'StripeInvalidRequestError'
  ) {
    return new ValidationError(stripeError.message || 'Invalid payment request');
  }

  // API errors
  if (stripeError.type === 'api_error' || stripeError.type === 'StripeAPIError') {
    return new ExternalServiceError(
      'Stripe',
      'Stripe API error - please try again',
      error as unknown as Error
    );
  }

  // Connection errors
  if (stripeError.type === 'api_connection_error' || stripeError.type === 'StripeConnectionError') {
    return new NetworkError('Unable to connect to payment processor', error as unknown as Error);
  }

  // Authentication errors
  if (
    stripeError.type === 'authentication_error' ||
    stripeError.type === 'StripeAuthenticationError'
  ) {
    return new InternalServerError('Payment configuration error', error as unknown as Error);
  }

  // Rate limit errors
  if (stripeError.type === 'rate_limit_error' || stripeError.type === 'StripeRateLimitError') {
    return new ExternalServiceError(
      'Stripe',
      'Too many payment requests - please try again later',
      error as unknown as Error
    );
  }

  // Idempotency errors
  if (stripeError.type === 'idempotency_error' || stripeError.type === 'StripeIdempotencyError') {
    return new ConflictError('Duplicate payment request detected');
  }

  // Default: Generic payment error
  return new PaymentError(
    stripeError.message || 'Payment processing error',
    stripeError.code,
    error as unknown as Error
  );
}

/**
 * Type guard for Stripe errors
 */
function isStripeError(error: unknown): error is StripeError {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return false;
  }
  const errType = (error as Record<string, unknown>).type;
  if (typeof errType !== 'string') return false;
  // Handle both old (StripeXxxError) and new (xxx_error) Stripe error types
  return errType.startsWith('Stripe') || errType.endsWith('_error');
}

// ============================================================================
// Generic Error Handler
// ============================================================================

/**
 * Converts any error to an AppError instance
 * Useful for handling errors from unknown sources
 */
export function handleError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Prisma error
  if (isPrismaError(error)) {
    return handlePrismaError(error);
  }

  // Stripe error
  if (isStripeError(error)) {
    return handleStripeError(error);
  }

  // Standard Error instance
  if (error instanceof Error) {
    return new InternalServerError(error.message, error);
  }

  // Unknown error type
  return new InternalServerError('An unexpected error occurred');
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Wraps an async function to catch and convert errors to AppError
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler: (error: unknown) => AppError = handleError
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw errorHandler(error);
    }
  }) as T;
}
