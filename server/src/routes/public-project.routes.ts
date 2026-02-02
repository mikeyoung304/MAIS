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
import { validateProjectAccessToken, generateProjectAccessToken } from '../lib/project-tokens';
import { projectHubSessionLimiter, projectHubChatLimiter } from '../middleware/rateLimiter';
import {
  createProjectHubAgentService,
  type ContextType,
} from '../services/project-hub-agent.service';

// ============================================================================
// Request Schemas
// ============================================================================

/** Access token query param schema */
const _AccessQuerySchema = z.object({
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
  // Project Lookup by Booking (for success page)
  // ============================================================================

  /**
   * GET /by-booking/:bookingId
   *
   * Simple lookup to get projectId from bookingId.
   * Used by success page to link to Project Hub after payment.
   * No token required - just returns projectId (no sensitive data).
   */
  router.get('/by-booking/:bookingId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { bookingId } = req.params;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      if (!bookingId) {
        res.status(400).json({ error: 'Booking ID is required' });
        return;
      }

      // Find project by booking ID (tenant-scoped)
      const project = await prisma.project.findFirst({
        where: {
          bookingId,
          tenantId, // CRITICAL: tenant-scoped
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          customerId: true,
        },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found for this booking' });
        return;
      }

      // Generate a fresh access token for immediate Project Hub access
      // This token allows the customer to access their project right after payment
      const accessToken = generateProjectAccessToken(
        project.id,
        tenantId,
        project.customerId,
        'view', // View permission (also allows chat)
        30 // 30-day validity
      );

      res.json({
        projectId: project.id,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        accessToken, // Token for Project Hub access
      });
    } catch (error) {
      logger.error({ error }, 'Project lookup by booking error');
      next(error);
    }
  });

  /**
   * GET /by-session/:sessionId
   *
   * Lookup project by Stripe session ID.
   * Used by success page since Stripe redirects with session_id, not booking_id.
   * Chains: sessionId → Payment.processorId → Booking → Project
   */
  router.get('/by-session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;
      const { sessionId } = req.params;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Find payment by Stripe session ID (tenant-scoped)
      // Payment.processorId stores the Stripe checkout session ID
      const payment = await prisma.payment.findFirst({
        where: {
          processorId: sessionId,
          tenantId, // CRITICAL: tenant-scoped
        },
        select: {
          bookingId: true,
        },
      });

      if (!payment) {
        // Payment not found - webhook may not have processed yet
        // Return 404 so client can retry with polling
        res.status(404).json({
          error: 'Payment not found for this session',
          retryable: true,
        });
        return;
      }

      // Find project by booking ID
      const project = await prisma.project.findFirst({
        where: {
          bookingId: payment.bookingId,
          tenantId, // CRITICAL: tenant-scoped
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          customerId: true,
        },
      });

      if (!project) {
        // Booking exists but project doesn't - creation may be pending
        res.status(404).json({
          error: 'Project not found for this session',
          retryable: true,
        });
        return;
      }

      // Generate access token for Project Hub
      const accessToken = generateProjectAccessToken(
        project.id,
        tenantId,
        project.customerId,
        'view',
        30 // 30-day validity
      );

      res.json({
        projectId: project.id,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        accessToken,
      });
    } catch (error) {
      logger.error({ error, sessionId: req.params.sessionId }, 'Project lookup by session error');
      next(error);
    }
  });

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

      // Verify token's customer ID matches the project's customerId
      // Note: project.customerId stores the email (set in booking.service.ts during project creation)
      // Token is generated with project.customerId, so we must validate against the same field
      if (tokenResult.payload.customerId !== project.customerId) {
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
          customerId: true, // Used for token validation
          booking: { select: { customerId: true, customer: { select: { id: true } } } },
        },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Verify customer ID matches token (uses project.customerId which is the email)
      if (tokenResult.payload.customerId !== project.customerId) {
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

        // Verify customer ID matches token (uses project.customerId which is the email)
        if (tokenResult.payload.customerId !== project.customerId) {
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

        // SECURITY: contextType is 'customer' because token auth = customer access
        const contextType: ContextType = 'customer';
        const customerId = project.customerId;

        // Create REAL ADK session (not just a local ID)
        const agentService = createProjectHubAgentService();
        let sessionId: string;

        try {
          sessionId = await agentService.createSession(
            tenantId,
            customerId,
            projectId,
            contextType
          );
          logger.info(
            { projectId, sessionId, contextType },
            '[ProjectHubChat] ADK session created'
          );
        } catch (sessionError) {
          logger.error(
            { projectId, error: sessionError },
            '[ProjectHubChat] Failed to create ADK session'
          );
          res.status(503).json({
            error: 'Chat service temporarily unavailable',
            errorType: 'agent_unavailable',
          });
          return;
        }

        res.json({
          sessionId,
          projectId,
          customerId,
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
   * Uses ProjectHubAgentService for proper Identity Token auth to Cloud Run.
   * Requires valid access token in request body.
   *
   * Rate limiting (layered protection):
   * - publicProjectRateLimiter: 100/15min per IP (applied at router level)
   * - projectHubChatLimiter: 30/min per project (project-level quota)
   * - projectHubSessionLimiter: 15/min per session (per-session burst protection)
   *
   * SECURITY: contextType is determined by backend from verified token,
   * never from request body (prevents context escalation attacks).
   */
  router.post(
    '/:projectId/chat/message',
    projectHubChatLimiter, // 30/min per project
    projectHubSessionLimiter, // 15/min per session
    async (req: Request, res: Response, next: NextFunction) => {
      // Generate request ID for correlation
      const requestId = `prj-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

        // SECURITY: Re-verify role from token (never trust request body contextType)
        // This is the authoritative source for determining user context
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
          select: {
            id: true,
            customerId: true,
          },
        });

        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        // Verify customer ID matches token (uses project.customerId which is the email)
        if (tokenResult.payload.customerId !== project.customerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        const customerId = project.customerId;

        // SECURITY: contextType is 'customer' because token auth = customer access
        // Tenant access would come through authenticated session (Phase 1b)
        const contextType: ContextType = 'customer';

        // Use ProjectHubAgentService for proper Cloud Run authentication
        const agentService = createProjectHubAgentService();

        // Create session if needed, or use existing
        let activeSessionId = sessionId;
        if (!activeSessionId) {
          try {
            activeSessionId = await agentService.createSession(
              tenantId,
              customerId,
              projectId,
              contextType,
              requestId
            );
            logger.info(
              { requestId, projectId, sessionId: activeSessionId, contextType },
              '[ProjectHubChat] New session created'
            );
          } catch (sessionError) {
            logger.error(
              { requestId, projectId, error: sessionError },
              '[ProjectHubChat] Failed to create session'
            );
            res.status(503).json({
              error: 'Chat service temporarily unavailable',
              errorType: 'agent_unavailable',
            });
            return;
          }
        }

        // Send message to agent
        const agentResult = await agentService.sendMessage(
          activeSessionId,
          tenantId,
          customerId,
          message,
          requestId
        );

        // Handle agent errors
        if (agentResult.error) {
          logger.warn(
            { requestId, projectId, error: agentResult.error },
            '[ProjectHubChat] Agent returned error'
          );

          // Map error types to HTTP status codes
          if (agentResult.error === 'timeout') {
            res.status(504).json({
              error: 'Request timed out. Please try again.',
              errorType: 'agent_timeout',
              sessionId: activeSessionId,
            });
            return;
          }

          if (agentResult.error === 'session_not_found') {
            res.status(410).json({
              error: 'Session expired. Please refresh.',
              errorType: 'session_expired',
            });
            return;
          }

          // Default to 502 for other agent errors
          res.status(502).json({
            error: 'Unable to process message',
            errorType: 'agent_error',
            sessionId: activeSessionId,
          });
          return;
        }

        // Success response
        res.json({
          message: agentResult.response,
          sessionId: agentResult.sessionId,
          toolCalls: agentResult.toolCalls,
        });
      } catch (error) {
        logger.error({ requestId, error }, '[ProjectHubChat] Unexpected error');
        next(error);
      }
    }
  );

  return router;
}
