/**
 * Tenant Admin Upload Routes
 * POST /segment-image, POST /upload-url, GET /gallery
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import multer from 'multer';
import { checkUploadConcurrency, releaseUploadConcurrency } from '../adapters/upload.adapter';
import { logger } from '../lib/core/logger';
import { uploadLimiterIP, uploadLimiterTenant } from '../middleware/rateLimiter';
import { getTenantId, handleMulterError } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

// Upload config for segment images (5MB)
const uploadSegmentImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for segment images
  },
});

export function registerUploadRoutes(router: Router, deps: TenantAdminDeps): void {
  const {
    tenantRepository,
    catalogService,
    storageProvider,
    segmentService,
    sectionContentService,
  } = deps;

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
    uploadSegmentImage.single('file'),
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
        const uploadResult = await storageProvider.uploadSegmentImage(
          req.file as Express.Multer.File,
          tenantId
        );

        logger.info({ tenantId, filename: uploadResult.filename }, 'Segment image uploaded');

        releaseUploadConcurrency(tenantId);
        res.status(201).json(uploadResult);
      } catch (error) {
        releaseUploadConcurrency(tenantId);
        logger.error({ error }, 'Error uploading segment image');
        next(error);
      }
    }
  );

  // ============================================================================
  // Agent API Endpoints (for AI agent integration)
  // ============================================================================

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
        endpoint: `/v1/tenant-admin/${fileType === 'logo' ? 'logo' : fileType === 'segment' ? 'segment-image' : 'tiers/{tierId}/photos'}`,
        fieldName: fileType === 'logo' ? 'logo' : fileType === 'segment' ? 'file' : 'photo',
        maxSizeMB: fileType === 'logo' ? 2 : 5,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        instructions:
          'Upload file using multipart/form-data to the endpoint above. For tier photos, replace {tierId} with the actual tier ID.',
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

      // 1. Get tier photos
      const tiers = await catalogService.getAllTiers(tenantId);
      for (const tier of tiers) {
        if (tier.photoUrl) {
          images.push({
            url: tier.photoUrl,
            type: 'package',
            source: `Tier: ${tier.title}`,
          });
        }
        if (tier.photos && Array.isArray(tier.photos)) {
          for (const photo of tier.photos) {
            if (photo.url) {
              images.push({
                url: photo.url,
                type: 'package',
                source: `Tier: ${tier.title}`,
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
}
