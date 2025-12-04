/**
 * Request context utilities
 * Provides request ID middleware and context-aware logging
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger, type Logger } from '../core/logger';

// ============================================================================
// Request ID Middleware
// ============================================================================

/**
 * Adds a unique request ID to each request and response
 * This extends the existing requestLogger middleware with X-Request-ID header
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();

  // Set response header for client tracking
  res.setHeader('X-Request-ID', requestId);

  // Store in res.locals for access in handlers
  res.locals.requestId = requestId;

  next();
}

// ============================================================================
// Context Logger
// ============================================================================

export interface ContextLogger {
  info: (message: string, meta?: any) => void;
  error: (message: string, error?: Error, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

/**
 * Creates a context-aware logger with request ID
 */
export function createLogger(requestId: string): ContextLogger {
  const childLogger = logger.child({ requestId });

  return {
    info: (message: string, meta?: any) => {
      childLogger.info(meta || {}, message);
    },

    error: (message: string, error?: Error, meta?: any) => {
      childLogger.error(
        {
          ...meta,
          error: error?.message,
          stack: error?.stack,
          name: error?.name,
        },
        message
      );
    },

    warn: (message: string, meta?: any) => {
      childLogger.warn(meta || {}, message);
    },

    debug: (message: string, meta?: any) => {
      childLogger.debug(meta || {}, message);
    },
  };
}

/**
 * Gets the logger from res.locals or creates a new one with request ID
 */
export function getRequestLogger(res: Response): ContextLogger {
  if (res.locals.logger) {
    return createLoggerFromPino(res.locals.logger, res.locals.requestId);
  }

  const requestId = res.locals.requestId || randomUUID();
  return createLogger(requestId);
}

/**
 * Converts a Pino logger to ContextLogger interface
 */
function createLoggerFromPino(pinoLogger: Logger, requestId: string): ContextLogger {
  return {
    info: (message: string, meta?: any) => {
      pinoLogger.info(meta || {}, message);
    },

    error: (message: string, error?: Error, meta?: any) => {
      pinoLogger.error(
        {
          ...meta,
          error: error?.message,
          stack: error?.stack,
          name: error?.name,
        },
        message
      );
    },

    warn: (message: string, meta?: any) => {
      pinoLogger.warn(meta || {}, message);
    },

    debug: (message: string, meta?: any) => {
      pinoLogger.debug(meta || {}, message);
    },
  };
}

// ============================================================================
// Request Context Utilities
// ============================================================================

/**
 * Extracts request metadata for logging
 */
export function getRequestMetadata(req: Request): Record<string, any> {
  return {
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    query: req.query,
  };
}

/**
 * Timing middleware to track request duration
 */
export function timingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.locals.duration = duration;

    const reqLogger = res.locals.logger || logger;
    reqLogger.info(
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
      },
      'Request completed'
    );
  });

  next();
}
