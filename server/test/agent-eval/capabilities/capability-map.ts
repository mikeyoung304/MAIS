/**
 * Agent Capability Map
 *
 * Type-safe contract for what each agent can do.
 * Used by parity tests to verify tools match capabilities.
 *
 * Philosophy: Each capability represents something a user can do.
 * Agent-native architecture demands: "If the user can do it, the agent can do it."
 */

/**
 * Trust tiers for agent tools
 *
 * T1 - Auto-confirm: Low risk, read-like operations
 * T2 - Soft-confirm: Medium risk, side effects but recoverable
 * T3 - Hard-confirm: High risk, requires explicit user confirmation
 */
export type TrustTier = 'T1' | 'T2' | 'T3';

/**
 * Single capability definition
 *
 * A capability represents one thing the agent can do for the user.
 * Each capability must have a corresponding tool.
 */
export interface AgentCapability {
  /** Unique capability identifier (e.g., 'browse-services', 'book-service') */
  id: string;

  /** Human-readable description of what the agent can do */
  description: string;

  /** Tool name that enables this capability */
  requiredTool: string;

  /** Trust tier for this capability */
  trustTier: TrustTier;

  /**
   * Keywords that should appear in the system prompt.
   * Used by prompt parity tests to verify the agent knows about this capability.
   */
  promptKeywords: string[];

  /**
   * Category for grouping related capabilities
   */
  category:
    | 'read'
    | 'write'
    | 'booking'
    | 'catalog'
    | 'payment'
    | 'marketing'
    | 'onboarding'
    | 'customer-service';
}

/**
 * Agent capability map
 *
 * Complete list of capabilities for a specific agent type.
 * This serves as the source of truth for what the agent can do.
 */
export interface AgentCapabilityMap {
  /** Agent type identifier */
  agentType: 'customer' | 'onboarding' | 'admin';

  /** Human-readable agent description */
  description: string;

  /** All capabilities this agent has */
  capabilities: AgentCapability[];
}

/**
 * Get all capability maps
 */
export function getAllCapabilityMaps(): AgentCapabilityMap[] {
  // Import dynamically to avoid circular deps in test files
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CUSTOMER_AGENT_CAPABILITIES } = require('./customer-agent.cap');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ONBOARDING_AGENT_CAPABILITIES } = require('./onboarding-agent.cap');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ADMIN_AGENT_CAPABILITIES } = require('./admin-agent.cap');

  return [CUSTOMER_AGENT_CAPABILITIES, ONBOARDING_AGENT_CAPABILITIES, ADMIN_AGENT_CAPABILITIES];
}

/**
 * Get capability map by agent type
 */
export function getCapabilityMap(agentType: string): AgentCapabilityMap | undefined {
  return getAllCapabilityMaps().find((m) => m.agentType === agentType);
}

/**
 * Helper: Get all capabilities requiring user confirmation (T3)
 */
export function getHighRiskCapabilities(map: AgentCapabilityMap): AgentCapability[] {
  return map.capabilities.filter((c) => c.trustTier === 'T3');
}

/**
 * Helper: Get all read-only capabilities (T1 + read category)
 */
export function getReadOnlyCapabilities(map: AgentCapabilityMap): AgentCapability[] {
  return map.capabilities.filter((c) => c.category === 'read');
}

/**
 * Helper: Get capabilities by category
 */
export function getCapabilitiesByCategory(
  map: AgentCapabilityMap,
  category: AgentCapability['category']
): AgentCapability[] {
  return map.capabilities.filter((c) => c.category === category);
}
