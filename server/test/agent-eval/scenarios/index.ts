/**
 * Multi-Turn Conversation Scenarios
 *
 * Exports all scenario definitions and the runner for testing complete
 * user journeys with agents.
 *
 * @see plans/agent-evaluation-system.md Phase 3
 */

// Types
export type {
  ConversationScenario,
  ScenarioTurn,
  TurnExpectations,
  TurnResult,
  ScenarioResult,
  SuccessCriteria,
  ScenarioCategory,
  ScenarioPriority,
  TenantSetup,
  ServiceSetup,
  BookingSetup,
  AgentInterface,
  AgentFactory,
  ScenarioRunnerConfig,
} from './types';

export { DEFAULT_RUNNER_CONFIG } from './types';

// Runner
export { ScenarioRunner, createScenarioRunner } from './runner';

// Customer Scenarios
export {
  BOOKING_HAPPY_PATH,
  INFORMATION_QUERY,
  SERVICE_COMPARISON,
  CUSTOMER_SCENARIOS,
} from './customer/booking-happy-path.scenario';

// Onboarding Scenarios
export {
  NO_STRIPE_FORCING,
  COMPLETE_ONBOARDING,
  SKIP_ONBOARDING,
  RETURNING_USER_RESUME,
  ONBOARDING_SCENARIOS,
} from './onboarding/no-stripe-forcing.scenario';

// Adversarial Scenarios
export {
  PROMPT_INJECTION_RESISTANCE,
  JAILBREAK_RESISTANCE,
  CROSS_TENANT_PROTECTION,
  SOCIAL_ENGINEERING_RESISTANCE,
  UNICODE_ATTACK_RESISTANCE,
  ADVERSARIAL_SCENARIOS,
} from './adversarial/prompt-injection.scenario';

// All Scenarios Combined
import { CUSTOMER_SCENARIOS } from './customer/booking-happy-path.scenario';
import { ONBOARDING_SCENARIOS } from './onboarding/no-stripe-forcing.scenario';
import { ADVERSARIAL_SCENARIOS } from './adversarial/prompt-injection.scenario';
import type { ConversationScenario } from './types';

export const ALL_SCENARIOS: ConversationScenario[] = [
  ...CUSTOMER_SCENARIOS,
  ...ONBOARDING_SCENARIOS,
  ...ADVERSARIAL_SCENARIOS,
];

/**
 * Get scenarios by priority.
 */
export function getScenariosByPriority(
  priority: 'critical' | 'high' | 'medium' | 'low'
): ConversationScenario[] {
  return ALL_SCENARIOS.filter((s) => s.priority === priority);
}

/**
 * Get scenarios by tag.
 */
export function getScenariosByTag(tag: string): ConversationScenario[] {
  return ALL_SCENARIOS.filter((s) => s.tags.includes(tag));
}

/**
 * Get scenarios by category.
 */
export function getScenariosByCategory(
  category: 'happy-path' | 'edge-case' | 'error-handling' | 'adversarial'
): ConversationScenario[] {
  return ALL_SCENARIOS.filter((s) => s.category === category);
}

/**
 * Get scenarios by agent type.
 */
export function getScenariosByAgentType(
  agentType: 'customer' | 'onboarding' | 'admin'
): ConversationScenario[] {
  return ALL_SCENARIOS.filter((s) => s.agentType === agentType);
}

/**
 * Get critical path scenarios (highest priority for regression testing).
 */
export function getCriticalPathScenarios(): ConversationScenario[] {
  return ALL_SCENARIOS.filter((s) => s.priority === 'critical' || s.tags.includes('critical-path'));
}
