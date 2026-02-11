/**
 * Project Management Tools - Migrated from project-hub-agent (tenant view)
 *
 * Tenant-facing tools for managing customer projects and requests.
 * Includes request approval/denial, messaging, and status updates.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  callMaisApi,
  callBackendAPI,
  logger,
  requireTenantId,
  validateParams,
  wrapToolExecute,
} from '../utils.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Project {
  id: string;
  status: string;
  bookingDate: string;
  serviceName: string;
  customerPreferences: Record<string, unknown>;
}

interface ProjectEvent {
  id: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
  visibleToCustomer: boolean;
}

interface ProjectRequest {
  id: string;
  type: string;
  status: string;
  requestData: Record<string, unknown>;
  expiresAt: string;
  version?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULTS = {
  PENDING_REQUESTS_LIMIT: 10,
  ACTIVITY_LOOKBACK_DAYS: 7,
  RECENT_EVENTS_DISPLAY_LIMIT: 10,
} as const;

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const LimitSchema = z.object({
  limit: z
    .number()
    .default(DEFAULTS.PENDING_REQUESTS_LIMIT)
    .describe('Maximum number of requests to return'),
});

const DaysSchema = z.object({
  days: z.number().default(DEFAULTS.ACTIVITY_LOOKBACK_DAYS).describe('Number of days to look back'),
});

const ApproveRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID required').describe('The request ID to approve'),
  expectedVersion: z
    .number()
    .int()
    .positive('Expected version required')
    .describe('Expected version from get_pending_requests (required for optimistic locking)'),
  response: z.string().optional().describe('Optional response message to customer'),
});

const DenyRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID required').describe('The request ID to deny'),
  expectedVersion: z
    .number()
    .int()
    .positive('Expected version required')
    .describe('Expected version from get_pending_requests'),
  reason: z
    .string()
    .min(1, 'Reason required')
    .describe('Reason for denial (will be shared with customer)'),
  response: z.string().optional().describe('Optional additional response message to customer'),
});

const SendMessageSchema = z.object({
  projectId: z.string().min(1, 'Project ID required').describe('The project ID'),
  message: z.string().min(1, 'Message required').describe('Message to send to the customer'),
  notifyByEmail: z.boolean().default(true).describe('Whether to also send email notification'),
});

const UpdateStatusSchema = z.object({
  projectId: z.string().min(1, 'Project ID required').describe('The project ID'),
  newStatus: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).describe('New status'),
  reason: z.string().optional().describe('Reason for status change'),
});

const GetProjectDetailsSchema = z.object({
  projectId: z.string().min(1, 'Project ID required').describe('The project ID to get details for'),
});

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * T1: Get pending customer requests
 */
export const getPendingRequestsTool = new FunctionTool({
  name: 'get_pending_requests',
  description:
    'Get all pending customer requests that need your attention. Returns requests awaiting approval/denial.',
  parameters: LimitSchema,
  execute: wrapToolExecute(async (params, context) => {
    validateParams(LimitSchema, params);
    const tenantId = requireTenantId(context);

    const result = await callMaisApi(`/project-hub/pending-requests`, tenantId, {});
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Failed to get pending requests' };
    }

    const data = result.data as { requests: ProjectRequest[]; count: number };
    return {
      success: true,
      requests: data.requests.map((r: ProjectRequest) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        data: r.requestData,
        expiresAt: r.expiresAt,
        version: r.version,
      })),
      count: data.count,
      // State indicators for agent context (Pitfall #48)
      hasPendingRequests: data.count > 0,
      pendingRequestCount: data.count,
      lastUpdated: new Date().toISOString(),
    };
  }),
});

/**
 * T1: Get customer activity across projects
 */
export const getCustomerActivityTool = new FunctionTool({
  name: 'get_customer_activity',
  description: 'Get recent customer activity across all your projects.',
  parameters: DaysSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { days } = validateParams(DaysSchema, params);
    const tenantId = requireTenantId(context);

    // Uses GET with tenantId in path — callBackendAPI needed for non-POST methods
    try {
      const activity = await callBackendAPI<{
        totalProjects: number;
        activeProjects: number;
        recentEvents: ProjectEvent[];
      }>(`/project-hub/tenants/${tenantId}/activity?days=${days}`, 'GET');

      return {
        success: true,
        summary: {
          totalProjects: activity.totalProjects,
          activeProjects: activity.activeProjects,
          recentEventCount: activity.recentEvents.length,
        },
        recentEvents: activity.recentEvents.slice(0, DEFAULTS.RECENT_EVENTS_DISPLAY_LIMIT),
        hasActiveProjects: activity.activeProjects > 0,
        hasRecentActivity: activity.recentEvents.length > 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity',
      };
    }
  }),
});

/**
 * T1: Get project details
 */
export const getProjectDetailsTool = new FunctionTool({
  name: 'get_project_details',
  description: 'Get details about a specific customer project.',
  parameters: GetProjectDetailsSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { projectId } = validateParams(GetProjectDetailsSchema, params);
    const tenantId = requireTenantId(context);

    const result = await callMaisApi(`/project-hub/project-details`, tenantId, { projectId });
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Failed to get project details' };
    }

    const project = result.data as Project;
    return {
      success: true,
      project: {
        id: project.id,
        status: project.status,
        bookingDate: project.bookingDate,
        serviceName: project.serviceName,
        preferences: project.customerPreferences,
      },
      lastUpdated: new Date().toISOString(),
    };
  }),
});

/**
 * T2: Approve a pending request
 */
export const approveRequestTool = new FunctionTool({
  name: 'approve_request',
  description:
    'Approve a pending customer request. Requires expectedVersion for optimistic locking - get this from get_pending_requests first.',
  parameters: ApproveRequestSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { requestId, expectedVersion, response } = validateParams(ApproveRequestSchema, params);
    const tenantId = requireTenantId(context);

    const result = await callMaisApi(`/project-hub/approve-request`, tenantId, {
      requestId,
      expectedVersion,
      response,
    });
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Failed to approve request' };
    }

    const data = result.data as {
      success: boolean;
      request: ProjectRequest;
      remainingPendingCount?: number;
    };
    return {
      success: true,
      message: 'Request approved successfully',
      request: data.request,
      requestStatus: 'APPROVED' as const,
      hasPendingRequests:
        data.remainingPendingCount !== undefined ? data.remainingPendingCount > 0 : undefined,
      remainingPendingCount: data.remainingPendingCount,
    };
  }),
});

/**
 * T2: Deny a pending request
 */
export const denyRequestTool = new FunctionTool({
  name: 'deny_request',
  description:
    'Deny a pending customer request with a reason. Requires expectedVersion for optimistic locking.',
  parameters: DenyRequestSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { requestId, expectedVersion, reason, response } = validateParams(
      DenyRequestSchema,
      params
    );
    const tenantId = requireTenantId(context);

    const result = await callMaisApi(`/project-hub/deny-request`, tenantId, {
      requestId,
      expectedVersion,
      reason,
      response,
    });
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Failed to deny request' };
    }

    const data = result.data as {
      success: boolean;
      request: ProjectRequest;
      remainingPendingCount?: number;
    };
    return {
      success: true,
      message: 'Request denied',
      request: data.request,
      requestStatus: 'DENIED' as const,
      hasPendingRequests:
        data.remainingPendingCount !== undefined ? data.remainingPendingCount > 0 : undefined,
      remainingPendingCount: data.remainingPendingCount,
    };
  }),
});

/**
 * T2: Send a message to a customer
 */
export const sendMessageToCustomerTool = new FunctionTool({
  name: 'send_message_to_customer',
  description: 'Send a message directly to a customer about their project.',
  parameters: SendMessageSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { projectId, message, notifyByEmail } = validateParams(SendMessageSchema, params);
    const tenantId = requireTenantId(context);

    const result = await callMaisApi(`/project-hub/projects/${projectId}/events`, tenantId, {
      type: 'MESSAGE_FROM_TENANT',
      actor: tenantId,
      actorType: 'tenant',
      payload: { message },
      visibleToCustomer: true,
      visibleToTenant: true,
    });
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Failed to send message' };
    }

    // Fire-and-forget email notification
    if (notifyByEmail) {
      callMaisApi(`/project-hub/projects/${projectId}/notify`, tenantId, {
        type: 'message',
        message,
      }).catch((error: unknown) =>
        logger.error(
          { error: error instanceof Error ? error.message : String(error), projectId },
          '[TenantAgent] Failed to send email notification'
        )
      );
    }

    return {
      success: true,
      message: 'Message sent to customer',
      lastMessageAt: new Date().toISOString(),
      messageSentToCustomer: true,
      emailNotificationSent: notifyByEmail,
    };
  }),
});

/**
 * T2: Update project status
 */
export const updateProjectStatusTool = new FunctionTool({
  name: 'update_project_status',
  description: 'Update the status of a project (e.g., mark as completed, on hold).',
  parameters: UpdateStatusSchema,
  execute: wrapToolExecute(async (params, context) => {
    const { projectId, newStatus, reason } = validateParams(UpdateStatusSchema, params);
    const tenantId = requireTenantId(context);

    // Uses PUT — callBackendAPI needed for non-POST methods
    try {
      const updateResult = await callBackendAPI<{ success: boolean; project: Project }>(
        `/project-hub/projects/${projectId}/status`,
        'PUT',
        { status: newStatus, reason, tenantId }
      );

      // Fire-and-forget event logging via callMaisApi
      callMaisApi(`/project-hub/projects/${projectId}/events`, tenantId, {
        type: 'STATUS_CHANGED',
        actor: tenantId,
        actorType: 'tenant',
        payload: { oldStatus: 'ACTIVE', newStatus, reason },
        visibleToCustomer: newStatus === 'COMPLETED',
        visibleToTenant: true,
      }).catch((error: unknown) =>
        logger.error(
          { error: error instanceof Error ? error.message : String(error), projectId, newStatus },
          '[TenantAgent] Failed to log status change event'
        )
      );

      return {
        success: true,
        project: updateResult.project,
        projectStatus: newStatus,
        statusUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }),
});
