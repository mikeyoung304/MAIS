/**
 * Tenant Admin Projects Routes
 *
 * Authenticated endpoints for tenant project management.
 * Requires tenant admin authentication via createTenantAuthMiddleware.
 *
 * Endpoints:
 * - GET  /projects                    - List all projects for tenant
 * - GET  /projects/bootstrap          - Get dashboard summary
 * - GET  /projects/requests/pending   - Get pending requests
 * - POST /projects/requests/approve   - Approve a request
 * - POST /projects/requests/deny      - Deny a request
 * - GET  /projects/:projectId         - Get project details
 * - GET  /projects/:projectId/timeline - Get project timeline
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { ProjectHubService } from '../services/project-hub.service';
import { logger } from '../lib/core/logger';

// Rate limiter for tenant admin routes (higher limit than public routes)
const tenantProjectRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min (higher for authenticated tenants)
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  keyGenerator: (_req, res) => (res as Response).locals.tenantAuth?.tenantId || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Request Schemas
// ============================================================================

const ApproveRequestSchema = z.object({
  requestId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  response: z.string().optional(),
});

const DenyRequestSchema = z.object({
  requestId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  reason: z.string().min(1),
  response: z.string().optional(),
});

// ============================================================================
// Route Factory
// ============================================================================

/**
 * Create tenant admin project routes
 *
 * @param projectHubService - Project Hub service instance
 * @returns Express router
 */
export function createTenantAdminProjectRoutes(projectHubService: ProjectHubService): Router {
  const router = Router();

  // Apply rate limiting to all tenant admin project routes
  router.use(tenantProjectRateLimiter);

  // ============================================================================
  // Bootstrap / Dashboard Summary
  // ============================================================================

  /**
   * GET /bootstrap
   * Get dashboard summary for tenant
   */
  router.get('/bootstrap', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const bootstrap = await projectHubService.bootstrapTenant(tenantId);
      res.json(bootstrap);
    } catch (error) {
      logger.error({ error }, 'Tenant projects bootstrap error');
      next(error);
    }
  });

  // ============================================================================
  // Projects List
  // ============================================================================

  /**
   * GET /
   * List projects for tenant with pagination
   * Query params: status, cursor, limit
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { status, cursor, limit } = req.query;
      const statusFilter = status
        ? (status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD')
        : undefined;
      const cursorParam = typeof cursor === 'string' ? cursor : undefined;
      const limitParam = typeof limit === 'string' ? Math.min(parseInt(limit, 10), 100) : 50;

      const result = await projectHubService.listProjects(
        tenantId,
        statusFilter,
        cursorParam,
        limitParam
      );
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Tenant projects list error');
      next(error);
    }
  });

  // ============================================================================
  // Pending Requests
  // ============================================================================

  /**
   * GET /requests/pending
   * Get pending requests for tenant with limit
   * Query params: limit
   */
  router.get('/requests/pending', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { limit } = req.query;
      const limitParam = typeof limit === 'string' ? Math.min(parseInt(limit, 10), 100) : 50;

      const result = await projectHubService.getPendingRequests(tenantId, limitParam);
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Tenant pending requests error');
      next(error);
    }
  });

  // ============================================================================
  // Request Actions
  // ============================================================================

  /**
   * POST /requests/approve
   * Approve a pending request
   */
  router.post('/requests/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const parseResult = ApproveRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        res.status(400).json({ error: firstError?.message || 'Invalid request' });
        return;
      }

      const { requestId, expectedVersion, response } = parseResult.data;

      const result = await projectHubService.approveRequest({
        tenantId,
        requestId,
        expectedVersion,
        response,
      });

      res.json({ success: true, request: result });
    } catch (error) {
      logger.error({ error }, 'Tenant request approve error');
      next(error);
    }
  });

  /**
   * POST /requests/deny
   * Deny a pending request
   */
  router.post('/requests/deny', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const parseResult = DenyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        res.status(400).json({ error: firstError?.message || 'Invalid request' });
        return;
      }

      const { requestId, expectedVersion, reason, response } = parseResult.data;

      const result = await projectHubService.denyRequest({
        tenantId,
        requestId,
        expectedVersion,
        reason,
        response,
      });

      res.json({ success: true, request: result });
    } catch (error) {
      logger.error({ error }, 'Tenant request deny error');
      next(error);
    }
  });

  // ============================================================================
  // Project Details
  // ============================================================================

  /**
   * GET /:projectId
   * Get project details
   */
  router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId } = req.params;
      const project = await projectHubService.getProjectDetails(tenantId, projectId);

      res.json(project);
    } catch (error) {
      logger.error({ error }, 'Tenant project details error');
      next(error);
    }
  });

  /**
   * GET /:projectId/timeline
   * Get project timeline for tenant view
   */
  router.get('/:projectId/timeline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals.tenantAuth?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId } = req.params;
      const events = await projectHubService.getTimeline(tenantId, projectId, 'tenant');

      res.json({ events, count: events.length });
    } catch (error) {
      logger.error({ error }, 'Tenant project timeline error');
      next(error);
    }
  });

  return router;
}
