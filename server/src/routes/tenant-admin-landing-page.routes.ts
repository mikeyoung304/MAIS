/**
 * Tenant Admin Landing Page Routes
 * Protected routes for tenant administrators to manage their landing page configuration
 * Requires tenant admin authentication via JWT
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { LandingPageConfigSchema } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError } from '../lib/errors';

/**
 * Create tenant admin landing page routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param tenantRepo - Tenant repository instance
 * @returns Express router with tenant admin landing page endpoints
 */
export function createTenantAdminLandingPageRoutes(
  tenantRepo: PrismaTenantRepository
): Router {
  const router = Router();

  /**
   * GET /v1/tenant-admin/landing-page
   * Get current landing page configuration for authenticated tenant
   *
   * @returns 200 - Landing page configuration or null if not set
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Fetch landing page config from repository
      const config = await tenantRepo.getLandingPageConfig(tenantId);

      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/landing-page
   * Update landing page configuration for authenticated tenant
   * Full configuration update (replaces entire config)
   *
   * Request body: LandingPageConfig (validated by Zod)
   * {
   *   sections: { hero: boolean, socialProofBar: boolean, ... },
   *   hero?: { headline, subheadline, ctaText, backgroundImageUrl },
   *   socialProofBar?: { items: [...] },
   *   about?: { headline, content, imageUrl, imagePosition },
   *   testimonials?: { headline, items: [...] },
   *   accommodation?: { headline, description, imageUrl, ctaText, ctaUrl, highlights },
   *   gallery?: { headline, images: [...], instagramHandle },
   *   faq?: { headline, items: [...] },
   *   finalCta?: { headline, subheadline, ctaText }
   * }
   *
   * @returns 200 - Updated landing page configuration
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate request body against LandingPageConfigSchema
      const data = LandingPageConfigSchema.parse(req.body);

      // Update landing page config
      const updatedConfig = await tenantRepo.updateLandingPageConfig(tenantId, data);

      logger.info(
        { tenantId },
        'Landing page configuration updated by tenant admin'
      );

      res.json(updatedConfig);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      next(error);
    }
  });

  /**
   * PATCH /v1/tenant-admin/landing-page/sections
   * Toggle individual section visibility on/off
   * Partial update - only affects the specified section
   *
   * Request body:
   * {
   *   section: 'hero' | 'socialProofBar' | 'segmentSelector' | 'about' | 'testimonials' | 'accommodation' | 'gallery' | 'faq' | 'finalCta',
   *   enabled: boolean
   * }
   *
   * @returns 200 - Success indicator
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.patch('/sections', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate request body
      const { section, enabled } = req.body;

      const validSections = [
        'hero',
        'socialProofBar',
        'segmentSelector',
        'about',
        'testimonials',
        'accommodation',
        'gallery',
        'faq',
        'finalCta',
      ];

      if (!section || !validSections.includes(section)) {
        res.status(400).json({
          error: 'Invalid section name',
          details: [`Section must be one of: ${validSections.join(', ')}`],
        });
        return;
      }

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          error: 'Invalid enabled value',
          details: ['enabled must be a boolean'],
        });
        return;
      }

      // Toggle section
      await tenantRepo.toggleLandingPageSection(tenantId, section, enabled);

      logger.info(
        { tenantId, section, enabled },
        'Landing page section toggled by tenant admin'
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
