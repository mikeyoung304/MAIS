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

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  logger,
  callMaisApiTyped,
  requireTenantId,
  validateParams,
  wrapToolExecute,
} from '../utils.js';
import { StoreDiscoveryFactResponse, GetDiscoveryFactsResponse } from '../types/api-responses.js';
import { DISCOVERY_FACT_KEYS } from '../constants/discovery-facts.js';

// Re-export for backward compatibility with tools/index.ts
export { DISCOVERY_FACT_KEYS, type DiscoveryFactKey } from '../constants/discovery-facts.js';

// ─────────────────────────────────────────────────────────────────────────────
// Store Discovery Fact Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store Discovery Fact Tool
 *
 * Active memory management - call this when you learn something important
 * about the business during conversation.
 *
 * Part of the Slot Machine Protocol:
 * 1. User shares info → store_discovery_fact
 * 2. Response includes nextAction → follow it deterministically
 */
export const storeDiscoveryFactTool = new FunctionTool({
  name: 'store_discovery_fact',
  description: `Store a fact about the business learned during conversation.

CRITICAL: Call this when you learn something important about the business.

Examples:
- User says "I'm a life coach" → store_discovery_fact(key: "businessType", value: "life coach")
- User says "I use CBT approach" → store_discovery_fact(key: "approach", value: "CBT (Cognitive Behavioral Therapy)")
- User says "I'm in Wisconsin" → store_discovery_fact(key: "location", value: {state: "Wisconsin"})
- User says "I help people break through" → store_discovery_fact(key: "uniqueValue", value: "helping people break through to their inner selves")
- User says "rich people, same-sex couples" → store_discovery_fact(key: "dreamClient", value: "affluent individuals and same-sex couples")

Valid keys: ${DISCOVERY_FACT_KEYS.join(', ')}

After storing, the response includes a nextAction from the slot machine.
Follow nextAction deterministically:
- ASK: Ask the question from missingForNext[0]
- BUILD_FIRST_DRAFT: Call build_first_draft to build MVP sections
- TRIGGER_RESEARCH: Call delegate_to_research
- OFFER_REFINEMENT: Invite feedback on the draft`,

  parameters: z.object({
    key: z.enum(DISCOVERY_FACT_KEYS).describe('The type of fact being stored'),
    value: z
      .unknown()
      .describe('The value to store (string, number, or object for complex data like location)'),
  }),

  execute: wrapToolExecute(async (params, context) => {
    const { key, value } = validateParams(
      z.object({
        key: z.enum(DISCOVERY_FACT_KEYS),
        value: z.unknown(),
      }),
      params
    );
    const tenantId = requireTenantId(context);

    logger.info({ key, tenantId }, '[TenantAgent] store_discovery_fact');

    const result = await callMaisApiTyped(
      '/store-discovery-fact',
      tenantId,
      {
        key,
        value,
      },
      StoreDiscoveryFactResponse
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        suggestion: 'Fact not stored, but you can continue the conversation.',
      };
    }

    // Return updated facts list + slot machine result so agent knows what to do next
    const responseData = result.data;

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
  }),
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

  execute: wrapToolExecute(async (_params, context) => {
    const tenantId = requireTenantId(context);

    logger.info({ tenantId }, '[TenantAgent] get_known_facts');

    const result = await callMaisApiTyped(
      '/get-discovery-facts',
      tenantId,
      {},
      GetDiscoveryFactsResponse
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        suggestion: 'Could not retrieve facts. Continue the conversation normally.',
      };
    }

    const responseData = result.data;

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
  }),
});
