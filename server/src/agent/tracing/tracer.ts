/**
 * Conversation Tracer
 *
 * High-performance conversation tracing for agent evaluation.
 * Uses fire-and-forget writes to avoid blocking the response path.
 *
 * Key Features:
 * - Lazy initialization (trace created on first user message)
 * - Fire-and-forget database writes (P1 performance fix)
 * - Automatic flagging for anomalies (high turn count, high latency)
 * - Size limits to prevent storage blowout (P2 fix)
 * - 90-day retention via expiresAt column (P2 data hygiene)
 *
 * @see plans/agent-evaluation-system.md Phase 1.3
 */

import type { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import type {
  TracedMessage,
  TracedToolCall,
  TraceMetrics,
  TracerConfig,
  AgentType,
  TracedError,
} from './types';
import {
  DEFAULT_TRACER_CONFIG,
  COST_PER_1K_TOKENS,
  MAX_MESSAGES_SIZE,
  MAX_TOOLCALLS_SIZE,
  MAX_MESSAGES_AFTER_TRUNCATION,
  MAX_TOOLCALLS_AFTER_TRUNCATION,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tracer State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory state for an active trace.
 * Persisted to database periodically and on completion.
 */
interface TraceState {
  traceId: string | null;
  tenantId: string;
  sessionId: string;
  agentType: AgentType;
  startedAt: Date;
  messages: TracedMessage[];
  toolCalls: TracedToolCall[];
  errors: TracedError[];
  metrics: TraceMetrics;
  promptVersion: string | null;
  cacheHit: boolean;
  taskCompleted: boolean | null;
  flagged: boolean;
  flagReason: string | null;
  dirty: boolean; // Has unpersisted changes
}

/**
 * Create empty metrics object
 */
function createEmptyMetrics(): TraceMetrics {
  return {
    turnCount: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalLatencyMs: 0,
    estimatedCostCents: 0,
    toolCallCount: 0,
    errorCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Tracer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conversation Tracer
 *
 * Traces conversation flow for later evaluation and analysis.
 * Uses lazy initialization - trace is only created in DB when first message is recorded.
 */
export class ConversationTracer {
  private state: TraceState | null = null;
  private readonly config: TracerConfig;
  private pendingWrites: Promise<void>[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<TracerConfig> = {}
  ) {
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initialize a new trace (lazy - doesn't write to DB yet).
   * Called at the start of a conversation.
   */
  initialize(
    tenantId: string,
    sessionId: string,
    agentType: AgentType,
    options?: {
      promptVersion?: string;
    }
  ): void {
    this.state = {
      traceId: null, // Set when first persisted
      tenantId,
      sessionId,
      agentType,
      startedAt: new Date(),
      messages: [],
      toolCalls: [],
      errors: [],
      metrics: createEmptyMetrics(),
      promptVersion: options?.promptVersion ?? null,
      cacheHit: false,
      taskCompleted: null,
      flagged: false,
      flagReason: null,
      dirty: false,
    };
  }

  /**
   * Check if tracer has been initialized
   */
  isInitialized(): boolean {
    return this.state !== null;
  }

  /**
   * Get the current trace ID (null if not yet persisted)
   */
  getTraceId(): string | null {
    return this.state?.traceId ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recording Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record a user message
   */
  recordUserMessage(content: string, tokenCount: number): void {
    if (!this.state) {
      logger.warn('Tracer not initialized, skipping user message record');
      return;
    }

    const message: TracedMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      latencyMs: null, // User messages have no latency
      tokenCount,
    };

    this.state.messages.push(message);
    this.state.metrics.inputTokens += tokenCount;
    this.state.metrics.totalTokens += tokenCount;
    this.state.dirty = true;
  }

  /**
   * Record an assistant response
   */
  recordAssistantResponse(content: string, tokenCount: number, latencyMs: number): void {
    if (!this.state) {
      logger.warn('Tracer not initialized, skipping assistant message record');
      return;
    }

    const message: TracedMessage = {
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      latencyMs,
      tokenCount,
    };

    this.state.messages.push(message);
    this.state.metrics.turnCount += 1;
    this.state.metrics.outputTokens += tokenCount;
    this.state.metrics.totalTokens += tokenCount;
    this.state.metrics.totalLatencyMs += latencyMs;
    this.state.dirty = true;

    // Update cost estimate
    this.updateCostEstimate();

    // Check for high latency flag
    if (latencyMs > this.config.autoFlagHighLatencyMs) {
      this.flag(`High latency: ${latencyMs}ms`);
    }

    // Check for high turn count flag
    if (this.state.metrics.turnCount >= this.config.autoFlagHighTurnCount) {
      this.flag(`High turn count: ${this.state.metrics.turnCount}`);
    }
  }

  /**
   * Record a tool call
   */
  recordToolCall(toolCall: Omit<TracedToolCall, 'timestamp'>): void {
    if (!this.state) {
      logger.warn('Tracer not initialized, skipping tool call record');
      return;
    }

    const traced: TracedToolCall = {
      ...toolCall,
      timestamp: new Date().toISOString(),
    };

    this.state.toolCalls.push(traced);
    this.state.metrics.toolCallCount += 1;
    this.state.dirty = true;

    if (!toolCall.success) {
      this.recordError({ message: toolCall.error || 'Tool call failed' });
    }
  }

  /**
   * Record an error
   */
  recordError(error: { message: string; stack?: string }): void {
    if (!this.state) {
      logger.warn('Tracer not initialized, skipping error record');
      return;
    }

    const traced: TracedError = {
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack,
    };

    this.state.errors.push(traced);
    this.state.metrics.errorCount += 1;
    this.state.dirty = true;
  }

  /**
   * Flag the conversation for review
   */
  flag(reason: string): void {
    if (!this.state) {
      logger.warn('Tracer not initialized, skipping flag');
      return;
    }

    if (!this.state.flagged) {
      this.state.flagged = true;
      this.state.flagReason = reason;
      this.state.dirty = true;
    } else if (this.state.flagReason) {
      // Append additional reasons
      this.state.flagReason += `; ${reason}`;
      this.state.dirty = true;
    }
  }

  /**
   * Set cache hit flag
   */
  setCacheHit(hit: boolean): void {
    if (!this.state) return;
    this.state.cacheHit = hit;
    this.state.dirty = true;
  }

  /**
   * Mark task as completed or not
   */
  setTaskCompleted(completed: boolean): void {
    if (!this.state) return;
    this.state.taskCompleted = completed;
    this.state.dirty = true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Persistence Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Flush pending changes to database.
   *
   * Uses fire-and-forget pattern (P1 fix):
   * - Writes are queued and executed asynchronously
   * - Returns immediately without waiting for completion
   * - Errors are logged but don't block the response
   */
  flush(): void {
    if (!this.state || !this.state.dirty) {
      return;
    }

    // Capture state for async write
    const state = { ...this.state };
    this.state.dirty = false;

    // Fire-and-forget write using setImmediate
    const writePromise = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await this.persistState(state);
        } catch (error) {
          logger.error(
            { error: sanitizeError(error), sessionId: state.sessionId },
            'Failed to persist trace state'
          );
        }
        resolve();
      });
    });

    this.pendingWrites.push(writePromise);

    // ✅ Simplified cleanup per DHH review (P1-581)
    // Drain when array is large instead of complex filtering
    if (this.pendingWrites.length > 10) {
      this.drainPendingWrites().catch((error) => {
        logger.warn({ error: sanitizeError(error) }, 'Failed to drain pending writes');
      });
    }
  }

  /**
   * Drain all pending writes.
   * Uses settle-and-clear pattern per DHH review.
   */
  private async drainPendingWrites(): Promise<void> {
    await Promise.allSettled(this.pendingWrites);
    this.pendingWrites = [];
    logger.debug('Drained pending trace writes');
  }

  /**
   * Finalize the trace and wait for all pending writes.
   * Called at the end of a conversation.
   */
  async finalize(): Promise<string | null> {
    if (!this.state) {
      return null;
    }

    // Mark dirty to force final persist
    this.state.dirty = true;
    this.flush();

    // Wait for all pending writes to complete
    await Promise.all(this.pendingWrites);

    const traceId = this.state.traceId;
    this.state = null;
    this.pendingWrites = [];

    return traceId;
  }

  /**
   * Wait for all pending writes to complete.
   * Useful for testing and graceful shutdown.
   * Uses allSettled to handle both resolved and rejected promises.
   */
  async waitForPendingWrites(): Promise<void> {
    await Promise.allSettled(this.pendingWrites);
    this.pendingWrites = [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update cost estimate based on current token counts
   */
  private updateCostEstimate(): void {
    if (!this.state) return;

    const costs = COST_PER_1K_TOKENS[this.config.model];
    const inputCost = (this.state.metrics.inputTokens / 1000) * costs.input;
    const outputCost = (this.state.metrics.outputTokens / 1000) * costs.output;
    const totalCostDollars = inputCost + outputCost;
    this.state.metrics.estimatedCostCents = Math.round(totalCostDollars * 100);
  }

  /**
   * Persist trace state to database
   */
  private async persistState(state: TraceState): Promise<void> {
    // Truncate messages and toolCalls if they exceed size limits (P2 fix)
    const truncatedMessages = this.truncateMessages(state.messages);
    const truncatedToolCalls = this.truncateToolCalls(state.toolCalls);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.retentionDays);

    if (state.traceId) {
      // Update existing trace
      await this.prisma.conversationTrace.update({
        where: { id: state.traceId },
        data: {
          endedAt: new Date(),
          turnCount: state.metrics.turnCount,
          totalTokens: state.metrics.totalTokens,
          inputTokens: state.metrics.inputTokens,
          outputTokens: state.metrics.outputTokens,
          totalLatencyMs: state.metrics.totalLatencyMs,
          estimatedCostCents: state.metrics.estimatedCostCents,
          messages: truncatedMessages as unknown as object,
          toolCalls: truncatedToolCalls as unknown as object,
          errors: state.errors.length > 0 ? (state.errors as unknown as object) : undefined,
          cacheHit: state.cacheHit,
          taskCompleted: state.taskCompleted,
          flagged: state.flagged,
          flagReason: state.flagReason,
          reviewStatus: state.flagged ? 'pending' : null,
        },
      });
    } else {
      // Create new trace
      const created = await this.prisma.conversationTrace.create({
        data: {
          tenantId: state.tenantId,
          sessionId: state.sessionId,
          agentType: state.agentType,
          startedAt: state.startedAt,
          endedAt: new Date(),
          turnCount: state.metrics.turnCount,
          totalTokens: state.metrics.totalTokens,
          inputTokens: state.metrics.inputTokens,
          outputTokens: state.metrics.outputTokens,
          totalLatencyMs: state.metrics.totalLatencyMs,
          estimatedCostCents: state.metrics.estimatedCostCents,
          messages: truncatedMessages as unknown as object,
          toolCalls: truncatedToolCalls as unknown as object,
          errors: state.errors.length > 0 ? (state.errors as unknown as object) : undefined,
          expiresAt,
          promptVersion: state.promptVersion,
          cacheHit: state.cacheHit,
          taskCompleted: state.taskCompleted,
          flagged: state.flagged,
          flagReason: state.flagReason,
          reviewStatus: state.flagged ? 'pending' : null,
        },
      });

      // Update in-memory state with traceId
      if (this.state && this.state.sessionId === state.sessionId) {
        this.state.traceId = created.id;
      }
    }
  }

  /**
   * Truncate messages array if it exceeds size limit
   */
  private truncateMessages(messages: TracedMessage[]): TracedMessage[] {
    const jsonSize = JSON.stringify(messages).length;
    if (jsonSize <= MAX_MESSAGES_SIZE) {
      return messages;
    }

    // Keep first 5 messages (context) and last N messages
    const keepFirst = 5;
    const keepLast = MAX_MESSAGES_AFTER_TRUNCATION - keepFirst;

    if (messages.length <= MAX_MESSAGES_AFTER_TRUNCATION) {
      // Still too large, truncate content
      return messages.map((m) => ({
        ...m,
        content: m.content.length > 500 ? m.content.slice(0, 500) + '...[truncated]' : m.content,
      }));
    }

    const first = messages.slice(0, keepFirst);
    const last = messages.slice(-keepLast);

    logger.debug(
      { originalCount: messages.length, truncatedCount: first.length + last.length },
      'Truncated messages for trace'
    );

    return [...first, ...last];
  }

  /**
   * Truncate toolCalls array if it exceeds size limit
   */
  private truncateToolCalls(toolCalls: TracedToolCall[]): TracedToolCall[] {
    const jsonSize = JSON.stringify(toolCalls).length;
    if (jsonSize <= MAX_TOOLCALLS_SIZE) {
      return toolCalls;
    }

    // Keep last N tool calls
    if (toolCalls.length > MAX_TOOLCALLS_AFTER_TRUNCATION) {
      return toolCalls.slice(-MAX_TOOLCALLS_AFTER_TRUNCATION);
    }

    // Still too large, truncate output
    return toolCalls.map((tc) => ({
      ...tc,
      input: this.truncateObject(tc.input, 200) as Record<string, unknown>,
      output: this.truncateObject(tc.output, 200),
    }));
  }

  /**
   * Truncate object values to max length
   */
  private truncateObject(obj: unknown, maxLength: number): unknown {
    if (typeof obj === 'string' && obj.length > maxLength) {
      return obj.slice(0, maxLength) + '...[truncated]';
    }
    if (Array.isArray(obj)) {
      return obj.slice(0, 10).map((item) => this.truncateObject(item, maxLength));
    }
    if (obj !== null && typeof obj === 'object') {
      const truncated: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        truncated[key] = this.truncateObject(value, maxLength);
      }
      return truncated;
    }
    return obj;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new conversation tracer.
 *
 * Usage:
 * ```typescript
 * const tracer = createTracer(prisma, { model: 'claude-sonnet-4-20250514' });
 * tracer.initialize(tenantId, sessionId, 'customer');
 * tracer.recordUserMessage('Hello', 10);
 * tracer.recordAssistantResponse('Hi there!', 50, 234);
 * tracer.flush(); // Fire-and-forget
 * await tracer.finalize(); // Wait for all writes
 * ```
 */
export function createTracer(
  prisma: PrismaClient,
  config?: Partial<TracerConfig>
): ConversationTracer {
  return new ConversationTracer(prisma, config);
}
