/**
 * Tier Management Tools for Tenant Agent
 *
 * CRUD operations for pricing tiers within a segment.
 * Tiers are bookable entities with real prices — they appear in the
 * Services section and drive checkout.
 *
 * Trust Tiers:
 * - list: T1 (read-only, execute immediately)
 * - create: T2 (creates database record)
 * - update: T2 (modifies database record)
 * - delete: T3 (requires explicit confirmation)
 *
 * Price handling: Agent sends priceInDollars (e.g., 2500 for $2,500).
 * Conversion to priceCents happens agent-side before the API call.
 * LLMs are unreliable at arithmetic — never let them work in cents.
 *
 * @see docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md
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
import {
  TierListResponse,
  TierMutationResponse,
  TierDeleteResponse,
} from '../types/api-responses.js';
import { MAX_TIERS_PER_SEGMENT } from '../constants/shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: ADK doesn't support z.discriminatedUnion (pitfall #30), so we use a
// flat object with optional fields and validate action-specific requirements
// at runtime in the execute function.

const ManageTiersParams = z.object({
  action: z
    .enum(['list', 'create', 'update', 'delete'])
    .describe('The operation to perform on tiers'),
  // Required for create — which segment to add this tier to
  segmentId: z
    .string()
    .optional()
    .describe(
      'ID of the segment this tier belongs to. Required for create. Use manage_segments(action: "list") to get IDs.'
    ),
  // For create/update
  name: z
    .string()
    .optional()
    .describe('Tier name (e.g., "Elopement Package", "Premium Session"). Required for create.'),
  priceInDollars: z
    .number()
    .optional()
    .describe(
      'Price in DOLLARS (e.g., 2500 for $2,500). Required for create. Range: $1 — $50,000.'
    ),
  bookingType: z
    .enum(['DATE', 'TIMESLOT'])
    .optional()
    .describe(
      'How clients book — DATE for full-day events, TIMESLOT for hourly sessions. Defaults to DATE.'
    ),
  features: z
    .array(z.string())
    .optional()
    .describe(
      'List of included features (e.g., ["4 hours coverage", "Online gallery", "Print credits"]). Optional.'
    ),
  // For update/delete
  tierId: z
    .string()
    .optional()
    .describe('ID of the tier to update or delete. Required for update/delete.'),
  // For delete (T3 confirmation)
  confirmationReceived: z
    .boolean()
    .optional()
    .describe(
      'Must be true to confirm deletion — this deletes the tier and may affect existing bookings!'
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Manage Tiers Tool
// ─────────────────────────────────────────────────────────────────────────────

export const manageTiersTool = new FunctionTool({
  name: 'manage_tiers',
  description: `Create, update, delete, or list pricing tiers within a segment.

Tiers are your ACTUAL bookable offerings — they appear in your Services section with prices and "Book" buttons. Each tier belongs to a segment.

Actions:
- list: See all tiers (optionally filter by segmentId)
- create: Add a new tier (requires segmentId, name, priceInDollars)
- update: Modify an existing tier (requires tierId)
- delete: Remove a tier (requires tierId AND confirmationReceived: true)

Max ${MAX_TIERS_PER_SEGMENT} tiers per segment. Price range: $1 — $50,000.

Examples:
- "Add an Elopement Package for $2,500 to the Weddings segment"
  → manage_tiers(action: "create", segmentId: "seg_xxx", name: "Elopement Package", priceInDollars: 2500)

- "Update the Full Day tier to $5,000"
  → manage_tiers(action: "update", tierId: "tier_xxx", priceInDollars: 5000)

- "Add features to the Premium tier"
  → manage_tiers(action: "update", tierId: "tier_xxx", features: ["8 hours", "Second shooter", "Album"])

Price is in DOLLARS (e.g., 2500 = $2,500), not cents. After creating tiers, use manage_addons for optional extras.`,

  parameters: ManageTiersParams,

  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(ManageTiersParams, params);
    const tenantId = requireTenantId(context);

    logger.info({ action: validParams.action, tenantId }, '[TenantAgent] manage_tiers');

    switch (validParams.action) {
      case 'list':
        return handleListTiers(tenantId, validParams.segmentId);

      case 'create': {
        if (!validParams.segmentId) {
          return {
            success: false,
            error:
              'Create requires segmentId. Use manage_segments(action: "list") to see segment IDs.',
          };
        }
        if (!validParams.name) {
          return {
            success: false,
            error: 'Create requires: name',
            suggestion: 'Example: "Add an Elopement Package for $2,500"',
          };
        }
        if (validParams.priceInDollars === undefined) {
          return {
            success: false,
            error: 'Create requires: priceInDollars',
            suggestion: 'Example: manage_tiers(action: "create", ..., priceInDollars: 2500)',
          };
        }
        if (validParams.priceInDollars < 1 || validParams.priceInDollars > 50000) {
          return {
            success: false,
            error: 'Price must be between $1 and $50,000',
          };
        }
        return handleCreateTier(tenantId, {
          segmentId: validParams.segmentId,
          name: validParams.name,
          priceInDollars: validParams.priceInDollars,
          bookingType: validParams.bookingType,
          features: validParams.features,
        });
      }

      case 'update': {
        if (!validParams.tierId) {
          return {
            success: false,
            error: 'Update requires tierId. Use action: "list" first to see tier IDs.',
          };
        }
        if (
          validParams.priceInDollars !== undefined &&
          (validParams.priceInDollars < 1 || validParams.priceInDollars > 50000)
        ) {
          return {
            success: false,
            error: 'Price must be between $1 and $50,000',
          };
        }
        return handleUpdateTier(tenantId, {
          tierId: validParams.tierId,
          name: validParams.name,
          priceInDollars: validParams.priceInDollars,
          bookingType: validParams.bookingType,
          features: validParams.features,
        });
      }

      case 'delete': {
        if (!validParams.tierId) {
          return {
            success: false,
            error: 'Delete requires tierId. Use action: "list" first to see tier IDs.',
          };
        }
        if (!validParams.confirmationReceived) {
          return {
            success: false,
            error:
              'Delete requires confirmationReceived: true — this may affect existing bookings!',
            requiresConfirmation: true,
          };
        }
        return handleDeleteTier(tenantId, { tierId: validParams.tierId });
      }

      default:
        return { success: false, error: 'Unknown action. Use: list, create, update, or delete' };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleListTiers(tenantId: string, segmentId?: string) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-tiers',
    tenantId,
    { action: 'list', ...(segmentId ? { segmentId } : {}) },
    TierListResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    tiers: data.tiers,
    totalCount: data.totalCount,
    segmentId: data.segmentId,
    message:
      data.totalCount > 0
        ? `Found ${data.totalCount} tier(s): ${data.tiers.map((t) => `${t.name} ($${t.priceInDollars.toLocaleString()})`).join(', ')}`
        : segmentId
          ? 'No tiers in this segment yet. Create one to get started.'
          : 'No tiers yet. Create segments first, then add tiers.',
    hasTiers: data.totalCount > 0,
  };
}

async function handleCreateTier(
  tenantId: string,
  params: {
    segmentId: string;
    name: string;
    priceInDollars: number;
    bookingType?: 'DATE' | 'TIMESLOT';
    features?: string[];
  }
) {
  // Convert dollars → cents for the server contract (server expects priceCents)
  const priceCents = Math.round(params.priceInDollars * 100);

  const result = await callMaisApiTyped(
    '/content-generation/manage-tiers',
    tenantId,
    {
      action: 'create',
      segmentId: params.segmentId,
      name: params.name,
      priceCents,
      bookingType: params.bookingType ?? 'DATE',
      features: params.features ?? [],
    },
    TierMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    created: true,
    tier: data.tier,
    totalCount: data.totalCount,
    message: `Created "${data.tier.name}" at $${data.tier.priceInDollars.toLocaleString()}. Customers can now book this tier.`,
    nextStep: 'Add more tiers or use manage_addons to create optional extras.',
  };
}

async function handleUpdateTier(
  tenantId: string,
  params: {
    tierId: string;
    name?: string;
    priceInDollars?: number;
    bookingType?: 'DATE' | 'TIMESLOT';
    features?: string[];
  }
) {
  // Convert dollars → cents for the server contract (server expects priceCents)
  const priceCentsPayload =
    params.priceInDollars !== undefined
      ? { priceCents: Math.round(params.priceInDollars * 100) }
      : {};

  const result = await callMaisApiTyped(
    '/content-generation/manage-tiers',
    tenantId,
    {
      action: 'update',
      tierId: params.tierId,
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...priceCentsPayload,
      ...(params.bookingType !== undefined ? { bookingType: params.bookingType } : {}),
      ...(params.features !== undefined ? { features: params.features } : {}),
    },
    TierMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    updated: true,
    tier: data.tier,
    message: `Updated "${data.tier.name}" — now $${data.tier.priceInDollars.toLocaleString()}.`,
  };
}

async function handleDeleteTier(tenantId: string, params: { tierId: string }) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-tiers',
    tenantId,
    { action: 'delete', tierId: params.tierId },
    TierDeleteResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    deleted: true,
    deletedId: data.deletedId,
    remainingCount: data.totalCount,
    message: `Tier deleted. You now have ${data.totalCount} tier(s).`,
  };
}
