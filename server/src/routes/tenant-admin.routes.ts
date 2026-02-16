/**
 * Tenant Admin Routes — Thin Aggregator
 *
 * Defines TenantAdminDeps and delegates to domain-specific sub-modules.
 * Authenticated routes for tenant administrators to manage their branding,
 * packages, blackouts, bookings, add-ons, uploads, trial, sections, and previews.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getTenantId } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

// Domain-specific route registrars
import { registerBrandingRoutes, TenantAdminController } from './tenant-admin-branding.routes';
import { registerBlackoutRoutes } from './tenant-admin-blackouts.routes';
import { registerBookingRoutes } from './tenant-admin-bookings.routes';
import { registerAddonRoutes } from './tenant-admin-addons.routes';
import { registerUploadRoutes } from './tenant-admin-uploads.routes';
import { registerTrialRoutes } from './tenant-admin-trial.routes';
import { registerSectionRoutes } from './tenant-admin-sections.routes';
import { registerPreviewRoutes } from './tenant-admin-preview.routes';
import { registerTierPhotoRoutes } from './tenant-admin-tier-photos.routes';

// Re-export shared types for external consumers
export type { TenantAdminDeps } from './tenant-admin-shared';
export { TenantAdminController } from './tenant-admin-branding.routes';

/**
 * Create tenant admin routes
 *
 * @param deps - Shared dependencies for all tenant-admin route sub-modules
 */
export function createTenantAdminRoutes(deps: TenantAdminDeps): Router {
  const router = Router();

  // Register all domain-specific routes
  registerBrandingRoutes(router, deps);
  registerBlackoutRoutes(router, deps);
  registerBookingRoutes(router, deps);
  registerAddonRoutes(router, deps);
  registerUploadRoutes(router, deps);
  registerTrialRoutes(router, deps);
  registerSectionRoutes(router, deps);
  registerPreviewRoutes(router, deps);
  registerTierPhotoRoutes(router, deps);

  // ============================================================================
  // Tier Listing (kept in aggregator — GET only, used for dashboard count)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/tiers
   * List all tiers for the tenant (used by dashboard for tier count)
   * Full CRUD is not needed — tier management happens through agent tools.
   */
  router.get('/tiers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tiers = await deps.catalogService.getAllTiers(tenantId);
      res.json(tiers);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Profile Endpoint (kept in aggregator — small, doesn't fit a domain)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/profile
   * Get full tenant profile for agent context
   *
   * Returns business profile including:
   * - Basic info (name, slug, email)
   * - Branding configuration
   * - Stripe Connect status
   * - Setup completion indicators
   *
   * SECURITY: Excludes sensitive fields (apiKeySecret, passwordHash, secrets, etc.)
   */
  router.get('/profile', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tenant = await deps.tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Return safe profile fields (exclude secrets, passwords, tokens)
      const profile = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        emailVerified: tenant.emailVerified,
        branding: tenant.branding,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
        stripeOnboarded: tenant.stripeOnboarded,
        stripeAccountId: tenant.stripeAccountId ? true : false, // Boolean only, not the ID
        depositPercent: tenant.depositPercent ? Number(tenant.depositPercent) : null,
        balanceDueDays: tenant.balanceDueDays,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      };

      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
