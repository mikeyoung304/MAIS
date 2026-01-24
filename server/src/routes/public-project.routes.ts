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
import { validateProjectAccessToken } from '../lib/project-tokens';
import { projectHubSessionLimiter } from '../middleware/rateLimiter';

// ============================================================================
// Request Schemas
// ============================================================================

/** Access token query param schema */
const AccessQuerySchema = z.object({
  token: z.string().min(1, 'Access token is required'),
});

/** Chat session request body schema */
const ChatSessionSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
});

/** Chat message request body schema */
const ChatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)'),
  sessionId: z.string().optional(),
  token: z.string().min(1, 'Access token is required'),
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
   * Access is verified via cryptographically signed JWT token:
   * 1. Token must be present and valid
   * 2. Token must match the projectId in URL
   * 3. Token's tenantId must match request context
   */
  router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { projectId } = req.params;
      const { token } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Validate access token (REQUIRED - no fallback to email)
      if (!token || typeof token !== 'string') {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      const tokenResult = validateProjectAccessToken(token, projectId, 'view');
      if (!tokenResult.valid) {
        // Map token errors to appropriate HTTP status codes
        const statusCode = tokenResult.error === 'expired' ? 401 : 403;
        res.status(statusCode).json({ error: tokenResult.message });
        return;
      }

      // Verify token's tenant matches request context
      if (tokenResult.payload.tenantId !== tenantId) {
        res.status(403).json({ error: 'Access denied' });
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
                select: { id: true, name: true, basePrice: true },
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

      // Verify token's customer ID matches the project's customer
      const projectCustomerId = project.booking.customer?.id ?? project.booking.customerId;
      if (tokenResult.payload.customerId !== projectCustomerId) {
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
          serviceName: project.booking.package?.name ?? 'Service',
          customerName: project.booking.customer?.name ?? 'Customer',
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
   * Requires valid access token.
   */
  router.get('/:projectId/timeline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { projectId } = req.params;
      const { token } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      // Validate access token
      if (!token || typeof token !== 'string') {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      const tokenResult = validateProjectAccessToken(token, projectId, 'view');
      if (!tokenResult.valid) {
        const statusCode = tokenResult.error === 'expired' ? 401 : 403;
        res.status(statusCode).json({ error: tokenResult.message });
        return;
      }

      if (tokenResult.payload.tenantId !== tenantId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Verify project belongs to tenant (still needed for data integrity)
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        select: {
          id: true,
          booking: { select: { customerId: true, customer: { select: { id: true } } } },
        },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Verify customer ID matches token
      const projectCustomerId = project.booking.customer?.id ?? project.booking.customerId;
      if (tokenResult.payload.customerId !== projectCustomerId) {
        res.status(403).json({ error: 'Access denied' });
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
   * Requires valid access token in request body.
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

        // Validate request body (token required)
        const parseResult = ChatSessionSchema.safeParse(req.body);
        if (!parseResult.success) {
          const firstError = parseResult.error.errors[0];
          res.status(400).json({ error: firstError?.message || 'Invalid request' });
          return;
        }

        const { token } = parseResult.data;

        // Validate access token
        const tokenResult = validateProjectAccessToken(token, projectId, 'chat');
        if (!tokenResult.valid) {
          const statusCode = tokenResult.error === 'expired' ? 401 : 403;
          res.status(statusCode).json({ error: tokenResult.message });
          return;
        }

        if (tokenResult.payload.tenantId !== tenantId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        // Verify project exists and get customer info
        const project = await prisma.project.findFirst({
          where: { id: projectId, tenantId },
          include: {
            booking: {
              include: {
                customer: { select: { id: true, name: true } },
                package: { select: { name: true } },
              },
            },
          },
        });

        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        // Verify customer ID matches token
        const projectCustomerId = project.booking.customer?.id ?? project.booking.customerId;
        if (tokenResult.payload.customerId !== projectCustomerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        // Get tenant name
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        const customerName = project.booking.customer?.name ?? 'there';
        const serviceName = project.booking.package?.name ?? 'your service';
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
   * Requires valid access token in request body.
   *
   * Rate limiting (Phase 2 enhancement):
   * - publicProjectRateLimiter: 100/15min per IP (applied at router level)
   * - projectHubSessionLimiter: 15/min per session (per-session burst protection)
   */
  router.post(
    '/:projectId/chat/message',
    projectHubSessionLimiter, // Phase 2: Per-session rate limiting
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

        const { message, sessionId, token } = parseResult.data;

        // Validate access token
        const tokenResult = validateProjectAccessToken(token, projectId, 'chat');
        if (!tokenResult.valid) {
          const statusCode = tokenResult.error === 'expired' ? 401 : 403;
          res.status(statusCode).json({ error: tokenResult.message });
          return;
        }

        if (tokenResult.payload.tenantId !== tenantId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

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

        // Verify customer ID matches token
        const projectCustomerId = project.booking.customer?.id ?? project.booking.customerId;
        if (tokenResult.payload.customerId !== projectCustomerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        const customerId = projectCustomerId;

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

        // Forward to agent with timeout (30s for agent communication per pitfall #46)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
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
            signal: controller.signal,
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

          const agentData = (await agentResponse.json()) as {
            message?: string;
            response?: string;
            sessionId?: string;
            proposals?: unknown[];
          };

          res.json({
            message:
              agentData.message ??
              agentData.response ??
              'I apologize, I encountered an issue processing your request.',
            sessionId: agentData.sessionId ?? sessionId,
            proposals: agentData.proposals ?? [],
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            logger.warn({ projectId, tenantId }, 'Project Hub agent request timed out');
            res.status(504).json({ error: 'Request timed out. Please try again.' });
            return;
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        logger.error({ error }, 'Project chat message error');
        next(error);
      }
    }
  );

  return router;
}
