/**
 * Draft Management Tools
 *
 * Tools for managing the storefront draft lifecycle:
 * - preview_draft (T1): Get preview URL for current draft
 * - publish_draft (T3): Publish draft changes to live
 * - discard_draft (T3): Discard all draft changes
 *
 * T3 tools REQUIRE explicit user confirmation via confirmationReceived parameter.
 * This follows pitfall #45: Trust tier enforcement must be programmatic.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool } from '@google/adk';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import {
  callMaisApiTyped,
  requireTenantId,
  validateParams,
  wrapToolExecute,
  logger,
} from '../utils.js';
import {
  PreviewDraftResponse,
  PublishAllResponse,
  DiscardAllResponse,
} from '../types/api-responses.js';

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation Token System (T3 Defense-in-Depth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a short confirmation token for T3 two-phase confirmation.
 * Format: CONF-{6 hex chars} (e.g., "CONF-a7b3f2")
 * Stored in ADK session state with 5-minute TTL.
 */
function generateConfirmationToken(): string {
  return `CONF-${randomBytes(3).toString('hex')}`;
}

/** Session state key for storing pending confirmation tokens */
const PUBLISH_TOKEN_KEY = 'pendingPublishToken';
const PUBLISH_TOKEN_EXPIRY_KEY = 'pendingPublishTokenExpiry';
const DISCARD_TOKEN_KEY = 'pendingDiscardToken';
const DISCARD_TOKEN_EXPIRY_KEY = 'pendingDiscardTokenExpiry';

/** Token TTL in milliseconds (5 minutes) */
const TOKEN_TTL_MS = 5 * 60 * 1000;

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
  confirmationToken: z
    .string()
    .optional()
    .describe(
      'The confirmation token returned from the first call. Required when confirmationReceived is true.'
    ),
});

const DiscardDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "discard", "revert", "undo all", "cancel changes", or similar confirmation. This will lose all unpublished changes.'
    ),
  confirmationToken: z
    .string()
    .optional()
    .describe(
      'The confirmation token returned from the first call. Required when confirmationReceived is true.'
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
  execute: wrapToolExecute(async (_params, context) => {
    const tenantId = requireTenantId(context);

    logger.info({}, '[TenantAgent] preview_draft called');

    // Call backend API
    const result = await callMaisApiTyped(
      '/storefront/preview',
      tenantId,
      {},
      PreviewDraftResponse
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      ...result.data,
    };
  }),
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
  execute: wrapToolExecute(async (params, context) => {
    const validatedParams = validateParams(PublishDraftParams, params);
    const tenantId = requireTenantId(context);

    // T3 confirmation check (pitfall #45)
    if (!validatedParams.confirmationReceived) {
      // Phase 1: Generate and store confirmation token
      const token = generateConfirmationToken();

      // Store token in ADK session state
      context?.state?.set(PUBLISH_TOKEN_KEY, token);
      context?.state?.set(PUBLISH_TOKEN_EXPIRY_KEY, Date.now() + TOKEN_TTL_MS);

      logger.info({ token }, '[TenantAgent] publish_draft: generated confirmation token');
      return {
        success: false,
        requiresConfirmation: true,
        confirmationType: 'publish',
        confirmationToken: token,
        message:
          'Ready to publish? This will make all draft changes visible to your visitors immediately.',
        confirmationPrompt: `Say "publish" or "go live" to confirm. (Token: ${token})`,
      };
    }

    // Phase 2: Validate confirmation token (defense-in-depth, pitfall #803)
    const storedToken = context?.state?.get<string>(PUBLISH_TOKEN_KEY);
    const storedExpiry = context?.state?.get<number>(PUBLISH_TOKEN_EXPIRY_KEY);

    if (!storedToken || !validatedParams.confirmationToken) {
      logger.warn({}, '[TenantAgent] publish_draft: missing confirmation token');
      return {
        success: false,
        error: 'Missing confirmation token. Please start the publish flow again.',
        requiresConfirmation: true,
        confirmationType: 'publish',
      };
    }

    if (validatedParams.confirmationToken !== storedToken) {
      logger.warn(
        { provided: validatedParams.confirmationToken, expected: storedToken },
        '[TenantAgent] publish_draft: token mismatch'
      );
      return {
        success: false,
        error: 'Invalid confirmation token. Please start the publish flow again.',
        requiresConfirmation: true,
        confirmationType: 'publish',
      };
    }

    if (storedExpiry && Date.now() > storedExpiry) {
      logger.warn({}, '[TenantAgent] publish_draft: confirmation token expired');
      // Clear expired token
      context?.state?.set(PUBLISH_TOKEN_KEY, null);
      context?.state?.set(PUBLISH_TOKEN_EXPIRY_KEY, null);
      return {
        success: false,
        error: 'Confirmation token expired. Please confirm again.',
        requiresConfirmation: true,
        confirmationType: 'publish',
      };
    }

    // Clear token after successful validation (one-time use)
    context?.state?.set(PUBLISH_TOKEN_KEY, null);
    context?.state?.set(PUBLISH_TOKEN_EXPIRY_KEY, null);

    logger.info({}, '[TenantAgent] publish_draft: token validated, proceeding');

    // Call backend API
    const result = await callMaisApiTyped('/storefront/publish', tenantId, {}, PublishAllResponse);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    const { success: _ok, ...publishData } = result.data;
    return {
      success: true,
      published: true,
      hasDraft: false,
      message: 'Published! Your changes are now live.',
      dashboardAction: { type: 'PUBLISH_SITE' },
      ...publishData,
    };
  }),
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
  execute: wrapToolExecute(async (params, context) => {
    const validatedParams = validateParams(DiscardDraftParams, params);
    const tenantId = requireTenantId(context);

    // T3 confirmation check (pitfall #45)
    if (!validatedParams.confirmationReceived) {
      // Phase 1: Generate and store confirmation token
      const token = generateConfirmationToken();

      // Store token in ADK session state
      context?.state?.set(DISCARD_TOKEN_KEY, token);
      context?.state?.set(DISCARD_TOKEN_EXPIRY_KEY, Date.now() + TOKEN_TTL_MS);

      logger.info({ token }, '[TenantAgent] discard_draft: generated confirmation token');
      return {
        success: false,
        requiresConfirmation: true,
        confirmationType: 'discard',
        confirmationToken: token,
        message:
          'This will discard ALL your unpublished changes and revert to the live version. This cannot be undone.',
        confirmationPrompt: `Say "discard" or "revert" to confirm. (Token: ${token})`,
      };
    }

    // Phase 2: Validate confirmation token (defense-in-depth, pitfall #803)
    const storedToken = context?.state?.get<string>(DISCARD_TOKEN_KEY);
    const storedExpiry = context?.state?.get<number>(DISCARD_TOKEN_EXPIRY_KEY);

    if (!storedToken || !validatedParams.confirmationToken) {
      logger.warn({}, '[TenantAgent] discard_draft: missing confirmation token');
      return {
        success: false,
        error: 'Missing confirmation token. Please start the discard flow again.',
        requiresConfirmation: true,
        confirmationType: 'discard',
      };
    }

    if (validatedParams.confirmationToken !== storedToken) {
      logger.warn(
        { provided: validatedParams.confirmationToken, expected: storedToken },
        '[TenantAgent] discard_draft: token mismatch'
      );
      return {
        success: false,
        error: 'Invalid confirmation token. Please start the discard flow again.',
        requiresConfirmation: true,
        confirmationType: 'discard',
      };
    }

    if (storedExpiry && Date.now() > storedExpiry) {
      logger.warn({}, '[TenantAgent] discard_draft: confirmation token expired');
      // Clear expired token
      context?.state?.set(DISCARD_TOKEN_KEY, null);
      context?.state?.set(DISCARD_TOKEN_EXPIRY_KEY, null);
      return {
        success: false,
        error: 'Confirmation token expired. Please confirm again.',
        requiresConfirmation: true,
        confirmationType: 'discard',
      };
    }

    // Clear token after successful validation (one-time use)
    context?.state?.set(DISCARD_TOKEN_KEY, null);
    context?.state?.set(DISCARD_TOKEN_EXPIRY_KEY, null);

    logger.info({}, '[TenantAgent] discard_draft: token validated, proceeding');

    // Call backend API
    const result = await callMaisApiTyped('/storefront/discard', tenantId, {}, DiscardAllResponse);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    const { success: _ok2, ...discardData } = result.data;
    return {
      success: true,
      discarded: true,
      hasDraft: false,
      message: 'Draft discarded. Your site is back to the live version.',
      ...discardData,
    };
  }),
});
