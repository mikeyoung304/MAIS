/**
 * Setup Progress Tool — T1 (Read-Only)
 *
 * Returns the tenant's setup checklist progress derived from actual data state.
 * Used by the agent to suggest the highest-impact next step during conversation.
 *
 * @see docs/plans/2026-02-20-feat-onboarding-redesign-plan.md (Phase 6)
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { logger, callMaisApi, requireTenantId, wrapToolExecute } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Response schema for validation
// ─────────────────────────────────────────────────────────────────────────────

const SetupProgressResponseSchema = z.object({
  percentage: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      completed: z.boolean(),
      dismissed: z.boolean(),
      weight: z.number(),
      action: z
        .object({
          type: z.string(),
        })
        .passthrough(),
    })
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Setup Progress Tool
 *
 * T1 trust tier: execute immediately, no confirmation needed.
 * Returns checklist items with completion status and suggested next actions.
 */
export const getSetupProgressTool = new FunctionTool({
  name: 'get_setup_progress',
  description: `Check the tenant's website setup progress and see which checklist items are complete.

Returns a percentage (0-100) and a list of 8 setup items with completion status.

Use this tool to:
- See what the tenant has already completed
- Suggest the highest-impact next step (highest weight incomplete item)
- Know whether to suggest Stripe, calendar, testimonials, FAQ, gallery, or publishing

Call this ONCE at the start of a conversation to understand the tenant's current state.
Do NOT announce "Let me check..." — just check and incorporate the results naturally.`,

  parameters: z.object({}),

  execute: wrapToolExecute(async (_params, context) => {
    const tenantId = requireTenantId(context);

    logger.info({ tenantId }, '[TenantAgent] get_setup_progress');

    const result = await callMaisApi('/onboarding/setup-progress', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? 'Could not fetch setup progress',
      };
    }

    const parsed = SetupProgressResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      logger.error(
        { tenantId, errors: parsed.error.format() },
        '[TenantAgent] Setup progress response shape mismatch'
      );
      return {
        success: false,
        error: 'Unexpected response format from backend',
      };
    }

    const { percentage, items } = parsed.data;
    const incomplete = items
      .filter((i) => !i.completed && !i.dismissed)
      .sort((a, b) => b.weight - a.weight);

    return {
      success: true,
      percentage,
      totalItems: items.length,
      completedItems: items.filter((i) => i.completed).length,
      dismissedItems: items.filter((i) => i.dismissed).length,
      items,
      suggestedNext: incomplete[0] ?? null,
    };
  }),
});
