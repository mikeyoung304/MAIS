/**
 * Discovery Tools for Tenant Agent
 *
 * Active memory management during onboarding conversations.
 * These tools allow the agent to store and retrieve facts learned
 * about the business during the interview pattern.
 *
 * Ported from archived concierge agent during Phase 4 migration.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 * @see CLAUDE.md pitfall #49 (discovery facts dual-source)
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { logger, callMaisApi, getTenantId } from '../utils.js';
import { DISCOVERY_FACT_KEYS } from '../../../../../shared/constants/discovery-facts.js';

// Re-export for backward compatibility with tools/index.ts
export {
  DISCOVERY_FACT_KEYS,
  type DiscoveryFactKey,
} from '../../../../../shared/constants/discovery-facts.js';

// ─────────────────────────────────────────────────────────────────────────────
// Store Discovery Fact Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store Discovery Fact Tool
 *
 * Active memory management - call this when you learn something important
 * about the business during conversation.
 *
 * Part of the Fact-to-Storefront Bridge pattern:
 * 1. User shares info → store_discovery_fact
 * 2. Immediately after → update_section to apply it
 */
export const storeDiscoveryFactTool = new FunctionTool({
  name: 'store_discovery_fact',
  description: `Store a fact about the business learned during conversation.

CRITICAL: Call this when you learn something important about the business.
This is part of the Fact-to-Storefront Bridge - after storing, immediately call update_section to apply it.

Examples:
- User says "I'm a life coach" → store_discovery_fact(key: "businessType", value: "life coach")
- User says "I use CBT approach" → store_discovery_fact(key: "approach", value: "CBT (Cognitive Behavioral Therapy)")
- User says "I'm in Wisconsin" → store_discovery_fact(key: "location", value: {state: "Wisconsin"})
- User says "I help people break through" → store_discovery_fact(key: "uniqueValue", value: "helping people break through to their inner selves")
- User says "rich people, same-sex couples" → store_discovery_fact(key: "dreamClient", value: "affluent individuals and same-sex couples")

Valid keys: ${DISCOVERY_FACT_KEYS.join(', ')}

After storing a fact that relates to storefront content, IMMEDIATELY call update_section to apply it.`,

  parameters: z.object({
    key: z.enum(DISCOVERY_FACT_KEYS).describe('The type of fact being stored'),
    value: z
      .unknown()
      .describe('The value to store (string, number, or object for complex data like location)'),
  }),

  execute: async (params, context: ToolContext | undefined) => {
    // Validate params (pitfall #56)
    const parseResult = z
      .object({
        key: z.enum(DISCOVERY_FACT_KEYS),
        value: z.unknown(),
      })
      .safeParse(params);

    if (!parseResult.success) {
      return {
        stored: false,
        error: `Invalid parameters: ${parseResult.error.message}`,
      };
    }

    const { key, value } = parseResult.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        stored: false,
        error: 'No tenant context available',
      };
    }

    logger.info({ key, tenantId }, '[TenantAgent] store_discovery_fact');

    const result = await callMaisApi('/store-discovery-fact', tenantId, {
      key,
      value,
    });

    if (!result.ok) {
      return {
        stored: false,
        error: result.error,
        suggestion: 'Fact not stored, but you can continue the conversation.',
      };
    }

    // Return updated facts list + slot machine result so agent knows what to do next
    const responseData = result.data as {
      stored: boolean;
      key: string;
      value: unknown;
      totalFactsKnown: number;
      knownFactKeys: string[];
      currentPhase: string;
      phaseAdvanced: boolean;
      nextAction: string;
      readySections: string[];
      missingForNext: Array<{ key: string; question: string }>;
      slotMetrics: { filled: number; total: number; utilization: number };
      message: string;
    };

    return {
      stored: true,
      key,
      value,
      totalFactsKnown: responseData.totalFactsKnown,
      knownFactKeys: responseData.knownFactKeys,
      // Slot machine results — agent follows nextAction deterministically
      currentPhase: responseData.currentPhase,
      phaseAdvanced: responseData.phaseAdvanced,
      nextAction: responseData.nextAction,
      readySections: responseData.readySections,
      missingForNext: responseData.missingForNext,
      slotMetrics: responseData.slotMetrics,
      message: `Got it! I now know: ${responseData.knownFactKeys.join(', ')}`,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Known Facts Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Known Facts Tool
 *
 * Read-only access to stored discovery facts.
 * Call this to check what you already know before asking redundant questions.
 */
export const getKnownFactsTool = new FunctionTool({
  name: 'get_known_facts',
  description: `Get the current list of known facts about the business.

Use this to:
- Check what you already know before asking questions (prevents redundant questions)
- Confirm stored information before updating the storefront
- Resume context in a returning session

Call this when:
- Starting a conversation to see what you've learned before
- Before asking about business details (you might already know)
- When user says "you already asked that" - check what you know!`,

  parameters: z.object({}),

  execute: async (_params, context: ToolContext | undefined) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info({ tenantId }, '[TenantAgent] get_known_facts');

    const result = await callMaisApi('/get-discovery-facts', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        suggestion: 'Could not retrieve facts. Continue the conversation normally.',
      };
    }

    const responseData = result.data as {
      success: boolean;
      facts: Record<string, unknown>;
      factCount: number;
      factKeys: string[];
      message: string;
    };

    return {
      success: true,
      facts: responseData.facts,
      factCount: responseData.factCount,
      factKeys: responseData.factKeys,
      message: responseData.message,
      // Help agent avoid redundant questions
      guidance:
        responseData.factCount > 0
          ? `You already know ${responseData.factCount} facts. Don't ask about: ${responseData.factKeys.join(', ')}`
          : 'No facts stored yet. Start the interview pattern.',
    };
  },
});
