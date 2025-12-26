/**
 * Agent Proposal Service
 *
 * Server-side approval mechanism for write operations.
 * Implements trust tier enforcement:
 * - T1: Auto-confirmed, executes immediately
 * - T2: Soft confirm, auto-confirms after next message (unless "wait")
 * - T3: Hard confirm, requires explicit confirm_proposal() call
 *
 * Security: Prevents prompt injection from bypassing approval.
 */

import type { PrismaClient, AgentTrustTier, AgentProposalStatus } from '../../generated/prisma';
import { Prisma } from '../../generated/prisma';
import { logger } from '../../lib/core/logger';

/**
 * Proposal creation input
 */
export interface CreateProposalInput {
  tenantId: string;
  sessionId: string;
  toolName: string;
  operation: string;
  trustTier: AgentTrustTier;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
}

/**
 * Proposal result
 */
export interface ProposalResult {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: AgentTrustTier;
  requiresApproval: boolean;
  status: AgentProposalStatus;
  expiresAt: string;
}

/**
 * Proposal TTL in milliseconds (30 minutes)
 */
const PROPOSAL_TTL_MS = 30 * 60 * 1000;

/**
 * Agent Proposal Service
 */
export class ProposalService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new proposal for a write operation
   *
   * For T1 operations, automatically marks as CONFIRMED (will be auto-executed).
   * For T2/T3, creates PENDING proposal awaiting confirmation.
   */
  async createProposal(input: CreateProposalInput): Promise<ProposalResult> {
    const { tenantId, sessionId, toolName, operation, trustTier, payload, preview } = input;

    // T1 operations are auto-confirmed
    const isAutoConfirm = trustTier === 'T1';
    const status: AgentProposalStatus = isAutoConfirm ? 'CONFIRMED' : 'PENDING';

    const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);

    const proposal = await this.prisma.agentProposal.create({
      data: {
        tenantId,
        sessionId,
        toolName,
        operation,
        trustTier,
        payload: payload as Prisma.JsonObject,
        preview: preview as Prisma.JsonObject,
        status,
        requiresApproval: !isAutoConfirm,
        expiresAt,
        confirmedAt: isAutoConfirm ? new Date() : null,
      },
    });

    logger.info(
      { tenantId, proposalId: proposal.id, toolName, trustTier, status },
      'Proposal created'
    );

    return {
      proposalId: proposal.id,
      operation,
      preview,
      trustTier,
      requiresApproval: !isAutoConfirm,
      status,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Get a proposal by ID with tenant isolation
   */
  async getProposal(tenantId: string, proposalId: string) {
    return this.prisma.agentProposal.findFirst({
      where: {
        id: proposalId,
        tenantId, // CRITICAL: Tenant isolation
      },
    });
  }

  /**
   * Confirm a pending proposal
   *
   * Updates status to CONFIRMED. The actual execution happens
   * via the agent.routes.ts confirm endpoint.
   */
  async confirmProposal(tenantId: string, proposalId: string): Promise<ProposalResult | null> {
    const proposal = await this.getProposal(tenantId, proposalId);

    if (!proposal) {
      return null;
    }

    // Check expiration
    if (new Date() > proposal.expiresAt) {
      await this.prisma.agentProposal.update({
        where: { id: proposalId },
        data: { status: 'EXPIRED' },
      });
      return null;
    }

    // Only PENDING proposals can be confirmed
    if (proposal.status !== 'PENDING') {
      return null;
    }

    const updated = await this.prisma.agentProposal.update({
      where: { id: proposalId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    logger.info({ tenantId, proposalId }, 'Proposal confirmed');

    return {
      proposalId: updated.id,
      operation: updated.operation,
      preview: updated.preview as Record<string, unknown>,
      trustTier: updated.trustTier,
      requiresApproval: updated.requiresApproval,
      status: updated.status,
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  /**
   * Reject a pending proposal
   */
  async rejectProposal(tenantId: string, proposalId: string): Promise<boolean> {
    const proposal = await this.getProposal(tenantId, proposalId);

    if (!proposal || proposal.status !== 'PENDING') {
      return false;
    }

    await this.prisma.agentProposal.update({
      where: { id: proposalId },
      data: { status: 'REJECTED' },
    });

    logger.info({ tenantId, proposalId }, 'Proposal rejected');

    return true;
  }

  /**
   * Get all pending proposals for a session
   */
  async getPendingProposals(tenantId: string, sessionId: string) {
    const now = new Date();

    return this.prisma.agentProposal.findMany({
      where: {
        tenantId,
        sessionId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Auto-confirm T2 proposals for a session
   *
   * Called when user sends a message (soft confirm behavior).
   * Only confirms if user didn't say "wait", "stop", etc.
   */
  async softConfirmPendingT2(
    tenantId: string,
    sessionId: string,
    userMessage: string
  ): Promise<string[]> {
    // Check for rejection keywords
    const rejectionPatterns = [
      /\bwait\b/i,
      /\bstop\b/i,
      /\bno\b/i,
      /\bcancel\b/i,
      /\bhold\b/i,
      /\bactually\b/i,
      /\bdon'?t\b/i,
    ];

    const isRejection = rejectionPatterns.some((p) => p.test(userMessage));

    if (isRejection) {
      // Reject all pending T2 proposals
      await this.prisma.agentProposal.updateMany({
        where: {
          tenantId,
          sessionId,
          status: 'PENDING',
          trustTier: 'T2',
        },
        data: { status: 'REJECTED' },
      });
      return [];
    }

    // Get pending T2 proposals
    const proposals = await this.prisma.agentProposal.findMany({
      where: {
        tenantId,
        sessionId,
        status: 'PENDING',
        trustTier: 'T2',
        expiresAt: { gt: new Date() },
      },
    });

    if (proposals.length === 0) {
      return [];
    }

    // Auto-confirm all pending T2 proposals
    const proposalIds = proposals.map((p) => p.id);

    await this.prisma.agentProposal.updateMany({
      where: {
        id: { in: proposalIds },
      },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    logger.info(
      { tenantId, sessionId, count: proposalIds.length },
      'T2 proposals soft-confirmed'
    );

    return proposalIds;
  }

  /**
   * Mark proposal as executed
   */
  async markExecuted(
    proposalId: string,
    result: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.agentProposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        result: result as Prisma.JsonObject,
      },
    });

    logger.info({ proposalId }, 'Proposal executed');
  }

  /**
   * Mark proposal as failed
   */
  async markFailed(proposalId: string, error: string): Promise<void> {
    await this.prisma.agentProposal.update({
      where: { id: proposalId },
      data: {
        status: 'FAILED',
        error,
      },
    });

    logger.error({ proposalId, error }, 'Proposal failed');
  }

  /**
   * Cleanup expired proposals (call periodically)
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.agentProposal.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Expired proposals cleaned up');
    }

    return result.count;
  }
}
