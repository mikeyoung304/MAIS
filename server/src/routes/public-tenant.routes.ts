/**
 * Public tenant lookup routes for storefront routing
 *
 * Provides public endpoint to resolve tenant by slug for customer-facing storefronts.
 * SECURITY: Only returns safe public fields - never secrets, Stripe IDs, or PII.
 *
 * @example
 * GET /v1/public/tenants/little-bit-farm
 * Returns: { id, slug, name, apiKeyPublic, branding }
 */

import { Router } from 'express';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { logger } from '../lib/core/logger';

/**
 * Create public tenant routes
 * Uses repository pattern for DI and testability
 *
 * @param tenantRepository - Repository for tenant data access
 */
export function createPublicTenantRoutes(tenantRepository: PrismaTenantRepository): Router {
  const router = Router();

  /**
   * GET /v1/public/tenants/:slug
   * Get public tenant info by slug (for storefront routing)
   *
   * SECURITY: Only returns allowlisted fields:
   * - id, slug, name - Public identifiers
   * - apiKeyPublic - Read-only API key for X-Tenant-Key header
   * - branding - Visual customization only (validated)
   *
   * NEVER returns: apiKeySecret, stripeAccountId, email, encryptedSecrets
   */
  router.get('/:slug', async (req, res) => {
    const { slug } = req.params;

    // Slug format validation (matches contract validation)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || slug.length === 0 || slug.length > 63 || !slugRegex.test(slug)) {
      return res.status(400).json({
        error: 'Invalid slug format: must be lowercase alphanumeric with hyphens, 1-63 characters',
      });
    }

    try {
      // Use repository method with Zod-validated branding (safeParse with graceful degradation)
      const tenant = await tenantRepository.findBySlugPublic(slug);

      if (!tenant) {
        logger.info({ slug }, 'Tenant not found for public lookup');
        return res.status(404).json({
          error: 'Tenant not found',
        });
      }

      logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Public tenant lookup');

      return res.status(200).json(tenant);
    } catch (error) {
      logger.error({ error, slug }, 'Error fetching public tenant');
      return res.status(500).json({
        error: 'Failed to fetch tenant',
      });
    }
  });

  return router;
}
