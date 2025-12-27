/**
 * Tenant Authentication Routes
 * Handles tenant admin login endpoints
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TenantAuthService } from '../services/tenant-auth.service';
import { loginLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { createTenantAuthMiddleware } from '../middleware/tenant-auth';

/**
 * Tenant login DTO
 */
export interface TenantLoginDto {
  email: string;
  password: string;
}

/**
 * Controller for tenant authentication operations
 */
export class TenantAuthController {
  constructor(private readonly tenantAuthService: TenantAuthService) {}

  /**
   * Tenant admin login
   * Authenticates tenant and returns JWT token
   *
   * @param input - Login credentials (email, password)
   * @returns JWT token for tenant authentication
   */
  async login(input: TenantLoginDto): Promise<{ token: string }> {
    return this.tenantAuthService.login(input.email, input.password);
  }

  /**
   * Get current tenant info from token
   * Useful for verifying token and getting tenant context
   *
   * @param tenantId - Tenant ID from JWT token (res.locals.tenantAuth)
   * @param slug - Tenant slug from JWT token
   * @param email - Tenant email from JWT token
   * @returns Tenant information
   */
  async getCurrentTenant(
    tenantId: string,
    slug: string,
    email: string
  ): Promise<{
    tenantId: string;
    slug: string;
    email: string;
  }> {
    return { tenantId, slug, email };
  }
}

/**
 * Create tenant authentication routes
 * Exports a router factory that requires TenantAuthService
 */
export function createTenantAuthRoutes(tenantAuthService: TenantAuthService): Router {
  const router = Router();
  const controller = new TenantAuthController(tenantAuthService);
  const tenantAuthMiddleware = createTenantAuthMiddleware(tenantAuthService);

  /**
   * POST /login
   * Authenticate tenant and receive JWT token (public endpoint)
   * Protected by strict rate limiting (5 attempts per 15 minutes)
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
      res.status(200).json(result);
    } catch (error) {
      // Log failed login attempts
      logger.warn(
        {
          event: 'tenant_login_failed',
          endpoint: '/v1/tenant-auth/login',
          email: req.body.email,
          ipAddress,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed tenant login attempt'
      );
      next(error);
    }
  });

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

        const result = await controller.getCurrentTenant(
          tenantAuth.tenantId,
          tenantAuth.slug,
          tenantAuth.email
        );
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
