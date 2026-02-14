/**
 * Tenant Authentication Routes
 *
 * Login is handled by the unified /v1/auth routes (auth.routes.ts).
 * This file only provides the /me endpoint for token verification.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TenantAuthService } from '../services/tenant-auth.service';
import { createTenantAuthMiddleware } from '../middleware/tenant-auth';

/**
 * Create tenant authentication routes
 * Exports a router factory that requires TenantAuthService
 */
export function createTenantAuthRoutes(tenantAuthService: TenantAuthService): Router {
  const router = Router();
  const tenantAuthMiddleware = createTenantAuthMiddleware(tenantAuthService);

  /**
   * GET /me
   * Get current tenant info (requires authentication)
   * Protected by tenantAuthMiddleware which validates JWT and sets res.locals.tenantAuth
   */
  router.get(
    '/me',
    tenantAuthMiddleware,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = (res.locals as any).tenantAuth;

        // Middleware guarantees tenantAuth exists, but check for safety
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        res.status(200).json({
          tenantId: tenantAuth.tenantId,
          slug: tenantAuth.slug,
          email: tenantAuth.email,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
