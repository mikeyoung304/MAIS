/**
 * Internal Agent Project Hub Routes
 *
 * Dual-faced customer-tenant communication system.
 * 9 endpoints for project CRUD, timeline, and request management.
 *
 * Called by: customer-agent (bootstrap-customer, timeline, create-request)
 *           tenant-agent (bootstrap-tenant, pending-requests, approve/deny, list-projects)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { verifyInternalSecret, handleError, TenantIdSchema } from './internal-agent-shared';
import type { ProjectHubRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

const ProjectHubBootstrapCustomerSchema = TenantIdSchema.extend({
  customerId: z.string().min(1, 'customerId is required'),
  // projectId is optional for backwards compatibility - when provided, looks up specific project
  // When omitted, falls back to finding any active project for the customer (legacy behavior)
  projectId: z.string().optional(),
});

const ProjectHubGetProjectSchema = TenantIdSchema.extend({
  projectId: z.string().min(1, 'projectId is required'),
});

const ProjectHubGetTimelineSchema = TenantIdSchema.extend({
  projectId: z.string().min(1, 'projectId is required'),
  actor: z.enum(['customer', 'tenant']).default('customer'),
});

const PROJECT_REQUEST_TYPES = [
  'RESCHEDULE',
  'ADD_ON',
  'QUESTION',
  'CHANGE_REQUEST',
  'CANCELLATION',
  'REFUND',
  'OTHER',
] as const;

const ProjectHubCreateRequestSchema = TenantIdSchema.extend({
  projectId: z.string().min(1, 'projectId is required'),
  type: z.enum(PROJECT_REQUEST_TYPES),
  requestData: z.record(z.unknown()),
});

const ProjectHubHandleRequestSchema = TenantIdSchema.extend({
  requestId: z.string().min(1, 'requestId is required'),
  expectedVersion: z.number().int().min(1),
  response: z.string().optional(),
});

const ProjectHubDenyRequestSchema = ProjectHubHandleRequestSchema.extend({
  reason: z.string().min(1, 'reason is required'),
});

const ProjectHubListProjectsSchema = TenantIdSchema.extend({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).optional(),
});

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal agent project hub routes.
 *
 * Mounted at `/project-hub` by the aggregator.
 * All paths below are relative (e.g., `/bootstrap-customer`).
 */
export function createInternalAgentProjectHubRoutes(deps: ProjectHubRoutesDeps): Router {
  const router = Router();
  const { projectHubService, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // POST /bootstrap-customer - Initialize customer session
  router.post('/bootstrap-customer', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, customerId, projectId } = ProjectHubBootstrapCustomerSchema.parse(req.body);

      logger.info(
        { tenantId, customerId, projectId, endpoint: '/project-hub/bootstrap-customer' },
        '[Agent] Bootstrapping customer session'
      );

      const result = await projectHubService.bootstrapCustomer(tenantId, customerId, projectId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/bootstrap-customer');
    }
  });

  // POST /bootstrap-tenant - Initialize tenant session
  router.post('/bootstrap-tenant', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/project-hub/bootstrap-tenant' },
        '[Agent] Bootstrapping tenant session'
      );

      const result = await projectHubService.bootstrapTenant(tenantId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/bootstrap-tenant');
    }
  });

  // POST /project-details - Get project with booking info
  router.post('/project-details', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId } = ProjectHubGetProjectSchema.parse(req.body);

      logger.info(
        { tenantId, projectId, endpoint: '/project-hub/project-details' },
        '[Agent] Getting project details'
      );

      const result = await projectHubService.getProjectDetails(tenantId, projectId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/project-details');
    }
  });

  // POST /timeline - Get project timeline events
  router.post('/timeline', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId, actor } = ProjectHubGetTimelineSchema.parse(req.body);

      logger.info(
        { tenantId, projectId, actor, endpoint: '/project-hub/timeline' },
        '[Agent] Getting project timeline'
      );

      const events = await projectHubService.getTimeline(tenantId, projectId, actor);

      res.json({ events, count: events.length });
    } catch (error) {
      handleError(res, error, '/project-hub/timeline');
    }
  });

  // POST /pending-requests - Get pending requests for tenant
  router.post('/pending-requests', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/project-hub/pending-requests' },
        '[Agent] Getting pending requests'
      );

      const result = await projectHubService.getPendingRequests(tenantId);

      res.json({
        requests: result.requests,
        count: result.requests.length,
        hasMore: result.hasMore,
      });
    } catch (error) {
      handleError(res, error, '/project-hub/pending-requests');
    }
  });

  // POST /create-request - Create a customer request
  router.post('/create-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId, type, requestData } = ProjectHubCreateRequestSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, projectId, type, endpoint: '/project-hub/create-request' },
        '[Agent] Creating request'
      );

      const request = await projectHubService.createRequest({
        tenantId,
        projectId,
        type,
        requestData,
      });

      res.json({ success: true, request, expiresAt: request.expiresAt });
    } catch (error) {
      handleError(res, error, '/project-hub/create-request');
    }
  });

  // POST /approve-request - Approve a pending request (with optimistic locking)
  router.post('/approve-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, requestId, expectedVersion, response } =
        ProjectHubHandleRequestSchema.parse(req.body);

      logger.info(
        { tenantId, requestId, expectedVersion, endpoint: '/project-hub/approve-request' },
        '[Agent] Approving request'
      );

      const request = await projectHubService.approveRequest({
        tenantId,
        requestId,
        expectedVersion,
        response,
      });

      res.json({ success: true, request });
    } catch (error) {
      handleError(res, error, '/project-hub/approve-request');
    }
  });

  // POST /deny-request - Deny a pending request (with optimistic locking)
  router.post('/deny-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, requestId, expectedVersion, reason, response } =
        ProjectHubDenyRequestSchema.parse(req.body);

      logger.info(
        { tenantId, requestId, expectedVersion, endpoint: '/project-hub/deny-request' },
        '[Agent] Denying request'
      );

      const request = await projectHubService.denyRequest({
        tenantId,
        requestId,
        expectedVersion,
        reason,
        response,
      });

      res.json({ success: true, request });
    } catch (error) {
      handleError(res, error, '/project-hub/deny-request');
    }
  });

  // POST /list-projects - List all projects for tenant
  router.post('/list-projects', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, status } = ProjectHubListProjectsSchema.parse(req.body);

      logger.info(
        { tenantId, status, endpoint: '/project-hub/list-projects' },
        '[Agent] Listing projects'
      );

      const result = await projectHubService.listProjects(tenantId, status);

      res.json({
        projects: result.projects,
        count: result.projects.length,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      handleError(res, error, '/project-hub/list-projects');
    }
  });

  return router;
}
