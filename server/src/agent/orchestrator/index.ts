/**
 * Agent Orchestrator Module
 *
 * Exports all orchestrator classes and types.
 * The BaseOrchestrator provides shared infrastructure,
 * specialized orchestrators customize for specific use cases.
 */

// Base class and shared types
export {
  BaseOrchestrator,
  type OrchestratorConfig as BaseOrchestratorConfig,
  type ChatMessage as BaseChatMessage,
  type SessionState as BaseSessionState,
  type ChatResponse as BaseChatResponse,
  type PromptContext,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './base-orchestrator';

// Specialized orchestrators
export { OnboardingOrchestrator, type OnboardingSessionState } from './onboarding-orchestrator';
export { CustomerChatOrchestrator } from './customer-chat-orchestrator';
export { AdminOrchestrator, type AdminSessionState } from './admin-orchestrator';

// Guardrail types and utilities
export {
  type AgentType,
  type TierBudgets,
  type BudgetTracker,
  type SessionId,
  type TenantId,
  DEFAULT_TIER_BUDGETS,
  SOFT_CONFIRM_WINDOWS,
  createBudgetTracker,
  toSessionId,
  toTenantId,
} from './types';

export {
  ToolRateLimiter,
  type ToolRateLimits,
  type ToolRateLimit,
  type RateLimitResult,
  type RateLimitStats,
  DEFAULT_TOOL_RATE_LIMITS,
} from './rate-limiter';

export {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  type CircuitBreakerCheckResult,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';

// Legacy type aliases for backwards compatibility (types only, no runtime code)
export type {
  OrchestratorConfig,
  ChatMessage,
  SessionState,
  ChatResponse,
} from './base-orchestrator';

// Prometheus metrics for agent observability
export {
  agentMetrics,
  agentRegistry,
  recordToolCall,
  recordRateLimitHit,
  recordCircuitBreakerTrip,
  recordTurnDuration,
  recordProposal,
  recordTierBudgetExhausted,
  recordApiError,
  setActiveSessions,
  getAgentMetrics,
  getAgentMetricsContentType,
} from './metrics';

// Note: The legacy AgentOrchestrator and CustomerOrchestrator have been removed.
// Use AdminOrchestrator, OnboardingOrchestrator, or CustomerChatOrchestrator instead.
// See: ADR-018 Agent Ecosystem Refactor
