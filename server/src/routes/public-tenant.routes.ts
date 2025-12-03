/**
 * Public tenant lookup routes for storefront routing
 *
 * Provides public endpoint to resolve tenant by slug for customer-facing storefronts.
 * SECURITY: Only returns safe public fields - never secrets, Stripe IDs, or PII.
 *
 * TIMING ATTACK MITIGATION:
 * - Responses take minimum 100ms regardless of result (found/not found/inactive)
 * - Error messages don't distinguish between not found and inactive
 * - Prevents timing-based tenant enumeration attacks
 *
 * @example
 * GET /v1/public/tenants/little-bit-farm
 * Returns: { id, slug, name, apiKeyPublic, branding }
 */

import { Router } from 'express';
import { setTimeout } from 'timers/promises';
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
   * TIMING ATTACK MITIGATION:
   * - All responses take minimum 100ms to prevent tenant enumeration via timing
   * - Generic error message for both not found and inactive tenants
   *
   * NEVER returns: apiKeySecret, stripeAccountId, email, encryptedSecrets
   */
  router.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    const startTime = Date.now();
    const MIN_RESPONSE_TIME = 100; // ms - minimum time to prevent timing attacks

    /**
     * Ensures minimum response time to prevent timing-based enumeration
     * Call this before all response paths (success, not found, error)
     */
    const ensureMinResponseTime = async (): Promise<void> => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await setTimeout(MIN_RESPONSE_TIME - elapsed);
      }
    };

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

      // Ensure minimum response time regardless of result
      await ensureMinResponseTime();

      if (!tenant) {
        logger.info({ slug }, 'Tenant not available for public lookup');
        // Generic error message doesn't distinguish between not found and inactive
        // Prevents information disclosure about tenant status
        return res.status(404).json({
          error: 'Tenant not available',
        });
      }

      logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Public tenant lookup');

      return res.status(200).json(tenant);
    } catch (error) {
      // Ensure minimum response time even on error
      await ensureMinResponseTime();
      logger.error({ error, slug }, 'Error fetching public tenant');
      return res.status(500).json({
        error: 'Failed to fetch tenant',
      });
    }
  });

  return router;
}
