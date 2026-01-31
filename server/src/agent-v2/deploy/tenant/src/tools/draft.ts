/**
 * Draft Management Tools
 *
 * Tools for managing the storefront draft lifecycle:
 * - preview_draft (T1): Get preview URL for current draft
 * - publish_draft (T3): Publish draft changes to live
 * - discard_draft (T3): Discard all draft changes
 *
 * T3 tools REQUIRE explicit user confirmation via confirmationReceived parameter.
 * This follows pitfall #49: Trust tier enforcement must be programmatic.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, getTenantId, logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const PreviewDraftParams = z.object({});

const PublishDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "publish", "make it live", "ship it", "go live", or similar confirmation. This is a T3 action that affects the live site.'
    ),
});

const DiscardDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "discard", "revert", "undo all", "cancel changes", or similar confirmation. This will lose all unpublished changes.'
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Preview Draft Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview Draft Tool (T1)
 *
 * Gets the preview URL for the current draft.
 * The preview shows what the site will look like if published.
 */
export const previewDraftTool = new FunctionTool({
  name: 'preview_draft',
  description: `Get the preview URL for the current draft.

Use this when:
- After making changes, to show the user where to preview
- User asks to see their unpublished changes
- Before publishing, to let user review

Returns the preview URL that shows draft state vs live state.

This is a T1 tool - executes immediately.`,
  parameters: PreviewDraftParams,
  execute: async (_params, context: ToolContext | undefined) => {
    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info({}, '[TenantAgent] preview_draft called');

    // Call backend API
    const result = await callMaisApi('/storefront/preview', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      ...(result.data as Record<string, unknown>),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Publish Draft Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish Draft Tool (T3)
 *
 * Publishes all draft changes to the live site.
 *
 * CRITICAL: This is a T3 action. MUST have confirmationReceived=true.
 * Only set to true if user explicitly confirmed with words like:
 * - "publish"
 * - "make it live"
 * - "ship it"
 * - "go live"
 * - "yes, publish"
 *
 * If user hasn't confirmed, return the confirmation prompt and wait.
 */
export const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: `Publish draft changes to make them live.

**T3 ACTION - REQUIRES EXPLICIT CONFIRMATION**

Only call with confirmationReceived=true if user explicitly said:
- "publish", "publish it", "publish now"
- "make it live", "go live"
- "ship it", "let's ship"
- "yes" (in response to publish confirmation)

If user hasn't confirmed, call with confirmationReceived=false to get
the confirmation prompt, then wait for their explicit approval.

This affects the LIVE site that visitors see.`,
  parameters: PublishDraftParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = PublishDraftParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    // T3 confirmation check (pitfall #49)
    if (!parseResult.data.confirmationReceived) {
      logger.info({}, '[TenantAgent] publish_draft called without confirmation');
      return {
        success: false,
        requiresConfirmation: true,
        confirmationType: 'publish',
        message:
          'Ready to publish? This will make all draft changes visible to your visitors immediately.',
        confirmationPrompt: 'Say "publish" or "go live" to confirm.',
      };
    }

    logger.info({}, '[TenantAgent] publish_draft called with confirmation');

    // Call backend API
    const result = await callMaisApi('/storefront/publish', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      published: true,
      hasDraft: false,
      message: 'Published! Your changes are now live.',
      ...(result.data as Record<string, unknown>),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Discard Draft Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discard Draft Tool (T3)
 *
 * Discards all draft changes and reverts to the live version.
 *
 * CRITICAL: This is a T3 action. MUST have confirmationReceived=true.
 * Only set to true if user explicitly confirmed with words like:
 * - "discard"
 * - "revert"
 * - "undo all"
 * - "cancel changes"
 * - "start over"
 *
 * This action CANNOT be undone.
 */
export const discardDraftTool = new FunctionTool({
  name: 'discard_draft',
  description: `Discard all draft changes and revert to the live version.

**T3 ACTION - REQUIRES EXPLICIT CONFIRMATION**

Only call with confirmationReceived=true if user explicitly said:
- "discard", "discard it", "discard changes"
- "revert", "revert all", "revert to live"
- "undo all", "undo everything"
- "cancel changes", "cancel all changes"
- "start over"

If user hasn't confirmed, call with confirmationReceived=false to get
the confirmation prompt.

**WARNING:** This loses ALL unpublished changes. Cannot be undone.`,
  parameters: DiscardDraftParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = DiscardDraftParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    // T3 confirmation check (pitfall #49)
    if (!parseResult.data.confirmationReceived) {
      logger.info({}, '[TenantAgent] discard_draft called without confirmation');
      return {
        success: false,
        requiresConfirmation: true,
        confirmationType: 'discard',
        message:
          'This will discard ALL your unpublished changes and revert to the live version. This cannot be undone.',
        confirmationPrompt: 'Say "discard" or "revert" to confirm.',
      };
    }

    logger.info({}, '[TenantAgent] discard_draft called with confirmation');

    // Call backend API
    const result = await callMaisApi('/storefront/discard', tenantId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      discarded: true,
      hasDraft: false,
      message: 'Draft discarded. Your site is back to the live version.',
      ...(result.data as Record<string, unknown>),
    };
  },
});
