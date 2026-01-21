/**
 * Public Customer Chat Routes
 *
 * Public endpoints for customer-facing chatbot.
 * NO authentication required - uses tenant context from X-Tenant-Key header.
 *
 * Endpoints:
 * - GET  /v1/public/chat/health    - Check if chatbot is available
 * - POST /v1/public/chat/session   - Create or get chat session
 * - POST /v1/public/chat/message   - Send message to chatbot
 * - POST /v1/public/chat/confirm   - Confirm a booking proposal
 * - GET  /v1/public/chat/greeting  - Get initial greeting message
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { CustomerChatOrchestrator } from '../agent/orchestrator';
import { getCustomerProposalExecutor } from '../agent/customer/executor-registry';
import { validateExecutorPayload } from '../agent/proposals/executor-schemas';

// ============================================================================
// Request Body Schemas (TS-4: Typed request validation)
// ============================================================================

/** Message endpoint request body schema */
const MessageRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)'),
  sessionId: z.string().optional(),
});

/** Confirm endpoint request body schema */
const ConfirmRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required to confirm booking'),
});

/**
 * IP-based rate limiter for public chat endpoints
 * - 50 requests per 15 minutes per IP
 * - Protects against abuse from unauthenticated sources
 * - Separate from agent-level rate limiting (which is per-session)
 *
 * NOTE: Uses default keyGenerator (req.ip) which works correctly because
 * app.set('trust proxy', 1) is configured in app.ts. This makes Express
 * extract the real client IP from X-Forwarded-For in a secure way:
 * - Takes rightmost IP minus trusted proxy count (prevents spoofing)
 * - Falls back to socket address if no proxy headers
 * See: https://expressjs.com/en/guide/behind-proxies.html
 */
const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable deprecated headers
  // Default keyGenerator uses req.ip which is correctly set by trust proxy
});

/**
 * Middleware factory to require chat to be enabled for tenant.
 * Returns 403 if chat is disabled or tenant not found.
 */
function createRequireChatEnabled(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.tenantId ?? null;

    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { chatEnabled: true },
    });

    if (!tenant?.chatEnabled) {
      res.status(403).json({ error: 'Chat is not enabled for this business' });
      return;
    }

    next();
  };
}

/**
 * Create public customer chat routes
 */
export function createPublicCustomerChatRoutes(prisma: PrismaClient): Router {
  const router = Router();
  // CustomerChatOrchestrator includes guardrails (rate limiting, circuit breakers, tier budgets)
  // and prompt injection detection for public-facing endpoints
  const orchestrator = new CustomerChatOrchestrator(prisma);
  const requireChatEnabled = createRequireChatEnabled(prisma);

  // Apply IP rate limiting to all routes
  router.use(publicChatRateLimiter);

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * GET /health
   * Check if chatbot is available for this tenant
   */
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.json({
          available: false,
          reason: 'missing_tenant',
          message: 'Business not found.',
        });
        return;
      }

      // Check if LLM API is configured (Vertex AI via ADC)
      const apiKeyConfigured = !!process.env.GOOGLE_VERTEX_PROJECT;

      // Check if tenant has chat enabled
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { chatEnabled: true, name: true },
      });

      if (!tenant) {
        res.json({
          available: false,
          reason: 'tenant_not_found',
          message: 'Business not found.',
        });
        return;
      }

      if (!tenant.chatEnabled) {
        res.json({
          available: false,
          reason: 'chat_disabled',
          message: 'Chat is not available for this business.',
        });
        return;
      }

      if (!apiKeyConfigured) {
        res.json({
          available: false,
          reason: 'api_not_configured',
          message: 'Chat is temporarily unavailable.',
        });
        return;
      }

      res.json({
        available: true,
        businessName: tenant.name,
      });
    } catch (error) {
      logger.error({ error }, 'Customer chat health check error');
      next(error);
    }
  });

  // ============================================================================
  // Greeting
  // ============================================================================

  /**
   * GET /greeting
   * Get initial greeting message for chat widget
   */
  router.get('/greeting', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      const greeting = await orchestrator.getGreeting(tenantId);

      res.json({ greeting });
    } catch (error) {
      logger.error({ error }, 'Customer chat greeting error');
      next(error);
    }
  });

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * POST /session
   * Create or get existing chat session
   */
  router.post(
    '/session',
    requireChatEnabled,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // tenantId guaranteed by requireChatEnabled middleware
        const tenantId = req.tenantId!;

        const session = await orchestrator.getOrCreateSession(tenantId);
        const greeting = await orchestrator.getGreeting(tenantId);

        // Get business name from tenant (not stored in session)
        const tenantInfo = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        res.json({
          sessionId: session.sessionId,
          greeting,
          businessName: tenantInfo?.name ?? null,
          messageCount: session.messages.length,
        });
      } catch (error) {
        logger.error({ error }, 'Customer chat session error');
        next(error);
      }
    }
  );

  // ============================================================================
  // Chat Messages
  // ============================================================================

  /**
   * POST /message
   * Send a message to the chatbot
   */
  router.post(
    '/message',
    requireChatEnabled,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // tenantId guaranteed by requireChatEnabled middleware
        const tenantId = req.tenantId!;

        // Validate request body with Zod
        const parseResult = MessageRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          const firstError = parseResult.error.errors[0];
          res.status(400).json({ error: firstError?.message || 'Invalid request' });
          return;
        }

        const { message, sessionId } = parseResult.data;

        // Get or create session, validating ownership if sessionId provided
        let actualSessionId = sessionId;
        if (actualSessionId) {
          // Validate that sessionId belongs to this tenant
          const session = await orchestrator.getSession(tenantId, actualSessionId);
          if (!session) {
            res.status(400).json({ error: 'Invalid or expired session' });
            return;
          }
        } else {
          const session = await orchestrator.getOrCreateSession(tenantId);
          actualSessionId = session.sessionId;
        }

        // Send message to orchestrator
        const response = await orchestrator.chat(tenantId, actualSessionId, message);

        logger.info(
          {
            tenantId,
            sessionId: actualSessionId,
            messageLength: message.length,
            responseLength: response.message.length,
            hasProposals: !!response.proposals?.length,
          },
          'Customer chat message processed'
        );

        res.json({
          message: response.message,
          sessionId: response.sessionId,
          proposals: response.proposals,
          toolResults: response.toolResults,
        });
      } catch (error) {
        logger.error({ error }, 'Customer chat message error');
        next(error);
      }
    }
  );

  // ============================================================================
  // Proposal Confirmation
  // ============================================================================

  /**
   * POST /confirm/:proposalId
   * Confirm and execute a booking proposal
   */
  router.post('/confirm/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      const { proposalId } = req.params;

      // SECURITY: sessionId is REQUIRED for ownership verification
      // Prevents proposal enumeration attacks (P1 fix from code review)
      const parseResult = ConfirmRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        res.status(400).json({ error: firstError?.message || 'Session ID is required' });
        return;
      }

      const { sessionId } = parseResult.data;

      // Build where clause with tenant isolation AND session ownership
      const whereClause: { id: string; tenantId: string; sessionId: string } = {
        id: proposalId,
        tenantId, // CRITICAL: Tenant isolation
        sessionId, // CRITICAL: Session ownership (P1 fix)
      };

      // Fetch proposal with tenant + session isolation
      const proposal = await prisma.agentProposal.findFirst({
        where: whereClause,
      });

      if (!proposal) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      // Check expiration
      if (new Date() > proposal.expiresAt) {
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: { status: 'EXPIRED' },
        });
        res.status(410).json({ error: 'This booking has expired. Please try again.' });
        return;
      }

      // Check status
      if (proposal.status !== 'PENDING') {
        res.status(409).json({
          error:
            proposal.status === 'EXECUTED'
              ? 'This booking has already been confirmed.'
              : `Booking cannot be confirmed (status: ${proposal.status})`,
        });
        return;
      }

      // Get executor for this operation
      const executor = getCustomerProposalExecutor(proposal.operation);

      if (!executor) {
        logger.warn(
          { tenantId, proposalId, operation: proposal.operation },
          'No executor for customer proposal'
        );
        res.status(500).json({ error: 'Unable to process booking. Please try again.' });
        return;
      }

      const startTime = Date.now();

      // Validate payload schema before execution (prevents malformed/malicious payloads)
      const rawPayload = (proposal.payload as Record<string, unknown>) || {};
      let validatedPayload: Record<string, unknown>;
      try {
        validatedPayload = validateExecutorPayload(proposal.operation, rawPayload);
      } catch (validationError) {
        const errorMessage =
          validationError instanceof Error ? validationError.message : String(validationError);
        logger.error(
          { tenantId, proposalId, operation: proposal.operation, error: errorMessage },
          'Customer proposal payload validation failed'
        );
        res.status(400).json({ error: 'Invalid booking data. Please try again.' });
        return;
      }

      // Execute OUTSIDE of a wrapping transaction.
      // Executors manage their own transactions (with advisory locks for booking operations).
      // Wrapping them in an outer transaction causes nested transaction issues in PostgreSQL.
      // See: docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md
      try {
        // Step 1: Verify customer exists and belongs to tenant (before executor)
        const customerId = proposal.customerId;
        if (!customerId) {
          throw new Error('Customer ID not found on proposal');
        }

        // Verify customer belongs to this tenant (multi-tenant security)
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, tenantId },
        });
        if (!customer) {
          throw new Error('Customer not found or access denied');
        }

        // Step 2: Execute the booking (executor handles its own transaction if needed)
        const executorResult = await executor(tenantId, customerId, validatedPayload);

        // Step 3: Update proposal status after successful execution
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'EXECUTED',
            confirmedAt: new Date(),
            executedAt: new Date(),
            result: executorResult as Prisma.JsonObject,
          },
        });

        // Step 4: Log audit entry
        await prisma.agentAuditLog.create({
          data: {
            tenantId,
            sessionId: proposal.sessionId,
            toolName: proposal.toolName,
            proposalId,
            inputSummary: `Confirm customer booking: ${proposal.operation}`.slice(0, 500),
            outputSummary: JSON.stringify(executorResult).slice(0, 500),
            trustTier: proposal.trustTier,
            approvalStatus: 'EXPLICIT',
            durationMs: Date.now() - startTime,
            success: true,
          },
        });

        logger.info(
          { tenantId, proposalId, customerId: proposal.customerId },
          'Customer booking confirmed'
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

        // Audit log
        await prisma.agentAuditLog.create({
          data: {
            tenantId,
            sessionId: proposal.sessionId,
            toolName: proposal.toolName,
            proposalId,
            inputSummary: `Confirm customer booking: ${proposal.operation}`.slice(0, 500),
            outputSummary: `Failed: ${errorMessage}`.slice(0, 500),
            trustTier: proposal.trustTier,
            approvalStatus: 'EXPLICIT',
            durationMs: Date.now() - startTime,
            success: false,
            errorMessage,
          },
        });

        logger.error({ error, tenantId, proposalId }, 'Customer booking failed');
        res.status(500).json({
          id: proposalId,
          status: 'FAILED',
          error: 'Booking failed. Please try again.',
        });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
