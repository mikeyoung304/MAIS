/**
 * LLM Module - Vertex AI Integration
 *
 * Thin boundary between orchestrators and Google's Gen AI SDK.
 * All LLM interactions go through these modules.
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
