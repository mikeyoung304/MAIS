/**
 * Add-On Management Tools for Tenant Agent
 *
 * CRUD operations for optional add-on services (e.g., "Second Shooter", "Album").
 * Add-ons can be scoped to a specific segment or available across all segments.
 *
 * Trust Tiers:
 * - list: T1 (read-only, execute immediately)
 * - create: T2 (creates database record)
 * - update: T2 (modifies database record)
 * - delete: T3 (requires explicit confirmation)
 *
 * Price handling: Agent sends priceInDollars (e.g., 500 for $500).
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
  AddOnListResponse,
  AddOnMutationResponse,
  AddOnDeleteResponse,
} from '../types/api-responses.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: ADK doesn't support z.discriminatedUnion (pitfall #30), so we use a
// flat object with optional fields and validate action-specific requirements
// at runtime in the execute function.

const ManageAddOnsParams = z.object({
  action: z
    .enum(['list', 'create', 'update', 'delete'])
    .describe('The operation to perform on add-ons'),
  // For create/update
  name: z
    .string()
    .optional()
    .describe('Add-on name (e.g., "Second Shooter", "Premium Album"). Required for create.'),
  description: z
    .string()
    .optional()
    .describe(
      'What this add-on includes (e.g., "Professional hardcover album with 40 pages"). Optional.'
    ),
  priceInDollars: z
    .number()
    .optional()
    .describe('Price in DOLLARS (e.g., 500 for $500). Required for create. Range: $1 — $10,000.'),
  // Optional segment scoping
  segmentId: z
    .string()
    .optional()
    .describe(
      'Segment to scope this add-on to. If omitted, add-on is available across all segments.'
    ),
  // For update/delete
  addOnId: z
    .string()
    .optional()
    .describe('ID of the add-on to update or delete. Required for update/delete.'),
  // For delete (T3 confirmation)
  confirmationReceived: z.boolean().optional().describe('Must be true to confirm deletion.'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Manage Add-Ons Tool
// ─────────────────────────────────────────────────────────────────────────────

export const manageAddOnsTool = new FunctionTool({
  name: 'manage_addons',
  description: `Create, update, delete, or list optional add-on services.

Add-ons are extras customers can add to any booking (e.g., "Second Shooter" for $500, "Premium Album" for $800). They can be scoped to a specific segment or available across all segments.

Actions:
- list: See all add-ons (optionally filter by segmentId)
- create: Add a new add-on (requires name, priceInDollars)
- update: Modify an existing add-on (requires addOnId)
- delete: Remove an add-on (requires addOnId AND confirmationReceived: true)

Price range: $1 — $10,000.

Examples:
- "Add a Second Shooter add-on for $500"
  → manage_addons(action: "create", name: "Second Shooter", priceInDollars: 500, description: "Additional photographer for complete coverage")

- "Add a Premium Album add-on only for Weddings"
  → manage_addons(action: "create", name: "Premium Album", priceInDollars: 800, segmentId: "seg_xxx")

Price is in DOLLARS (e.g., 500 = $500), not cents.`,

  parameters: ManageAddOnsParams,

  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(ManageAddOnsParams, params);
    const tenantId = requireTenantId(context);

    logger.info({ action: validParams.action, tenantId }, '[TenantAgent] manage_addons');

    switch (validParams.action) {
      case 'list':
        return handleListAddOns(tenantId, validParams.segmentId);

      case 'create': {
        if (!validParams.name) {
          return {
            success: false,
            error: 'Create requires: name',
            suggestion: 'Example: "Add a Second Shooter add-on for $500"',
          };
        }
        if (validParams.priceInDollars === undefined) {
          return {
            success: false,
            error: 'Create requires: priceInDollars',
            suggestion:
              'Example: manage_addons(action: "create", name: "Second Shooter", priceInDollars: 500)',
          };
        }
        if (validParams.priceInDollars < 1 || validParams.priceInDollars > 10000) {
          return {
            success: false,
            error: 'Price must be between $1 and $10,000',
          };
        }
        return handleCreateAddOn(tenantId, {
          name: validParams.name,
          description: validParams.description,
          priceInDollars: validParams.priceInDollars,
          segmentId: validParams.segmentId,
        });
      }

      case 'update': {
        if (!validParams.addOnId) {
          return {
            success: false,
            error: 'Update requires addOnId. Use action: "list" first to see add-on IDs.',
          };
        }
        if (
          validParams.priceInDollars !== undefined &&
          (validParams.priceInDollars < 1 || validParams.priceInDollars > 10000)
        ) {
          return {
            success: false,
            error: 'Price must be between $1 and $10,000',
          };
        }
        return handleUpdateAddOn(tenantId, {
          addOnId: validParams.addOnId,
          name: validParams.name,
          description: validParams.description,
          priceInDollars: validParams.priceInDollars,
          segmentId: validParams.segmentId,
        });
      }

      case 'delete': {
        if (!validParams.addOnId) {
          return {
            success: false,
            error: 'Delete requires addOnId. Use action: "list" first to see add-on IDs.',
          };
        }
        if (!validParams.confirmationReceived) {
          return {
            success: false,
            error: 'Delete requires confirmationReceived: true.',
            requiresConfirmation: true,
          };
        }
        return handleDeleteAddOn(tenantId, { addOnId: validParams.addOnId });
      }

      default:
        return { success: false, error: 'Unknown action. Use: list, create, update, or delete' };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleListAddOns(tenantId: string, segmentId?: string) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-addons',
    tenantId,
    { action: 'list', ...(segmentId ? { segmentId } : {}) },
    AddOnListResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    addOns: data.addOns,
    totalCount: data.totalCount,
    message:
      data.totalCount > 0
        ? `Found ${data.totalCount} add-on(s): ${data.addOns.map((a) => `${a.name} ($${a.priceInDollars.toLocaleString()})`).join(', ')}`
        : 'No add-ons yet. Create one to offer extras to your clients.',
    hasAddOns: data.totalCount > 0,
  };
}

async function handleCreateAddOn(
  tenantId: string,
  params: {
    name: string;
    description?: string;
    priceInDollars: number;
    segmentId?: string;
  }
) {
  // Convert dollars → cents for the server contract (server expects priceCents)
  const priceCents = Math.round(params.priceInDollars * 100);

  const result = await callMaisApiTyped(
    '/content-generation/manage-addons',
    tenantId,
    {
      action: 'create',
      name: params.name,
      description: params.description,
      priceCents,
      ...(params.segmentId ? { segmentId: params.segmentId } : {}),
    },
    AddOnMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    created: true,
    addOn: data.addOn,
    totalCount: data.totalCount,
    message: `Created "${data.addOn.name}" add-on at $${data.addOn.priceInDollars.toLocaleString()}.${data.addOn.segmentName ? ` Scoped to ${data.addOn.segmentName} segment.` : ' Available across all segments.'}`,
  };
}

async function handleUpdateAddOn(
  tenantId: string,
  params: {
    addOnId: string;
    name?: string;
    description?: string;
    priceInDollars?: number;
    segmentId?: string;
  }
) {
  // Convert dollars → cents for the server contract (server expects priceCents)
  const priceCentsPayload =
    params.priceInDollars !== undefined
      ? { priceCents: Math.round(params.priceInDollars * 100) }
      : {};

  const result = await callMaisApiTyped(
    '/content-generation/manage-addons',
    tenantId,
    {
      action: 'update',
      addOnId: params.addOnId,
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...priceCentsPayload,
      ...(params.segmentId !== undefined ? { segmentId: params.segmentId } : {}),
    },
    AddOnMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    updated: true,
    addOn: data.addOn,
    message: `Updated "${data.addOn.name}" — now $${data.addOn.priceInDollars.toLocaleString()}.`,
  };
}

async function handleDeleteAddOn(tenantId: string, params: { addOnId: string }) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-addons',
    tenantId,
    { action: 'delete', addOnId: params.addOnId },
    AddOnDeleteResponse
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
    message: `Add-on deleted. You now have ${data.totalCount} add-on(s).`,
  };
}
