/**
 * Internal Agent Content Segments Routes
 *
 * CRUD operations on tenant segments.
 *
 * Called by: tenant-agent's manage_segments tool
 */

import type { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { handleError, TenantIdSchema, slugify } from './internal-agent-shared';
import type { MarketingRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Constants
// =============================================================================

const MAX_SEGMENTS_PER_TENANT = 5;

// =============================================================================
// Schemas
// =============================================================================

const ManageSegmentsSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  segmentId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  active: z.boolean().optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerSegmentRoutes(router: Router, deps: MarketingRoutesDeps): void {
  const { tenantRepo, segmentService } = deps;

  // POST /manage-segments - CRUD on tenant segments
  router.post('/manage-segments', async (req: Request, res: Response) => {
    try {
      const params = ManageSegmentsSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-segments' },
        '[Agent] Segment management request'
      );

      if (!segmentService) {
        res.status(503).json({ error: 'Segment service not available' });
        return;
      }

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          const segments = await segmentService.getSegments(tenantId, false);
          const formatted = segments.map((seg) => ({
            id: seg.id,
            name: seg.name,
            slug: seg.slug,
            sortOrder: seg.sortOrder,
            active: seg.active,
          }));

          res.json({
            segments: formatted,
            totalCount: formatted.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'create': {
          if (!params.name) {
            res.status(400).json({ error: 'name is required for create' });
            return;
          }

          // Enforce max segments per tenant
          const existingSegments = await segmentService.getSegments(tenantId, false);
          if (existingSegments.length >= MAX_SEGMENTS_PER_TENANT) {
            res.status(400).json({
              error: `Maximum ${MAX_SEGMENTS_PER_TENANT} segments per tenant. Delete one first.`,
            });
            return;
          }

          const slug = params.slug || slugify(params.name);
          const maxSort = existingSegments.reduce((max, s) => Math.max(max, s.sortOrder), 0);

          const newSegment = await segmentService.createSegment({
            tenantId,
            name: params.name,
            slug,
            heroTitle: params.name, // Default heroTitle to segment name
            sortOrder: maxSort + 1,
            active: params.active ?? true,
          });

          const allSegments = await segmentService.getSegments(tenantId, false);

          logger.info(
            { tenantId, segmentId: newSegment.id, name: newSegment.name },
            '[Agent] Segment created'
          );

          res.json({
            segment: {
              id: newSegment.id,
              name: newSegment.name,
              slug: newSegment.slug,
              sortOrder: newSegment.sortOrder,
              active: newSegment.active,
            },
            totalCount: allSegments.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'update': {
          if (!params.segmentId) {
            res.status(400).json({ error: 'segmentId is required for update' });
            return;
          }

          const updateData: { name?: string; slug?: string; active?: boolean } = {};
          if (params.name) updateData.name = params.name;
          if (params.slug) updateData.slug = params.slug;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await segmentService.updateSegment(
            tenantId,
            params.segmentId,
            updateData
          );

          const allSegments = await segmentService.getSegments(tenantId, false);

          logger.info(
            { tenantId, segmentId: updated.id, updates: Object.keys(updateData) },
            '[Agent] Segment updated'
          );

          res.json({
            segment: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              sortOrder: updated.sortOrder,
              active: updated.active,
            },
            totalCount: allSegments.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'delete': {
          if (!params.segmentId) {
            res.status(400).json({ error: 'segmentId is required for delete' });
            return;
          }

          await segmentService.deleteSegment(tenantId, params.segmentId);

          const remainingSegments = await segmentService.getSegments(tenantId, false);

          logger.info({ tenantId, deletedSegmentId: params.segmentId }, '[Agent] Segment deleted');

          res.json({
            deletedId: params.segmentId,
            totalCount: remainingSegments.length,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-segments');
    }
  });
}
