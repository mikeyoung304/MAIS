/**
 * Tracer Type Definitions
 *
 * Types for the conversation tracing system (Phase 1: Observability Foundation).
 * These types define the structure of traced messages, tool calls, and metrics
 * that are stored in the ConversationTrace model.
 *
 * @see plans/agent-evaluation-system.md Phase 1.2
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Traced Message Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A traced message in a conversation.
 * Contains the message content plus metadata for analysis.
 */
export interface TracedMessage {
  /** Message role: user or assistant */
  role: 'user' | 'assistant';
  /** Message content text */
  content: string;
  /** ISO timestamp of when message was created */
  timestamp: string;
  /** Latency in ms for assistant responses, null for user messages */
  latencyMs: number | null;
  /** Token count for this message */
  tokenCount: number;
}

/** Zod schema for runtime validation of TracedMessage */
export const TracedMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().datetime(),
  latencyMs: z.number().nullable(),
  tokenCount: z.number().int().nonnegative(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Traced Tool Call Types
// ─────────────────────────────────────────────────────────────────────────────

/** Trust tier for tool calls */
export type TrustTier = 'T1' | 'T2' | 'T3';

/** Execution state for tool calls */
export type ExecutionState = 'complete' | 'partial' | 'failed';

/**
 * A traced tool call in a conversation.
 * Contains full execution details for analysis and debugging.
 */
export interface TracedToolCall {
  /** Name of the tool that was called */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Output from the tool (may be truncated for large payloads) */
  output: unknown;
  /** Execution time in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when tool was called */
  timestamp: string;
  /** Trust tier of the tool */
  trustTier: TrustTier;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Error message if the tool failed */
  error: string | null;
  /** Execution state for partial failures */
  executionState: ExecutionState;
  /** Proposal ID if T2/T3 tool */
  proposalId: string | null;
  /** Proposal status if T2/T3 tool */
  proposalStatus: string | null;
}

/** Zod schema for runtime validation of TracedToolCall */
export const TracedToolCallSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.unknown(),
  latencyMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  trustTier: z.enum(['T1', 'T2', 'T3']),
  success: z.boolean(),
  error: z.string().nullable(),
  executionState: z.enum(['complete', 'partial', 'failed']),
  proposalId: z.string().nullable(),
  proposalStatus: z.string().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Trace Metrics Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate metrics for a conversation trace.
 * These are computed incrementally as the conversation progresses.
 */
export interface TraceMetrics {
  /** Number of assistant turns in the conversation */
  turnCount: number;
  /** Total token count (input + output) */
  totalTokens: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** Estimated cost in cents */
  estimatedCostCents: number;
  /** Number of tool calls made */
  toolCallCount: number;
  /** Number of errors encountered */
  errorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracer Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported model IDs for cost calculation */
export type SupportedModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-haiku-35-20241022'
  | 'claude-opus-4-20250514';

/**
 * Configuration for the conversation tracer.
 */
export interface TracerConfig {
  /** Turn count threshold for auto-flagging (default: 8) */
  autoFlagHighTurnCount: number;
  /** Latency threshold in ms for auto-flagging (default: 5000) */
  autoFlagHighLatencyMs: number;
  /** Model being used (for cost calculation) */
  model: SupportedModel;
  /** Retention period in days (default: 90) */
  retentionDays: number;
}

/** Default tracer configuration */
export const DEFAULT_TRACER_CONFIG: TracerConfig = {
  autoFlagHighTurnCount: 8,
  autoFlagHighLatencyMs: 5000,
  model: 'claude-sonnet-4-20250514',
  retentionDays: 90,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cost Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cost per 1K tokens for each model (Anthropic pricing as of 2025).
 * Used for estimating conversation costs.
 */
export const COST_PER_1K_TOKENS: Record<SupportedModel, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-haiku-35-20241022': { input: 0.00025, output: 0.00125 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tracer Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error structure for traced errors.
 */
export interface TracedError {
  /** Error message */
  message: string;
  /** ISO timestamp of when error occurred */
  timestamp: string;
  /** Error stack trace (optional, may be redacted) */
  stack?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Type Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Agent types that can be traced */
export type AgentType = 'customer' | 'onboarding' | 'admin';

/** All agent types for iteration */
export const AGENT_TYPES: readonly AgentType[] = ['customer', 'onboarding', 'admin'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Size Limits (P2 Fix: Prevent storage blowout)
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum size in bytes for messages JSONB column */
export const MAX_MESSAGES_SIZE = 100_000; // 100KB

/** Maximum size in bytes for toolCalls JSONB column */
export const MAX_TOOLCALLS_SIZE = 50_000; // 50KB

/** Maximum messages to keep when truncating */
export const MAX_MESSAGES_AFTER_TRUNCATION = 50;

/** Maximum tool calls to keep when truncating */
export const MAX_TOOLCALLS_AFTER_TRUNCATION = 30;
