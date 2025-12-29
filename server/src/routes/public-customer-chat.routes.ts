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
import type { PrismaClient } from '../generated/prisma';
import { Prisma } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { CustomerOrchestrator } from '../agent/customer';
import { getCustomerProposalExecutor } from '../agent/customer/executor-registry';

/**
 * Create public customer chat routes
 */
export function createPublicCustomerChatRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const orchestrator = new CustomerOrchestrator(prisma);

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

      // Check if API key is configured
      const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

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
  router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      // Check if chat is enabled
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { chatEnabled: true },
      });
      if (!tenant?.chatEnabled) {
        res.status(403).json({ error: 'Chat is not enabled for this business' });
        return;
      }

      const session = await orchestrator.getOrCreateSession(tenantId);
      const greeting = await orchestrator.getGreeting(tenantId);

      res.json({
        sessionId: session.sessionId,
        greeting,
        businessName: session.businessName,
        messageCount: session.messages.length,
      });
    } catch (error) {
      logger.error({ error }, 'Customer chat session error');
      next(error);
    }
  });

  // ============================================================================
  // Chat Messages
  // ============================================================================

  /**
   * POST /message
   * Send a message to the chatbot
   */
  router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      const { message, sessionId } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (message.length > 2000) {
        res.status(400).json({ error: 'Message too long (max 2000 characters)' });
        return;
      }

      // Check if chat is enabled
      const tenantCheck = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { chatEnabled: true },
      });
      if (!tenantCheck?.chatEnabled) {
        res.status(403).json({ error: 'Chat is not enabled for this business' });
        return;
      }

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
          hasProposal: !!response.proposal,
        },
        'Customer chat message processed'
      );

      res.json({
        message: response.message,
        sessionId: response.sessionId,
        proposal: response.proposal,
        toolResults: response.toolResults,
      });
    } catch (error) {
      logger.error({ error }, 'Customer chat message error');
      next(error);
    }
  });

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
      const { sessionId } = req.body as { sessionId?: string };

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required to confirm booking' });
        return;
      }

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

      try {
        // Execute within transaction
        const result = await prisma.$transaction(async (tx) => {
          // Execute the booking
          const customerId = proposal.customerId;
          if (!customerId) {
            throw new Error('Customer ID not found on proposal');
          }

          const executorResult = await executor(
            tenantId,
            customerId,
            proposal.payload as Record<string, unknown>
          );

          // Update proposal as executed
          await tx.agentProposal.update({
            where: { id: proposalId },
            data: {
              status: 'EXECUTED',
              confirmedAt: new Date(),
              executedAt: new Date(),
              result: executorResult as Prisma.JsonObject,
            },
          });

          // Audit log
          await tx.agentAuditLog.create({
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

          return executorResult;
        });

        logger.info(
          { tenantId, proposalId, customerId: proposal.customerId },
          'Customer booking confirmed'
        );

        res.json({
          id: proposalId,
          status: 'EXECUTED',
          result,
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
