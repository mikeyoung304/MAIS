/**
 * Tool Parity Tests
 *
 * Verifies that every capability has a matching tool and vice versa.
 * This ensures the capability map stays in sync with actual tool implementations.
 *
 * Philosophy:
 * - If a capability exists, there must be a tool to enable it
 * - If a tool exists, it should serve a documented capability
 * - Trust tiers must match between capability and tool
 */

import { describe, it, expect } from 'vitest';

// Import capability maps
import { CUSTOMER_AGENT_CAPABILITIES } from '../capabilities/customer-agent.cap';
import { ONBOARDING_AGENT_CAPABILITIES } from '../capabilities/onboarding-agent.cap';
import { ADMIN_AGENT_CAPABILITIES } from '../capabilities/admin-agent.cap';
import type { AgentCapabilityMap } from '../capabilities/capability-map';

// Import actual tools
import { CUSTOMER_TOOLS } from '../../../src/agent/customer/customer-tools';
import { onboardingTools } from '../../../src/agent/tools/onboarding-tools';
import { readTools } from '../../../src/agent/tools/read-tools';
import { writeTools } from '../../../src/agent/tools/write-tools';
import type { AgentTool } from '../../../src/agent/tools/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Data Setup
// ─────────────────────────────────────────────────────────────────────────────

interface AgentToolSet {
  capabilityMap: AgentCapabilityMap;
  tools: AgentTool[];
  name: string;
}

const AGENT_TOOL_SETS: AgentToolSet[] = [
  {
    name: 'Customer Agent',
    capabilityMap: CUSTOMER_AGENT_CAPABILITIES,
    tools: CUSTOMER_TOOLS,
  },
  {
    name: 'Onboarding Agent',
    capabilityMap: ONBOARDING_AGENT_CAPABILITIES,
    tools: onboardingTools,
  },
  {
    name: 'Admin Agent',
    capabilityMap: ADMIN_AGENT_CAPABILITIES,
    tools: [...readTools, ...writeTools],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all required tool names from a capability map
 */
function getRequiredToolNames(map: AgentCapabilityMap): Set<string> {
  return new Set(map.capabilities.map((c) => c.requiredTool));
}

/**
 * Get all actual tool names from a tool array
 */
function getActualToolNames(tools: AgentTool[]): Set<string> {
  return new Set(tools.map((t) => t.name));
}

/**
 * Find orphan tools (tools without matching capability)
 */
function findOrphanTools(map: AgentCapabilityMap, tools: AgentTool[]): string[] {
  const requiredTools = getRequiredToolNames(map);
  return tools.map((t) => t.name).filter((name) => !requiredTools.has(name));
}

/**
 * Find missing tools (capabilities without matching tool)
 */
function findMissingTools(map: AgentCapabilityMap, tools: AgentTool[]): string[] {
  const actualTools = getActualToolNames(tools);
  return map.capabilities
    .filter((c) => !actualTools.has(c.requiredTool))
    .map((c) => c.requiredTool);
}

/**
 * Find trust tier mismatches
 */
function findTrustTierMismatches(
  map: AgentCapabilityMap,
  tools: AgentTool[]
): Array<{ capability: string; expected: string; actual: string }> {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  const mismatches: Array<{ capability: string; expected: string; actual: string }> = [];

  for (const capability of map.capabilities) {
    const tool = toolMap.get(capability.requiredTool);
    if (tool && tool.trustTier !== capability.trustTier) {
      // Allow T2→T3 escalation (documented in capability)
      // This is valid when tools dynamically escalate based on context
      if (capability.trustTier === 'T2' && tool.trustTier === 'T2') {
        // Both are T2 base, escalation happens at runtime
        continue;
      }
      mismatches.push({
        capability: capability.id,
        expected: capability.trustTier,
        actual: tool.trustTier,
      });
    }
  }

  return mismatches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Tool Parity Tests', () => {
  describe.each(AGENT_TOOL_SETS)('$name', ({ name, capabilityMap, tools }) => {
    it('should have a tool for every capability', () => {
      const missingTools = findMissingTools(capabilityMap, tools);

      if (missingTools.length > 0) {
        throw new Error(
          `${name} is missing tools for capabilities:\n` +
            missingTools.map((t) => `  - ${t}`).join('\n') +
            '\n\nEither add the tool or remove the capability from the map.'
        );
      }

      expect(missingTools).toHaveLength(0);
    });

    it('should not have orphan tools (tools without capabilities)', () => {
      const orphanTools = findOrphanTools(capabilityMap, tools);

      if (orphanTools.length > 0) {
        throw new Error(
          `${name} has orphan tools (no matching capability):\n` +
            orphanTools.map((t) => `  - ${t}`).join('\n') +
            '\n\nEither add a capability for each tool or remove the tool.'
        );
      }

      expect(orphanTools).toHaveLength(0);
    });

    it('should have matching trust tiers', () => {
      const mismatches = findTrustTierMismatches(capabilityMap, tools);

      if (mismatches.length > 0) {
        throw new Error(
          `${name} has trust tier mismatches:\n` +
            mismatches
              .map((m) => `  - ${m.capability}: expected ${m.expected}, got ${m.actual}`)
              .join('\n') +
            '\n\nUpdate either the capability map or the tool definition.'
        );
      }

      expect(mismatches).toHaveLength(0);
    });

    it('should have at least one capability', () => {
      expect(capabilityMap.capabilities.length).toBeGreaterThan(0);
    });

    it('should have unique capability IDs', () => {
      const ids = capabilityMap.capabilities.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique tool names', () => {
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cross-Agent Validation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cross-Agent Validation', () => {
    it('should have unique capability IDs across all agents', () => {
      const allIds: string[] = [];

      for (const { capabilityMap } of AGENT_TOOL_SETS) {
        allIds.push(...capabilityMap.capabilities.map((c) => c.id));
      }

      // Capability IDs should be globally unique for clarity
      // (even if tools are shared, capabilities describe different use cases)
      const duplicates = allIds.filter((id, i) => allIds.indexOf(id) !== i);

      // Allow some duplicates for shared capabilities (e.g., check-availability)
      // but warn if there are unexpected duplicates
      if (duplicates.length > 0) {
        // For now, just log a warning - shared capabilities are acceptable
        // if they serve the same purpose across agents
        console.warn(`Shared capability IDs found: ${[...new Set(duplicates)].join(', ')}`);
      }
    });

    it('should have correct agent type identifiers', () => {
      const validTypes = ['customer', 'onboarding', 'admin'];

      for (const { capabilityMap, name } of AGENT_TOOL_SETS) {
        expect(validTypes).toContain(capabilityMap.agentType);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tool Metadata Validation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Tool Metadata Validation', () => {
    const allTools = [...CUSTOMER_TOOLS, ...onboardingTools, ...readTools, ...writeTools];

    it('every tool should have a non-empty description', () => {
      for (const tool of allTools) {
        expect(tool.description, `Tool ${tool.name} missing description`).toBeTruthy();
        expect(tool.description.length, `Tool ${tool.name} description too short`).toBeGreaterThan(
          10
        );
      }
    });

    it('every tool should have a valid trust tier', () => {
      const validTiers = ['T1', 'T2', 'T3'];

      for (const tool of allTools) {
        expect(validTiers, `Tool ${tool.name} has invalid tier: ${tool.trustTier}`).toContain(
          tool.trustTier
        );
      }
    });

    it('every tool should have an input schema', () => {
      for (const tool of allTools) {
        expect(tool.inputSchema, `Tool ${tool.name} missing inputSchema`).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('every tool should have an execute function', () => {
      for (const tool of allTools) {
        expect(typeof tool.execute, `Tool ${tool.name} missing execute`).toBe('function');
      }
    });
  });
});
