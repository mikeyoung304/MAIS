/**
 * Project Management Tools - Migrated from project-hub-agent (tenant view)
 *
 * Tenant-facing tools for managing customer projects and requests.
 * Includes request approval/denial, messaging, and status updates.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { FunctionTool, type ToolContext as _ToolContext } from '@google/adk';
import { z } from 'zod';
import { getTenantId, callBackendAPI, logger } from '../utils.js';

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
  limit: z.number().default(DEFAULTS.PENDING_REQUESTS_LIMIT),
});

const DaysSchema = z.object({
  days: z.number().default(DEFAULTS.ACTIVITY_LOOKBACK_DAYS),
});

const ApproveRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID required'),
  expectedVersion: z.number().int().positive('Expected version required'),
  response: z.string().optional(),
});

const DenyRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID required'),
  expectedVersion: z.number().int().positive('Expected version required'),
  reason: z.string().min(1, 'Reason required'),
  response: z.string().optional(),
});

const SendMessageSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  message: z.string().min(1, 'Message required'),
  notifyByEmail: z.boolean().default(true),
});

const UpdateStatusSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  newStatus: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
  reason: z.string().optional(),
});

const GetProjectDetailsSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
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
  parameters: z.object({
    limit: z
      .number()
      .default(DEFAULTS.PENDING_REQUESTS_LIMIT)
      .describe('Maximum number of requests to return'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = LimitSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      const result = await callBackendAPI<{ requests: ProjectRequest[]; count: number }>(
        `/project-hub/pending-requests`,
        'POST',
        { tenantId }
      );

      return {
        success: true,
        requests: result.requests.map((r: ProjectRequest) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          data: r.requestData,
          expiresAt: r.expiresAt,
          version: r.version,
        })),
        count: result.count,
        // State indicators for agent context (Pitfall #52)
        hasPendingRequests: result.count > 0,
        pendingRequestCount: result.count,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending requests',
      };
    }
  },
});

/**
 * T1: Get customer activity across projects
 */
export const getCustomerActivityTool = new FunctionTool({
  name: 'get_customer_activity',
  description: 'Get recent customer activity across all your projects.',
  parameters: z.object({
    days: z
      .number()
      .default(DEFAULTS.ACTIVITY_LOOKBACK_DAYS)
      .describe('Number of days to look back'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = DaysSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { days } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

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
  },
});

/**
 * T1: Get project details
 */
export const getProjectDetailsTool = new FunctionTool({
  name: 'get_project_details',
  description: 'Get details about a specific customer project.',
  parameters: z.object({
    projectId: z.string().describe('The project ID to get details for'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = GetProjectDetailsSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { projectId } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      const project = await callBackendAPI<Project>(`/project-hub/project-details`, 'POST', {
        tenantId,
        projectId,
      });

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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project details',
      };
    }
  },
});

/**
 * T2: Approve a pending request
 */
export const approveRequestTool = new FunctionTool({
  name: 'approve_request',
  description:
    'Approve a pending customer request. Requires expectedVersion for optimistic locking - get this from get_pending_requests first.',
  parameters: z.object({
    requestId: z.string().describe('The request ID to approve'),
    expectedVersion: z
      .number()
      .int()
      .positive()
      .describe('Expected version from get_pending_requests (required for optimistic locking)'),
    response: z.string().optional().describe('Optional response message to customer'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = ApproveRequestSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { requestId, expectedVersion, response } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      const result = await callBackendAPI<{
        success: boolean;
        request: ProjectRequest;
        remainingPendingCount?: number;
      }>(`/project-hub/approve-request`, 'POST', {
        tenantId,
        requestId,
        expectedVersion,
        response,
      });

      return {
        success: true,
        message: 'Request approved successfully',
        request: result.request,
        requestStatus: 'APPROVED' as const,
        hasPendingRequests:
          result.remainingPendingCount !== undefined ? result.remainingPendingCount > 0 : undefined,
        remainingPendingCount: result.remainingPendingCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve request',
      };
    }
  },
});

/**
 * T2: Deny a pending request
 */
export const denyRequestTool = new FunctionTool({
  name: 'deny_request',
  description:
    'Deny a pending customer request with a reason. Requires expectedVersion for optimistic locking.',
  parameters: z.object({
    requestId: z.string().describe('The request ID to deny'),
    expectedVersion: z
      .number()
      .int()
      .positive()
      .describe('Expected version from get_pending_requests'),
    reason: z.string().describe('Reason for denial (will be shared with customer)'),
    response: z.string().optional().describe('Optional additional response message to customer'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = DenyRequestSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { requestId, expectedVersion, reason, response } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      const result = await callBackendAPI<{
        success: boolean;
        request: ProjectRequest;
        remainingPendingCount?: number;
      }>(`/project-hub/deny-request`, 'POST', {
        tenantId,
        requestId,
        expectedVersion,
        reason,
        response,
      });

      return {
        success: true,
        message: 'Request denied',
        request: result.request,
        requestStatus: 'DENIED' as const,
        hasPendingRequests:
          result.remainingPendingCount !== undefined ? result.remainingPendingCount > 0 : undefined,
        remainingPendingCount: result.remainingPendingCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deny request',
      };
    }
  },
});

/**
 * T2: Send a message to a customer
 */
export const sendMessageToCustomerTool = new FunctionTool({
  name: 'send_message_to_customer',
  description: 'Send a message directly to a customer about their project.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    message: z.string().describe('Message to send to the customer'),
    notifyByEmail: z.boolean().default(true).describe('Whether to also send email notification'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = SendMessageSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { projectId, message, notifyByEmail } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'MESSAGE_FROM_TENANT',
        actor: tenantId,
        actorType: 'tenant',
        payload: { message },
        visibleToCustomer: true,
        visibleToTenant: true,
        tenantId,
      });

      // Fire-and-forget email notification
      if (notifyByEmail) {
        callBackendAPI(`/project-hub/projects/${projectId}/notify`, 'POST', {
          type: 'message',
          message,
          tenantId,
        }).catch((err: unknown) =>
          logger.error(
            { err: err instanceof Error ? err.message : String(err), projectId },
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  },
});

/**
 * T2: Update project status
 */
export const updateProjectStatusTool = new FunctionTool({
  name: 'update_project_status',
  description: 'Update the status of a project (e.g., mark as completed, on hold).',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    newStatus: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).describe('New status'),
    reason: z.string().optional().describe('Reason for status change'),
  }),
  execute: async (params, context) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = UpdateStatusSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }
    const { projectId, newStatus, reason } = parsed.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    try {
      const result = await callBackendAPI<{ success: boolean; project: Project }>(
        `/project-hub/projects/${projectId}/status`,
        'PUT',
        { status: newStatus, reason, tenantId }
      );

      // Fire-and-forget event logging
      callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'STATUS_CHANGED',
        actor: tenantId,
        actorType: 'tenant',
        payload: { oldStatus: 'ACTIVE', newStatus, reason },
        visibleToCustomer: newStatus === 'COMPLETED',
        visibleToTenant: true,
        tenantId,
      }).catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err), projectId, newStatus },
          '[TenantAgent] Failed to log status change event'
        )
      );

      return {
        success: true,
        project: result.project,
        projectStatus: newStatus,
        statusUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  },
});
