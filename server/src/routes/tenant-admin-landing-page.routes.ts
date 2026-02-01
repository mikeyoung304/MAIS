/**
 * Tenant Admin Landing Page Routes
 * Protected routes for tenant administrators to manage their landing page configuration
 * Requires tenant admin authentication via JWT
 *
 * SECURITY:
 * - All endpoints verify tenant isolation via res.locals.tenantAuth
 * - Input sanitization applied in service layer (XSS prevention)
 * - Image URLs validated in repository layer (protocol validation)
 * - Publish operation wrapped in transaction (atomicity)
 *
 * ARCHITECTURE (TODO-241):
 * Routes are thin HTTP handlers that delegate to LandingPageService.
 * Business logic (sanitization, validation) lives in the service layer.
 * This follows the same pattern as booking, catalog, and scheduling.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import type { LandingPageService } from '../services/landing-page.service';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError, TooManyRequestsError } from '../lib/errors';
import {
  draftAutosaveLimiter,
  uploadLimiterIP,
  uploadLimiterTenant,
} from '../middleware/rateLimiter';
import {
  uploadService,
  checkUploadConcurrency,
  releaseUploadConcurrency,
} from '../services/upload.service';

// Configure multer for landing page images (5MB)
const uploadLandingPageImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for landing page images
  },
});

/**
 * Multer error handler middleware
 * Converts multer-specific errors to proper HTTP status codes
 */
function handleMulterError(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large (max 5MB)' });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}

/**
 * Create tenant admin landing page routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param landingPageService - Landing page service instance
 * @returns Express router with tenant admin landing page endpoints
 */
export function createTenantAdminLandingPageRoutes(landingPageService: LandingPageService): Router {
  const router = Router();

  /**
   * GET /v1/tenant-admin/landing-page
   * Get current landing page configuration for authenticated tenant
   *
   * @returns 200 - Landing page configuration or null if not set
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const config = await landingPageService.getConfig(tenantId);
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Draft System Endpoints
  // ============================================================================
  // NOTE: Visual Editor write routes (PUT /, PATCH /sections) have been deleted.
  // All storefront editing now happens through the AI agent chatbot (Build Mode).
  // See: 2026-02-01 realtime preview plan.

  /**
   * GET /v1/tenant-admin/landing-page/draft
   * Get current draft and published landing page configuration
   *
   * @returns 200 - Draft wrapper with draft/published configs
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 500 - Internal server error
   */
  router.get('/draft', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const draftWrapper = await landingPageService.getDraft(tenantId);
      res.json(draftWrapper);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // NOTE: PUT /draft (autosave) has been deleted.
  // All storefront editing now happens through the AI agent chatbot (Build Mode).
  // See: 2026-02-01 realtime preview plan.

  /**
   * POST /v1/tenant-admin/landing-page/publish
   * Publish draft to live landing page
   *
   * RATE LIMITED: 120 requests per minute per tenant (TODO-249)
   *
   * @returns 200 - Publish result with timestamp
   * @returns 400 - No draft to publish
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 429 - Rate limit exceeded
   * @returns 500 - Internal server error
   */
  router.post(
    '/publish',
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const { tenantId } = tenantAuth;

        const result = await landingPageService.publish(tenantId);
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
    }
  );

  /**
   * DELETE /v1/tenant-admin/landing-page/draft
   * Discard draft and revert to published configuration
   *
   * RATE LIMITED: 120 requests per minute per tenant (TODO-249)
   *
   * @returns 200 - Discard result
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Tenant not found
   * @returns 429 - Rate limit exceeded
   * @returns 500 - Internal server error
   */
  router.delete(
    '/draft',
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const { tenantId } = tenantAuth;

        const result = await landingPageService.discardDraft(tenantId);
        res.json(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  );

  // ============================================================================
  // Image Upload Endpoint (TODO-235)
  // ============================================================================

  /**
   * POST /v1/tenant-admin/landing-page/images
   * Upload image for landing page sections (hero, about, gallery, etc.)
   *
   * RATE LIMITED: 200/hour per IP (DDoS protection), 50/hour per tenant (quota enforcement)
   *
   * @returns 200 - Image successfully uploaded with URL and filename
   * @returns 400 - No file uploaded or invalid file type
   * @returns 401 - No tenant authentication
   * @returns 413 - File too large (>5MB, handled by multer middleware)
   * @returns 429 - Rate limit exceeded (IP or tenant) or concurrent upload limit exceeded
   * @returns 500 - Internal server error
   */
  router.post(
    '/images',
    uploadLimiterIP, // IP-level DDoS protection (200/hour)
    uploadLimiterTenant, // Tenant-level quota enforcement (50/hour)
    uploadLandingPageImage.single('image'),
    handleMulterError,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      try {
        // Check concurrency limit BEFORE processing file (memory exhaustion protection)
        checkUploadConcurrency(tenantId);

        // Check if file was uploaded
        if (!req.file) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'No image uploaded' });
          return;
        }

        // Upload landing page image
        const uploadResult = await uploadService.uploadLandingPageImage(
          req.file as Express.Multer.File,
          tenantId
        );

        logger.info({ tenantId, filename: uploadResult.filename }, 'Landing page image uploaded');

        releaseUploadConcurrency(tenantId);
        res.status(200).json(uploadResult);
      } catch (error) {
        releaseUploadConcurrency(tenantId);
        logger.error({ error }, 'Error uploading landing page image');

        // Handle concurrency limit exceeded
        if (error instanceof TooManyRequestsError) {
          res.status(429).json({ error: error.message });
          return;
        }

        // Handle generic errors from upload service (file validation)
        if (error instanceof Error) {
          res.status(400).json({ error: error.message });
          return;
        }

        // Pass unknown errors to global error handler
        next(error);
      }
    }
  );

  return router;
}
