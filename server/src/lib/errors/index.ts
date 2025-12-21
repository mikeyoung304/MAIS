/**
 * Centralized error exports
 * All error classes, utilities, and handlers available from one import
 */

// ============================================================================
// Base Errors
// ============================================================================

export {
  AppError,
  DomainError, // Legacy alias for backward compatibility
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  FileSystemError,
  NetworkError,
  TimeoutError,
  isOperationalError,
  isAppError,
  isDatabaseError,
  isExternalServiceError,
} from './base';

// ============================================================================
// HTTP Errors
// ============================================================================

export {
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  ConflictError,
  GoneError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  NotImplementedError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
} from './http';

// ============================================================================
// Business/Domain Errors
// ============================================================================

export {
  BusinessRuleError,
  BookingError,
  InvalidStateTransitionError,
  BookingAlreadyConfirmedError,
  BookingExpiredError,
  BookingConflictError,
  BookingLockTimeoutError,
  BookingAlreadyCancelledError,
  BookingCannotBeRescheduledError,
  PaymentError,
  PaymentAlreadyProcessedError,
  PaymentFailedError,
  InsufficientFundsError,
  PackageError,
  PackageNotAvailableError,
  PackageQuotaExceededError,
  InvalidBookingTypeError,
  TenantError,
  TenantNotActiveError,
  TenantQuotaExceededError,
  InvalidTenantKeyError,
  IdempotencyError,
  IdempotencyConflictError,
  AuthError,
  InvalidCredentialsError,
  TokenExpiredError,
  InvalidTokenError,
  InsufficientPermissionsError,
  WebhookValidationError,
  WebhookProcessingError,
} from './business';

// ============================================================================
// Error Handlers
// ============================================================================

export { handlePrismaError, handleStripeError, handleError, withErrorHandling } from './handlers';

// ============================================================================
// API Error Responses
// ============================================================================

export {
  type ApiErrorResponse,
  type ApiSuccessResponse,
  createApiError,
  createApiSuccess,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  internalServerError,
  fieldError,
  validateRequiredFields,
  isErrorResponse,
  isSuccessResponse,
} from './api-errors';

// Note: Error handler middleware moved to middleware/error-handler.ts
// These exports were previously in error-handler.ts but are no longer needed here

// ============================================================================
// Request Context
// ============================================================================

export {
  requestIdMiddleware,
  type ContextLogger,
  createLogger,
  getRequestLogger,
  getRequestMetadata,
  timingMiddleware,
} from './request-context';

// ============================================================================
// Sentry Integration
// ============================================================================

export {
  type SentryConfig,
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  isSentryEnabled,
  sentryRequestHandler,
  sentryErrorHandler,
} from './sentry';
