/**
 * Tenant Admin Landing Page Routes
 * Protected routes for tenant administrators to manage their landing page configuration
 * Requires tenant admin authentication via JWT
 *
 * SECURITY:
 * - All endpoints verify tenant isolation via res.locals.tenantAuth
 * - Input sanitization applied to all text fields (XSS prevention)
 * - Image URLs validated in repository layer (protocol validation)
 * - Publish operation wrapped in transaction (atomicity)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { LandingPageConfigSchema } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError } from '../lib/errors';
import { sanitizeObject } from '../lib/sanitization';

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
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Input sanitization applied to all text fields (XSS prevention)
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

      // Sanitize all text fields (XSS prevention)
      // Note: URL fields are preserved as-is (validated by SafeUrlSchema in contracts)
      const sanitizedData = sanitizeObject(data, { allowHtml: [] });

      // Update landing page config
      const updatedConfig = await tenantRepo.updateLandingPageConfig(tenantId, sanitizedData);

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

  // ============================================================================
  // Draft System Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/landing-page/draft
   * Get current draft and published landing page configuration
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   *
   * @returns 200 - Draft wrapper with draft/published configs
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 500 - Internal server error
   */
  router.get('/draft', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const draftWrapper = await tenantRepo.getLandingPageDraft(tenantId);
      res.json(draftWrapper);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/landing-page/draft
   * Save draft landing page configuration (auto-save target)
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Input sanitization applied to all text fields (XSS prevention)
   * - Image URLs re-validated in repository layer (protocol validation)
   *
   * @returns 200 - Save result with timestamp
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 500 - Internal server error
   */
  router.put('/draft', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate request body against LandingPageConfigSchema
      const data = LandingPageConfigSchema.parse(req.body);

      // Sanitize all text fields (XSS prevention)
      const sanitizedData = sanitizeObject(data, { allowHtml: [] });

      // Save draft (repository re-validates image URLs)
      const result = await tenantRepo.saveLandingPageDraft(tenantId, sanitizedData);

      logger.info({ tenantId }, 'Landing page draft saved by tenant admin');

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/landing-page/publish
   * Publish draft to live landing page
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Atomic transaction ensures draft→published copy is all-or-nothing
   *
   * @returns 200 - Publish result with timestamp
   * @returns 400 - No draft to publish
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 500 - Internal server error
   */
  router.post('/publish', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const result = await tenantRepo.publishLandingPageDraft(tenantId);

      logger.info({ tenantId }, 'Landing page draft published by tenant admin');

      res.json(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ValidationError) {
        // "No draft to publish" error
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/landing-page/draft
   * Discard draft and revert to published configuration
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   *
   * @returns 200 - Discard result
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 500 - Internal server error
   */
  router.delete('/draft', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const result = await tenantRepo.discardLandingPageDraft(tenantId);

      logger.info({ tenantId }, 'Landing page draft discarded by tenant admin');

      res.json(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
