/**
 * Agent Evaluation Domain Errors
 *
 * Domain-specific errors for the agent evaluation system.
 * Using typed errors instead of generic Error allows:
 * 1. Proper error handling in routes
 * 2. Type-safe error checking
 * 3. Consistent error messages
 *
 * @see plans/agent-eval-remediation-plan.md Phase 2.2
 */

import { AppError } from './base';

/**
 * Trace not found error
 * Thrown when attempting to access a trace that doesn't exist
 */
export class TraceNotFoundError extends AppError {
  constructor(traceId: string) {
    super(`Trace not found: ${traceId}`, 'TRACE_NOT_FOUND', 404, true);
    this.name = 'TraceNotFoundError';
  }
}

/**
 * Tenant access denied error
 * Thrown when a tenant attempts to access a resource they don't own
 */
export class TenantAccessDeniedError extends AppError {
  constructor(resource: string = 'resource') {
    super(`Access denied to ${resource}`, 'TENANT_ACCESS_DENIED', 403, true);
    this.name = 'TenantAccessDeniedError';
  }
}

/**
 * Evaluation failed error
 * Thrown when the LLM evaluation process fails
 */
export class EvaluationFailedError extends AppError {
  constructor(
    traceId: string,
    reason: string,
    public readonly originalError?: Error
  ) {
    super(`Evaluation failed for trace ${traceId}: ${reason}`, 'EVALUATION_FAILED', 500, true);
    this.name = 'EvaluationFailedError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Invalid action type error
 * Thrown when an invalid review action type is provided
 */
export class InvalidActionTypeError extends AppError {
  constructor(action: string) {
    super(`Invalid review action type: ${action}`, 'INVALID_ACTION_TYPE', 400, true);
    this.name = 'InvalidActionTypeError';
  }
}

/**
 * Review not allowed error
 * Thrown when attempting to review a trace that's not in reviewable state
 */
export class ReviewNotAllowedError extends AppError {
  constructor(traceId: string, reason: string) {
    super(`Cannot review trace ${traceId}: ${reason}`, 'REVIEW_NOT_ALLOWED', 400, true);
    this.name = 'ReviewNotAllowedError';
  }
}

/**
 * Calibration mismatch error
 * Thrown when evaluator calibration produces unexpected results
 */
export class CalibrationMismatchError extends AppError {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
    public readonly tolerance: number
  ) {
    super(
      `Calibration mismatch: expected ${expected} ± ${tolerance}, got ${actual}`,
      'CALIBRATION_MISMATCH',
      500,
      false // Not operational - indicates system issue
    );
    this.name = 'CalibrationMismatchError';
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is TraceNotFoundError
 */
export function isTraceNotFoundError(error: unknown): error is TraceNotFoundError {
  return error instanceof TraceNotFoundError;
}

/**
 * Check if error is TenantAccessDeniedError
 */
export function isTenantAccessDeniedError(error: unknown): error is TenantAccessDeniedError {
  return error instanceof TenantAccessDeniedError;
}

/**
 * Check if error is EvaluationFailedError
 */
export function isEvaluationFailedError(error: unknown): error is EvaluationFailedError {
  return error instanceof EvaluationFailedError;
}

/**
 * Check if error is InvalidActionTypeError
 */
export function isInvalidActionTypeError(error: unknown): error is InvalidActionTypeError {
  return error instanceof InvalidActionTypeError;
}
