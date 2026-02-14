/**
 * Unified Authentication Routes
 * Single login endpoint that handles both platform admins and tenant admins
 * Uses role-based JWT authentication
 *
 * This file is the thin aggregator. Domain-specific routes are in:
 * - auth-signup.routes.ts          (POST /signup)
 * - auth-password-reset.routes.ts  (POST /forgot-password, POST /reset-password)
 * - auth-impersonation.routes.ts   (POST /impersonate, POST /stop-impersonation)
 * - auth-early-access.routes.ts    (POST /early-access)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { IdentityService } from '../services/identity.service';
import type { TenantAuthService } from '../services/tenant-auth.service';
import type { TenantProvisioningService } from '../services/tenant-provisioning.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { EarlyAccessRepository } from '../lib/ports';
import { loginLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { UnauthorizedError } from '../lib/errors';

// Domain-specific route registrars
import { registerSignupRoutes } from './auth-signup.routes';
import { registerPasswordResetRoutes } from './auth-password-reset.routes';
import { registerImpersonationRoutes } from './auth-impersonation.routes';
import { registerEarlyAccessRoutes } from './auth-early-access.routes';

/**
 * Options for creating unified auth routes
 * Uses an options object pattern to avoid parameter explosion
 */
export interface UnifiedAuthRoutesOptions {
  identityService: IdentityService;
  tenantAuthService: TenantAuthService;
  tenantRepo: PrismaTenantRepository;
  config: {
    earlyAccessNotificationEmail?: string;
    adminNotificationEmail?: string;
  };
  mailProvider?: {
    sendPasswordReset: (to: string, resetToken: string, resetUrl: string) => Promise<void>;
    sendEmail: (input: { to: string; subject: string; html: string }) => Promise<void>;
  };
  /** Atomic tenant provisioning service for signup (creates tenant + segment + packages in transaction) */
  tenantProvisioningService?: TenantProvisioningService;
  earlyAccessRepo?: EarlyAccessRepository;
}

/**
 * Unified login DTO
 */
export interface UnifiedLoginDto {
  email: string;
  password: string;
}

/**
 * Unified login response
 * Role indicates user type, tenantId present for tenant admins
 */
export interface UnifiedLoginResponse {
  token: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId?: string;
  email: string;
  userId?: string; // Platform admin ID
  slug?: string; // Tenant slug
  apiKeyPublic?: string; // Tenant public API key (for impersonation)
  impersonation?: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string;
  };
}

/**
 * Controller for unified authentication operations
 */
export class UnifiedAuthController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly tenantAuthService: TenantAuthService,
    private readonly tenantRepo: PrismaTenantRepository
  ) {}

  /**
   * Unified login endpoint
   * Attempts tenant login first, then falls back to platform admin login
   *
   * @param input - Login credentials (email, password)
   * @returns JWT token with role information
   */
  async login(input: UnifiedLoginDto): Promise<UnifiedLoginResponse> {
    const { email, password } = input;

    // First, try tenant admin login
    try {
      const tenant = await this.tenantRepo.findByEmail(email);

      if (tenant && tenant.passwordHash) {
        // Tenant exists with password - attempt tenant login
        const result = await this.tenantAuthService.login(email, password);

        return {
          token: result.token,
          role: 'TENANT_ADMIN',
          tenantId: tenant.id,
          email: tenant.email!,
          slug: tenant.slug,
        };
      }
    } catch (error) {
      // Tenant login failed - will try platform admin next
      logger.debug({ email, error }, 'Tenant login attempt failed, trying platform admin');
    }

    // If tenant login didn't succeed, try platform admin login
    try {
      const result = await this.identityService.login(email, password);
      const payload = this.identityService.verifyToken(result.token);

      return {
        token: result.token,
        role: 'PLATFORM_ADMIN',
        email: payload.email,
        userId: payload.userId,
      };
    } catch (error) {
      // Both login attempts failed
      throw new UnauthorizedError('Invalid credentials');
    }
  }

  /**
   * Verify token and get user information
   * Works for both platform admin and tenant admin tokens
   *
   * @param token - JWT token to verify
   * @returns User information with role
   */
  async verifyToken(token: string): Promise<{
    role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
    email: string;
    userId?: string;
    tenantId?: string;
    slug?: string;
  }> {
    // Try to verify as tenant token first
    try {
      const payload = this.tenantAuthService.verifyToken(token);
      return {
        role: 'TENANT_ADMIN',
        email: payload.email,
        tenantId: payload.tenantId,
        slug: payload.slug,
      };
    } catch {
      // Not a tenant token, try platform admin
      try {
        const payload = this.identityService.verifyToken(token);
        return {
          role: 'PLATFORM_ADMIN',
          email: payload.email,
          userId: payload.userId,
        };
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }
    }
  }

  /**
   * Start impersonating a tenant
   * Platform admin only - creates a new JWT with impersonation data
   *
   * @param currentToken - Current platform admin JWT
   * @param tenantId - Tenant ID to impersonate
   * @returns New JWT token with impersonation data
   */
  async startImpersonation(currentToken: string, tenantId: string): Promise<UnifiedLoginResponse> {
    // Verify caller is platform admin
    const payload = this.identityService.verifyToken(currentToken) as {
      userId?: string;
      email: string;
      impersonating?: { tenantId: string };
    };
    if (!payload.userId) {
      throw new UnauthorizedError('Only platform admins can impersonate tenants');
    }

    // Prevent nested impersonation (security: avoid impersonation chains)
    if (payload.impersonating) {
      throw new UnauthorizedError(
        'Cannot impersonate while already impersonating. Exit current impersonation first.'
      );
    }

    // Get tenant details
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new UnauthorizedError('Tenant not found');
    }

    // Build impersonation data (used in both token and response)
    const impersonationData = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantEmail: tenant.email || '',
      startedAt: new Date().toISOString(),
    };

    // Create new token with impersonation data
    const impersonationToken = this.identityService.createImpersonationToken({
      userId: payload.userId,
      email: payload.email,
      role: 'PLATFORM_ADMIN' as const,
      impersonating: impersonationData,
    });

    logger.info(
      {
        event: 'impersonation_started',
        adminEmail: payload.email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
      `Platform admin ${payload.email} started impersonating tenant ${tenant.slug}`
    );

    return {
      token: impersonationToken,
      role: 'PLATFORM_ADMIN',
      email: payload.email,
      userId: payload.userId,
      tenantId: tenant.id,
      slug: tenant.slug,
      apiKeyPublic: tenant.apiKeyPublic,
      impersonation: impersonationData,
    };
  }

  /**
   * Stop impersonating a tenant
   * Returns to normal platform admin token
   *
   * @param impersonationToken - Current impersonation JWT
   * @returns Normal platform admin JWT token
   */
  async stopImpersonation(impersonationToken: string): Promise<UnifiedLoginResponse> {
    // Verify it's an impersonation token
    const payload = this.identityService.verifyToken(impersonationToken);
    if (!payload.userId) {
      throw new UnauthorizedError('Invalid impersonation token');
    }

    // Create normal admin token (without impersonation)
    const normalToken = this.identityService.createToken({
      userId: payload.userId,
      email: payload.email,
      role: 'PLATFORM_ADMIN' as const,
    });

    logger.info(
      {
        event: 'impersonation_stopped',
        adminEmail: payload.email,
      },
      `Platform admin ${payload.email} stopped impersonation`
    );

    return {
      token: normalToken,
      role: 'PLATFORM_ADMIN',
      email: payload.email,
      userId: payload.userId,
    };
  }
}

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
