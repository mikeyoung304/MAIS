/**
 * Review Actions Service
 *
 * Records and manages actions taken during human review of flagged conversations.
 * Tracks the outcome of reviews for learning and improvement.
 *
 * Action types:
 * - approve: Score was correct, no action needed
 * - reject: Score was wrong, needs correction
 * - escalate: Needs senior review
 * - retrain: Add to training data
 * - prompt_updated: System prompt was modified
 * - bug_filed: Bug ticket created
 *
 * @see plans/agent-evaluation-system.md Phase 5.4
 */

import type { PrismaClient, ReviewAction } from '../../generated/prisma';
import { TraceNotFoundError, TenantAccessDeniedError } from '../../lib/errors/agent-eval-errors';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Types of review actions that can be taken.
 */
export type ReviewActionType =
  | 'approve' // Score correct, no action needed
  | 'reject' // Score wrong, needs correction
  | 'escalate' // Needs senior review
  | 'retrain' // Add to training data
  | 'prompt_updated' // Prompt was modified
  | 'bug_filed'; // Bug ticket created

/**
 * Input for recording a review action.
 */
export interface ReviewActionInput {
  traceId: string;
  action: ReviewActionType;
  notes?: string;
  correctedScore?: number;
  performedBy: string;
}

/**
 * Action statistics.
 */
export interface ActionStats {
  totalActions: number;
  actionBreakdown: Record<ReviewActionType, number>;
  avgCorrectedScoreDelta: number;
  mostCommonAction: ReviewActionType | null;
}

/**
 * Review action with trace context.
 */
export interface ReviewActionWithContext extends ReviewAction {
  trace?: {
    agentType: string;
    evalScore: number | null;
    startedAt: Date;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Action Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Service for recording and retrieving review actions.
 *
 * Usage:
 * ```typescript
 * const service = new ReviewActionService(prisma);
 * await service.recordAction(tenantId, {
 *   traceId: 'trace-123',
 *   action: 'approve',
 *   notes: 'Agent responded appropriately',
 *   performedBy: 'user@example.com',
 * });
 * ```
 */
export class ReviewActionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record a review action.
   * P0 Security: Validates trace belongs to tenant.
   */
  async recordAction(tenantId: string, input: ReviewActionInput): Promise<ReviewAction> {
    // P0 Security: Validate trace belongs to tenant
    const trace = await this.prisma.conversationTrace.findFirst({
      where: { id: input.traceId, tenantId },
    });

    if (!trace) {
      throw new TraceNotFoundError(input.traceId);
    }

    // Record the action and update trace in a transaction
    const [action] = await this.prisma.$transaction([
      this.prisma.reviewAction.create({
        data: {
          tenantId,
          traceId: input.traceId,
          action: input.action,
          notes: input.notes,
          correctedScore: input.correctedScore,
          performedBy: input.performedBy,
        },
      }),
      // Update trace status
      this.prisma.conversationTrace.update({
        where: { id: input.traceId },
        data: {
          reviewStatus: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: input.performedBy,
          reviewNotes: input.notes,
          // Use corrected score if provided
          ...(input.correctedScore !== undefined && {
            evalScore: input.correctedScore,
          }),
        },
      }),
    ]);

    return action;
  }

  /**
   * Get all actions for a specific trace.
   */
  async getActionsForTrace(tenantId: string, traceId: string): Promise<ReviewAction[]> {
    // Validate access - tenant must own the trace
    const trace = await this.prisma.conversationTrace.findFirst({
      where: { id: traceId, tenantId },
    });

    if (!trace) {
      throw new TraceNotFoundError(traceId);
    }

    return this.prisma.reviewAction.findMany({
      where: { traceId },
      orderBy: { performedAt: 'desc' },
    });
  }

  /**
   * Get recent actions for a tenant.
   */
  async getRecentActions(
    tenantId: string,
    options: { limit?: number; action?: ReviewActionType } = {}
  ): Promise<ReviewActionWithContext[]> {
    const { limit = 50, action } = options;

    const actions = await this.prisma.reviewAction.findMany({
      where: {
        tenantId,
        ...(action && { action }),
      },
      orderBy: { performedAt: 'desc' },
      take: limit,
      include: {
        trace: {
          select: {
            agentType: true,
            evalScore: true,
            startedAt: true,
          },
        },
      },
    });

    return actions;
  }

  /**
   * Get action statistics for a tenant.
   */
  async getActionStats(tenantId: string, options: { since?: Date } = {}): Promise<ActionStats> {
    const { since } = options;

    const [actionCounts, correctionStats] = await Promise.all([
      // Count by action type
      this.prisma.reviewAction.groupBy({
        by: ['action'],
        where: {
          tenantId,
          ...(since && { performedAt: { gte: since } }),
        },
        _count: true,
      }),
      // Get correction score stats
      this.prisma.reviewAction.aggregate({
        where: {
          tenantId,
          correctedScore: { not: null },
          ...(since && { performedAt: { gte: since } }),
        },
        _avg: { correctedScore: true },
        _count: true,
      }),
    ]);

    // Build action breakdown
    const actionBreakdown: Record<ReviewActionType, number> = {
      approve: 0,
      reject: 0,
      escalate: 0,
      retrain: 0,
      prompt_updated: 0,
      bug_filed: 0,
    };

    let totalActions = 0;
    let mostCommonAction: ReviewActionType | null = null;
    let maxCount = 0;

    for (const item of actionCounts) {
      const actionType = item.action as ReviewActionType;
      if (actionType in actionBreakdown) {
        actionBreakdown[actionType] = item._count;
        totalActions += item._count;
        if (item._count > maxCount) {
          maxCount = item._count;
          mostCommonAction = actionType;
        }
      }
    }

    return {
      totalActions,
      actionBreakdown,
      avgCorrectedScoreDelta: correctionStats._avg.correctedScore ?? 0,
      mostCommonAction,
    };
  }

  /**
   * Get actions that require follow-up (escalated, bug filed, etc).
   */
  async getPendingFollowUps(tenantId: string): Promise<ReviewActionWithContext[]> {
    return this.prisma.reviewAction.findMany({
      where: {
        tenantId,
        action: { in: ['escalate', 'bug_filed', 'prompt_updated'] },
      },
      orderBy: { performedAt: 'desc' },
      include: {
        trace: {
          select: {
            agentType: true,
            evalScore: true,
            startedAt: true,
          },
        },
      },
    });
  }

  /**
   * Get traces that were corrected (score changed during review).
   * Useful for identifying evaluator calibration issues.
   */
  async getCorrectedTraces(
    tenantId: string,
    options: { limit?: number } = {}
  ): Promise<
    Array<{
      traceId: string;
      originalScore: number;
      correctedScore: number;
      delta: number;
      action: string;
      performedBy: string;
      performedAt: Date;
    }>
  > {
    const { limit = 50 } = options;

    const actions = await this.prisma.reviewAction.findMany({
      where: {
        tenantId,
        correctedScore: { not: null },
      },
      orderBy: { performedAt: 'desc' },
      take: limit,
      include: {
        trace: {
          select: { evalScore: true },
        },
      },
    });

    // ✅ Use type guards instead of non-null assertions (P1-585)
    return actions
      .filter(
        (
          a
        ): a is typeof a & {
          correctedScore: number;
          trace: { evalScore: number };
        } => a.correctedScore !== null && a.trace !== null && a.trace.evalScore !== null
      )
      .map((a) => ({
        traceId: a.traceId,
        originalScore: a.trace.evalScore,
        correctedScore: a.correctedScore,
        delta: a.correctedScore - a.trace.evalScore,
        action: a.action,
        performedBy: a.performedBy,
        performedAt: a.performedAt,
      }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new review action service.
 */
export function createReviewActionService(prisma: PrismaClient): ReviewActionService {
  return new ReviewActionService(prisma);
}
