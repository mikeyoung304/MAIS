/**
 * Agent Tracing Module
 *
 * Provides conversation tracing for agent evaluation.
 *
 * @see plans/agent-evaluation-system.md Phase 1
 */

export { ConversationTracer, createTracer } from './tracer';
export type {
  TracedMessage,
  TracedToolCall,
  TraceMetrics,
  TracerConfig,
  AgentType,
  SupportedModel,
  TrustTier,
  ExecutionState,
  TracedError,
} from './types';
export {
  DEFAULT_TRACER_CONFIG,
  COST_PER_1K_TOKENS,
  AGENT_TYPES,
  TracedMessageSchema,
  TracedToolCallSchema,
  MAX_MESSAGES_SIZE,
  MAX_TOOLCALLS_SIZE,
} from './types';

// Encryption middleware for PII protection
export { traceEncryptionExtension } from './encryption-middleware';
export type { PrismaWithTraceEncryption } from './encryption-middleware';
