/**
 * Human Review Queue
 *
 * Manages the queue of flagged conversations awaiting human review.
 * Provides methods to fetch, filter, and act on flagged traces.
 *
 * Key features:
 * - Tenant-scoped access (CRITICAL for security)
 * - PII redaction for reviewer privacy
 * - Priority ordering by score and date
 *
 * @see plans/agent-evaluation-system.md Phase 5.3
 */

import type { PrismaClient } from '../../generated/prisma';
import type { TracedMessage } from '../tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Review item for the queue.
 */
export interface ReviewItem {
  traceId: string;
  tenantId: string;
  agentType: string;
  evalScore: number | null;
  flagReason: string | null;
  turnCount: number;
  startedAt: Date;
  /** Redacted and truncated messages for privacy */
  messagesPreview: Array<{
    role: string;
    content: string;
  }>;
  /** Implicit signals if available */
  implicitSignals?: {
    retryCount: number;
    negativeSignals: number;
    abandonmentRate: number;
  };
}

/**
 * Options for fetching flagged conversations.
 */
export interface ReviewQueueOptions {
  /** Maximum items to return */
  limit?: number;
  /** Filter by agent type */
  agentType?: string;
  /** Only show conversations with score at or below this */
  maxScore?: number;
  /** Only show conversations with this review status */
  reviewStatus?: 'pending' | 'reviewed' | 'actioned';
  /** Sort order */
  orderBy?: 'score_asc' | 'score_desc' | 'date_desc' | 'date_asc';
}

/**
 * Review submission input.
 */
export interface ReviewSubmission {
  reviewedBy: string;
  notes: string;
  correctEvalScore?: number;
  actionTaken:
    | 'none'
    | 'approve'
    | 'reject'
    | 'escalate'
    | 'prompt_updated'
    | 'bug_filed'
    | 'retrain';
}

/**
 * Queue statistics.
 */
export interface QueueStats {
  pendingCount: number;
  reviewedTodayCount: number;
  avgEvalScore: number;
  flagReasonBreakdown: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PII Redaction Patterns
// ─────────────────────────────────────────────────────────────────────────────

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  {
    pattern: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE]',
  },
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD]',
  },
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Review Queue Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages the queue of flagged conversations for human review.
 *
 * Usage:
 * ```typescript
 * const queue = new ReviewQueue(prisma);
 * const items = await queue.getFlaggedConversations(tenantId, { limit: 10 });
 * await queue.submitReview(tenantId, items[0].traceId, {
 *   reviewedBy: 'user123',
 *   notes: 'Agent responded appropriately',
 *   actionTaken: 'approve',
 * });
 * ```
 */
export class ReviewQueue {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get flagged conversations for a tenant.
   * CRITICAL: Always tenant-scoped for security.
   */
  async getFlaggedConversations(
    tenantId: string,
    options: ReviewQueueOptions = {}
  ): Promise<ReviewItem[]> {
    const {
      limit = 20,
      agentType,
      maxScore,
      reviewStatus = 'pending',
      orderBy = 'score_asc',
    } = options;

    // Build order by
    const orderByClause = this.buildOrderBy(orderBy);

    const traces = await this.prisma.conversationTrace.findMany({
      where: {
        tenantId,
        flagged: true,
        ...(reviewStatus && { reviewStatus }),
        ...(agentType && { agentType }),
        ...(maxScore !== undefined && { evalScore: { lte: maxScore } }),
      },
      orderBy: orderByClause,
      take: limit,
      select: {
        id: true,
        tenantId: true,
        agentType: true,
        evalScore: true,
        flagReason: true,
        turnCount: true,
        startedAt: true,
        messages: true,
      },
    });

    return traces.map((trace) => ({
      traceId: trace.id,
      tenantId: trace.tenantId,
      agentType: trace.agentType,
      evalScore: trace.evalScore,
      flagReason: trace.flagReason,
      turnCount: trace.turnCount,
      startedAt: trace.startedAt,
      messagesPreview: this.redactMessages(trace.messages as unknown as TracedMessage[]),
    }));
  }

  /**
   * Get a single flagged conversation with full details.
   */
  async getConversation(tenantId: string, traceId: string): Promise<ReviewItem | null> {
    const trace = await this.prisma.conversationTrace.findFirst({
      where: { id: traceId, tenantId },
      select: {
        id: true,
        tenantId: true,
        agentType: true,
        evalScore: true,
        evalDimensions: true,
        evalReasoning: true,
        flagReason: true,
        turnCount: true,
        startedAt: true,
        messages: true,
        toolCalls: true,
        reviewStatus: true,
        reviewedBy: true,
        reviewNotes: true,
      },
    });

    if (!trace) return null;

    return {
      traceId: trace.id,
      tenantId: trace.tenantId,
      agentType: trace.agentType,
      evalScore: trace.evalScore,
      flagReason: trace.flagReason,
      turnCount: trace.turnCount,
      startedAt: trace.startedAt,
      messagesPreview: this.redactMessages(trace.messages as unknown as TracedMessage[]),
    };
  }

  /**
   * Submit a review for a flagged conversation.
   */
  async submitReview(tenantId: string, traceId: string, review: ReviewSubmission): Promise<void> {
    // P0 Security: Verify trace belongs to tenant
    const trace = await this.prisma.conversationTrace.findFirst({
      where: { id: traceId, tenantId },
    });

    if (!trace) {
      throw new Error('Trace not found or access denied');
    }

    // Update trace with review
    await this.prisma.conversationTrace.update({
      where: { id: traceId },
      data: {
        reviewStatus: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: review.reviewedBy,
        reviewNotes: review.notes,
        ...(review.correctEvalScore !== undefined && {
          evalScore: review.correctEvalScore,
        }),
      },
    });

    // Log action if taken
    if (review.actionTaken !== 'none') {
      await this.prisma.reviewAction.create({
        data: {
          tenantId,
          traceId,
          action: review.actionTaken,
          notes: review.notes,
          correctedScore: review.correctEvalScore,
          performedBy: review.reviewedBy,
        },
      });
    }
  }

  /**
   * Get queue statistics for a tenant.
   */
  async getQueueStats(tenantId: string): Promise<QueueStats> {
    const [pendingCount, reviewedToday, avgScore, flagReasons] = await Promise.all([
      // Pending count
      this.prisma.conversationTrace.count({
        where: { tenantId, flagged: true, reviewStatus: 'pending' },
      }),
      // Reviewed today
      this.prisma.conversationTrace.count({
        where: {
          tenantId,
          reviewedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Average eval score
      this.prisma.conversationTrace.aggregate({
        where: { tenantId, flagged: true, evalScore: { not: null } },
        _avg: { evalScore: true },
      }),
      // Flag reason breakdown
      this.prisma.conversationTrace.groupBy({
        by: ['flagReason'],
        where: { tenantId, flagged: true, flagReason: { not: null } },
        _count: true,
      }),
    ]);

    const flagReasonBreakdown: Record<string, number> = {};
    for (const item of flagReasons) {
      if (item.flagReason) {
        // Normalize flag reasons to categories
        const category = this.categorizeReason(item.flagReason);
        flagReasonBreakdown[category] = (flagReasonBreakdown[category] ?? 0) + item._count;
      }
    }

    return {
      pendingCount,
      reviewedTodayCount: reviewedToday,
      avgEvalScore: avgScore._avg.evalScore ?? 0,
      flagReasonBreakdown,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Redact PII from messages and truncate.
   */
  private redactMessages(messages: TracedMessage[]): Array<{ role: string; content: string }> {
    return messages.map((m) => ({
      role: m.role,
      content: this.redactPII(m.content).slice(0, 500), // Truncate to 500 chars
    }));
  }

  /**
   * Redact PII from text.
   */
  private redactPII(text: string): string {
    let redacted = text;
    for (const { pattern, replacement } of PII_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }

  /**
   * Build order by clause.
   */
  private buildOrderBy(orderBy: string): Array<{ [key: string]: 'asc' | 'desc' }> {
    switch (orderBy) {
      case 'score_asc':
        return [{ evalScore: 'asc' }, { startedAt: 'desc' }];
      case 'score_desc':
        return [{ evalScore: 'desc' }, { startedAt: 'desc' }];
      case 'date_desc':
        return [{ startedAt: 'desc' }];
      case 'date_asc':
        return [{ startedAt: 'asc' }];
      default:
        return [{ evalScore: 'asc' }, { startedAt: 'desc' }];
    }
  }

  /**
   * Categorize flag reasons for stats.
   */
  private categorizeReason(reason: string): string {
    const lower = reason.toLowerCase();
    if (lower.includes('safety')) return 'safety';
    if (lower.includes('effectiveness') || lower.includes('task')) return 'effectiveness';
    if (lower.includes('experience') || lower.includes('frustrat')) return 'experience';
    if (lower.includes('error') || lower.includes('fail')) return 'error';
    if (lower.includes('rating')) return 'user_rating';
    return 'other';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new review queue.
 */
export function createReviewQueue(prisma: PrismaClient): ReviewQueue {
  return new ReviewQueue(prisma);
}
