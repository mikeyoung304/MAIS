/**
 * Public Segment Routes
 * Endpoints for customers to browse segments and their packages
 * Requires tenant context via X-Tenant-Key header
 */

import type { Response, NextFunction } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';
import type { TenantRequest } from '../middleware/tenant';
import type { SegmentService } from '../services/segment.service';
import { segmentSlugSchema, segmentQuerySchema } from '../validation/segment.schemas';
import { logger } from '../lib/core/logger';
import { NotFoundError } from '../lib/errors';

/**
 * Create public segment routes
 *
 * @param segmentService - Segment service instance
 * @returns Express router with segment endpoints
 */
export function createSegmentsRouter(segmentService: SegmentService): Router {
  const router = Router();

  /**
   * GET /v1/segments
   * List all active segments for the tenant
   * Used for homepage segment navigation/cards
   *
   * @returns 200 - Array of active segments ordered by sortOrder
   * @returns 401 - Missing or invalid tenant key
   * @returns 500 - Internal server error
   */
  router.get('/', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // Parse query params (onlyActive defaults to true for public API)
      const query = segmentQuerySchema.parse(req.query);
      const onlyActive = query.onlyActive !== false; // Default true

      const segments = await segmentService.getSegments(tenantId, onlyActive);

      res.json(segments);
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
   * GET /v1/segments/:slug
   * Get single segment by slug
   * Returns segment metadata without packages
   *
   * @param slug - URL-safe segment identifier (e.g., "wellness-retreat")
   * @returns 200 - Segment object
   * @returns 400 - Invalid slug format
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Segment not found
   * @returns 500 - Internal server error
   */
  router.get('/:slug', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // Validate slug format
      const params = segmentSlugSchema.parse(req.params);
      const { slug } = params;

      const segment = await segmentService.getSegmentBySlug(tenantId, slug);

      res.json(segment);
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

  /**
   * GET /v1/segments/:slug/packages
   * Get segment with packages and add-ons
   * Used for segment landing pages
   *
   * Returns:
   * - Segment metadata (hero, description, SEO)
   * - Packages grouped by optional `grouping` field
   * - Both global add-ons (segmentId = null) and segment-specific add-ons
   *
   * @param slug - URL-safe segment identifier
   * @returns 200 - Segment with packages and add-ons
   * @returns 400 - Invalid slug format
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Segment not found
   * @returns 500 - Internal server error
   */
  router.get('/:slug/packages', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // Validate slug format
      const params = segmentSlugSchema.parse(req.params);
      const { slug } = params;

      const segment = await segmentService.getSegmentWithRelations(tenantId, slug);

      logger.info(
        { tenantId, slug, packageCount: segment.packages?.length || 0 },
        'Segment landing page accessed'
      );

      // Transform packages to match PackageDto format for client consumption
      const transformedPackages =
        segment.packages?.map((pkg) => {
          // Parse photos JSON to get first photo URL
          let photoUrl: string | undefined;
          if (pkg.photos) {
            try {
              const photosArray =
                typeof pkg.photos === 'string' ? JSON.parse(pkg.photos) : pkg.photos;
              if (Array.isArray(photosArray) && photosArray.length > 0) {
                photoUrl = photosArray[0]?.url;
              }
            } catch {
              // Ignore JSON parse errors
            }
          }

          return {
            id: pkg.id,
            slug: pkg.slug,
            title: pkg.name, // Map name -> title
            description: pkg.description || '',
            priceCents: pkg.basePrice, // Map basePrice -> priceCents
            photoUrl,
            // Include tier grouping fields for storefront display
            grouping: pkg.grouping || null,
            groupingOrder: pkg.groupingOrder ?? null,
            addOns:
              pkg.addOns?.map((pa) => ({
                id: pa.addOn.id,
                title: pa.addOn.name,
                description: pa.addOn.description || '',
                priceCents: pa.addOn.price,
              })) || [],
          };
        }) || [];

      // Transform add-ons to match AddOnDto format
      const transformedAddOns =
        segment.addOns?.map((addOn) => ({
          id: addOn.id,
          title: addOn.name,
          description: addOn.description || '',
          priceCents: addOn.price,
        })) || [];

      res.json({
        ...segment,
        packages: transformedPackages,
        addOns: transformedAddOns,
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

  return router;
}
