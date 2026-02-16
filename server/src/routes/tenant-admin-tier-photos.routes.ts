/**
 * Tenant Admin Tier Photo Routes
 * POST /tiers/:id/photos, DELETE /tiers/:id/photos/:filename
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import multer from 'multer';
import { checkUploadConcurrency, releaseUploadConcurrency } from '../adapters/upload.adapter';
import { logger } from '../lib/core/logger';
import { BadRequestError, AppError } from '../lib/errors';
import { uploadLimiterIP, uploadLimiterTenant } from '../middleware/rateLimiter';
import { handleMulterError } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

// Upload config for tier photos (5MB)
const uploadTierPhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for tier photos
  },
});

export function registerTierPhotoRoutes(router: Router, deps: TenantAdminDeps): void {
  const { catalogService, storageProvider } = deps;

  /**
   * POST /v1/tenant-admin/tiers/:id/photos
   * Upload photo for tier (max 5 photos per tier)
   *
   * @returns 201 - Photo successfully uploaded
   * @returns 400 - No file uploaded, invalid file type, or max photos reached (5)
   * @returns 401 - No tenant authentication
   * @returns 404 - Tier not found or belongs to different tenant
   * @returns 413 - File too large (>5MB, handled by multer middleware)
   * @returns 429 - Rate limit exceeded (IP or tenant)
   */
  router.post(
    '/tiers/:id/photos',
    uploadLimiterIP,
    uploadLimiterTenant,
    uploadTierPhoto.single('photo'),
    handleMulterError,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id: tierId } = req.params;

      try {
        checkUploadConcurrency(tenantId);

        if (!req.file) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'No photo uploaded' });
          return;
        }

        // Verify tier exists and belongs to tenant
        const tier = await catalogService.getTierById(tenantId, tierId);
        if (!tier) {
          releaseUploadConcurrency(tenantId);
          res.status(404).json({ error: 'Tier not found' });
          return;
        }

        // Check photo count (max 5)
        const currentPhotos =
          (tier.photos as Array<{ url: string; filename: string; size: number; order: number }>) ||
          [];
        if (currentPhotos.length >= 5) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'Maximum 5 photos per tier' });
          return;
        }

        // Upload photo
        const uploadResult = await storageProvider.uploadTierPhoto(
          req.file as Express.Multer.File,
          tierId,
          tenantId
        );

        // Add photo to tier photos array
        const newPhoto = {
          url: uploadResult.url,
          filename: uploadResult.filename,
          size: uploadResult.size,
          order: currentPhotos.length,
        };

        const updatedPhotos = [...currentPhotos, newPhoto];

        // Update tier in database
        await catalogService.updateTier(tenantId, tierId, {
          photos: updatedPhotos,
        });

        logger.info({ tenantId, tierId, filename: uploadResult.filename }, 'Tier photo uploaded');

        releaseUploadConcurrency(tenantId);
        res.status(201).json(newPhoto);
      } catch (error) {
        releaseUploadConcurrency(tenantId);
        logger.error({ error }, 'Error uploading tier photo');
        if (error instanceof Error && !(error instanceof AppError)) {
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    }
  );

  /**
   * DELETE /v1/tenant-admin/tiers/:id/photos/:filename
   * Delete photo from tier
   *
   * @returns 204 - Photo successfully deleted
   * @returns 401 - No tenant authentication
   * @returns 404 - Tier not found, belongs to different tenant, or photo not found
   */
  router.delete(
    '/tiers/:id/photos/:filename',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;
        const { id: tierId, filename } = req.params;

        // Verify tier exists and belongs to tenant
        const tier = await catalogService.getTierById(tenantId, tierId);
        if (!tier) {
          res.status(404).json({ error: 'Tier not found' });
          return;
        }

        // Verify photo exists in tier photos array
        const currentPhotos =
          (tier.photos as Array<{ url: string; filename: string; size: number; order: number }>) ||
          [];
        const updatedPhotos = currentPhotos.filter((p) => p.filename !== filename);

        if (updatedPhotos.length === currentPhotos.length) {
          res.status(404).json({ error: 'Photo not found in tier' });
          return;
        }

        // Delete file from storage
        await storageProvider.deleteTierPhoto(filename);

        // Update tier in database
        await catalogService.updateTier(tenantId, tierId, {
          photos: updatedPhotos,
        });

        logger.info({ tenantId, tierId, filename }, 'Tier photo deleted');

        res.status(204).send();
      } catch (error) {
        logger.error({ error }, 'Error deleting tier photo');
        next(error);
      }
    }
  );
}
