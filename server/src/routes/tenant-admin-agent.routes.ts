/**
 * Tenant Admin Agent Routes
 *
 * Dashboard API endpoints for chatting with the Concierge agent.
 * These are tenant-authenticated routes for the admin dashboard.
 *
 * Endpoints:
 * - POST /api/agent/chat - Send a message and get a response
 * - GET /api/agent/session/:id - Get session history
 * - POST /api/agent/session - Create a new session
 * - DELETE /api/agent/session/:id - Close a session
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../lib/core/logger';
import { VertexAgentService, createVertexAgentService } from '../services/vertex-agent.service';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
});

const SessionIdSchema = z.object({
  id: z.string().min(1),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface TenantAdminAgentRoutesDeps {
  vertexAgentService?: VertexAgentService;
}

/**
 * Create tenant admin agent routes for dashboard chat integration.
 *
 * @param deps - Dependencies (optional, will create default if not provided)
 * @returns Express router
 */
export function createTenantAdminAgentRoutes(deps: TenantAdminAgentRoutesDeps = {}): Router {
  const router = Router();

  // Use provided service or create new instance
  const agentService = deps.vertexAgentService || createVertexAgentService();

  // ===========================================================================
  // POST /chat - Send a message to the Concierge agent
  // ===========================================================================

  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, sessionId: providedSessionId } = SendMessageSchema.parse(req.body);

      // Get tenant context from auth middleware (res.locals.tenantAuth)
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = slug; // Use tenant slug as user ID for simplicity

      logger.info({ tenantId, messageLength: message.length }, '[AgentChat] Message received');

      // Get or create session
      // If a sessionId was provided, verify it exists. If not, create a new session.
      // This handles server restarts where the in-memory session store is cleared.
      let sessionId = providedSessionId;
      if (sessionId) {
        // Verify the session still exists (might be stale after server restart)
        const existingSession = agentService.getSession(sessionId);
        if (!existingSession) {
          logger.info(
            { tenantId, staleSessionId: sessionId },
            '[AgentChat] Stale session detected, creating new session'
          );
          // Session doesn't exist anymore, create a new one
          const newSession = await agentService.getOrCreateSession(tenantId, userId);
          sessionId = newSession.sessionId;
        }
      } else {
        const session = await agentService.getOrCreateSession(tenantId, userId);
        sessionId = session.sessionId;
      }

      // Send message and get response
      const result = await agentService.sendMessage(sessionId, message);

      // Return response
      res.json({
        success: true,
        sessionId: result.sessionId,
        response: result.response,
        toolCalls: result.toolCalls,
        error: result.error,
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

      // Verify session belongs to tenant
      const session = agentService.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (session.tenantId !== tenantId) {
        res.status(403).json({ error: 'Session does not belong to this tenant' });
        return;
      }

      // Get session history
      const messages = agentService.getSessionHistory(sessionId);

      res.json({
        session: {
          sessionId: session.sessionId,
          createdAt: session.createdAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session.messageCount,
        },
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls,
        })),
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

      // Verify session belongs to tenant
      const session = agentService.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (session.tenantId !== tenantId) {
        res.status(403).json({ error: 'Session does not belong to this tenant' });
        return;
      }

      // Close session
      agentService.closeSession(sessionId);

      logger.info({ tenantId, sessionId }, '[AgentChat] Session closed');

      res.json({
        success: true,
        message: 'Session closed',
      });
    } catch (error) {
      handleError(res, error, '/session/:id');
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
