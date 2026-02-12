/**
 * Segment Management Tools for Tenant Agent
 *
 * CRUD operations for client segments (e.g., "Weddings", "Portraits", "Individual Therapy").
 * Segments are the top-level grouping for tiers and add-ons.
 *
 * Trust Tiers:
 * - list: T1 (read-only, execute immediately)
 * - create: T2 (creates database record)
 * - update: T2 (modifies database record)
 * - delete: T3 (requires explicit confirmation)
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
  SegmentListResponse,
  SegmentMutationResponse,
  SegmentDeleteResponse,
} from '../types/api-responses.js';
import { MAX_SEGMENTS_PER_TENANT } from '../constants/shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: ADK doesn't support z.discriminatedUnion (pitfall #30), so we use a
// flat object with optional fields and validate action-specific requirements
// at runtime in the execute function.

const ManageSegmentsParams = z.object({
  action: z
    .enum(['list', 'create', 'update', 'delete'])
    .describe('The operation to perform on segments'),
  // For create/update
  name: z
    .string()
    .optional()
    .describe(
      'Segment name (e.g., "Wedding Photography", "Individual Therapy"). Required for create.'
    ),
  // For update/delete
  segmentId: z
    .string()
    .optional()
    .describe('ID of the segment to update or delete. Required for update/delete.'),
  // For delete (T3 confirmation)
  confirmationReceived: z
    .boolean()
    .optional()
    .describe('Must be true to confirm deletion — this deletes the segment AND all its tiers!'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Manage Segments Tool
// ─────────────────────────────────────────────────────────────────────────────

export const manageSegmentsTool = new FunctionTool({
  name: 'manage_segments',
  description: `Create, update, delete, or list client segments (who you serve).

Segments group your services by client type. Example: a photographer might have "Weddings" and "Portraits" segments, each with different pricing tiers.

Actions:
- list: See all your current segments (max ${MAX_SEGMENTS_PER_TENANT})
- create: Add a new segment (requires name)
- update: Modify an existing segment (requires segmentId)
- delete: Remove a segment AND all its tiers (requires segmentId AND confirmationReceived: true)

Examples:
- "Add a Wedding Photography segment"
  → manage_segments(action: "create", name: "Wedding Photography")

- "Rename my Portraits segment"
  → manage_segments(action: "update", segmentId: "seg_xxx", name: "Portrait Sessions")

After creating a segment, use manage_tiers to add pricing tiers to it.`,

  parameters: ManageSegmentsParams,

  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(ManageSegmentsParams, params);
    const tenantId = requireTenantId(context);

    logger.info({ action: validParams.action, tenantId }, '[TenantAgent] manage_segments');

    switch (validParams.action) {
      case 'list':
        return handleListSegments(tenantId);

      case 'create': {
        if (!validParams.name) {
          return {
            success: false,
            error: 'Create requires: name',
            suggestion: 'Example: "Add a Wedding Photography segment"',
          };
        }
        return handleCreateSegment(tenantId, { name: validParams.name });
      }

      case 'update': {
        if (!validParams.segmentId) {
          return {
            success: false,
            error: 'Update requires segmentId. Use action: "list" first to see segment IDs.',
          };
        }
        return handleUpdateSegment(tenantId, {
          segmentId: validParams.segmentId,
          name: validParams.name,
        });
      }

      case 'delete': {
        if (!validParams.segmentId) {
          return {
            success: false,
            error: 'Delete requires segmentId. Use action: "list" first to see segment IDs.',
          };
        }
        if (!validParams.confirmationReceived) {
          return {
            success: false,
            error:
              'Delete requires confirmationReceived: true — this deletes the segment AND all its tiers!',
            requiresConfirmation: true,
          };
        }
        return handleDeleteSegment(tenantId, { segmentId: validParams.segmentId });
      }

      default:
        return { success: false, error: 'Unknown action. Use: list, create, update, or delete' };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleListSegments(tenantId: string) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-segments',
    tenantId,
    { action: 'list' },
    SegmentListResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    segments: data.segments,
    totalCount: data.totalCount,
    maxSegments: data.maxSegments,
    message:
      data.totalCount > 0
        ? `You have ${data.totalCount} segment(s): ${data.segments.map((s) => s.name).join(', ')}`
        : 'No segments yet. Create one to get started.',
    canAddMore: data.totalCount < data.maxSegments,
  };
}

async function handleCreateSegment(tenantId: string, params: { name: string }) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-segments',
    tenantId,
    { action: 'create', name: params.name },
    SegmentMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    created: true,
    segment: data.segment,
    totalCount: data.totalCount,
    maxSegments: data.maxSegments,
    message: `Created "${data.segment.name}" segment. Now add pricing tiers with manage_tiers.`,
    nextStep:
      'Use manage_tiers(action: "create", segmentId: "' + data.segment.id + '", ...) to add tiers.',
  };
}

async function handleUpdateSegment(tenantId: string, params: { segmentId: string; name?: string }) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-segments',
    tenantId,
    { action: 'update', segmentId: params.segmentId, name: params.name },
    SegmentMutationResponse
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const data = result.data;

  return {
    success: true,
    updated: true,
    segment: data.segment,
    message: `Updated segment to "${data.segment.name}".`,
  };
}

async function handleDeleteSegment(tenantId: string, params: { segmentId: string }) {
  const result = await callMaisApiTyped(
    '/content-generation/manage-segments',
    tenantId,
    { action: 'delete', segmentId: params.segmentId },
    SegmentDeleteResponse
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
    message: `Segment deleted. You now have ${data.totalCount} segment(s).`,
  };
}
