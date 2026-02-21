/**
 * Tenant Admin Tenant Agent Routes
 *
 * Dashboard API endpoints for chatting with the unified Tenant Agent.
 * Thin route handlers that delegate to TenantAgentService for all
 * chat operations (session creation, messaging, history, recovery).
 *
 * Endpoints:
 * - POST /session - Create session with bootstrap context
 * - GET /session/:id - Get session history
 * - DELETE /session/:id - Close a session
 * - POST /chat - Send a message
 * - GET /onboarding-state - Get onboarding phase and context
 * - POST /skip-onboarding - Skip the onboarding flow
 * - POST /mark-reveal-completed - Mark reveal animation complete
 *
 * @see server/src/services/tenant-agent.service.ts (business logic)
 * @see docs/plans/2026-02-20-feat-tenant-agent-session-persistence-plan.md
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import type { ContextBuilderService } from '../services/context-builder.service';
import type { TenantAgentService } from '../services/tenant-agent.service';

// =============================================================================
// REQUEST SCHEMAS (Pitfall #56: Zod validation for runtime data)
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

interface TenantAgentRoutesDeps {
  tenantAgent: TenantAgentService;
  contextBuilder: ContextBuilderService;
  tenantOnboarding?: import('../services/tenant-onboarding.service').TenantOnboardingService;
}

/**
 * Create tenant admin routes for the unified Tenant Agent.
 * All chat operations delegate to TenantAgentService.
 */
export function createTenantAdminTenantAgentRoutes(deps: TenantAgentRoutesDeps): Router {
  const router = Router();
  const { tenantAgent, contextBuilder, tenantOnboarding } = deps;

  // ===========================================================================
  // POST /session - Create a new session with bootstrap context
  // ===========================================================================

  router.post('/session', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const session = await tenantAgent.createSession(tenantId, slug);

      res.json({
        success: true,
        sessionId: session.sessionId,
        version: session.version,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // GET /session/:id - Get session history
  // ===========================================================================

  router.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const history = await tenantAgent.getSessionHistory(tenantId, slug, sessionId);

      res.json(history);
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      next(error);
    }
  });

  // ===========================================================================
  // DELETE /session/:id - Close a session
  // ===========================================================================

  router.delete('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      logger.info({ tenantId, sessionId }, '[TenantAgent] Session close requested');

      res.json({ success: true, message: 'Session closed' });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /chat - Send a message to the Tenant Agent
  // ===========================================================================

  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = SendMessageSchema.parse(req.body);

      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;

      logger.info({ tenantId, messageLength: message.length }, '[TenantAgent] Message received');

      const result = await tenantAgent.chat(tenantId, slug, message, sessionId);

      res.json({
        success: true,
        sessionId: result.sessionId,
        version: result.version,
        response: result.message,
        dashboardActions: result.dashboardActions,
        toolCalls: result.toolCalls,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // GET /onboarding-state - Get current onboarding phase and context
  // ===========================================================================

  router.get('/onboarding-state', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      const state = await contextBuilder.getOnboardingState(tenantId);

      logger.info(
        { tenantId, status: state.status, factCount: state.factCount },
        '[TenantAgent] Onboarding state retrieved'
      );

      res.json({
        status: state.status,
        isComplete: state.isComplete,
        isReturning: false,
        lastActiveAt: null,
        revealCompleted: state.revealCompleted,
        summaries: {
          discovery: null,
          marketContext: null,
          preferences: null,
          decisions: null,
          pendingQuestions: null,
        },
        resumeMessage: null,
        memory: {
          currentStatus: state.status,
          discoveryData: state.discoveryFacts,
          marketResearchData: null,
          servicesData: null,
          marketingData: null,
          lastEventVersion: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /skip-onboarding - Skip the onboarding process
  // ===========================================================================

  router.post('/skip-onboarding', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      const { reason } = req.body as { reason?: string };

      if (!tenantOnboarding) {
        res.status(503).json({ error: 'Onboarding service unavailable' });
        return;
      }

      try {
        const result = await tenantOnboarding.skipOnboarding(tenantId);

        logger.info(
          { tenantId, previousStatus: result.previousStatus, reason },
          '[TenantAgent] Onboarding skipped'
        );

        res.json({
          success: true,
          status: result.status,
          message: 'Onboarding skipped. You can set up your business manually.',
        });
      } catch (serviceError) {
        const err = serviceError as Error & { status?: string };
        if (err.message === 'Tenant not found') {
          res.status(404).json({ error: 'Tenant not found' });
          return;
        }
        if (err.message === 'Onboarding already finished') {
          res.status(409).json({ error: 'Onboarding already finished', status: err.status });
          return;
        }
        throw serviceError;
      }
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /mark-reveal-completed - Frontend calls after reveal animation
  // ===========================================================================

  router.post(
    '/mark-reveal-completed',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Tenant authentication required' });
          return;
        }

        const { tenantId } = tenantAuth;

        if (!tenantOnboarding) {
          res.status(503).json({ error: 'Onboarding service unavailable' });
          return;
        }

        try {
          const result = await tenantOnboarding.completeReveal(tenantId);

          if (!result.alreadyCompleted) {
            logger.info({ tenantId }, '[TenantAgent] revealCompletedAt written (frontend trigger)');
          }
          res.json({ success: true, alreadyCompleted: result.alreadyCompleted });
        } catch (serviceError) {
          if ((serviceError as Error).message === 'Tenant not found') {
            res.status(404).json({ success: false, error: 'Tenant not found' });
            return;
          }
          throw serviceError;
        }
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
