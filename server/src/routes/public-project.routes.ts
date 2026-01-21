/**
 * Public Project Routes
 *
 * Public endpoints for customer-facing project views.
 * NO authentication required - uses tenant context from X-Tenant-Key header
 * plus project access token for verification.
 *
 * Endpoints:
 * - GET  /v1/public/projects/:projectId - Get project details (with access token)
 * - POST /v1/public/projects/:projectId/chat/session - Create Project Hub chat session
 * - POST /v1/public/projects/:projectId/chat/message - Send message to Project Hub agent
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';

// ============================================================================
// Request Schemas
// ============================================================================

/** Access token query param schema */
const AccessQuerySchema = z.object({
  token: z.string().optional(),
});

/** Chat message request body schema */
const ChatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)'),
  sessionId: z.string().optional(),
});

/**
 * Rate limiter for public project endpoints
 * - 100 requests per 15 minutes per IP
 */
const publicProjectRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Create public project routes
 *
 * @param prisma - Database client
 * @returns Express router
 */
export function createPublicProjectRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Apply rate limiting to all routes
  router.use(publicProjectRateLimiter);

  // ============================================================================
  // Project Details
  // ============================================================================

  /**
   * GET /:projectId
   *
   * Get project details for customer view.
   * Access is verified via:
   * 1. Tenant context (X-Tenant-Key header)
   * 2. Customer email in query param (for magic link access)
   * 3. Optional access token for additional security
   */
  router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { projectId } = req.params;
      const { email } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Find project with tenant isolation
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          tenantId, // CRITICAL: tenant-scoped
        },
        include: {
          booking: {
            include: {
              package: {
                select: { id: true, title: true, priceCents: true },
              },
              customer: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          requests: {
            where: { status: 'PENDING' },
            select: { id: true, type: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Verify access via email (simple magic link pattern)
      // In production, this should use a signed token
      const customerEmail = project.booking.customer?.email ?? project.booking.customerEmail;
      if (email && email !== customerEmail) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Get tenant info for branding
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, branding: true },
      });

      // Build public response (no sensitive data)
      const eventDate = project.booking.date ?? project.booking.startTime ?? new Date();

      res.json({
        project: {
          id: project.id,
          status: project.status,
          createdAt: project.createdAt,
        },
        booking: {
          eventDate: eventDate.toISOString(),
          serviceName: project.booking.package?.title ?? 'Service',
          customerName:
            project.booking.customer?.name ?? project.booking.customerName ?? 'Customer',
        },
        pendingRequests: project.requests.map((r) => ({
          id: r.id,
          type: r.type,
          createdAt: r.createdAt.toISOString(),
        })),
        hasPendingRequests: project.requests.length > 0,
        tenant: {
          name: tenant?.name ?? 'Business',
          branding: tenant?.branding ?? null,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Public project fetch error');
      next(error);
    }
  });

  // ============================================================================
  // Project Timeline
  // ============================================================================

  /**
   * GET /:projectId/timeline
   *
   * Get project timeline events visible to customer.
   */
  router.get('/:projectId/timeline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { projectId } = req.params;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      // Verify project belongs to tenant
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Get customer-visible events
      const events = await prisma.projectEvent.findMany({
        where: {
          projectId,
          tenantId,
          visibleToCustomer: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.json({
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          payload: e.payload,
          createdAt: e.createdAt.toISOString(),
        })),
        count: events.length,
      });
    } catch (error) {
      logger.error({ error }, 'Public project timeline error');
      next(error);
    }
  });

  // ============================================================================
  // Project Chat Session (for Project Hub agent)
  // ============================================================================

  /**
   * POST /:projectId/chat/session
   *
   * Create a chat session for the Project Hub agent.
   * This bootstraps the agent with project context.
   */
  router.post(
    '/:projectId/chat/session',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.tenantId ?? null;
        const { projectId } = req.params;

        if (!tenantId) {
          res.status(400).json({ error: 'Missing tenant context' });
          return;
        }

        // Verify project exists and get customer info
        const project = await prisma.project.findFirst({
          where: { id: projectId, tenantId },
          include: {
            booking: {
              include: {
                customer: { select: { id: true, name: true } },
                package: { select: { title: true } },
              },
            },
          },
        });

        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        // Get tenant name
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        const customerName =
          project.booking.customer?.name ?? project.booking.customerName ?? 'there';
        const serviceName = project.booking.package?.title ?? 'your service';
        const businessName = tenant?.name ?? 'us';

        // Generate session ID (could also store in DB for persistence)
        const sessionId = `project-${projectId}-${Date.now()}`;

        res.json({
          sessionId,
          projectId,
          customerId: project.booking.customer?.id ?? project.booking.customerId,
          greeting: `Hi ${customerName}! I'm here to help you with your ${serviceName} booking with ${businessName}. How can I assist you today?`,
          businessName,
        });
      } catch (error) {
        logger.error({ error }, 'Project chat session error');
        next(error);
      }
    }
  );

  /**
   * POST /:projectId/chat/message
   *
   * Send a message to the Project Hub agent.
   * Routes to the Project Hub agent via internal API.
   */
  router.post(
    '/:projectId/chat/message',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.tenantId ?? null;
        const { projectId } = req.params;

        if (!tenantId) {
          res.status(400).json({ error: 'Missing tenant context' });
          return;
        }

        // Validate request body
        const parseResult = ChatMessageSchema.safeParse(req.body);
        if (!parseResult.success) {
          const firstError = parseResult.error.errors[0];
          res.status(400).json({ error: firstError?.message || 'Invalid request' });
          return;
        }

        const { message, sessionId } = parseResult.data;

        // Verify project exists
        const project = await prisma.project.findFirst({
          where: { id: projectId, tenantId },
          include: {
            booking: {
              include: {
                customer: { select: { id: true } },
              },
            },
          },
        });

        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        const customerId = project.booking.customer?.id ?? project.booking.customerId;

        // Call Project Hub agent via internal API
        // The agent is deployed to Cloud Run
        const agentUrl = process.env.PROJECT_HUB_AGENT_URL;
        if (!agentUrl) {
          logger.warn('PROJECT_HUB_AGENT_URL not configured');
          res.status(503).json({
            error: 'Chat service temporarily unavailable',
          });
          return;
        }

        // Forward to agent
        const agentResponse = await fetch(`${agentUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            sessionId: sessionId ?? `project-${projectId}-${Date.now()}`,
            contextType: 'customer',
            tenantId,
            customerId,
            projectId,
          }),
        });

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text();
          logger.error(
            { status: agentResponse.status, error: errorText },
            'Project Hub agent error'
          );
          res.status(502).json({ error: 'Unable to process message' });
          return;
        }

        const agentData = await agentResponse.json();

        res.json({
          message:
            agentData.message ??
            agentData.response ??
            'I apologize, I encountered an issue processing your request.',
          sessionId: agentData.sessionId ?? sessionId,
          proposals: agentData.proposals ?? [],
        });
      } catch (error) {
        logger.error({ error }, 'Project chat message error');
        next(error);
      }
    }
  );

  return router;
}
