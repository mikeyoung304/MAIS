/**
 * Agent Metrics Module
 *
 * Prometheus metrics for agent observability.
 * Uses a dedicated registry to avoid polluting the default registry.
 *
 * Metrics exposed:
 * - agent_tool_calls_total: Counter of tool calls by name, tier, status, agent type
 * - agent_rate_limit_hits_total: Counter of rate limit blocks
 * - agent_circuit_breaker_trips_total: Counter of circuit breaker trips
 * - agent_turn_duration_seconds: Histogram of turn durations
 * - agent_active_sessions: Gauge of active sessions
 * - agent_proposals_total: Counter of proposals by status, tier, agent type
 * - agent_tier_budget_exhausted_total: Counter of tier budget exhaustions
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// Create a dedicated registry for agent metrics
export const agentRegistry = new Registry();

// Set default labels for all metrics in this registry
agentRegistry.setDefaultLabels({
  service: 'handled-api',
});

/**
 * Agent metrics collection
 */
export const agentMetrics = {
  /**
   * Total tool calls by tool name, trust tier, status, and agent type
   * Use to track tool usage patterns and success rates
   */
  toolCallsTotal: new Counter({
    name: 'agent_tool_calls_total',
    help: 'Total tool calls by tool name, trust tier, status, and agent type',
    labelNames: ['tool_name', 'trust_tier', 'status', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Rate limit hits by tool name and agent type
   * Use to identify tools hitting limits frequently
   */
  rateLimitHits: new Counter({
    name: 'agent_rate_limit_hits_total',
    help: 'Rate limit blocks by tool name and agent type',
    labelNames: ['tool_name', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Circuit breaker trips by reason and agent type
   * Use to detect sessions with excessive usage
   */
  circuitBreakerTrips: new Counter({
    name: 'agent_circuit_breaker_trips_total',
    help: 'Circuit breaker trips by reason and agent type',
    labelNames: ['reason', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Duration of agent turns in seconds
   * Use to track response latency and identify slow operations
   */
  turnDuration: new Histogram({
    name: 'agent_turn_duration_seconds',
    help: 'Duration of agent turns in seconds',
    labelNames: ['agent_type', 'had_tool_calls'] as const,
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [agentRegistry],
  }),

  /**
   * Number of active agent sessions by type
   * Use to track concurrent session load
   */
  activeSessions: new Gauge({
    name: 'agent_active_sessions',
    help: 'Number of active agent sessions by type',
    labelNames: ['agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Total proposals created by status, trust tier, and agent type
   * Use to track proposal flow and approval rates
   */
  proposalsTotal: new Counter({
    name: 'agent_proposals_total',
    help: 'Proposals created by status, trust tier, and agent type',
    labelNames: ['status', 'trust_tier', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Tier budget exhaustion events by tier and agent type
   * Use to identify agents running out of budget frequently
   */
  tierBudgetExhausted: new Counter({
    name: 'agent_tier_budget_exhausted_total',
    help: 'Tier budget exhaustion events by tier and agent type',
    labelNames: ['tier', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Claude API errors by type and agent type
   * Use to track API reliability issues
   */
  apiErrors: new Counter({
    name: 'agent_api_errors_total',
    help: 'Claude API errors by error type and agent type',
    labelNames: ['error_type', 'agent_type'] as const,
    registers: [agentRegistry],
  }),

  /**
   * Recursion depth reached in tool processing
   * Use to identify complex multi-step conversations
   */
  recursionDepthReached: new Counter({
    name: 'agent_recursion_depth_reached_total',
    help: 'Recursion depth limit reached by agent type',
    labelNames: ['agent_type'] as const,
    registers: [agentRegistry],
  }),
};

/**
 * Helper to record a successful tool call
 */
export function recordToolCall(
  toolName: string,
  trustTier: string,
  agentType: string,
  success: boolean
): void {
  agentMetrics.toolCallsTotal.inc({
    tool_name: toolName,
    trust_tier: trustTier,
    status: success ? 'success' : 'error',
    agent_type: agentType,
  });
}

/**
 * Helper to record a rate limit hit
 */
export function recordRateLimitHit(toolName: string, agentType: string): void {
  agentMetrics.rateLimitHits.inc({
    tool_name: toolName,
    agent_type: agentType,
  });
}

/**
 * Helper to record a circuit breaker trip
 */
export function recordCircuitBreakerTrip(reason: string, agentType: string): void {
  agentMetrics.circuitBreakerTrips.inc({
    reason,
    agent_type: agentType,
  });
}

/**
 * Helper to record turn duration
 */
export function recordTurnDuration(
  durationSeconds: number,
  agentType: string,
  hadToolCalls: boolean
): void {
  agentMetrics.turnDuration.observe(
    {
      agent_type: agentType,
      had_tool_calls: hadToolCalls ? 'true' : 'false',
    },
    durationSeconds
  );
}

/**
 * Helper to record proposal creation
 */
export function recordProposal(status: string, trustTier: string, agentType: string): void {
  agentMetrics.proposalsTotal.inc({
    status,
    trust_tier: trustTier,
    agent_type: agentType,
  });
}

/**
 * Helper to record tier budget exhaustion
 */
export function recordTierBudgetExhausted(tier: string, agentType: string): void {
  agentMetrics.tierBudgetExhausted.inc({
    tier,
    agent_type: agentType,
  });
}

/**
 * Helper to record API error
 */
export function recordApiError(errorType: string, agentType: string): void {
  agentMetrics.apiErrors.inc({
    error_type: errorType,
    agent_type: agentType,
  });
}

/**
 * Helper to update active sessions gauge
 */
export function setActiveSessions(agentType: string, count: number): void {
  agentMetrics.activeSessions.set({ agent_type: agentType }, count);
}

/**
 * Get all metrics as Prometheus text format
 */
export async function getAgentMetrics(): Promise<string> {
  return agentRegistry.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getAgentMetricsContentType(): string {
  return agentRegistry.contentType;
}
