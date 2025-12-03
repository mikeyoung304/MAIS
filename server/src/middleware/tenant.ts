import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/prisma';
import { apiKeyService } from '../lib/api-key.service';
import { logger } from '../lib/core/logger';

/**
 * Tenant branding configuration stored in Prisma Json field
 * Contains theme customization for embeddable widget
 */
export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logo?: string;
}

/**
 * Extended Express Request with tenant context
 * Available after resolveTenant middleware runs
 */
export interface TenantRequest extends Request {
  /** Full tenant object with all properties */
  tenant?: {
    id: string;
    slug: string;
    name: string;
    commissionPercent: number;
    branding: TenantBranding;
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
  };
  /** Shortcut for request.tenant.id (most commonly needed) */
  tenantId?: string;
}

/**
 * Middleware: Extract and validate tenant from API key in header
 *
 * USAGE:
 *   - Widget embedding: Client sends 'X-Tenant-Key: pk_live_tenant_xyz' header
 *   - All API routes requiring tenant context should use this middleware
 *   - Apply before route-specific middleware (e.g., authentication)
 *
 * SECURITY:
 *   - Validates API key format before database lookup
 *   - Checks tenant exists and is active
 *   - Prevents inactive tenants from making requests
 *   - Returns 401 for invalid/missing keys, 403 for inactive tenants
 *
 * ERROR CODES:
 *   - TENANT_KEY_REQUIRED: X-Tenant-Key header missing
 *   - INVALID_TENANT_KEY: API key format invalid or not found
 *   - TENANT_INACTIVE: Tenant exists but is disabled
 *   - TENANT_RESOLUTION_ERROR: Database error during lookup
 *
 * @example
 * // Apply to specific routes
 * router.use('/api/v1/catalog', resolveTenant, requireTenant, catalogRoutes);
 *
 * // Access in route handler
 * router.get('/packages', async (req: TenantRequest, res) => {
 *   const packages = await catalogService.getAllPackages(req.tenantId!);
 *   res.json({ packages });
 * });
 */
export function resolveTenant(prisma: PrismaClient) {
  return async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const apiKey = req.headers['x-tenant-key'] as string;

    // API key required
    if (!apiKey) {
      logger.warn({ path: req.path }, 'Request missing X-Tenant-Key header');
      res.status(401).json({
        error: 'Missing X-Tenant-Key header',
        code: 'TENANT_KEY_REQUIRED',
        hint: 'Include X-Tenant-Key header with your tenant API key',
      });
      return;
    }

    // Validate format before database lookup
    if (!apiKeyService.isValidPublicKeyFormat(apiKey)) {
      logger.warn({ apiKey, path: req.path }, 'Invalid API key format');
      res.status(401).json({
        error: 'Invalid API key format',
        code: 'INVALID_TENANT_KEY',
        hint: 'API key must be in format: pk_live_tenant_xxxx',
      });
      return;
    }

    try {
      // Lookup tenant by public API key
      const tenant = await prisma.tenant.findUnique({
        where: { apiKeyPublic: apiKey },
        select: {
          id: true,
          slug: true,
          name: true,
          commissionPercent: true,
          branding: true,
          stripeAccountId: true,
          stripeOnboarded: true,
          isActive: true,
        },
      });

      // Tenant not found
      if (!tenant) {
        logger.warn({ apiKey, path: req.path }, 'Tenant not found for API key');
        res.status(401).json({
          error: 'Invalid API key',
          code: 'TENANT_NOT_FOUND',
          hint: 'API key not recognized. Check your tenant configuration.',
        });
        return;
      }

      // Tenant disabled
      if (!tenant.isActive) {
        logger.warn(
          { tenantId: tenant.id, slug: tenant.slug, path: req.path },
          'Inactive tenant attempted request'
        );
        res.status(403).json({
          error: 'Tenant account is inactive',
          code: 'TENANT_INACTIVE',
          hint: 'Contact support to reactivate your account.',
        });
        return;
      }

      // Attach tenant to request
      req.tenant = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        commissionPercent: Number(tenant.commissionPercent),
        branding: tenant.branding as TenantBranding,
        stripeAccountId: tenant.stripeAccountId,
        stripeOnboarded: tenant.stripeOnboarded,
      };
      req.tenantId = tenant.id;

      logger.info(
        { tenantId: tenant.id, slug: tenant.slug, apiKey: apiKey.substring(0, 20) + '...', path: req.path },
        'Tenant resolved successfully'
      );

      next();
    } catch (error) {
      logger.error(
        { error, apiKey, path: req.path },
        'Error resolving tenant'
      );
      res.status(500).json({
        error: 'Failed to resolve tenant',
        code: 'TENANT_RESOLUTION_ERROR',
      });
    }
  };
}

/**
 * Middleware: Require tenant context (use after resolveTenant)
 * Returns 401 if tenant was not resolved by previous middleware
 *
 * USAGE:
 *   Apply after resolveTenant to enforce tenant requirement
 *   Useful for optional tenant on some routes, required on others
 *
 * @example
 * // Optional tenant (healthcheck, public routes)
 * router.get('/health', (req, res) => res.json({ ok: true }));
 *
 * // Required tenant (protected routes)
 * router.get('/catalog', resolveTenant, requireTenant, catalogHandler);
 */
export function requireTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant || !req.tenantId) {
    logger.warn({ path: req.path }, 'Tenant required but not resolved');
    res.status(401).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
      hint: 'This endpoint requires a valid X-Tenant-Key header',
    });
    return;
  }
  next();
}

/**
 * Middleware: Require Stripe Connect onboarding completed
 * Use after resolveTenant + requireTenant for payment endpoints
 *
 * SECURITY:
 *   - Prevents bookings before Stripe account is ready
 *   - Prevents payment processing with incomplete setup
 *
 * @example
 * router.post('/bookings', resolveTenant, requireTenant, requireStripeOnboarded, createBooking);
 */
export function requireStripeOnboarded(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant) {
    res.status(401).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
    });
    return;
  }

  if (!req.tenant.stripeOnboarded || !req.tenant.stripeAccountId) {
    logger.warn(
      { tenantId: req.tenant.id, slug: req.tenant.slug },
      'Tenant Stripe Connect not onboarded'
    );
    res.status(403).json({
      error: 'Stripe Connect onboarding not completed',
      code: 'STRIPE_NOT_ONBOARDED',
      hint: 'Complete Stripe Connect onboarding before accepting payments',
    });
    return;
  }

  next();
}

/**
 * Helper: Extract tenant ID from request (throws if missing)
 * Use in route handlers to get tenant ID with TypeScript safety
 *
 * @example
 * const packages = await catalogService.getAllPackages(getTenantId(req));
 */
export function getTenantId(req: TenantRequest): string {
  if (!req.tenantId) {
    throw new Error('Tenant ID not found in request. Did you forget resolveTenant middleware?');
  }
  return req.tenantId;
}

/**
 * Helper: Extract full tenant object from request (throws if missing)
 *
 * @example
 * const tenant = getTenant(req);
 * const commission = tenant.commissionPercent;
 */
export function getTenant(req: TenantRequest): NonNullable<TenantRequest['tenant']> {
  if (!req.tenant) {
    throw new Error('Tenant not found in request. Did you forget resolveTenant middleware?');
  }
  return req.tenant;
}
