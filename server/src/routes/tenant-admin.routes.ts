/**
 * Tenant Admin Routes
 * Authenticated routes for tenant administrators to manage their branding,
 * packages, blackouts, and bookings
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ZodError } from 'zod';
import { UpdateBrandingDtoSchema, UpdatePackageDraftDtoSchema } from '@macon/contracts';
import { uploadService, checkUploadConcurrency, releaseUploadConcurrency } from '../services/upload.service';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { CatalogService } from '../services/catalog.service';
import type { BookingService } from '../services/booking.service';
import type { BlackoutRepository } from '../lib/ports';
import type { SegmentService } from '../services/segment.service';
import type { PackageDraftService } from '../services/package-draft.service';
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
import { uploadLimiterIP, uploadLimiterTenant, draftAutosaveLimiter } from '../middleware/rateLimiter';

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
function handleMulterError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
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

      logger.info(
        { tenantId, logoUrl: result.url },
        'Tenant logo uploaded and branding updated'
      );

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
  async getBranding(req: Request, res: Response): Promise<void> {
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
 */
export function createTenantAdminRoutes(
  tenantRepository: PrismaTenantRepository,
  catalogService: CatalogService,
  bookingService: BookingService,
  blackoutRepo: BlackoutRepository,
  segmentService?: SegmentService,
  packageDraftService?: PackageDraftService
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
  router.get('/packages', async (req: Request, res: Response, next: NextFunction) => {
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
        title: pkg.title,
        description: pkg.description,
        priceCents: pkg.priceCents,
        photoUrl: pkg.photoUrl,
        photos: pkg.photos,
        // Tier/segment organization fields
        segmentId: pkg.segmentId,
        grouping: pkg.grouping,
        groupingOrder: pkg.groupingOrder,
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
  router.get('/packages/drafts', draftAutosaveLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
  });

  /**
   * POST /v1/tenant-admin/packages/publish
   * Publish all package drafts to live
   */
  router.post('/packages/publish', draftAutosaveLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
      const validatedPackageIds = packageIds && Array.isArray(packageIds) ? packageIds.filter((id: unknown) => typeof id === 'string') : undefined;

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
  });

  /**
   * DELETE /v1/tenant-admin/packages/drafts
   * Discard all package drafts
   */
  router.delete('/packages/drafts', draftAutosaveLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
      const validatedPackageIds = packageIds && Array.isArray(packageIds) ? packageIds.filter((id: unknown) => typeof id === 'string') : undefined;

      const result = await packageDraftService.discardDrafts(tenantId, validatedPackageIds);

      res.json({ discarded: result.discarded });
    } catch (error) {
      next(error);
    }
  });

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
          res.status(404).json({ error: 'Invalid segment: segment not found or does not belong to this tenant' });
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
          res.status(404).json({ error: 'Invalid segment: segment not found or does not belong to this tenant' });
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
        const currentPhotos = (pkg.photos as Array<{ url: string; filename: string; size: number; order: number }>) || [];
        if (currentPhotos.length >= 5) {
          releaseUploadConcurrency(tenantId);
          res.status(400).json({ error: 'Maximum 5 photos per package' });
          return;
        }

        // Upload photo (pass tenantId for Supabase storage path)
        const uploadResult = await uploadService.uploadPackagePhoto(req.file as Express.Multer.File, packageId, tenantId);

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
        const currentPhotos = (pkg.photos as Array<{ url: string; filename: string; size: number; order: number }>) || [];
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
  router.patch('/packages/:id/draft', draftAutosaveLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
  });

  // ============================================================================
  // Blackout Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/blackouts
   * List all blackout dates for authenticated tenant
   */
  router.get('/blackouts', async (req: Request, res: Response, next: NextFunction) => {
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
        const uploadResult = await uploadService.uploadSegmentImage(req.file as Express.Multer.File, tenantId);

        logger.info(
          { tenantId, filename: uploadResult.filename },
          'Segment image uploaded'
        );

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

  return router;
}
