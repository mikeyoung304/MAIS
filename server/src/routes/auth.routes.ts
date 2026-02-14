/**
 * Unified Authentication Routes — Thin Aggregator
 *
 * Login/verify kept inline (small). Domain-specific routes in:
 * - auth-signup.routes.ts          (POST /signup)
 * - auth-password-reset.routes.ts  (POST /forgot-password, POST /reset-password)
 * - auth-impersonation.routes.ts   (POST /impersonate, POST /stop-impersonation)
 * - auth-early-access.routes.ts    (POST /early-access)
 *
 * Shared types in auth-shared.ts (breaks circular dependency)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { loginLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';

// Shared types & controller (from auth-shared.ts to break circular deps)
import { UnifiedAuthController } from './auth-shared';
import type { UnifiedAuthRoutesOptions } from './auth-shared';

// Re-export for external consumers (index.ts imports from here)
export type {
  UnifiedAuthRoutesOptions,
  UnifiedLoginDto,
  UnifiedLoginResponse,
} from './auth-shared';
export { UnifiedAuthController } from './auth-shared';

// Domain-specific route registrars
import { registerSignupRoutes } from './auth-signup.routes';
import { registerPasswordResetRoutes } from './auth-password-reset.routes';
import { registerImpersonationRoutes } from './auth-impersonation.routes';
import { registerEarlyAccessRoutes } from './auth-early-access.routes';

/**
 * Create unified authentication routes
 * Exports a router factory that requires both IdentityService and TenantAuthService
 */
export function createUnifiedAuthRoutes(options: UnifiedAuthRoutesOptions): Router {
  const { identityService, tenantAuthService, tenantRepo } = options;

  const router = Router();
  const controller = new UnifiedAuthController(identityService, tenantAuthService, tenantRepo);

  // ─── Login (kept here — small, uses controller directly) ───────────────────

  /**
   * POST /login
   * Unified login endpoint for both platform admins and tenant admins
   * Protected by strict rate limiting (5 attempts per 15 minutes)
   *
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "password": "password123"
   * }
   *
   * Response:
   * {
   *   "token": "eyJhbGc...",
   *   "role": "PLATFORM_ADMIN" | "TENANT_ADMIN",
   *   "email": "user@example.com",
   *   "userId": "user_123",        // Only for PLATFORM_ADMIN
   *   "tenantId": "tenant_123",    // Only for TENANT_ADMIN
   *   "slug": "tenant-slug"        // Only for TENANT_ADMIN
   * }
   */
  router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await controller.login({ email, password });

      // Log successful login
      logger.info(
        {
          event: 'unified_login_success',
          endpoint: '/v1/auth/login',
          email: result.email,
          role: result.role,
          tenantId: result.tenantId,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        `Successful ${result.role} login`
      );

      res.status(200).json(result);
    } catch (error) {
      // Log failed login attempts
      logger.warn(
        {
          event: 'unified_login_failed',
          endpoint: '/v1/auth/login',
          email: req.body.email,
          ipAddress,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed login attempt'
      );

      next(error);
    }
  });

  // ─── Verify (kept here — small, uses controller directly) ──────────────────

  /**
   * GET /verify
   * Verify token and get user information
   * Requires Authorization header with Bearer token
   *
   * Response:
   * {
   *   "role": "PLATFORM_ADMIN" | "TENANT_ADMIN",
   *   "email": "user@example.com",
   *   "userId": "user_123",        // Only for PLATFORM_ADMIN
   *   "tenantId": "tenant_123",    // Only for TENANT_ADMIN
   *   "slug": "tenant-slug"        // Only for TENANT_ADMIN
   * }
   */
  router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');

      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res
          .status(401)
          .json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' });
        return;
      }

      const token = parts[1];
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const result = await controller.verifyToken(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  // ─── Domain-specific route groups ──────────────────────────────────────────

  registerSignupRoutes(router, options);
  registerPasswordResetRoutes(router, options);
  registerImpersonationRoutes(router, controller);
  registerEarlyAccessRoutes(router, options);

  return router;
}
