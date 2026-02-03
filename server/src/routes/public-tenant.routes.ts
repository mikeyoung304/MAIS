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
import { validatePreviewToken } from '../lib/preview-tokens';
import type { TenantPublicDto as _TenantPublicDto } from '@macon/contracts';
import type { SectionContentService } from '../services/section-content.service';

/**
 * Dependencies for public tenant routes
 */
interface PublicTenantRoutesDeps {
  tenantRepository: PrismaTenantRepository;
  sectionContentService?: SectionContentService;
}

/**
 * Create public tenant routes
 * Uses repository pattern for DI and testability
 *
 * @param deps - Dependencies for routes
 */
export function createPublicTenantRoutes(deps: PublicTenantRoutesDeps): Router {
  const { tenantRepository, sectionContentService } = deps;
  const router = Router();

  /**
   * GET /v1/public/tenants
   * Get list of active tenant slugs for sitemap generation
   *
   * Returns minimal data: slug and updatedAt for SEO sitemap generation.
   * Only returns active tenants to avoid exposing inactive/deleted tenants.
   *
   * NOTE: This is a public endpoint with no timing attack mitigation since
   * it intentionally exposes all active tenant slugs for sitemap purposes.
   */
  router.get('/', async (_req, res) => {
    try {
      const tenants = await tenantRepository.listActive();
      const slugs = tenants.map((t) => ({
        slug: t.slug,
        updatedAt: t.updatedAt,
      }));
      return res.status(200).json(slugs);
    } catch (error) {
      logger.error({ error }, 'Error fetching tenant slugs');
      return res.status(500).json({ error: 'Failed to fetch tenants' });
    }
  });

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

  /**
   * GET /v1/public/tenants/by-domain/:domain
   * Get public tenant info by custom domain
   *
   * Used by Next.js middleware for custom domain routing.
   * Same security guarantees as slug lookup.
   *
   * TIMING ATTACK MITIGATION:
   * - Same minimum response time as slug lookup
   * - Generic error message for both not found and unverified domains
   */
  router.get('/by-domain/:domain', async (req, res) => {
    const { domain } = req.params;
    const startTime = Date.now();
    const MIN_RESPONSE_TIME = 100;

    const ensureMinResponseTime = async (): Promise<void> => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await setTimeout(MIN_RESPONSE_TIME - elapsed);
      }
    };

    // Domain format validation (basic check)
    if (!domain || domain.length === 0 || domain.length > 253) {
      return res.status(400).json({
        error: 'Invalid domain format',
      });
    }

    try {
      const tenant = await tenantRepository.findByDomainPublic(domain);

      await ensureMinResponseTime();

      if (!tenant) {
        logger.info({ domain }, 'Domain not available for public lookup');
        return res.status(404).json({
          error: 'Domain not configured or not verified',
        });
      }

      logger.info({ tenantId: tenant.id, domain }, 'Public tenant domain lookup');

      return res.status(200).json(tenant);
    } catch (error) {
      await ensureMinResponseTime();
      logger.error({ error, domain }, 'Error fetching tenant by domain');
      return res.status(500).json({
        error: 'Failed to fetch tenant',
      });
    }
  });

  /**
   * GET /v1/public/tenants/:slug/preview
   * Get tenant info with DRAFT landing page config for preview
   *
   * SECURITY:
   * - Requires valid preview token (JWT signed, 10 minute expiry)
   * - Token must be tenant-scoped (can only preview own tenant's draft)
   * - Token validation happens before any data is returned
   * - Does NOT use timing attack mitigation (token validation is sufficient)
   *
   * CACHE BEHAVIOR:
   * - Response includes `Cache-Control: no-store` to prevent ISR cache poisoning
   * - Draft content is never cached
   *
   * @param token - Preview token (required query parameter)
   * @returns TenantPublicDto with draft landing page config (instead of published)
   */
  router.get('/:slug/preview', async (req, res) => {
    const { slug } = req.params;
    const { token } = req.query;

    // Validate token presence
    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        error: 'Preview token required',
      });
    }

    // Validate token
    const tokenResult = validatePreviewToken(token, slug);
    if (!tokenResult.valid) {
      // Log detailed error for debugging, but return generic message to client
      // SECURITY: Don't reveal specific failure reason (expired vs invalid vs tenant mismatch)
      // to prevent attackers from learning about token format or multi-tenancy
      logger.info({ slug, error: tokenResult.error }, 'Preview token validation failed');
      return res.status(401).json({
        error: 'Invalid or expired preview token',
      });
    }

    try {
      // PERFORMANCE: Single query fetches tenant + both draft and published configs
      // Previously made 2 sequential queries (findBySlugPublic + getLandingPageDraft)
      const result = await tenantRepository.findBySlugForPreview(slug);

      if (!result) {
        return res.status(404).json({
          error: 'Tenant not available',
        });
      }

      // Set cache headers to prevent ISR cache poisoning
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      logger.info(
        { tenantId: tokenResult.payload.tenantId, slug, hasDraft: result.hasDraft },
        'Preview data served'
      );

      return res.status(200).json(result.tenant);
    } catch (error) {
      logger.error({ error, slug }, 'Error fetching preview data');
      return res.status(500).json({
        error: 'Failed to fetch preview data',
      });
    }
  });

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

  // ============================================================================
  // Section Content Routes (Phase 4)
  // ============================================================================

  /**
   * GET /v1/public/tenants/:slug/sections
   * Get published sections for public storefront rendering
   *
   * Returns SectionContentDto[] sorted by page/order for ISR-cached rendering.
   * Only returns published (isDraft: false) sections.
   *
   * TIMING ATTACK MITIGATION:
   * - Same minimum response time as other tenant routes
   *
   * CACHE BEHAVIOR:
   * - Default: ISR cacheable (60s revalidation)
   * - Set Cache-Control: public, s-maxage=60
   */
  router.get('/:slug/sections', async (req, res) => {
    const { slug } = req.params;
    const startTime = Date.now();
    const MIN_RESPONSE_TIME = 100;

    const ensureMinResponseTime = async (): Promise<void> => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await setTimeout(MIN_RESPONSE_TIME - elapsed);
      }
    };

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || slug.length === 0 || slug.length > 63 || !slugRegex.test(slug)) {
      return res.status(400).json({
        error: 'Invalid slug format',
      });
    }

    if (!sectionContentService) {
      return res.status(503).json({
        error: 'Section content service not available',
      });
    }

    try {
      // First resolve tenant ID from slug
      const tenant = await tenantRepository.findBySlugPublic(slug);

      await ensureMinResponseTime();

      if (!tenant) {
        return res.status(404).json({
          error: 'Tenant not available',
        });
      }

      // Get published sections
      const sections = await sectionContentService.getPublishedSections(tenant.id);

      // Set cache headers for ISR
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

      // Serialize dates for JSON response
      const serializedSections = sections.map((s) => ({
        ...s,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));

      logger.info(
        { tenantId: tenant.id, slug, sectionCount: sections.length },
        'Public sections served'
      );

      return res.status(200).json({
        success: true,
        sections: serializedSections,
      });
    } catch (error) {
      await ensureMinResponseTime();
      logger.error({ error, slug }, 'Error fetching public sections');
      return res.status(500).json({
        error: 'Failed to fetch sections',
      });
    }
  });

  /**
   * GET /v1/public/tenants/:slug/sections/preview
   * Get preview sections (drafts take priority) for Build Mode
   *
   * SECURITY:
   * - Requires valid preview token (JWT signed, 10 minute expiry)
   * - Token must be tenant-scoped
   *
   * CACHE BEHAVIOR:
   * - Response includes `Cache-Control: no-store` to prevent cache poisoning
   * - Preview content is never cached
   */
  router.get('/:slug/sections/preview', async (req, res) => {
    const { slug } = req.params;
    const { token } = req.query;

    // Validate token presence
    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        error: 'Preview token required',
      });
    }

    // Validate token
    const tokenResult = validatePreviewToken(token, slug);
    if (!tokenResult.valid) {
      logger.info({ slug, error: tokenResult.error }, 'Preview token validation failed');
      return res.status(401).json({
        error: 'Invalid or expired preview token',
      });
    }

    if (!sectionContentService) {
      return res.status(503).json({
        error: 'Section content service not available',
      });
    }

    try {
      // Resolve tenant from slug (validated by token)
      const tenant = await tenantRepository.findBySlugPublic(slug);

      if (!tenant) {
        return res.status(404).json({
          error: 'Tenant not available',
        });
      }

      // Get preview sections (drafts take priority)
      const sections = await sectionContentService.getPreviewSections(tenant.id);

      // Set cache headers to prevent cache poisoning
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Serialize dates for JSON response
      const serializedSections = sections.map((s) => ({
        ...s,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));

      logger.info(
        { tenantId: tenant.id, slug, sectionCount: sections.length },
        'Preview sections served'
      );

      return res.status(200).json({
        success: true,
        sections: serializedSections,
      });
    } catch (error) {
      logger.error({ error, slug }, 'Error fetching preview sections');
      return res.status(500).json({
        error: 'Failed to fetch preview sections',
      });
    }
  });

  return router;
}
