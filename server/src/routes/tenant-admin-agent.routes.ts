/**
 * Tenant Admin Agent Routes
 *
 * Dashboard API endpoints for chatting with the Concierge agent.
 * These are tenant-authenticated routes for the admin dashboard.
 *
 * Endpoints:
 * - POST /chat - Send a message and get a response
 * - GET /session/:id - Get session history
 * - POST /session - Create a new session
 * - DELETE /session/:id - Close a session
 * - GET /onboarding-state - Get onboarding phase and context
 * - POST /skip-onboarding - Skip the onboarding flow
 *
 * @see plans/LEGACY_AGENT_MIGRATION_PLAN.md
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { VertexAgentService, createVertexAgentService } from '../services/vertex-agent.service';
import {
  ContextBuilderService,
  createContextBuilderService,
} from '../services/context-builder.service';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
  version: z.number().int().min(0).optional(), // Client-side version for optimistic locking
});

const SessionIdSchema = z.object({
  id: z.string().min(1),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface TenantAdminAgentRoutesDeps {
  vertexAgentService?: VertexAgentService;
  prisma: PrismaClient;
}

/**
 * Create tenant admin agent routes for dashboard chat integration.
 *
 * @param deps - Dependencies (prisma is required)
 * @returns Express router
 */
export function createTenantAdminAgentRoutes(deps: TenantAdminAgentRoutesDeps): Router {
  const router = Router();
  const prisma = deps.prisma;

  // Use provided service or create new instance with Prisma
  const agentService = deps.vertexAgentService || createVertexAgentService(prisma);

  // Initialize context builder service (replaces legacy AdvisorMemoryService)
  const contextBuilder = createContextBuilderService(prisma);

  // ===========================================================================
  // POST /chat - Send a message to the Concierge agent
  // ===========================================================================

  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const {
        message,
        sessionId: providedSessionId,
        version: providedVersion,
      } = SendMessageSchema.parse(req.body);

      // Get tenant context from auth middleware (res.locals.tenantAuth)
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = slug; // Use tenant slug as user ID for simplicity
      const userAgent = req.get('User-Agent');

      logger.info({ tenantId, messageLength: message.length }, '[AgentChat] Message received');

      // Get or create session
      // Now restores sessions from PostgreSQL, surviving server restarts!
      let sessionId = providedSessionId;
      let version: number;

      if (sessionId) {
        // Try to restore session from database
        const existingSession = await agentService.getSession(sessionId, tenantId);
        if (!existingSession) {
          logger.info(
            { tenantId, staleSessionId: sessionId },
            '[AgentChat] Session not found, creating new session'
          );
          // Session doesn't exist anymore, create a new one
          const newSession = await agentService.getOrCreateSession(
            tenantId,
            userId,
            undefined,
            userAgent
          );
          sessionId = newSession.sessionId;
          version = newSession.version;
        } else {
          // Existing session: require version for optimistic locking (Pitfall #69)
          if (providedVersion === undefined) {
            res.status(400).json({
              error: 'Version required for existing session',
              currentVersion: existingSession.version,
            });
            return;
          }
          version = providedVersion;
        }
      } else {
        const session = await agentService.getOrCreateSession(
          tenantId,
          userId,
          undefined,
          userAgent
        );
        sessionId = session.sessionId;
        version = session.version;
      }

      // Send message and get response (now persisted to PostgreSQL)
      const result = await agentService.sendMessage(sessionId, tenantId, message, version);

      // Handle concurrent modification (Pitfall #69: Optimistic locking enforcement)
      if (result.error === 'Concurrent modification detected') {
        res.status(409).json({
          success: false,
          error: 'CONCURRENT_MODIFICATION',
          message: result.response,
          currentVersion: result.version,
        });
        return;
      }

      // Return response with version for client-side tracking
      res.json({
        success: true,
        sessionId: result.sessionId,
        version: result.version,
        response: result.response,
        toolCalls: result.toolCalls,
      });
    } catch (error) {
      handleError(res, error, '/chat');
    }
  });

  // ===========================================================================
  // GET /session/:id - Get session history
  // ===========================================================================

  router.get('/session/:id', async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // Get session (now fetched from PostgreSQL)
      // Tenant scoping is enforced by SessionService - no need to verify separately
      const session = await agentService.getSession(sessionId, tenantId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get session history (now fetched from PostgreSQL with pagination)
      const history = await agentService.getSessionHistory(sessionId, tenantId);

      res.json({
        session: {
          sessionId: session.sessionId,
          createdAt: session.createdAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session.messageCount,
          version: session.version,
        },
        messages: history.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls,
        })),
        hasMore: history.hasMore,
        total: history.total,
      });
    } catch (error) {
      handleError(res, error, '/session/:id');
    }
  });

  // ===========================================================================
  // POST /session - Create a new session
  // ===========================================================================

  router.post('/session', async (_req: Request, res: Response) => {
    try {
      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = slug;

      // Create new session
      const sessionId = await agentService.createSession(tenantId, userId);

      logger.info({ tenantId, sessionId }, '[AgentChat] Session created');

      res.json({
        success: true,
        sessionId,
      });
    } catch (error) {
      handleError(res, error, '/session');
    }
  });

  // ===========================================================================
  // DELETE /session/:id - Close a session
  // ===========================================================================

  router.delete('/session/:id', async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // Close session (soft delete - now handled by SessionService with tenant scoping)
      await agentService.closeSession(sessionId, tenantId);

      logger.info({ tenantId, sessionId }, '[AgentChat] Session closed');

      res.json({
        success: true,
        message: 'Session closed',
      });
    } catch (error) {
      handleError(res, error, '/session/:id');
    }
  });

  // ===========================================================================
  // GET /onboarding-state - Get current onboarding phase and context
  // ===========================================================================

  router.get('/onboarding-state', async (_req: Request, res: Response) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // Use ContextBuilder for state (replaces legacy AdvisorMemoryService)
      const state = await contextBuilder.getOnboardingState(tenantId);

      logger.info(
        { tenantId, phase: state.phase, factCount: state.factCount },
        '[Onboarding] State retrieved'
      );

      res.json({
        phase: state.phase,
        isComplete: state.isComplete,
        isReturning: false, // Simplified: ContextBuilder doesn't track sessions
        lastActiveAt: null,
        summaries: {
          discovery: null,
          marketContext: null,
          preferences: null,
          decisions: null,
          pendingQuestions: null,
        },
        resumeMessage: null,
        // Provide discovery facts in a consistent format
        memory: {
          currentPhase: state.phase,
          discoveryData: state.discoveryFacts,
          marketResearchData: null,
          servicesData: null,
          marketingData: null,
          lastEventVersion: 0,
        },
      });
    } catch (error) {
      handleError(res, error, '/onboarding-state');
    }
  });

  // ===========================================================================
  // POST /skip-onboarding - Skip the onboarding process
  // ===========================================================================

  router.post('/skip-onboarding', async (req: Request, res: Response) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      const { reason } = req.body as { reason?: string };

      // Get current tenant state
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingPhase: true,
        },
      });

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const currentPhase = tenant.onboardingPhase || 'NOT_STARTED';

      // Check if already completed or skipped
      if (currentPhase === 'COMPLETED' || currentPhase === 'SKIPPED') {
        res.status(409).json({
          error: 'Onboarding already finished',
          phase: currentPhase,
        });
        return;
      }

      // Direct state update (replaces event sourcing)
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: 'SKIPPED',
          onboardingCompletedAt: new Date(), // onboardingDone doesn't exist - use completedAt timestamp
        },
      });

      logger.info({ tenantId, previousPhase: currentPhase, reason }, '[Onboarding] Skipped');

      res.json({
        success: true,
        phase: 'SKIPPED',
        message: 'Onboarding skipped. You can set up your business manually.',
      });
    } catch (error) {
      handleError(res, error, '/skip-onboarding');
    }
  });

  return router;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function handleError(res: Response, error: unknown, endpoint: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  logger.error({ error, endpoint }, '[AgentChat] Internal error');

  res.status(500).json({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}
