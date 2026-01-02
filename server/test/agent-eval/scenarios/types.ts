/**
 * Multi-Turn Conversation Scenario Types
 *
 * Defines the structure for testing complete user journeys with agents.
 * Scenarios specify setup, conversation flow, and success criteria.
 *
 * @see plans/agent-evaluation-system.md Phase 3
 */

import type { EvalResult } from '../../../src/agent/evals';
import type { AgentType } from '../../../src/agent/tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Setup Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenant configuration for scenario setup.
 */
export interface TenantSetup {
  businessName: string;
  businessType?: string;
  stripeConnected?: boolean;
  onboardingPhase?: string;
}

/**
 * Service/package configuration for scenario setup.
 */
export interface ServiceSetup {
  name: string;
  price: number; // In cents
  duration: number; // In minutes
  description?: string;
}

/**
 * Booking configuration for scenario setup.
 */
export interface BookingSetup {
  date: string; // ISO date
  serviceName: string;
  customerEmail?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Definition Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expectations for a single conversation turn.
 */
export interface TurnExpectations {
  /** Tools that SHOULD be called during this turn */
  shouldCallTools?: string[];
  /** Tools that should NOT be called during this turn */
  shouldNotCallTools?: string[];
  /** Response content should match this regex */
  responseShouldMatch?: RegExp;
  /** Response content should NOT match this regex */
  responseShouldNotMatch?: RegExp;
  /** Maximum tokens in response */
  maxResponseTokens?: number;
  /** Maximum latency for this turn */
  maxLatencyMs?: number;
}

/**
 * A single turn in a conversation scenario.
 */
export interface ScenarioTurn {
  /** User message for this turn */
  user: string;
  /** Expectations for the agent's response */
  expectations?: TurnExpectations;
  /** Simulate thinking time before this turn (ms) */
  delayMs?: number;
}

/**
 * Success criteria for scenario completion.
 */
export interface SuccessCriteria {
  /** Minimum overall evaluation score (0-10) */
  minOverallScore: number;
  /** Whether the task should be completed */
  taskCompleted?: boolean;
  /** Maximum total latency for all turns */
  maxTotalLatencyMs?: number;
  /** Maximum number of turns allowed */
  maxTurns?: number;
  /** Tools that MUST be called at some point */
  requiredToolCalls?: string[];
  /** Tools that should NEVER be called */
  forbiddenToolCalls?: string[];
}

/**
 * Category of scenario for organization and filtering.
 */
export type ScenarioCategory = 'happy-path' | 'edge-case' | 'error-handling' | 'adversarial';

/**
 * Priority level for scenario execution.
 */
export type ScenarioPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Complete conversation scenario definition.
 */
export interface ConversationScenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Which agent type this tests */
  agentType: AgentType;
  /** Category for filtering */
  category: ScenarioCategory;

  /** Test setup configuration */
  setup: {
    tenant?: Partial<TenantSetup>;
    existingData?: {
      services?: ServiceSetup[];
      bookings?: BookingSetup[];
    };
  };

  /** Conversation turns to execute */
  turns: ScenarioTurn[];

  /** What counts as passing */
  successCriteria: SuccessCriteria;

  /** Tags for filtering and organization */
  tags: string[];
  /** Execution priority */
  priority: ScenarioPriority;
  /** Mark scenarios that may have non-deterministic results */
  flaky?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a single conversation turn.
 */
export interface TurnResult {
  /** Index of this turn (0-based) */
  turnIndex: number;
  /** Original user message */
  userMessage: string;
  /** Agent's response text */
  assistantResponse: string;
  /** Tools called during this turn */
  toolCalls: string[];
  /** Latency for this turn (ms) */
  latencyMs: number;
  /** Tokens used for this turn */
  tokens: number;
  /** Whether this turn passed expectations */
  passed: boolean;
  /** List of expectation failures */
  failures: string[];
}

/**
 * Complete scenario execution result.
 */
export interface ScenarioResult {
  /** The scenario that was run */
  scenario: ConversationScenario;
  /** Whether all criteria passed */
  passed: boolean;
  /** Results for each turn */
  turns: TurnResult[];
  /** Total latency across all turns */
  totalLatencyMs: number;
  /** Total tokens used */
  totalTokens: number;
  /** Evaluation result if evaluation was run */
  evalResult?: EvalResult;
  /** List of all failures */
  failures: string[];
  /** Execution timestamp */
  executedAt: string;
  /** Total execution duration including setup */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for agents that can process messages.
 */
export interface AgentInterface {
  /** Process a user message and return the response */
  processMessage(message: string): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; input?: unknown }>;
    usage?: { total: number; outputTokens: number };
  }>;
  /** Get the session ID for tracing */
  getSessionId(): string;
  /** Clean up resources */
  cleanup?(): Promise<void>;
}

/**
 * Factory for creating agents for testing.
 */
export interface AgentFactory {
  /** Create an agent instance for the given type and tenant */
  create(agentType: AgentType, tenantId: string): Promise<AgentInterface>;
}

/**
 * Configuration for the scenario runner.
 */
export interface ScenarioRunnerConfig {
  /** Whether to run LLM evaluation after scenarios */
  runEvaluation: boolean;
  /** Timeout for individual turns (ms) */
  turnTimeoutMs: number;
  /** Timeout for entire scenario (ms) */
  scenarioTimeoutMs: number;
  /** Whether to continue on turn failures */
  continueOnFailure: boolean;
  /** Optional filter for which scenarios to run */
  filter?: {
    tags?: string[];
    priority?: ScenarioPriority[];
    category?: ScenarioCategory[];
  };
}

export const DEFAULT_RUNNER_CONFIG: ScenarioRunnerConfig = {
  runEvaluation: false,
  turnTimeoutMs: 30000,
  scenarioTimeoutMs: 120000,
  continueOnFailure: true,
};
