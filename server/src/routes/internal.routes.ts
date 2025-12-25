/**
 * Internal Routes
 *
 * Protected endpoints for internal service-to-service communication.
 * These endpoints are secured with a shared secret and should not be
 * exposed to the public internet.
 *
 * Endpoints:
 * - POST /v1/internal/revalidate - Trigger ISR revalidation for tenant pages
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../lib/core/logger';

// Validation schema for revalidation request
const revalidateSchema = z.object({
  tenantSlug: z.string().min(1, 'tenantSlug is required'),
  paths: z
    .array(z.string())
    .optional()
    .default([]),
});

/**
 * Create internal routes
 *
 * @param config - Configuration with INTERNAL_API_SECRET
 * @returns Express router with internal endpoints
 */
export function createInternalRoutes(config: { internalApiSecret?: string }): Router {
  const router = Router();

  /**
   * Middleware to verify internal API secret
   * Prevents unauthorized access to internal endpoints
   */
  const verifyInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const expectedSecret = config.internalApiSecret;

    // If no secret configured, reject all requests (fail-safe)
    if (!expectedSecret) {
      logger.warn('Internal API secret not configured - rejecting request');
      res.status(503).json({
        error: 'Internal API not configured',
      });
      return;
    }

    // Verify Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing or invalid Authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(token, expectedSecret)) {
      logger.warn({ ip: req.ip }, 'Invalid internal API secret');
      res.status(403).json({
        error: 'Invalid API secret',
      });
      return;
    }

    next();
  };

  /**
   * POST /v1/internal/revalidate
   *
   * Triggers ISR revalidation for tenant pages on the Next.js frontend.
   * Called after tenant saves landingPageConfig, branding, or packages.
   *
   * Request body:
   * {
   *   tenantSlug: string,    // Required: tenant slug to revalidate
   *   paths?: string[]       // Optional: specific paths (default: all tenant pages)
   * }
   *
   * Headers:
   * - Authorization: Bearer <INTERNAL_API_SECRET>
   *
   * @returns 200 - Revalidation triggered successfully
   * @returns 400 - Invalid request body
   * @returns 401 - Missing authorization
   * @returns 403 - Invalid API secret
   * @returns 503 - Internal API not configured or Next.js unreachable
   */
  router.post('/revalidate', verifyInternalSecret, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const { tenantSlug, paths } = revalidateSchema.parse(req.body);

      // Default paths to revalidate for a tenant
      const defaultPaths = [
        `/t/${tenantSlug}`, // Landing page
        `/t/${tenantSlug}/book`, // Booking page
      ];

      const pathsToRevalidate = paths.length > 0 ? paths : defaultPaths;

      // Get Next.js app URL from environment
      const nextjsUrl = process.env.NEXTJS_APP_URL || 'http://localhost:3000';
      const revalidateSecret = process.env.NEXTJS_REVALIDATE_SECRET;

      if (!revalidateSecret) {
        logger.warn('NEXTJS_REVALIDATE_SECRET not configured');
        res.status(503).json({
          error: 'Revalidation not configured',
          message: 'NEXTJS_REVALIDATE_SECRET environment variable not set',
        });
        return;
      }

      // Call Next.js revalidation API for each path
      const results: { path: string; success: boolean; error?: string }[] = [];

      for (const path of pathsToRevalidate) {
        try {
          const revalidateUrl = new URL('/api/revalidate', nextjsUrl);
          revalidateUrl.searchParams.set('path', path);
          revalidateUrl.searchParams.set('secret', revalidateSecret);

          const response = await fetch(revalidateUrl.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            results.push({ path, success: true });
            logger.info({ tenantSlug, path }, 'ISR revalidation triggered');
          } else {
            const errorText = await response.text();
            results.push({ path, success: false, error: errorText });
            logger.warn({ tenantSlug, path, error: errorText }, 'ISR revalidation failed');
          }
        } catch (err: any) {
          results.push({ path, success: false, error: err.message });
          logger.error({ tenantSlug, path, error: err }, 'ISR revalidation error');
        }
      }

      const allSuccess = results.every((r) => r.success);

      res.status(allSuccess ? 200 : 207).json({
        success: allSuccess,
        tenantSlug,
        results,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }

      logger.error({ error }, 'Internal revalidate error');
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  return router;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
