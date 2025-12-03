/**
 * Centralized error handler for public routes
 *
 * Handles common error patterns in public booking management and payment routes
 * to eliminate duplication and ensure consistent error responses.
 */

import type { Response } from 'express';
import { logger } from './core/logger';
import {
  NotFoundError,
  BookingConflictError,
  BookingAlreadyCancelledError,
  BookingCannotBeRescheduledError,
  TokenExpiredError,
  InvalidTokenError,
} from './errors';

/**
 * Standard error response structure for public routes
 */
interface ErrorResponse {
  status: 'error';
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Centralized error handler for public routes
 * Maps domain errors and legacy string-based errors to proper HTTP responses
 *
 * @param error - The error to handle
 * @param res - Express response object
 * @param operation - Operation name for logging (e.g., 'get booking details', 'reschedule booking')
 */
export function handlePublicRouteError(
  error: Error,
  res: Response,
  operation: string
): Response<ErrorResponse> {
  logger.error({ error: error.message }, `Failed to ${operation}`);

  // Token validation errors
  if (error instanceof TokenExpiredError) {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      error: 'TOKEN_EXPIRED',
      message: 'Your link has expired. Please request a new one.',
    });
  }

  if (error instanceof InvalidTokenError || error.message.includes('Token validation failed')) {
    // Handle both proper InvalidTokenError and legacy string-based errors
    if (error.message.includes('expired')) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        error: 'TOKEN_EXPIRED',
        message: 'Your link has expired. Please request a new one.',
      });
    }
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      error: 'INVALID_TOKEN',
      message: 'Invalid access link. Please request a new one.',
    });
  }

  // Booking-specific errors
  if (error instanceof BookingConflictError) {
    return res.status(409).json({
      status: 'error',
      statusCode: 409,
      error: 'BOOKING_CONFLICT',
      message: error.message,
    });
  }

  if (error instanceof BookingAlreadyCancelledError) {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      error: 'BOOKING_ALREADY_CANCELLED',
      message: error.message,
    });
  }

  if (error instanceof BookingCannotBeRescheduledError) {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      error: 'BOOKING_CANNOT_BE_RESCHEDULED',
      message: error.message,
    });
  }

  // Balance payment errors (legacy string-based errors)
  if (error.message.includes('does not have a deposit paid')) {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      error: 'NO_DEPOSIT_PAID',
      message: 'This booking does not have a deposit paid',
    });
  }

  if (error.message.includes('Balance has already been paid')) {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      error: 'BALANCE_ALREADY_PAID',
      message: 'Balance has already been paid for this booking',
    });
  }

  if (error.message.includes('No balance due')) {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      error: 'NO_BALANCE_DUE',
      message: 'No balance is due for this booking',
    });
  }

  // Resource not found
  // P1-172 FIX: Return generic message to prevent tenant ID disclosure
  if (error instanceof NotFoundError) {
    return res.status(404).json({
      status: 'error',
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'The requested resource was not found',
    });
  }

  // Default internal server error
  return res.status(500).json({
    status: 'error',
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: `Failed to ${operation}`,
  });
}
