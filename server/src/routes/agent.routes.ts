/**
 * Agent Routes
 * API endpoints for AI agent integration
 *
 * These routes support the MAIS Business Growth Agent:
 * - Proposal confirmation (server-side approval mechanism)
 * - Future: Session management, context injection
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors';

/**
 * Proposal executor registry
 * Maps tool names to their execution functions
 * This will be populated by the MCP server layer
 */
export type ProposalExecutor = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const proposalExecutors = new Map<string, ProposalExecutor>();

/**
 * Register a proposal executor for a tool
 * Called by MCP server during initialization
 */
export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void {
  proposalExecutors.set(toolName, executor);
}

/**
 * Create agent routes
 */
export function createAgentRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * Helper to extract tenantId from authenticated request
   */
  const getTenantId = (res: Response): string | null => {
    const tenantAuth = res.locals.tenantAuth;
    return tenantAuth?.tenantId ?? null;
  };

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
      const executor = proposalExecutors.get(proposal.toolName);
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

      // Execute the proposal
      const startTime = Date.now();
      let result: Record<string, unknown>;
      let success = true;
      let errorMessage: string | undefined;

      try {
        result = await executor(tenantId, proposal.payload as Record<string, unknown>);
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result = { error: errorMessage };

        // Update proposal as failed
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'FAILED',
            error: errorMessage,
            executedAt: new Date(),
          },
        });

        // Log audit
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
        return;
      }

      // Update proposal as executed
      await prisma.agentProposal.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          confirmedAt: new Date(),
          executedAt: new Date(),
          result,
        },
      });

      // Log audit
      await prisma.agentAuditLog.create({
        data: {
          tenantId,
          sessionId: proposal.sessionId,
          toolName: proposal.toolName,
          proposalId,
          inputSummary: `Confirm proposal: ${proposal.operation}`.slice(0, 500),
          outputSummary: JSON.stringify(result).slice(0, 500),
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
        result,
      });
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
