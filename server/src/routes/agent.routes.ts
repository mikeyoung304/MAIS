/**
 * Agent Routes
 * API endpoints for AI agent integration
 *
 * These routes support the MAIS Business Growth Agent:
 * - Chat endpoint (POST /v1/agent/chat)
 * - Session management (GET /v1/agent/session)
 * - Proposal confirmation (server-side approval mechanism)
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { PrismaClient, Prisma } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { AdminOrchestrator } from '../agent/orchestrator';
import { buildSessionContext, detectOnboardingState } from '../agent/context/context-builder';
import type { OnboardingState } from '../agent/context/context-builder';
import { AdvisorMemoryService } from '../agent/onboarding/advisor-memory.service';
import { PrismaAdvisorMemoryRepository } from '../adapters/prisma/advisor-memory.repository';
import { appendEvent } from '../agent/onboarding/event-sourcing';
import { parseOnboardingPhase } from '@macon/contracts';

// Re-export executor registry from centralized module
// (Avoids circular dependency with orchestrator.ts)
export {
  type ProposalExecutor,
  registerProposalExecutor,
  getProposalExecutor,
} from '../agent/proposals/executor-registry';
// Also import for local use in this file
import { getProposalExecutor } from '../agent/proposals/executor-registry';
import { validateExecutorPayload } from '../agent/proposals/executor-schemas';

/**
 * Create agent routes
 */
export function createAgentRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize orchestrator (singleton per route instance)
  // AdminOrchestrator includes guardrails (rate limiting, circuit breakers, tier budgets)
  // and automatically switches to onboarding tools when tenant is in onboarding mode
  const orchestrator = new AdminOrchestrator(prisma);

  // Initialize advisor memory service for onboarding
  const advisorMemoryRepository = new PrismaAdvisorMemoryRepository(prisma);
  const advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepository);

  /**
   * Helper to extract tenantId from authenticated request
   */
  const getTenantId = (res: Response): string | null => {
    const tenantAuth = res.locals.tenantAuth;
    return tenantAuth?.tenantId ?? null;
  };

  // ============================================================================
  // Onboarding State Endpoints
  // ============================================================================

  /**
   * GET /v1/agent/onboarding-state
   * Get the current onboarding state and context for the tenant
   *
   * This endpoint provides:
   * - Current onboarding phase (NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING, COMPLETED, SKIPPED)
   * - Memory summaries for context injection
   * - Returning user detection for personalized experience
   *
   * Response:
   * - phase: OnboardingPhase - Current phase
   * - isComplete: boolean - Whether onboarding is finished
   * - isReturning: boolean - Whether this is a returning user
   * - lastActiveAt: string | null - ISO timestamp of last activity
   * - summaries: object - Context summaries for each aspect
   * - resumeMessage: string | null - Human-friendly resume message for returning users
   */
  router.get('/onboarding-state', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const context = await advisorMemoryService.getOnboardingContext(tenantId);
      const resumeMessage = context.isReturning
        ? await advisorMemoryService.getResumeSummary(tenantId)
        : null;

      logger.info(
        { tenantId, phase: context.currentPhase, isReturning: context.isReturning },
        'Onboarding state retrieved'
      );

      res.json({
        phase: context.currentPhase,
        isComplete: context.currentPhase === 'COMPLETED' || context.currentPhase === 'SKIPPED',
        isReturning: context.isReturning,
        lastActiveAt: context.lastActiveAt?.toISOString() ?? null,
        summaries: {
          discovery: context.summaries.discovery || null,
          marketContext: context.summaries.marketContext || null,
          preferences: context.summaries.preferences || null,
          decisions: context.summaries.decisions || null,
          pendingQuestions: context.summaries.pendingQuestions || null,
        },
        resumeMessage,
        // Include memory data if available (for debugging/advanced UI)
        memory: context.memory
          ? {
              currentPhase: context.memory.currentPhase,
              discoveryData: context.memory.discoveryData ?? null,
              marketResearchData: context.memory.marketResearchData ?? null,
              servicesData: context.memory.servicesData ?? null,
              marketingData: context.memory.marketingData ?? null,
              lastEventVersion: context.memory.lastEventVersion,
            }
          : null,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting onboarding state');
      next(error);
    }
  });

  /**
   * POST /v1/agent/skip-onboarding
   * Skip the onboarding process entirely
   *
   * This endpoint allows users to skip onboarding and proceed to manual setup.
   * Creates a SKIPPED event and transitions the phase.
   *
   * Request body:
   * - reason: string (optional) - Why the user is skipping
   *
   * Response:
   * - success: boolean - Whether the skip was successful
   * - phase: OnboardingPhase - New phase (SKIPPED)
   * - message: string - Confirmation message
   */
  router.post('/skip-onboarding', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { reason } = req.body as { reason?: string };

      // Get current tenant state
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingPhase: true,
          onboardingVersion: true,
        },
      });

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const currentPhase = parseOnboardingPhase(tenant.onboardingPhase);
      const currentVersion = tenant.onboardingVersion || 0;

      // Check if already completed or skipped
      if (currentPhase === 'COMPLETED' || currentPhase === 'SKIPPED') {
        res.status(409).json({
          error: 'Onboarding already finished',
          phase: currentPhase,
        });
        return;
      }

      // Append ONBOARDING_SKIPPED event
      const result = await appendEvent(
        prisma,
        tenantId,
        'ONBOARDING_SKIPPED',
        {
          skippedAt: new Date().toISOString(),
          lastPhase: currentPhase,
          reason: reason || undefined,
        },
        currentVersion
      );

      if (!result.success) {
        if (result.error === 'CONCURRENT_MODIFICATION') {
          res.status(409).json({
            error: 'Concurrent modification detected. Please try again.',
            currentVersion: result.currentVersion,
          });
          return;
        }
        res.status(500).json({ error: result.error || 'Failed to skip onboarding' });
        return;
      }

      // Update tenant phase
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: 'SKIPPED',
          onboardingVersion: result.version,
          onboardingCompletedAt: new Date(),
        },
      });

      logger.info({ tenantId, fromPhase: currentPhase, reason }, 'Onboarding skipped');

      res.json({
        success: true,
        phase: 'SKIPPED',
        message: 'Onboarding skipped. You can configure your business manually.',
      });
    } catch (error) {
      logger.error({ error }, 'Error skipping onboarding');
      next(error);
    }
  });

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * GET /v1/agent/health
   * Pre-flight check for chatbot availability
   *
   * Returns:
   * - available: boolean - Whether the chatbot is ready to use
   * - reason: string | null - Why it's unavailable (if applicable)
   * - onboardingState: string - Current onboarding stage
   * - capabilities: string[] - What the chatbot can help with
   */
  router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);

      // Check 1: API key configured
      const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

      // Check 2: Can we build context for this tenant?
      let contextAvailable = false;
      let onboardingState: OnboardingState = 'needs_stripe';

      if (tenantId) {
        try {
          const context = await buildSessionContext(prisma, tenantId, 'health-check');
          contextAvailable = true;
          onboardingState = detectOnboardingState(context);
        } catch (err) {
          logger.warn({ tenantId, error: err }, 'Failed to build context for health check');
          contextAvailable = false;
        }
      }

      // Determine availability reason and user-friendly message
      let reason: string | null = null;
      let message: string | null = null;
      if (!apiKeyConfigured) {
        reason = 'missing_api_key';
        message = 'Our team is setting up your AI assistant. Check back shortly!';
      } else if (!tenantId) {
        reason = 'not_authenticated';
        message = 'Please sign in to access your assistant.';
      } else if (!contextAvailable) {
        reason = 'context_unavailable';
        message = 'Having trouble loading your data. Try again?';
      }

      res.json({
        available: apiKeyConfigured && contextAvailable,
        reason,
        message,
        onboardingState,
        capabilities: ['chat', 'create_packages', 'manage_bookings', 'stripe_onboarding'],
      });
    } catch (error) {
      logger.error({ error }, 'Health check error');
      next(error);
    }
  });

  // ============================================================================
  // Chat Endpoints
  // ============================================================================

  /**
   * POST /v1/agent/chat
   * Send a message to the AI agent and receive a response
   *
   * Request body:
   * - message: string (required) - User's message
   * - sessionId: string (optional) - Existing session ID to continue conversation
   *
   * Response:
   * - message: string - Agent's response
   * - sessionId: string - Session ID for future requests
   * - proposals: array - Any pending proposals that need confirmation
   * - toolResults: array - Results of any tools the agent used
   */
  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { message, sessionId } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (message.length > 10000) {
        res.status(400).json({ error: 'Message too long (max 10000 characters)' });
        return;
      }

      // Get or create session
      let session;
      if (sessionId) {
        session = await orchestrator.getSession(tenantId, sessionId);
        if (!session) {
          // Invalid session ID - create new session
          session = await orchestrator.getOrCreateSession(tenantId);
        }
      } else {
        session = await orchestrator.getOrCreateSession(tenantId);
      }

      // Send message to agent
      const response = await orchestrator.chat(tenantId, session.sessionId, message);

      logger.info(
        {
          tenantId,
          sessionId: session.sessionId,
          messageLength: message.length,
          responseLength: response.message.length,
          toolsUsed: response.toolResults?.length ?? 0,
          proposalsCreated: response.proposals?.length ?? 0,
        },
        'Agent chat completed'
      );

      res.json({
        message: response.message,
        sessionId: session.sessionId,
        proposals: response.proposals,
        toolResults: response.toolResults,
      });
    } catch (error) {
      logger.error({ error }, 'Agent chat error');
      next(error);
    }
  });

  /**
   * GET /v1/agent/session
   * Get or create a session for the current tenant
   *
   * Query params:
   * - sessionId: string (optional) - Get specific session by ID
   *
   * Response:
   * - sessionId: string - Session identifier
   * - greeting: string - Initial greeting based on user context
   * - context: object - Quick stats about the business
   */
  router.get('/session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { sessionId } = req.query;

      // Get or create base session first
      let baseSession;
      if (sessionId && typeof sessionId === 'string') {
        baseSession = await orchestrator.getSession(tenantId, sessionId);
        if (!baseSession) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
      } else {
        baseSession = await orchestrator.getOrCreateSession(tenantId);
      }

      // Get admin session with context (extends base session with context property)
      const session = await orchestrator.getAdminSession(tenantId, baseSession.sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get greeting for this session
      const greeting = await orchestrator.getGreeting(tenantId, session.sessionId);

      res.json({
        sessionId: session.sessionId,
        greeting,
        context: {
          businessName: session.context.businessName,
          businessSlug: session.context.businessSlug,
          quickStats: session.context.quickStats,
        },
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: session.messages.length,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/agent/session/:sessionId/history
   * Get chat history for a session
   */
  router.get(
    '/session/:sessionId/history',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const { sessionId } = req.params;
        const session = await orchestrator.getSession(tenantId, sessionId);

        if (!session) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }

        res.json({
          sessionId: session.sessionId,
          messages: session.messages,
          messageCount: session.messages.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ============================================================================
  // Proposal Endpoints
  // ============================================================================

  /**
   * POST /v1/agent/proposals/:id/confirm
   * Confirm and execute a pending proposal
   *
   * This is the server-side approval mechanism that prevents prompt injection
   * from bypassing user confirmation. The proposal must:
   * 1. Exist and belong to the authenticated tenant
   * 2. Be in PENDING status
   * 3. Not be expired (30 minute TTL)
   *
   * @returns Execution result or error
   */
  router.post('/proposals/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id: proposalId } = req.params;

      // Fetch proposal with tenant isolation
      const proposal = await prisma.agentProposal.findFirst({
        where: {
          id: proposalId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      // Check expiration
      if (new Date() > proposal.expiresAt) {
        // Mark as expired
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: { status: 'EXPIRED' },
        });
        res.status(410).json({ error: 'Proposal has expired' });
        return;
      }

      // Check status
      if (proposal.status !== 'PENDING' && proposal.status !== 'CONFIRMED') {
        res.status(409).json({
          error: `Proposal cannot be confirmed (current status: ${proposal.status})`,
        });
        return;
      }

      // Get executor for this tool
      const executor = getProposalExecutor(proposal.toolName);
      if (!executor) {
        // No executor registered yet - this is OK during development
        // Mark as confirmed but log warning
        logger.warn(
          { tenantId, proposalId, toolName: proposal.toolName },
          'No executor registered for tool - proposal confirmed but not executed'
        );

        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        res.json({
          id: proposalId,
          status: 'CONFIRMED',
          message: 'Proposal confirmed. Executor not yet registered.',
          preview: proposal.preview,
        });
        return;
      }

      // Validate payload schema before execution (prevents malformed/malicious payloads)
      const rawPayload = (proposal.payload as Record<string, unknown>) || {};
      let validatedPayload: Record<string, unknown>;
      try {
        validatedPayload = validateExecutorPayload(proposal.toolName, rawPayload);
      } catch (validationError) {
        const errorMessage =
          validationError instanceof Error ? validationError.message : String(validationError);
        logger.error(
          { tenantId, proposalId, toolName: proposal.toolName, error: errorMessage },
          'Proposal payload validation failed'
        );
        res.status(400).json({ error: `Invalid proposal data: ${errorMessage}` });
        return;
      }

      // Execute the proposal OUTSIDE of a wrapping transaction.
      // Executors manage their own transactions (with advisory locks for booking operations).
      // Wrapping them in an outer transaction causes nested transaction issues in PostgreSQL.
      // See: docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md
      const startTime = Date.now();

      try {
        // Step 1: Execute the proposal (executor handles its own transaction if needed)
        const executorResult = await executor(tenantId, validatedPayload);

        // Step 2: Update proposal status after successful execution
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'EXECUTED',
            confirmedAt: new Date(),
            executedAt: new Date(),
            result: executorResult as Prisma.JsonObject,
          },
        });

        // Step 3: Log audit entry
        await prisma.agentAuditLog.create({
          data: {
            tenantId,
            sessionId: proposal.sessionId,
            toolName: proposal.toolName,
            proposalId,
            inputSummary: `Confirm proposal: ${proposal.operation}`.slice(0, 500),
            outputSummary: JSON.stringify(executorResult).slice(0, 500),
            trustTier: proposal.trustTier,
            approvalStatus: 'EXPLICIT',
            durationMs: Date.now() - startTime,
            success: true,
          },
        });

        logger.info(
          { tenantId, proposalId, toolName: proposal.toolName },
          'Proposal executed successfully'
        );

        res.json({
          id: proposalId,
          status: 'EXECUTED',
          result: executorResult,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Update proposal as failed
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'FAILED',
            error: errorMessage,
            executedAt: new Date(),
          },
        });

        // Log audit for failure
        await prisma.agentAuditLog.create({
          data: {
            tenantId,
            sessionId: proposal.sessionId,
            toolName: proposal.toolName,
            proposalId,
            inputSummary: `Confirm proposal: ${proposal.operation}`.slice(0, 500),
            outputSummary: `Failed: ${errorMessage}`.slice(0, 500),
            trustTier: proposal.trustTier,
            approvalStatus: 'EXPLICIT',
            durationMs: Date.now() - startTime,
            success: false,
            errorMessage,
          },
        });

        res.status(500).json({
          id: proposalId,
          status: 'FAILED',
          error: errorMessage,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/agent/proposals/:id/reject
   * Reject a pending proposal
   */
  router.post('/proposals/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id: proposalId } = req.params;

      // Fetch proposal with tenant isolation
      const proposal = await prisma.agentProposal.findFirst({
        where: {
          id: proposalId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      // Check status
      if (proposal.status !== 'PENDING') {
        res.status(409).json({
          error: `Proposal cannot be rejected (current status: ${proposal.status})`,
        });
        return;
      }

      // Update proposal as rejected
      await prisma.agentProposal.update({
        where: { id: proposalId },
        data: { status: 'REJECTED' },
      });

      // Log audit
      await prisma.agentAuditLog.create({
        data: {
          tenantId,
          sessionId: proposal.sessionId,
          toolName: proposal.toolName,
          proposalId,
          inputSummary: `Reject proposal: ${proposal.operation}`.slice(0, 500),
          outputSummary: 'Rejected by user',
          trustTier: proposal.trustTier,
          approvalStatus: 'EXPLICIT',
          success: true,
        },
      });

      logger.info({ tenantId, proposalId }, 'Proposal rejected');

      res.json({
        id: proposalId,
        status: 'REJECTED',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/agent/proposals/:id
   * Get proposal details
   */
  router.get('/proposals/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id: proposalId } = req.params;

      // Fetch proposal with tenant isolation
      const proposal = await prisma.agentProposal.findFirst({
        where: {
          id: proposalId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      res.json({
        id: proposal.id,
        toolName: proposal.toolName,
        operation: proposal.operation,
        trustTier: proposal.trustTier,
        preview: proposal.preview,
        status: proposal.status,
        requiresApproval: proposal.requiresApproval,
        expiresAt: proposal.expiresAt.toISOString(),
        createdAt: proposal.createdAt.toISOString(),
        confirmedAt: proposal.confirmedAt?.toISOString(),
        executedAt: proposal.executedAt?.toISOString(),
        result: proposal.result,
        error: proposal.error,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/agent/proposals
   * List pending proposals for the current session
   */
  router.get('/proposals', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { sessionId, status } = req.query;

      const proposals = await prisma.agentProposal.findMany({
        where: {
          tenantId, // CRITICAL: Tenant isolation
          ...(sessionId && typeof sessionId === 'string' ? { sessionId } : {}),
          ...(status && typeof status === 'string' ? { status: status as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.json({
        proposals: proposals.map((p) => ({
          id: p.id,
          toolName: p.toolName,
          operation: p.operation,
          trustTier: p.trustTier,
          status: p.status,
          expiresAt: p.expiresAt.toISOString(),
          createdAt: p.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
