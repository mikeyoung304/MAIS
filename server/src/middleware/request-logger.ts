/**
 * Request logging middleware with requestId
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/core/logger';

/**
 * Adds a unique requestId to each request and creates a child logger
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const reqLogger = logger.child({ requestId });

  // Store logger in res.locals for use in route handlers
  res.locals.logger = reqLogger;
  res.locals.requestId = requestId;

  // Set response header so clients can correlate errors with server logs
  res.setHeader('X-Request-ID', requestId);

  // Log request start
  reqLogger.info(
    {
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
    },
    'Request started'
  );

  // Capture response finish time
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
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
