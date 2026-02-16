/**
 * Tenant Admin Branding Routes
 * POST /logo, GET /branding, PUT /branding
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import multer from 'multer';
import { UpdateBrandingDtoSchema } from '@macon/contracts';
import { checkUploadConcurrency, releaseUploadConcurrency } from '../adapters/upload.adapter';
import { logger } from '../lib/core/logger';
import { BadRequestError, AppError } from '../lib/errors';
import { uploadLimiterIP, uploadLimiterTenant } from '../middleware/rateLimiter';
import type { TenantAdminDeps } from './tenant-admin-shared';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { StorageProvider } from '../lib/ports';

// Configure multer for memory storage (2MB for logos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for logos
  },
});

export class TenantAdminController {
  constructor(
    private readonly tenantRepository: PrismaTenantRepository,
    private readonly storageProvider: StorageProvider
  ) {}

  /**
   * Upload logo
   * POST /v1/tenant-admin/logo
   */
  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.storageProvider.uploadLogo(
        req.file as Express.Multer.File,
        tenantId
      );

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
      // Upload service throws plain Error for invalid file types (MIME, size, empty)
      // Preserve AppError subclasses (e.g. TooManyRequestsError 429) — only wrap plain Errors
      if (error instanceof Error && !(error instanceof AppError)) {
        next(new BadRequestError(error.message));
        return;
      }
      next(error);
    }
  }

  /**
   * Update branding
   * PUT /v1/tenant-admin/branding
   */
  async updateBranding(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Write colors + fontPreset to dedicated columns (powers CSS vars in TenantSiteShell)
      const { fontPreset, ...colorFields } = validation.data;
      const updateData: Record<string, unknown> = {};
      if (colorFields.primaryColor) updateData.primaryColor = colorFields.primaryColor;
      if (colorFields.secondaryColor) updateData.secondaryColor = colorFields.secondaryColor;
      if (colorFields.accentColor) updateData.accentColor = colorFields.accentColor;
      if (colorFields.backgroundColor) updateData.backgroundColor = colorFields.backgroundColor;
      if (fontPreset) updateData.fontPreset = fontPreset;

      await this.tenantRepository.update(tenantId, updateData);

      // Re-read tenant to return current state
      const updated = await this.tenantRepository.findById(tenantId);
      const branding = (updated?.branding as Record<string, unknown>) || {};

      logger.info({ tenantId, updateData }, 'Tenant branding updated');

      res.status(200).json({
        primaryColor: updated?.primaryColor,
        secondaryColor: updated?.secondaryColor,
        accentColor: updated?.accentColor,
        backgroundColor: updated?.backgroundColor,
        fontPreset: updated?.fontPreset,
        logo: branding.logo,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating branding');
      next(error);
    }
  }

  /**
   * Get branding (for tenant admin)
   * GET /v1/tenant-admin/branding
   */
  async getBranding(_req: Request, res: Response, next: NextFunction): Promise<void> {
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
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
        fontPreset: tenant.fontPreset,
        logo: branding.logo,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting branding');
      next(error);
    }
  }
}

export function registerBrandingRoutes(router: Router, deps: TenantAdminDeps): void {
  const controller = new TenantAdminController(deps.tenantRepository, deps.storageProvider);

  // Logo upload endpoint
  router.post(
    '/logo',
    uploadLimiterIP, // IP-level DDoS protection (200/hour)
    uploadLimiterTenant, // Tenant-level quota enforcement (50/hour)
    upload.single('logo'),
    (req, res, next) => controller.uploadLogo(req, res, next)
  );

  // Branding endpoints
  router.get('/branding', (req, res, next) => controller.getBranding(req, res, next));
  router.put('/branding', (req, res, next) => controller.updateBranding(req, res, next));
}
