/**
 * Tenant Admin Package Routes
 * All /packages/* routes for package CRUD, drafts, photos
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import multer from 'multer';
import { UpdatePackageDraftDtoSchema } from '@macon/contracts';
import { checkUploadConcurrency, releaseUploadConcurrency } from '../adapters/upload.adapter';
import { logger } from '../lib/core/logger';
import { BadRequestError, AppError } from '../lib/errors';
import { createPackageSchema, updatePackageSchema } from '../validation/tenant-admin.schemas';
import {
  uploadLimiterIP,
  uploadLimiterTenant,
  draftAutosaveLimiter,
} from '../middleware/rateLimiter';
import { handleMulterError } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

// Separate upload config for package photos (5MB)
const uploadPackagePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for package photos
  },
});

export function registerPackageRoutes(router: Router, deps: TenantAdminDeps): void {
  const { catalogService, storageProvider, segmentService, packageDraftService } = deps;

  // ============================================================================
  // Package Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/packages
   * List all packages for authenticated tenant
   */
  router.get('/packages', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const packages = await catalogService.getAllPackages(tenantId);
      const packagesDto = packages.map((pkg) => ({
        id: pkg.id,
        slug: pkg.slug,
        // Map to frontend-expected field names
        name: pkg.title || pkg.name,
        basePrice: pkg.priceCents ?? pkg.basePrice,
        // Also include original names for backward compatibility
        title: pkg.title,
        priceCents: pkg.priceCents,
        description: pkg.description,
        photoUrl: pkg.photoUrl,
        photos: pkg.photos,
        // Tier/segment organization fields
        segmentId: pkg.segmentId,
        grouping: pkg.grouping,
        groupingOrder: pkg.groupingOrder,
        // Active status and currency for frontend
        isActive: pkg.active ?? true,
        currency: 'USD',
        depositAmount: pkg.depositAmount ?? null,
        sortOrder: pkg.sortOrder ?? 0,
      }));

      res.json(packagesDto);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Visual Editor Draft Endpoints
  // IMPORTANT: These static routes MUST come before /packages/:id to prevent
  // Express from matching "drafts" or "publish" as a package ID.
  // ============================================================================

  /**
   * GET /v1/tenant-admin/packages/drafts
   * Get all packages with draft fields for visual editor
   */
  router.get(
    '/packages/drafts',
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;

        if (!packageDraftService) {
          res.status(501).json({ error: 'Package draft service not available' });
          return;
        }

        const packagesWithDrafts = await packageDraftService.getAllPackagesWithDrafts(tenantId);

        // Map to DTO format
        const packagesDto = packagesWithDrafts.map((pkg) => ({
          id: pkg.id,
          slug: pkg.slug,
          title: pkg.name, // Map name to title for frontend compatibility
          description: pkg.description,
          priceCents: pkg.basePrice, // Map basePrice to priceCents for frontend compatibility
          photoUrl: pkg.photos?.[0]?.url,
          photos: pkg.photos,
          segmentId: pkg.segmentId,
          grouping: pkg.grouping,
          groupingOrder: pkg.groupingOrder,
          active: pkg.active,
          // Draft fields
          draftTitle: pkg.draftTitle,
          draftDescription: pkg.draftDescription,
          draftPriceCents: pkg.draftPriceCents,
          draftPhotos: pkg.draftPhotos,
          hasDraft: pkg.hasDraft,
          draftUpdatedAt: pkg.draftUpdatedAt?.toISOString() ?? null,
        }));

        res.json(packagesDto);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/tenant-admin/packages/publish
   * Publish all package drafts to live
   */
  router.post(
    '/packages/publish',
    draftAutosaveLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;

        if (!packageDraftService) {
          res.status(501).json({ error: 'Package draft service not available' });
          return;
        }

        // Optional: filter to specific packages
        const { packageIds } = req.body || {};
        const validatedPackageIds =
          packageIds && Array.isArray(packageIds)
            ? packageIds.filter((id: unknown) => typeof id === 'string')
            : undefined;

        const result = await packageDraftService.publishDrafts(tenantId, validatedPackageIds);

        // Map to DTO format
        const packagesDto = result.packages.map((pkg) => ({
          id: pkg.id,
          slug: pkg.slug,
          title: pkg.title,
          description: pkg.description,
          priceCents: pkg.priceCents,
          photoUrl: pkg.photoUrl,
          photos: pkg.photos,
        }));

        res.json({
          published: result.published,
          packages: packagesDto,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /v1/tenant-admin/packages/drafts
   * Discard all package drafts
   */
  router.delete(
    '/packages/drafts',
    draftAutosaveLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;

        if (!packageDraftService) {
          res.status(501).json({ error: 'Package draft service not available' });
          return;
        }

        // Optional: filter to specific packages
        const { packageIds } = req.body || {};
        const validatedPackageIds =
          packageIds && Array.isArray(packageIds)
            ? packageIds.filter((id: unknown) => typeof id === 'string')
            : undefined;

        const result = await packageDraftService.discardDrafts(tenantId, validatedPackageIds);

        res.json({ discarded: result.discarded });
      } catch (error) {
        next(error);
      }
    }
  );

  // ============================================================================
  // Package CRUD Endpoints (parameterized routes must come after static routes)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/packages/:id
   * Get single package by ID (verifies ownership)
   */
  router.get('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const packageId = req.params.id;

      const pkg = await catalogService.getPackageById(tenantId, packageId);

      if (!pkg) {
        res.status(404).json({ error: 'Package not found' });
        return;
      }

      res.json({
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        description: pkg.description,
        priceCents: pkg.priceCents,
        photoUrl: pkg.photoUrl,
        photos: pkg.photos || [],
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/packages
   * Create new package for authenticated tenant
   */
  router.post('/packages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const data = createPackageSchema.parse(req.body);

      // SECURITY: Validate segment ownership if segmentId is provided
      if (data.segmentId && segmentService) {
        try {
          await segmentService.getSegmentById(tenantId, data.segmentId);
        } catch {
          res.status(404).json({
            error: 'Invalid segment: segment not found or does not belong to this tenant',
          });
          return;
        }
      }

      const pkg = await catalogService.createPackage(tenantId, data);

      res.status(201).json({
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        description: pkg.description,
        priceCents: pkg.priceCents,
        photoUrl: pkg.photoUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/packages/:id
   * Update package (verifies ownership)
   */
  router.put('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;
      const data = updatePackageSchema.parse(req.body);

      // SECURITY: Validate segment ownership if segmentId is provided
      if (data.segmentId && segmentService) {
        try {
          await segmentService.getSegmentById(tenantId, data.segmentId);
        } catch {
          res.status(404).json({
            error: 'Invalid segment: segment not found or does not belong to this tenant',
          });
          return;
        }
      }

      const pkg = await catalogService.updatePackage(tenantId, id, data);

      res.json({
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        description: pkg.description,
        priceCents: pkg.priceCents,
        photoUrl: pkg.photoUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/packages/:id
   * Delete package (verifies ownership)
   */
  router.delete('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;
      await catalogService.deletePackage(tenantId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/packages/:id/photos
   * Upload photo for package (max 5 photos per package)
   *
   * @returns 201 - Photo successfully uploaded
   * @returns 400 - No file uploaded, invalid file type, or max photos reached (5)
   * @returns 401 - No tenant authentication
   * @returns 403 - Package belongs to different tenant
   * @returns 404 - Package not found
   * @returns 413 - File too large (>5MB, handled by multer middleware)
   * @returns 429 - Rate limit exceeded (IP or tenant)
   * @returns 500 - Internal server error (passed to global error handler)
   */
  router.post(
    '/packages/:id/photos',
    uploadLimiterIP, // IP-level DDoS protection (200/hour)
    uploadLimiterTenant, // Tenant-level quota enforcement (50/hour)
    uploadPackagePhoto.single('photo'),
    handleMulterError,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id: packageId } = req.params;

      try {
        // Check concurrency limit BEFORE processing file (memory exhaustion protection)
        checkUploadConcurrency(tenantId);

        // Check if file was uploaded
        if (!req.file) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'No photo uploaded' });
          return;
        }

        // Verify package exists and belongs to tenant
        const pkg = await catalogService.getPackageById(tenantId, packageId);
        if (!pkg) {
          releaseUploadConcurrency(tenantId);
          res.status(404).json({ error: 'Package not found' });
          return;
        }
        if (pkg.tenantId !== tenantId) {
          releaseUploadConcurrency(tenantId);
          res.status(403).json({ error: 'Forbidden: Package belongs to different tenant' });
          return;
        }

        // Check photo count (max 5)
        const currentPhotos =
          (pkg.photos as Array<{ url: string; filename: string; size: number; order: number }>) ||
          [];
        if (currentPhotos.length >= 5) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'Maximum 5 photos per package' });
          return;
        }

        // Upload photo (pass tenantId for Supabase storage path)
        const uploadResult = await storageProvider.uploadPackagePhoto(
          req.file as Express.Multer.File,
          packageId,
          tenantId
        );

        // Add photo to package photos array
        const newPhoto = {
          url: uploadResult.url,
          filename: uploadResult.filename,
          size: uploadResult.size,
          order: currentPhotos.length, // Append to end
        };

        const updatedPhotos = [...currentPhotos, newPhoto];

        // Update package in database
        await catalogService.updatePackage(tenantId, packageId, {
          photos: updatedPhotos,
        });

        logger.info(
          { tenantId, packageId, filename: uploadResult.filename },
          'Package photo uploaded'
        );

        releaseUploadConcurrency(tenantId);
        res.status(201).json(newPhoto);
      } catch (error) {
        releaseUploadConcurrency(tenantId);
        logger.error({ error }, 'Error uploading package photo');
        // Upload service throws plain Error for invalid file types (MIME, size)
        // Preserve AppError subclasses (e.g. TooManyRequestsError 429) — only wrap plain Errors
        if (error instanceof Error && !(error instanceof AppError)) {
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    }
  );

  /**
   * DELETE /v1/tenant-admin/packages/:id/photos/:filename
   * Delete photo from package
   *
   * @returns 204 - Photo successfully deleted
   * @returns 401 - No tenant authentication
   * @returns 403 - Package belongs to different tenant
   * @returns 404 - Package not found or photo not found in package
   * @returns 500 - Internal server error (file system errors, database errors)
   */
  router.delete(
    '/packages/:id/photos/:filename',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;
        const { id: packageId, filename } = req.params;

        // Verify package exists and belongs to tenant
        const pkg = await catalogService.getPackageById(tenantId, packageId);
        if (!pkg) {
          res.status(404).json({ error: 'Package not found' });
          return;
        }
        if (pkg.tenantId !== tenantId) {
          res.status(403).json({ error: 'Forbidden: Package belongs to different tenant' });
          return;
        }

        // Verify photo exists in package photos array
        const currentPhotos =
          (pkg.photos as Array<{ url: string; filename: string; size: number; order: number }>) ||
          [];
        const updatedPhotos = currentPhotos.filter((p) => p.filename !== filename);

        if (updatedPhotos.length === currentPhotos.length) {
          res.status(404).json({ error: 'Photo not found in package' });
          return;
        }

        // Delete file from storage (may throw filesystem errors)
        await storageProvider.deletePackagePhoto(filename);

        // Update package in database
        await catalogService.updatePackage(tenantId, packageId, {
          photos: updatedPhotos,
        });

        logger.info({ tenantId, packageId, filename }, 'Package photo deleted');

        res.status(204).send();
      } catch (error) {
        logger.error({ error }, 'Error deleting package photo');
        // Pass to global error handler which will return 500 for unhandled errors
        next(error);
      }
    }
  );

  /**
   * PATCH /v1/tenant-admin/packages/:id/draft
   * Update package draft (autosave target)
   */
  router.patch(
    '/packages/:id/draft',
    draftAutosaveLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;
        const { id: packageId } = req.params;

        if (!packageDraftService) {
          res.status(501).json({ error: 'Package draft service not available' });
          return;
        }

        // Validate request body using canonical schema from contracts
        const data = UpdatePackageDraftDtoSchema.parse(req.body);

        const updatedPackage = await packageDraftService.saveDraft(tenantId, packageId, data);

        // Map to DTO format
        res.json({
          id: updatedPackage.id,
          slug: updatedPackage.slug,
          title: updatedPackage.name,
          description: updatedPackage.description,
          priceCents: updatedPackage.basePrice,
          photoUrl: updatedPackage.photos?.[0]?.url,
          photos: updatedPackage.photos,
          segmentId: updatedPackage.segmentId,
          grouping: updatedPackage.grouping,
          groupingOrder: updatedPackage.groupingOrder,
          active: updatedPackage.active,
          draftTitle: updatedPackage.draftTitle,
          draftDescription: updatedPackage.draftDescription,
          draftPriceCents: updatedPackage.draftPriceCents,
          draftPhotos: updatedPackage.draftPhotos,
          hasDraft: updatedPackage.hasDraft,
          draftUpdatedAt: updatedPackage.draftUpdatedAt?.toISOString() ?? null,
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
