/**
 * Centralized error handling middleware
 * Enhanced with request ID support and Sentry integration
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/core/logger';
import { DomainError, AppError } from '../lib/errors';
import { captureException } from '../lib/errors/sentry';

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const requestId = res.locals.requestId;

  res.status(404).json({
    status: 'error',
    statusCode: 404,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId,
  });
}

/**
 * Centralized error handler that maps domain errors to HTTP status codes
 * Integrates with Sentry for non-operational errors
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const reqLogger = res.locals.logger || logger;
  const requestId = res.locals.requestId;

  // Map domain errors to HTTP status codes (existing DomainError from core)
  if (err instanceof DomainError) {
    reqLogger.info(
      { err: { name: err.name, message: err.message, code: err.code }, requestId },
      'Domain error'
    );

    res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      error: err.code,
      message: err.message,
      requestId,
    });
    return;
  }

  // Handle new AppError instances from error infrastructure
  if (err instanceof AppError) {
    // Log based on operational status
    if (err.isOperational) {
      reqLogger.info(
        { err: { name: err.name, message: err.message, code: err.code }, requestId },
        'Application error'
      );
    } else {
      reqLogger.error({ err, requestId }, 'Non-operational error');

      // Report non-operational errors to Sentry
      captureException(err, {
        requestId,
        url: req.url,
        method: req.method,
        userAgent: req.get('user-agent'),
      });
    }

    res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      error: err.code,
      message: err.message,
      requestId,
    });
    return;
  }

  // Map Zod validation errors to 400 Bad Request
  if (err instanceof ZodError) {
    reqLogger.info(
      { err: { name: 'ZodError', issues: err.issues }, requestId },
      'Validation error'
    );

    res.status(400).json({
      status: 'error',
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: err.issues.map((i) => i.message).join(', '),
      requestId,
    });
    return;
  }

  // Unknown errors - log full details but hide from client
  reqLogger.error({ err, requestId }, 'Unhandled error');

  // Report to Sentry
  captureException(err, {
    requestId,
    url: req.url,
    method: req.method,
    userAgent: req.get('user-agent'),
  });

  // Hide error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    status: 'error',
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: isDev ? err.message : 'An unexpected error occurred',
    requestId,
  });
}
