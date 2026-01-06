/**
 * Evaluation Pipeline
 *
 * Handles the evaluation workflow for conversation traces:
 * 1. Sampling (10% default to control costs)
 * 2. PII redaction before sending to evaluator
 * 3. Async evaluation with result persistence
 * 4. Flagging and review queue population
 *
 * @see plans/agent-evaluation-system.md Phase 2.3
 */

import type { PrismaClient, ConversationTrace } from '../../generated/prisma';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { TraceNotFoundError } from '../../lib/errors/agent-eval-errors';
import { redactMessages, redactToolCalls } from '../../lib/pii-redactor';
import type { ConversationEvaluator } from './evaluator';
import { createEvaluator } from './evaluator';
import type { EvalInput } from './evaluator';
import type { TracedMessage, TracedToolCall, AgentType } from '../tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Sampling rate (0-1, default 0.1 = 10%) */
  samplingRate: number;
  /** Always evaluate flagged traces */
  evaluateFlagged: boolean;
  /** Always evaluate traces with low task completion */
  evaluateFailedTasks: boolean;
  /** Batch size for processing */
  batchSize: number;
  /** Whether to process async (fire-and-forget) */
  asyncProcessing: boolean;
}

const DEFAULT_CONFIG: PipelineConfig = {
  samplingRate: 1.0, // 100% - evaluate all traces (adjust when volume increases)
  evaluateFlagged: true,
  evaluateFailedTasks: true,
  batchSize: 10,
  asyncProcessing: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sampling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if a trace should be evaluated based on sampling.
 */
function shouldEvaluate(
  trace: {
    flagged: boolean;
    taskCompleted: boolean | null;
  },
  config: PipelineConfig
): boolean {
  // Always evaluate flagged traces
  if (config.evaluateFlagged && trace.flagged) {
    return true;
  }

  // Always evaluate failed tasks
  if (config.evaluateFailedTasks && trace.taskCompleted === false) {
    return true;
  }

  // Otherwise, use sampling rate
  return Math.random() < config.samplingRate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluation Pipeline
 *
 * Processes conversation traces for evaluation with:
 * - Configurable sampling rate
 * - PII redaction
 * - Async processing
 * - Result persistence
 */
export class EvalPipeline {
  private readonly config: PipelineConfig;
  private pendingEvaluations: Promise<void>[] = [];

  /**
   * Create a new evaluation pipeline.
   *
   * @param prisma - Prisma client for database operations
   * @param evaluator - Conversation evaluator instance (Kieran: make required for proper DI)
   * @param config - Optional configuration overrides
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly evaluator: ConversationEvaluator, // ✅ Required (Kieran review)
    config: Partial<PipelineConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Submit a trace for evaluation.
   * Uses sampling to determine if it should be evaluated.
   *
   * CRITICAL: Requires tenantId for multi-tenant isolation.
   * The trace MUST belong to the specified tenant.
   *
   * @param tenantId - The tenant who owns the trace
   * @param traceId - The trace to evaluate
   * @throws TraceNotFoundError if trace doesn't exist or belongs to different tenant
   *
   * @see docs/solutions/patterns/mais-critical-patterns.md
   */
  async submit(tenantId: string, traceId: string): Promise<void> {
    // P0 Security: Validate tenantId
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('tenantId is required for submit');
    }

    // Fetch trace with tenant ownership check
    const trace = await this.prisma.conversationTrace.findFirst({
      where: {
        id: traceId,
        tenantId, // ✅ Tenant-scoped query (P1-580)
      },
    });

    if (!trace) {
      throw new TraceNotFoundError(traceId);
    }

    // Check if already evaluated
    if (trace.evalScore !== null) {
      logger.debug({ traceId, tenantId }, 'Trace already evaluated, skipping');
      return;
    }

    // Check sampling
    if (!shouldEvaluate(trace, this.config)) {
      logger.debug({ traceId, tenantId }, 'Trace not selected for evaluation (sampling)');
      return;
    }

    // Process evaluation
    if (this.config.asyncProcessing) {
      // Fire-and-forget
      const promise = this.processTrace(trace).catch((error) => {
        logger.error({ error: sanitizeError(error), traceId, tenantId }, 'Async evaluation failed');
      });
      this.pendingEvaluations.push(promise);

      // Cleanup completed promises periodically
      this.cleanupPendingEvaluations();
    } else {
      await this.processTrace(trace);
    }
  }

  /**
   * Process a batch of traces for a specific tenant.
   * Useful for backfill or scheduled evaluation.
   *
   * @param tenantId - The tenant who owns the traces
   * @param traceIds - The traces to evaluate
   */
  async processBatch(tenantId: string, traceIds: string[]): Promise<void> {
    for (let i = 0; i < traceIds.length; i += this.config.batchSize) {
      const batch = traceIds.slice(i, i + this.config.batchSize);
      await Promise.all(batch.map((id) => this.submit(tenantId, id)));
    }
  }

  /**
   * Get unevaluated traces for a specific tenant.
   * Useful for running evaluation on existing traces.
   *
   * CRITICAL: Always scope by tenantId for multi-tenant isolation.
   *
   * @param tenantId - The tenant to get traces for
   * @param limit - Maximum number of traces to return
   * @returns Array of trace IDs belonging to the tenant
   *
   * @see docs/solutions/patterns/mais-critical-patterns.md
   */
  async getUnevaluatedTraces(tenantId: string, limit: number = 100): Promise<string[]> {
    // P0 Security: Validate tenantId
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('tenantId is required for getUnevaluatedTraces');
    }

    const traces = await this.prisma.conversationTrace.findMany({
      where: {
        tenantId, // ✅ Tenant-scoped query (P1-580)
        evalScore: null,
        // Exclude very recent traces (may still be in progress)
        startedAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        },
      },
      select: { id: true },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return traces.map((t) => t.id);
  }

  /**
   * Wait for all pending evaluations to complete.
   * Uses settle-and-clear pattern per DHH review.
   */
  async waitForPending(): Promise<void> {
    await Promise.allSettled(this.pendingEvaluations);
    this.pendingEvaluations = [];
    logger.debug('Drained all pending evaluations');
  }

  /**
   * Process a single trace through evaluation.
   */
  private async processTrace(trace: ConversationTrace): Promise<void> {
    const startTime = Date.now();

    try {
      // Parse and redact messages/toolCalls (cast through unknown for Prisma 7 JSON type compatibility)
      const messages = redactMessages((trace.messages as unknown as TracedMessage[]) || []);
      const toolCalls = redactToolCalls((trace.toolCalls as unknown as TracedToolCall[]) || []);

      // Build evaluation input
      const input: EvalInput = {
        traceId: trace.id,
        tenantId: trace.tenantId,
        agentType: trace.agentType as AgentType,
        messages,
        toolCalls,
        taskCompleted: trace.taskCompleted,
      };

      // Run evaluation
      const result = await this.evaluator.evaluate(input);

      // Persist results
      await this.prisma.conversationTrace.update({
        where: { id: trace.id },
        data: {
          evalScore: result.overallScore,
          evalDimensions: result.dimensions as unknown as object,
          evalReasoning: result.summary,
          evalConfidence: result.overallConfidence,
          evaluatedAt: new Date(),
          flagged: result.flagged || trace.flagged,
          flagReason: result.flagReason || trace.flagReason,
          reviewStatus: result.flagged ? 'pending' : trace.reviewStatus,
        },
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          traceId: trace.id,
          tenantId: trace.tenantId,
          overallScore: result.overallScore,
          flagged: result.flagged,
          durationMs,
        },
        'Trace evaluation completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error(
        {
          error: sanitizeError(error),
          traceId: trace.id,
          tenantId: trace.tenantId,
          durationMs,
        },
        'Trace evaluation failed'
      );

      // Mark trace as needing review due to evaluation failure
      // P2-594: Don't expose error details in database - log internally only
      await this.prisma.conversationTrace.update({
        where: { id: trace.id },
        data: {
          flagged: true,
          flagReason: 'Evaluation failed - see logs for details',
          reviewStatus: 'pending',
        },
      });
    }
  }

  /**
   * Drain completed evaluations when array is large.
   *
   * ✅ Simple approach per DHH review:
   * "Just call Promise.allSettled() and clear the array.
   * Memory is cheap, clarity is expensive."
   *
   * This replaces the broken synchronous filter approach (P1-581).
   */
  private async drainCompleted(): Promise<void> {
    await Promise.allSettled(this.pendingEvaluations);
    this.pendingEvaluations = [];
    logger.debug('Drained pending evaluations');
  }

  /**
   * Cleanup completed promise references when needed.
   */
  private cleanupPendingEvaluations(): void {
    // ✅ Simplified: just drain when array is large (DHH review)
    if (this.pendingEvaluations.length > 50) {
      // Fire-and-forget the drain - don't await
      this.drainCompleted().catch((error) => {
        logger.warn({ error: sanitizeError(error) }, 'Failed to drain pending evaluations');
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new evaluation pipeline.
 *
 * @param prisma - Prisma client for database operations
 * @param evaluator - Optional evaluator instance (creates default if not provided)
 * @param config - Optional configuration overrides
 */
export function createEvalPipeline(
  prisma: PrismaClient,
  evaluator?: ConversationEvaluator,
  config?: Partial<PipelineConfig>
): EvalPipeline {
  return new EvalPipeline(
    prisma,
    evaluator ?? createEvaluator(), // Factory provides default evaluator
    config
  );
}
