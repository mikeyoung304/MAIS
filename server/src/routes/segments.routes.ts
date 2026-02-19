/**
 * Public Segment Routes
 * Endpoints for customers to browse segments and their tiers
 * Requires tenant context via X-Tenant-Key header
 */

import type { Response, NextFunction } from 'express';
import { Router } from 'express';
import type { TenantRequest } from '../middleware/tenant';
import type { SegmentService } from '../services/segment.service';
import { segmentSlugSchema, segmentQuerySchema } from '../validation/segment.schemas';
import { paginateArray } from '../lib/pagination';
import { logger } from '../lib/core/logger';

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

      const skip = Number(req.query.skip) || 0;
      const take = Math.min(Number(req.query.take) || 50, 100);

      // Parse query params (onlyActive defaults to true for public API)
      const query = segmentQuerySchema.parse(req.query);
      const onlyActive = query.onlyActive !== false; // Default true

      const segments = await segmentService.getSegments(tenantId, onlyActive);

      res.json(paginateArray(segments, skip, take));
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/segments/:slug
   * Get single segment by slug
   * Returns segment metadata without tiers
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
      next(error);
    }
  });

  /**
   * GET /v1/segments/:slug/tiers
   * Get segment with tiers and add-ons
   * Used for segment landing pages
   *
   * Returns:
   * - Segment metadata (hero, description, SEO)
   * - Tiers grouped by optional `grouping` field
   * - Both global add-ons (segmentId = null) and segment-specific add-ons
   *
   * @param slug - URL-safe segment identifier
   * @returns 200 - Segment with tiers and add-ons
   * @returns 400 - Invalid slug format
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Segment not found
   * @returns 500 - Internal server error
   */
  router.get('/:slug/tiers', async (req: TenantRequest, res: Response, next: NextFunction) => {
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
        { tenantId, slug, tierCount: segment.tiers?.length || 0 },
        'Segment landing page accessed'
      );

      // Transform tiers to match TierDto format for client consumption
      // Note: segment.tiers are Prisma Tier types (name, sortOrder, photos JSON)
      // mapped to client DTO fields (title, groupingOrder, photoUrl)
      const transformedTiers =
        segment.tiers?.map((tier) => {
          // Extract first photo URL from JSON photos array
          const photos = tier.photos as Array<{ url?: string }> | null;
          const photoUrl = Array.isArray(photos) ? photos[0]?.url : undefined;

          return {
            id: tier.id,
            slug: tier.slug,
            title: tier.name,
            description: tier.description || '',
            priceCents: tier.priceCents,
            photoUrl: photoUrl || undefined,
            grouping: null,
            groupingOrder: tier.sortOrder ?? null,
            addOns:
              tier.addOns?.map((ta) => ({
                id: ta.addOn.id,
                title: ta.addOn.name,
                description: ta.addOn.description || '',
                priceCents: ta.addOn.price,
              })) || [],
          };
        }) || [];

      // Transform add-ons to match AddOnDto format
      // Note: segment.addOns are Prisma AddOn types (name, price)
      const transformedAddOns =
        segment.addOns?.map((addOn) => ({
          id: addOn.id,
          title: addOn.name,
          description: addOn.description || '',
          priceCents: addOn.price,
        })) || [];

      res.json({
        ...segment,
        tiers: transformedTiers,
        addOns: transformedAddOns,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
