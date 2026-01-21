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

import type {
  PrismaClient,
  AgentTrustTier,
  AgentProposalStatus,
  Prisma,
} from '../../generated/prisma/client';
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
  /** Optional customer ID for ownership verification (customer chatbot proposals) */
  customerId?: string;
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
 * Agent type for context-aware soft-confirm windows
 */
export type AgentType = 'onboarding' | 'customer' | 'admin';

/**
 * T2 soft-confirm windows per agent type (in milliseconds)
 *
 * Different agent types need different confirmation windows:
 * - Onboarding: 10 minutes - users need time to read and think about suggestions
 * - Customer: 2 minutes - quick booking interactions
 * - Admin: 5 minutes - moderate time for business operations
 */
const T2_SOFT_CONFIRM_WINDOWS: Record<AgentType, number> = {
  onboarding: 10 * 60 * 1000, // 10 minutes
  customer: 2 * 60 * 1000, // 2 minutes
  admin: 5 * 60 * 1000, // 5 minutes
};

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
    const { tenantId, sessionId, toolName, operation, trustTier, payload, preview, customerId } =
      input;

    // T1 operations are auto-confirmed
    const isAutoConfirm = trustTier === 'T1';
    const status: AgentProposalStatus = isAutoConfirm ? 'CONFIRMED' : 'PENDING';

    const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);

    const proposal = await this.prisma.agentProposal.create({
      data: {
        tenantId,
        sessionId,
        customerId, // Include upfront to prevent orphaned proposals on crash
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
   *
   * @param tenantId - Tenant ID for isolation
   * @param sessionId - Session ID to query proposals for
   * @param userMessage - User message to check for rejection keywords
   * @param agentType - Agent type for context-aware window (default: 'customer')
   */
  async softConfirmPendingT2(
    tenantId: string,
    sessionId: string,
    userMessage: string,
    agentType: AgentType = 'customer'
  ): Promise<string[]> {
    // Get context-aware window for this agent type
    const windowMs = T2_SOFT_CONFIRM_WINDOWS[agentType];

    // Normalize unicode before pattern matching (prevent lookalike character bypass)
    const normalizedMessage = userMessage.normalize('NFKC');

    // Check for rejection keywords - contextual patterns to avoid false positives
    // Problem: "No, I don't have any questions" or "Wait, I have a question first"
    //          should NOT reject proposals - user is engaging, not canceling
    // Solution: Require explicit rejection context, not just keyword presence at start
    //
    // TODO-537 fix: Made patterns more contextual to reduce false positives like:
    // - "Wait, I have a question first" (just pausing to ask)
    // - "Stop by anytime" (different meaning of "stop")
    // - "Hold that thought" (not same as "hold on")
    const rejectionPatterns = [
      // "No" at start ONLY with explicit cancellation verb following
      /^no,?\s*(don'?t|cancel|stop|wait)\b/i,
      // "Wait" at start ONLY with explicit stop/cancel context (not "Wait, I have a question")
      /^wait[,!]?\s*(don'?t|stop|cancel|no)\b/i,
      // "Stop" at start with explicit object or followed by ", I" (changed mind pattern)
      /^stop[,!]?\s*(that|this|it|the|don'?t|now|i\s+(changed|don'?t|want))\b/i,
      // "Hold on" specifically (not "hold that thought")
      /^hold\s+on\b/i,
      // "Cancel" at start is always a rejection intent
      /^cancel\b/i,
      // Explicit cancel/stop with object anywhere in message
      /\b(cancel|stop)\s+(that|this|it|the)\b/i,
      // Explicit "don't do/proceed/continue" patterns
      /\bdon'?t\s+(do|proceed|continue|make|create|book)\b/i,
      // Repeated "no" (emphatic rejection like "no no no")
      /\bno\s+no\b/i,
      // Common rejection phrases (TODO-545 fix: false negatives)
      /\b(never\s+mind|on\s+second\s+thought)\b/i,
      /\b(scratch\s+that|forget\s+(it|that))\b/i,
      /\bactually,?\s+don'?t\b/i,
    ];

    // Check if message is a very short standalone rejection word
    const shortRejection = /^(no|stop|wait|cancel|hold)\.?!?$/i;
    const isShortRejection = shortRejection.test(normalizedMessage.trim());

    const isRejection =
      isShortRejection || rejectionPatterns.some((p) => p.test(normalizedMessage));

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

    const now = new Date();
    const softConfirmCutoff = new Date(now.getTime() - windowMs);

    // DEBUG: Log query params for troubleshooting
    logger.debug(
      {
        tenantId,
        sessionId,
        agentType,
        windowMs,
        softConfirmCutoff: softConfirmCutoff.toISOString(),
      },
      'T2 soft-confirm query params'
    );

    // Get pending T2 proposals created within the soft-confirm window
    const proposals = await this.prisma.agentProposal.findMany({
      where: {
        tenantId,
        sessionId,
        status: 'PENDING',
        trustTier: 'T2',
        expiresAt: { gt: now },
        createdAt: { gte: softConfirmCutoff }, // Only confirm if within 2-minute window
      },
    });

    if (proposals.length === 0) {
      return [];
    }

    // Auto-confirm T2 proposals within the window
    const proposalIds = proposals.map((p) => p.id);

    await this.prisma.agentProposal.updateMany({
      where: {
        id: { in: proposalIds },
        tenantId, // Defense-in-depth: ensure tenant isolation even though IDs came from tenant-filtered query
      },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    logger.info({ tenantId, sessionId, count: proposalIds.length }, 'T2 proposals soft-confirmed');

    return proposalIds;
  }

  /**
   * Mark proposal as executed
   */
  async markExecuted(proposalId: string, result: Record<string, unknown>): Promise<void> {
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
