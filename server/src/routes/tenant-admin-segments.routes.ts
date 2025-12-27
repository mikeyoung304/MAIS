/**
 * Tenant Admin Segment Routes
 * Authenticated routes for tenant administrators to manage their segments
 * Requires tenant admin authentication via JWT
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';
import type { SegmentService } from '../services/segment.service';
import {
  createSegmentSchema,
  updateSegmentSchema,
  segmentIdSchema,
} from '../validation/segment.schemas';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError } from '../lib/errors';

/**
 * Create tenant admin segment routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param segmentService - Segment service instance
 * @returns Express router with tenant admin segment endpoints
 */
export function createTenantAdminSegmentsRouter(segmentService: SegmentService): Router {
  const router = Router();

  /**
   * GET /v1/tenant/admin/segments
   * List all segments (including inactive) for authenticated tenant
   * Used in tenant admin dashboard for segment management
   *
   * @returns 200 - Array of all segments ordered by sortOrder
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

      // Include inactive segments for admin view
      const segments = await segmentService.getSegments(tenantId, false);

      res.json(segments);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant/admin/segments
   * Create new segment for authenticated tenant
   *
   * Request body: CreateSegmentInput (validated by Zod)
   * {
   *   slug: string,           // URL-safe (lowercase, alphanumeric, hyphens)
   *   name: string,           // Display name
   *   heroTitle: string,      // Landing page hero title
   *   heroSubtitle?: string,  // Optional subtitle
   *   heroImage?: string,     // Optional hero image URL
   *   description?: string,   // Extended description
   *   metaTitle?: string,     // SEO title
   *   metaDescription?: string, // SEO description
   *   sortOrder?: number,     // Display order (default 0)
   *   active?: boolean        // Visibility (default true)
   * }
   *
   * @returns 201 - Created segment object
   * @returns 400 - Validation error or duplicate slug
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate request body
      const data = createSegmentSchema.parse(req.body);

      // Create segment (service handles slug validation and cache invalidation)
      const segment = await segmentService.createSegment({
        ...data,
        tenantId,
      });

      logger.info(
        { tenantId, segmentId: segment.id, slug: segment.slug },
        'Segment created by tenant admin'
      );

      res.status(201).json(segment);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /v1/tenant/admin/segments/:id
   * Get segment details by ID
   * Verifies segment belongs to authenticated tenant
   *
   * @param id - Segment CUID
   * @returns 200 - Segment object
   * @returns 400 - Invalid ID format
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Segment not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate ID format
      const params = segmentIdSchema.parse(req.params);
      const { id } = params;

      // Get segment with tenant isolation (automatic ownership verification)
      const segment = await segmentService.getSegmentById(tenantId, id);

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
   * PUT /v1/tenant/admin/segments/:id
   * Update segment
   * Verifies segment belongs to authenticated tenant
   *
   * Request body: Partial<CreateSegmentInput>
   * All fields optional for partial updates
   *
   * @param id - Segment CUID
   * @returns 200 - Updated segment object
   * @returns 400 - Validation error or duplicate slug
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Segment not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate ID format
      const params = segmentIdSchema.parse(req.params);
      const { id } = params;

      // Validate update data (partial schema)
      const data = updateSegmentSchema.parse(req.body);

      // Update segment with tenant isolation (automatic ownership verification)
      const segment = await segmentService.updateSegment(tenantId, id, data);

      logger.info(
        { tenantId, segmentId: segment.id, slug: segment.slug },
        'Segment updated by tenant admin'
      );

      res.json(segment);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
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
   * DELETE /v1/tenant/admin/segments/:id
   * Delete segment
   * Verifies segment belongs to authenticated tenant
   * Sets package.segmentId to null for affected packages (cascade: SetNull)
   *
   * @param id - Segment CUID
   * @returns 204 - Segment deleted successfully
   * @returns 400 - Invalid ID format
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Segment not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate ID format
      const params = segmentIdSchema.parse(req.params);
      const { id } = params;

      // Delete segment with tenant isolation (automatic ownership verification)
      await segmentService.deleteSegment(tenantId, id);

      logger.info({ tenantId, segmentId: id }, 'Segment deleted by tenant admin');

      res.status(204).send();
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
   * GET /v1/tenant/admin/segments/:id/stats
   * Get segment statistics
   * Returns count of packages and add-ons for the segment
   *
   * @param id - Segment CUID
   * @returns 200 - Statistics object { packageCount, addOnCount }
   * @returns 400 - Invalid ID format
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Segment not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate ID format
      const params = segmentIdSchema.parse(req.params);
      const { id } = params;

      // Get stats with tenant isolation (automatic ownership verification)
      const stats = await segmentService.getSegmentStats(tenantId, id);

      res.json(stats);
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
