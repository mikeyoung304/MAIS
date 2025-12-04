/**
 * Unified Authentication Routes
 * Single login endpoint that handles both platform admins and tenant admins
 * Uses role-based JWT authentication
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import type { IdentityService } from '../services/identity.service';
import type { TenantAuthService } from '../services/tenant-auth.service';
import type { TenantOnboardingService } from '../services/tenant-onboarding.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { ApiKeyService } from '../lib/api-key.service';
import { loginLimiter, signupLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { UnauthorizedError, ConflictError, ValidationError } from '../lib/errors';

/**
 * Options for creating unified auth routes
 * Uses an options object pattern to avoid parameter explosion
 */
export interface UnifiedAuthRoutesOptions {
  identityService: IdentityService;
  tenantAuthService: TenantAuthService;
  tenantRepo: PrismaTenantRepository;
  apiKeyService: ApiKeyService;
  mailProvider?: {
    sendPasswordReset: (to: string, resetToken: string, resetUrl: string) => Promise<void>;
  };
  tenantOnboardingService?: TenantOnboardingService;
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
    const payload = this.identityService.verifyToken(currentToken);
    if (!payload.userId) {
      throw new UnauthorizedError('Only platform admins can impersonate tenants');
    }

    // Get tenant details
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new UnauthorizedError('Tenant not found');
    }

    // Create new token with impersonation data
    const impersonationToken = this.identityService.createImpersonationToken({
      userId: payload.userId,
      email: payload.email,
      role: 'PLATFORM_ADMIN' as const,
      impersonating: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantEmail: tenant.email || '',
        startedAt: new Date().toISOString(),
      },
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
  const {
    identityService,
    tenantAuthService,
    tenantRepo,
    apiKeyService,
    mailProvider,
    tenantOnboardingService,
  } = options;

  const router = Router();
  const controller = new UnifiedAuthController(identityService, tenantAuthService, tenantRepo);

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

  /**
   * POST /signup
   * Self-service tenant signup
   * Creates new tenant with API keys and returns JWT token
   *
   * Request body:
   * {
   *   "email": "owner@business.com",
   *   "password": "securepass123",
   *   "businessName": "My Business"
   * }
   *
   * Response:
   * {
   *   "token": "eyJhbGc...",
   *   "tenantId": "tenant_123",
   *   "slug": "my-business-1234567890",
   *   "email": "owner@business.com",
   *   "apiKeyPublic": "pk_live_...",
   *   "secretKey": "sk_live_..." // Shown ONCE, never stored in plaintext
   * }
   */
  router.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const { email, password, businessName } = req.body;

      // Validate required fields
      if (!email || !password || !businessName) {
        throw new ValidationError('Email, password, and business name are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
      }

      // Validate password length
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
      }

      // Validate business name
      if (businessName.length < 2 || businessName.length > 100) {
        throw new ValidationError('Business name must be between 2 and 100 characters');
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check email uniqueness
      const existingTenant = await tenantRepo.findByEmail(normalizedEmail);
      if (existingTenant) {
        throw new ConflictError('Email already registered');
      }

      // Generate unique slug from business name with timestamp
      const baseSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const slug = `${baseSlug}-${Date.now()}`;

      // Check slug uniqueness (should always be unique due to timestamp, but verify)
      const existingSlug = await tenantRepo.findBySlug(slug);
      if (existingSlug) {
        throw new ConflictError('Please try again');
      }

      // Generate API keys
      const publicKey = apiKeyService.generatePublicKey(slug);
      const secretKey = apiKeyService.generateSecretKey(slug);
      const secretKeyHash = apiKeyService.hashSecretKey(secretKey);

      // Hash password
      const passwordHash = await tenantAuthService.hashPassword(password);

      // Create tenant
      const tenant = await tenantRepo.create({
        slug,
        name: businessName,
        email: normalizedEmail,
        passwordHash,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKeyHash,
        commissionPercent: 10.0,
        emailVerified: false,
      });

      // Create default segment and packages for new tenant
      // Uses TenantOnboardingService for transactional, parallel creation
      if (tenantOnboardingService) {
        try {
          await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
        } catch (defaultDataError) {
          // Don't fail signup if default data creation fails
          // The tenant can still create their own packages manually
          logger.warn(
            {
              tenantId: tenant.id,
              error: defaultDataError instanceof Error ? defaultDataError.message : 'Unknown error',
            },
            'Failed to create default segment/packages for new tenant'
          );
        }
      }

      // Generate JWT token
      const { token } = await tenantAuthService.login(normalizedEmail, password);

      // Log successful signup
      logger.info(
        {
          event: 'tenant_signup_success',
          endpoint: '/v1/auth/signup',
          tenantId: tenant.id,
          slug: tenant.slug,
          email: tenant.email,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        'New tenant signup'
      );

      res.status(201).json({
        token,
        tenantId: tenant.id,
        slug: tenant.slug,
        email: tenant.email,
        apiKeyPublic: tenant.apiKeyPublic,
        secretKey, // Shown ONCE, not stored in DB
      });
    } catch (error) {
      // Log failed signup attempts
      logger.warn(
        {
          event: 'tenant_signup_failed',
          endpoint: '/v1/auth/signup',
          email: req.body.email,
          ipAddress,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed signup attempt'
      );

      next(error);
    }
  });

  /**
   * POST /forgot-password
   * Request password reset email
   *
   * Request body:
   * {
   *   "email": "owner@business.com"
   * }
   *
   * Response:
   * {
   *   "message": "If an account exists, a reset link has been sent"
   * }
   */
  router.post(
    '/forgot-password',
    signupLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email } = req.body;

        if (!email) {
          throw new ValidationError('Email is required');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const tenant = await tenantRepo.findByEmail(normalizedEmail);

        if (tenant) {
          // Generate secure random token (32 bytes = 64 hex chars)
          const resetToken = crypto.randomBytes(32).toString('hex');

          // Hash the token before storing (SHA-256)
          const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
          const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Store hashed token in database
          await tenantRepo.update(tenant.id, {
            passwordResetToken: tokenHash,
            passwordResetExpires: expires,
          });

          // Generate reset URL for frontend
          const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

          // Send password reset email
          if (mailProvider) {
            try {
              await mailProvider.sendPasswordReset(normalizedEmail, resetToken, resetUrl);
              logger.info(
                {
                  event: 'password_reset_email_sent',
                  tenantId: tenant.id,
                  email: tenant.email,
                },
                'Password reset email sent'
              );
            } catch (emailError) {
              logger.error(
                {
                  event: 'password_reset_email_failed',
                  tenantId: tenant.id,
                  email: tenant.email,
                  error: emailError instanceof Error ? emailError.message : 'Unknown error',
                },
                'Failed to send password reset email'
              );
              // Continue - don't leak error to user
            }
          } else {
            // Development mode - log the token
            logger.info(
              {
                event: 'password_reset_requested',
                tenantId: tenant.id,
                email: tenant.email,
                resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : '[redacted]',
              },
              'Password reset requested (no mail provider configured)'
            );
          }
        }

        // Always return success (don't leak email existence)
        res.status(200).json({
          message: 'If an account exists, a reset link has been sent',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reset-password
   * Reset password with token
   *
   * Request body:
   * {
   *   "token": "reset_token_here",
   *   "password": "newSecurePassword123"
   * }
   *
   * Response:
   * {
   *   "message": "Password updated successfully"
   * }
   */
  router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        throw new ValidationError('Token and password are required');
      }

      // Validate token format (should be 64 hex characters)
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        throw new ValidationError('Invalid reset token format');
      }

      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
      }

      // Hash the token to match database storage
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find tenant by hashed reset token
      const tenant = await tenantRepo.findByResetToken(tokenHash);

      if (!tenant) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Check if token has expired
      if (!tenant.passwordResetExpires || tenant.passwordResetExpires < new Date()) {
        throw new ValidationError('Reset token has expired');
      }

      // Hash new password
      const passwordHash = await tenantAuthService.hashPassword(password);

      // Update password and clear reset token
      await tenantRepo.update(tenant.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      logger.info(
        {
          event: 'password_reset_success',
          tenantId: tenant.id,
          email: tenant.email,
        },
        'Password reset successful'
      );

      res.status(200).json({
        message: 'Password updated successfully',
      });
    } catch (error) {
      next(error);
    }
  });

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

  /**
   * POST /impersonate
   * Start impersonating a tenant (platform admin only)
   *
   * Request body:
   * {
   *   "tenantId": "tenant_123"
   * }
   *
   * Response: Same as /login with impersonation data
   */
  router.post('/impersonate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const result = await controller.startImpersonation(token, tenantId);

      logger.info(
        {
          event: 'impersonation_api_success',
          adminEmail: result.email,
          tenantId: result.tenantId,
          tenantSlug: result.slug,
        },
        'Impersonation started via API'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /stop-impersonation
   * Stop impersonating and return to normal admin token
   *
   * Response: Same as /login without impersonation data
   */
  router.post('/stop-impersonation', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const result = await controller.stopImpersonation(token);

      logger.info(
        {
          event: 'stop_impersonation_api_success',
          adminEmail: result.email,
        },
        'Impersonation stopped via API'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
