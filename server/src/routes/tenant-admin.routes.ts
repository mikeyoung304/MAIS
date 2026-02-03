/**
 * Tenant Admin Routes
 * Authenticated routes for tenant administrators to manage their branding,
 * packages, blackouts, and bookings
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import {
  UpdateBrandingDtoSchema,
  UpdatePackageDraftDtoSchema,
  CreateAddOnDtoSchema,
  UpdateAddOnDtoSchema,
} from '@macon/contracts';
import {
  uploadService,
  checkUploadConcurrency,
  releaseUploadConcurrency,
} from '../services/upload.service';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { CatalogService } from '../services/catalog.service';
import type { BookingService } from '../services/booking.service';
import type { BlackoutRepository } from '../lib/ports';
import type { SegmentService } from '../services/segment.service';
import type { PackageDraftService } from '../services/package-draft.service';
import type { SectionContentService } from '../services/section-content.service';
import {
  createPackageSchema,
  updatePackageSchema,
  createBlackoutSchema,
  bookingQuerySchema,
} from '../validation/tenant-admin.schemas';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  TooManyRequestsError,
} from '../lib/errors';
import { generatePreviewToken } from '../lib/preview-tokens';
import type { AddOn } from '../lib/entities';
import {
  uploadLimiterIP,
  uploadLimiterTenant,
  draftAutosaveLimiter,
  addonReadLimiter,
  addonWriteLimiter,
} from '../middleware/rateLimiter';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for logos
  },
});

// Separate upload config for package photos (5MB)
const uploadPackagePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for package photos
  },
});

/**
 * Multer error handler middleware
 * Converts multer-specific errors (file size, field count, etc.) to proper HTTP status codes
 */
function handleMulterError(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large (max 5MB)' });
      return;
    }
    // Other multer errors (LIMIT_FILE_COUNT, LIMIT_FIELD_KEY, etc.)
    res.status(400).json({ error: error.message });
    return;
  }
  // Not a multer error, pass to next handler
  next(error);
}

export class TenantAdminController {
  constructor(private readonly tenantRepository: PrismaTenantRepository) {}

  /**
   * Upload logo
   * POST /v1/tenant/logo
   */
  async uploadLogo(req: Request, res: Response): Promise<void> {
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
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload file
      const result = await uploadService.uploadLogo(req.file as Express.Multer.File, tenantId);

      // Update tenant branding with logo URL
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) {
        releaseUploadConcurrency(tenantId);
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const currentBranding = (tenant.branding as Record<string, unknown>) || {};
      const updatedBranding = {
        ...currentBranding,
        logo: result.url,
      };

      await this.tenantRepository.update(tenantId, {
        branding: updatedBranding,
      });

      logger.info({ tenantId, logoUrl: result.url }, 'Tenant logo uploaded and branding updated');

      releaseUploadConcurrency(tenantId);
      res.status(200).json(result);
    } catch (error) {
      releaseUploadConcurrency(tenantId);
      logger.error({ error }, 'Error uploading logo');

      // Handle concurrency limit exceeded
      if (error instanceof TooManyRequestsError) {
        res.status(429).json({ error: error.message });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Update branding
   * PUT /v1/tenant/branding
   */
  async updateBranding(req: Request, res: Response): Promise<void> {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body using proper DTO schema (includes all 4 colors)
      const validation = UpdateBrandingDtoSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.error.issues,
        });
        return;
      }

      // Get current tenant
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Merge with existing branding (preserve logo URL)
      // Type the branding object to include all possible fields including logo
      interface BrandingData {
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        backgroundColor?: string;
        fontFamily?: string;
        logo?: string;
      }
      const currentBranding = (tenant.branding as BrandingData) || {};
      const updatedBranding: BrandingData = {
        ...currentBranding,
        ...validation.data,
      };

      // Update tenant
      await this.tenantRepository.update(tenantId, {
        branding: updatedBranding,
      });

      logger.info({ tenantId, branding: updatedBranding }, 'Tenant branding updated');

      res.status(200).json({
        primaryColor: updatedBranding.primaryColor,
        secondaryColor: updatedBranding.secondaryColor,
        accentColor: updatedBranding.accentColor,
        backgroundColor: updatedBranding.backgroundColor,
        fontFamily: updatedBranding.fontFamily,
        logo: updatedBranding.logo,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating branding');

      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Get branding (for tenant admin)
   * GET /v1/tenant/branding
   */
  async getBranding(_req: Request, res: Response): Promise<void> {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};

      res.status(200).json({
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        backgroundColor: branding.backgroundColor,
        fontFamily: branding.fontFamily,
        logo: branding.logo,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting branding');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Create tenant admin routes
 *
 * @param sectionContentService - Phase 5.2: Added for image gallery endpoint
 */
export function createTenantAdminRoutes(
  tenantRepository: PrismaTenantRepository,
  catalogService: CatalogService,
  bookingService: BookingService,
  blackoutRepo: BlackoutRepository,
  segmentService?: SegmentService,
  packageDraftService?: PackageDraftService,
  sectionContentService?: SectionContentService
): Router {
  const router = Router();
  const controller = new TenantAdminController(tenantRepository);

  // Logo upload endpoint
  router.post(
    '/logo',
    uploadLimiterIP, // IP-level DDoS protection (200/hour)
    uploadLimiterTenant, // Tenant-level quota enforcement (50/hour)
    upload.single('logo'),
    (req, res) => controller.uploadLogo(req, res)
  );

  // Branding endpoints
  router.get('/branding', (req, res) => controller.getBranding(req, res));
  router.put('/branding', (req, res) => controller.updateBranding(req, res));

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
        const uploadResult = await uploadService.uploadPackagePhoto(
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

        // Handle concurrency limit exceeded
        if (error instanceof TooManyRequestsError) {
          res.status(429).json({ error: error.message });
          return;
        }

        // Discriminate error types for proper HTTP status codes
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof ValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error instanceof ForbiddenError) {
          res.status(403).json({ error: error.message });
          return;
        }

        // Handle generic errors from upload service (file validation)
        if (error instanceof Error) {
          // Upload service throws generic Error for invalid file types
          res.status(400).json({ error: error.message });
          return;
        }

        // Pass unknown errors to global error handler
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
        await uploadService.deletePackagePhoto(filename);

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
        next(error);
      }
    }
  );

  // ============================================================================
  // Blackout Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/blackouts
   * List all blackout dates for authenticated tenant
   */
  router.get('/blackouts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Need to fetch full records with IDs
      // Type assertion needed because BlackoutRepository interface doesn't expose prisma
      // but PrismaBlackoutRepository implementation has it
      const prismaClient = (blackoutRepo as unknown as { prisma: unknown }).prisma as {
        blackoutDate: {
          findMany: (args: {
            where: { tenantId: string };
            orderBy: { date: string };
            select: { id: boolean; date: boolean; reason: boolean };
          }) => Promise<Array<{ id: string; date: Date; reason: string | null }>>;
        };
      };
      const fullBlackouts = await prismaClient.blackoutDate.findMany({
        where: { tenantId },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          reason: true,
        },
      });

      const blackouts = fullBlackouts.map((b) => ({
        id: b.id,
        date: b.date.toISOString().split('T')[0],
        ...(b.reason && { reason: b.reason }),
      }));

      res.json(blackouts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/blackouts
   * Add blackout date for authenticated tenant
   */
  router.post('/blackouts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const data = createBlackoutSchema.parse(req.body);
      await blackoutRepo.addBlackout(tenantId, data.date, data.reason);
      res.status(201).json({ ok: true });
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
   * DELETE /v1/tenant-admin/blackouts/:id
   * Remove blackout date (verifies ownership)
   */
  router.delete('/blackouts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;

      // Verify blackout belongs to tenant
      const blackout = await blackoutRepo.findBlackoutById(tenantId, id);
      if (!blackout) {
        res.status(404).json({ error: 'Blackout date not found' });
        return;
      }

      await blackoutRepo.deleteBlackout(tenantId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Booking View Endpoint (Read-Only)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/bookings
   * List all bookings for authenticated tenant
   * Query params: ?status=PAID&startDate=2025-01-01&endDate=2025-12-31
   */
  router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const query = bookingQuerySchema.parse(req.query);
      let bookings = await bookingService.getAllBookings(tenantId);

      // Apply filters
      if (query.status) {
        bookings = bookings.filter((b) => b.status === query.status);
      }

      if (query.startDate) {
        bookings = bookings.filter((b) => b.eventDate >= query.startDate!);
      }

      if (query.endDate) {
        bookings = bookings.filter((b) => b.eventDate <= query.endDate!);
      }

      // Map to DTO
      const bookingsDto = bookings.map((booking) => ({
        id: booking.id,
        packageId: booking.packageId,
        coupleName: booking.coupleName,
        email: booking.email,
        phone: booking.phone,
        eventDate: booking.eventDate,
        addOnIds: booking.addOnIds,
        totalCents: booking.totalCents,
        status: booking.status,
        createdAt: booking.createdAt,
      }));

      res.json(bookingsDto);
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

  // ============================================================================
  // Add-On Management Endpoints
  // ============================================================================

  /**
   * TODO-195 FIX: DTO mapper function to avoid code duplication
   * Maps AddOn entity to API response format
   */
  const mapAddOnToDto = (addOn: AddOn) => ({
    id: addOn.id,
    packageId: addOn.packageId,
    title: addOn.title,
    description: addOn.description ?? null,
    priceCents: addOn.priceCents,
    photoUrl: addOn.photoUrl,
  });

  /**
   * TODO-194 FIX: Helper to extract tenantId from authenticated request
   * Returns null if not authenticated, allowing route to handle 401
   */
  const getTenantId = (res: Response): string | null => {
    const tenantAuth = res.locals.tenantAuth;
    return tenantAuth?.tenantId ?? null;
  };

  /**
   * Middleware to require authentication before proceeding.
   * Use this BEFORE rate limiters to ensure auth errors are returned
   * instead of rate limit errors (see issue #733).
   */
  const requireAuth = (_req: Request, res: Response, next: NextFunction): void => {
    if (!res.locals.tenantAuth) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }
    next();
  };

  /**
   * GET /v1/tenant-admin/addons
   * List all add-ons for authenticated tenant
   */
  router.get(
    '/addons',
    addonReadLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const addOns = await catalogService.getAllAddOns(tenantId);
        res.json(addOns.map(mapAddOnToDto));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /v1/tenant-admin/addons/:id
   * Get single add-on by ID (verifies ownership)
   */
  router.get(
    '/addons/:id',
    addonReadLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const addOn = await catalogService.getAddOnById(tenantId, req.params.id);
        if (!addOn) {
          res.status(404).json({ error: 'Add-on not found' });
          return;
        }

        res.json(mapAddOnToDto(addOn));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/tenant-admin/addons
   * Create new add-on for authenticated tenant
   */
  router.post(
    '/addons',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const data = CreateAddOnDtoSchema.parse(req.body);

        // SECURITY: Validate package ownership - ensure packageId belongs to tenant
        const pkg = await catalogService.getPackageById(tenantId, data.packageId);
        if (!pkg) {
          res.status(404).json({
            error: 'Invalid package: package not found or does not belong to this tenant',
          });
          return;
        }

        const addOn = await catalogService.createAddOn(tenantId, data);
        res.status(201).json(mapAddOnToDto(addOn));
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    }
  );

  /**
   * PUT /v1/tenant-admin/addons/:id
   * Update add-on (verifies ownership)
   */
  router.put(
    '/addons/:id',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const { id } = req.params;
        const data = UpdateAddOnDtoSchema.parse(req.body);

        // SECURITY: If updating packageId, validate it belongs to tenant
        if (data.packageId) {
          const pkg = await catalogService.getPackageById(tenantId, data.packageId);
          if (!pkg) {
            res.status(404).json({
              error: 'Invalid package: package not found or does not belong to this tenant',
            });
            return;
          }
        }

        const addOn = await catalogService.updateAddOn(tenantId, id, data);
        res.json(mapAddOnToDto(addOn));
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        // TODO-196 FIX: Explicit NotFoundError handling
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  );

  /**
   * DELETE /v1/tenant-admin/addons/:id
   * Delete add-on (verifies ownership)
   */
  router.delete(
    '/addons/:id',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        await catalogService.deleteAddOn(tenantId, req.params.id);
        res.status(204).send();
      } catch (error) {
        // TODO-196 FIX: Explicit NotFoundError handling
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  );

  // ============================================================================
  // Segment Image Upload Endpoint
  // ============================================================================

  /**
   * POST /v1/tenant-admin/segment-image
   * Upload a hero image for segments
   *
   * @returns 201 - Image successfully uploaded with URL
   * @returns 400 - No file uploaded or invalid file type
   * @returns 401 - No tenant authentication
   * @returns 413 - File too large (>5MB, handled by multer middleware)
   * @returns 429 - Rate limit exceeded (IP or tenant)
   * @returns 500 - Internal server error
   */
  router.post(
    '/segment-image',
    uploadLimiterIP, // IP-level DDoS protection (200/hour)
    uploadLimiterTenant, // Tenant-level quota enforcement (50/hour)
    uploadPackagePhoto.single('file'),
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
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        // Upload segment image
        const uploadResult = await uploadService.uploadSegmentImage(
          req.file as Express.Multer.File,
          tenantId
        );

        logger.info({ tenantId, filename: uploadResult.filename }, 'Segment image uploaded');

        releaseUploadConcurrency(tenantId);
        res.status(201).json(uploadResult);
      } catch (error) {
        releaseUploadConcurrency(tenantId);
        logger.error({ error }, 'Error uploading segment image');

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

  // ============================================================================
  // Agent API Endpoints (for AI agent integration)
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

      const tenant = await tenantRepository.findById(tenantId);
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

  /**
   * GET /v1/tenant-admin/dashboard
   * Get aggregated business stats for agent context
   *
   * Returns:
   * - Package count
   * - Booking counts (total, upcoming, by status)
   * - Revenue stats (this month, total)
   * - Recent activity
   */
  router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      // Get basic stats
      const stats = await tenantRepository.getStats(tenantId);

      // Get all bookings for detailed stats
      const allBookings = await bookingService.getAllBookings(tenantId);

      // Calculate booking breakdown
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const bookingsByStatus = {
        pending: 0,
        depositPaid: 0,
        paid: 0,
        confirmed: 0,
        canceled: 0,
        refunded: 0,
        fulfilled: 0,
      };

      let upcomingCount = 0;
      let revenueThisMonth = 0;
      let totalRevenue = 0;

      for (const booking of allBookings) {
        // Count by status - normalize to lowercase without underscores
        const normalizedStatus = booking.status.toLowerCase().replace('_', '');
        if (normalizedStatus === 'depositpaid') {
          bookingsByStatus.depositPaid++;
        } else if (normalizedStatus in bookingsByStatus) {
          const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
          bookingsByStatus[statusKey]++;
        }

        // Count upcoming (next 30 days, not canceled/refunded)
        const eventDate = new Date(booking.eventDate);
        if (
          eventDate >= now &&
          eventDate <= next30Days &&
          !['CANCELED', 'REFUNDED'].includes(booking.status)
        ) {
          upcomingCount++;
        }

        // Calculate revenue (only PAID, CONFIRMED, FULFILLED)
        if (['PAID', 'CONFIRMED', 'FULFILLED'].includes(booking.status)) {
          totalRevenue += booking.totalCents;
          const bookingDate = new Date(booking.createdAt);
          if (bookingDate >= thisMonth) {
            revenueThisMonth += booking.totalCents;
          }
        }
      }

      const dashboard = {
        packages: stats.packageCount,
        addOns: stats.addOnCount,
        bookings: {
          total: stats.bookingCount,
          upcoming: upcomingCount,
          byStatus: bookingsByStatus,
        },
        revenue: {
          thisMonthCents: revenueThisMonth,
          totalCents: totalRevenue,
        },
      };

      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/bookings/:id
   * Get single booking with full details
   *
   * Returns complete booking information including customer details
   */
  router.get('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id } = req.params;
      const booking = await bookingService.getBookingById(tenantId, id);

      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      // Get package details for context (only for DATE bookings with packageId)
      const pkg = booking.packageId
        ? await catalogService.getPackageById(tenantId, booking.packageId)
        : null;

      const bookingDto = {
        id: booking.id,
        packageId: booking.packageId,
        packageTitle: pkg?.title || 'Unknown Package',
        coupleName: booking.coupleName,
        email: booking.email,
        phone: booking.phone,
        eventDate: booking.eventDate,
        addOnIds: booking.addOnIds,
        totalCents: booking.totalCents,
        status: booking.status,
        // Deposit/balance fields
        depositPaidAmount: booking.depositPaidAmount,
        balanceDueDate: booking.balanceDueDate,
        balancePaidAmount: booking.balancePaidAmount,
        balancePaidAt: booking.balancePaidAt,
        // Timestamps
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        // Cancellation details
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason,
        // Refund details
        refundStatus: booking.refundStatus,
        refundAmount: booking.refundAmount,
        refundedAt: booking.refundedAt,
      };

      res.json(bookingDto);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/bookings/:id/cancel
   * Cancel a booking with optional refund
   *
   * This is a T3 (hard confirm) operation for the agent.
   * Requires explicit user confirmation before calling.
   *
   * @body reason - Optional cancellation reason
   * @returns Cancelled booking with refund status
   */
  router.post('/bookings/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id } = req.params;
      const { reason } = req.body || {};

      // Get booking first to verify ownership
      const booking = await bookingService.getBookingById(tenantId, id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      // Check if already cancelled
      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        res.status(409).json({ error: 'Booking is already cancelled or refunded' });
        return;
      }

      // Cancel the booking (will handle refund if applicable)
      const cancelledBooking = await bookingService.cancelBooking(
        tenantId,
        id,
        'TENANT',
        reason || 'Cancelled by tenant'
      );

      logger.info({ tenantId, bookingId: id }, 'Booking cancelled via tenant-admin API');

      res.json({
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt,
        cancelledBy: cancelledBooking.cancelledBy,
        cancellationReason: cancelledBooking.cancellationReason,
        refundStatus: cancelledBooking.refundStatus,
        refundAmount: cancelledBooking.refundAmount,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/upload-url
   * Get a presigned URL for direct file upload
   *
   * Used by agents to orchestrate file uploads without handling binary data.
   * The agent gets the URL, user uploads via UI, agent confirms upload.
   *
   * @body fileType - Type of file: 'logo', 'package-photo', 'gallery', 'segment'
   * @body filename - Original filename (for extension detection)
   * @body contentType - MIME type (e.g., 'image/jpeg')
   * @returns Presigned upload URL and metadata
   */
  router.post('/upload-url', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { fileType, filename, contentType: _contentType } = req.body || {};

      // Validate required fields
      if (!fileType || !filename) {
        res.status(400).json({
          error: 'Missing required fields: fileType, filename',
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['logo', 'package-photo', 'gallery', 'segment'];
      if (!allowedTypes.includes(fileType)) {
        res.status(400).json({
          error: `Invalid fileType. Must be one of: ${allowedTypes.join(', ')}`,
        });
        return;
      }

      // Generate presigned URL (simplified - actual implementation would use S3/Supabase SDK)
      // For now, return instructions for direct upload endpoint
      const uploadInfo = {
        method: 'POST',
        endpoint: `/v1/tenant-admin/${fileType === 'logo' ? 'logo' : fileType === 'segment' ? 'segment-image' : 'packages/{packageId}/photos'}`,
        fieldName: fileType === 'logo' ? 'logo' : fileType === 'segment' ? 'file' : 'photo',
        maxSizeMB: fileType === 'logo' ? 2 : 5,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        instructions:
          'Upload file using multipart/form-data to the endpoint above. For package photos, replace {packageId} with the actual package ID.',
      };

      res.json(uploadInfo);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/gallery
   * Get all portfolio images across packages, segments, and landing page
   *
   * Returns aggregated list of all visual assets for agent context.
   * Useful for suggesting existing images or understanding visual content.
   */
  router.get('/gallery', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const images: Array<{
        url: string;
        type: 'package' | 'segment' | 'landing-page' | 'logo';
        source: string;
        filename?: string;
      }> = [];

      // 1. Get package photos
      const packages = await catalogService.getAllPackages(tenantId);
      for (const pkg of packages) {
        if (pkg.photoUrl) {
          images.push({
            url: pkg.photoUrl,
            type: 'package',
            source: `Package: ${pkg.title}`,
          });
        }
        if (pkg.photos && Array.isArray(pkg.photos)) {
          for (const photo of pkg.photos) {
            if (photo.url) {
              images.push({
                url: photo.url,
                type: 'package',
                source: `Package: ${pkg.title}`,
                filename: photo.filename,
              });
            }
          }
        }
      }

      // 2. Get segment images (if segment service available)
      if (segmentService) {
        const segments = await segmentService.getSegments(tenantId);
        for (const segment of segments) {
          if (segment.heroImage) {
            images.push({
              url: segment.heroImage,
              type: 'segment',
              source: `Segment: ${segment.name}`,
            });
          }
        }
      }

      // 3. Get landing page images from SectionContent table (Phase 5.2)
      if (sectionContentService) {
        const sections = await sectionContentService.getPublishedSections(tenantId);
        for (const section of sections) {
          const content = section.content as Record<string, unknown>;

          // Hero background
          if (section.blockType === 'HERO' && content.backgroundImage) {
            images.push({
              url: content.backgroundImage as string,
              type: 'landing-page',
              source: 'Landing Page: Hero',
            });
          }

          // About/Text image
          if (section.blockType === 'ABOUT' && content.image) {
            images.push({
              url: content.image as string,
              type: 'landing-page',
              source: 'Landing Page: About',
            });
          }

          // Gallery images
          if (section.blockType === 'GALLERY' && Array.isArray(content.items)) {
            for (const item of content.items as Array<{ url?: string }>) {
              if (item.url) {
                images.push({
                  url: item.url,
                  type: 'landing-page',
                  source: 'Landing Page: Gallery',
                });
              }
            }
          }
        }
      }

      // 4. Get tenant logo
      const tenant = await tenantRepository.findById(tenantId);
      if (tenant?.branding && typeof tenant.branding === 'object') {
        const branding = tenant.branding as { logo?: string };
        if (branding.logo) {
          images.push({
            url: branding.logo,
            type: 'logo',
            source: 'Business Logo',
          });
        }
      }

      res.json({
        totalImages: images.length,
        images,
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Trial & Subscription Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/trial/status
   * Get current trial/subscription status for authenticated tenant
   *
   * Returns:
   * - status: NONE | TRIALING | ACTIVE | EXPIRED
   * - daysRemaining: number | null (only for TRIALING)
   * - canStartTrial: boolean (has packages but no trial started)
   * - hasPackages: boolean
   */
  router.get('/trial/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if tenant has packages
      const packages = await catalogService.getAllPackages(tenantId);
      const hasPackages = packages.length > 0;

      // Determine status and days remaining
      let status = tenant.subscriptionStatus || 'NONE';
      let daysRemaining: number | null = null;

      if (status === 'TRIALING' && tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Auto-expire if trial has ended
        if (daysRemaining === 0) {
          status = 'EXPIRED';
          // Note: We could update the DB here, but for now we just return the derived status
        }
      }

      const canStartTrial = hasPackages && status === 'NONE';

      res.json({
        status,
        daysRemaining,
        canStartTrial,
        hasPackages,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/trial/start
   * Start 14-day free trial for authenticated tenant
   *
   * Idempotent: Returns existing trial if already started
   * Requires: At least one package created
   */
  router.post('/trial/start', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Idempotent: If trial already started, return existing status
      if (tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        const daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        res.json({
          message: 'Trial already started',
          trialEndsAt: tenant.trialEndsAt.toISOString(),
          daysRemaining,
        });
        return;
      }

      // Check if tenant has at least one package
      const packages = await catalogService.getAllPackages(tenantId);
      if (packages.length === 0) {
        res.status(400).json({
          error: 'Create at least one package before starting your trial',
        });
        return;
      }

      // Start 14-day trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await tenantRepository.update(tenantId, {
        trialEndsAt,
        subscriptionStatus: 'TRIALING',
      });

      logger.info({ tenantId, trialEndsAt }, 'Trial started for tenant');

      res.json({
        message: 'Trial started successfully',
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining: 14,
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Preview Token Endpoint
  // ============================================================================

  /**
   * POST /v1/tenant-admin/preview-token
   * Generate a short-lived preview token for draft preview access
   *
   * The token is used to authenticate iframe requests to view draft content
   * without flashing the published content first.
   *
   * SECURITY:
   * - Requires authenticated tenant session
   * - Token is tenant-scoped (can only preview own tenant's draft)
   * - Token expires after 10 minutes
   * - ISR cache is bypassed for preview requests (no cache poisoning)
   *
   * @returns { token: string, expiresAt: string } - JWT token and expiry timestamp
   */
  router.post(
    '/preview-token',
    requireAuth, // Auth check BEFORE rate limiter (see issue #733)
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        // Auth is guaranteed by requireAuth middleware - safe to assert non-null
        const tenantId = res.locals.tenantAuth!.tenantId;

        // Get tenant to include slug in token
        const tenant = await tenantRepository.findById(tenantId);
        if (!tenant) {
          res.status(404).json({ error: 'Tenant not found' });
          return;
        }

        // Generate preview token (10 minute expiry)
        const expiryMinutes = 10;
        const token = generatePreviewToken(tenantId, tenant.slug, expiryMinutes);

        // Calculate expiry timestamp
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

        logger.info({ tenantId, slug: tenant.slug }, 'Preview token generated');

        res.json({
          token,
          expiresAt,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
