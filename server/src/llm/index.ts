/**
 * LLM Module - Vertex AI Integration
 *
 * Thin boundary between orchestrators and Google's Gen AI SDK.
 * All LLM interactions go through these modules.
 *
 * Module structure:
 * - vertex-client: Client factory, model config, safety settings
 * - message-adapter: Format conversion (ChatMessage <-> Content)
 * - pricing: Cost calculation and usage logging
 * - errors: Error classification for Vertex AI
 * - retry: Intelligent retry with error classification
 */

// Client
export {
  createVertexClient,
  getVertexClient,
  resetVertexClient,
  GEMINI_MODELS,
  DEFAULT_MODEL,
  DEFAULT_SAFETY_SETTINGS,
  type GeminiModel,
  type VertexClientConfig,
} from './vertex-client';

// Message & Tool Adapters
export {
  toGeminiContents,
  toSystemInstruction,
  toGeminiFunctionDeclarations,
  toGeminiFunctionResponse,
  toGeminiMultipleFunctionResponses,
  extractText,
  extractToolCalls,
  hasToolCalls,
  extractModelContent,
  extractUsage,
  type ChatMessage,
  type ToolCall,
} from './message-adapter';

// Pricing & Usage
export {
  VERTEX_PRICING,
  COST_PER_1K_TOKENS,
  calculateCost,
  costToCents,
  logUsage,
  type UsageMetrics,
  type CostBreakdown,
} from './pricing';

// Error Classification (Phase 3)
export {
  GeminiErrorType,
  classifyGeminiError,
  requiresAlert,
  isTemporaryFailure,
  needsUserAction,
  type ClassifiedGeminiError,
} from './errors';

// Retry Logic (Phase 3)
export {
  withGeminiRetry,
  withGeminiRetryThrow,
  GeminiApiError,
  DEFAULT_GEMINI_RETRY_CONFIG,
  AGGRESSIVE_RETRY_CONFIG,
  PATIENT_RETRY_CONFIG,
  QUICK_RETRY_CONFIG,
  type GeminiRetryConfig,
  type GeminiRetryResult,
  type RetryContext,
} from './retry';
