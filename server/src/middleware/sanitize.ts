/**
 * Input Sanitization Middleware
 *
 * Applies sanitization to all user input (body, query, params).
 * Defense-in-depth layer in addition to Zod validation.
 */

import type { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../lib/sanitization';
import { logger } from '../lib/core/logger';

export interface SanitizeOptions {
  /**
   * Fields that allow limited HTML (sanitized with whitelist)
   */
  allowHtml?: string[];

  /**
   * Skip sanitization (for raw body endpoints like webhooks)
   */
  skip?: boolean;
}

/**
 * Sanitize all user input in request
 *
 * @example
 * ```typescript
 * router.post('/packages', sanitizeInput(), createPackage);
 * router.post('/content', sanitizeInput({ allowHtml: ['description'] }), updateContent);
 * ```
 */
export function sanitizeInput(options: SanitizeOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (options.skip) {
      return next();
    }

    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, { allowHtml: options.allowHtml });
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      logger.error({ error, path: req.path }, 'Input sanitization error');
      next(error);
    }
  };
}

/**
 * Skip sanitization for specific routes (e.g., webhooks with raw body)
 */
export function skipSanitization() {
  return sanitizeInput({ skip: true });
}
