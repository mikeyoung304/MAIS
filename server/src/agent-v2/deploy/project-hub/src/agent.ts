/**
 * Project Hub Agent - Standalone Deployment Package
 *
 * Dual-faced agent mediating customer-tenant communication post-booking.
 * Provides different views and capabilities based on context (customer vs tenant).
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for request classification and mediation
 * - Auto-handles routine requests (confidence > 80%)
 * - Escalates complex requests to tenant (confidence < 50%)
 * - 72-hour expiry for escalated requests
 *
 * Deploy with: npm run deploy
 */

import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// Mediation thresholds
const AUTO_HANDLE_THRESHOLD = 0.8;
const ESCALATE_THRESHOLD = 0.5;
const ALWAYS_ESCALATE_KEYWORDS = ['refund', 'complaint', 'lawyer', 'legal', 'cancel', 'sue'];

// Escalation expiry
const ESCALATION_EXPIRY_HOURS = 72;

// =============================================================================
// SYSTEM PROMPT - Dual-Faced Customer-Tenant Communication
// =============================================================================

const PROJECT_HUB_SYSTEM_PROMPT = `# HANDLED Project Hub - System Prompt

## Identity

You are the HANDLED Project Hub assistant - a helpful, professional, and reassuring presence that bridges communication between customers and service providers after a booking is confirmed.

## Your Role

You manage post-booking communication, ensuring:
1. Customers get timely, helpful information about their upcoming service
2. Routine questions are answered instantly
3. Complex requests are properly escalated to the service provider
4. Both parties stay informed throughout the project lifecycle

## Context Detection

IMPORTANT: Detect the context from the session state:
- If 'contextType' is 'customer': You're talking to the customer who made the booking
- If 'contextType' is 'tenant': You're talking to the service provider (business owner)

## Customer Context Behavior

When talking to a CUSTOMER:
- Be warm, reassuring, and helpful
- Proactively offer relevant information about their booking
- Answer common questions instantly (prep checklists, what to expect, timing)
- For special requests, evaluate if you can handle it or need to escalate
- Never reveal internal tenant notes or business details

## Tenant Context Behavior

When talking to a TENANT:
- Be efficient and professional
- Show pending customer requests that need attention
- Provide quick approve/deny workflows
- Give activity summaries and insights
- Allow direct messaging to customers

## Mediation Logic

For customer requests, classify and act:

1. **AUTO-HANDLE (High Confidence)**:
   - Simple date/time questions
   - Standard prep instructions
   - Location/parking information
   - What to bring/wear guidance
   → Handle immediately, log the interaction

2. **FLAG AND HANDLE (Medium Confidence)**:
   - Minor scheduling adjustments
   - Add-on inquiries
   - General questions about the service
   → Handle but flag for tenant visibility

3. **ESCALATE (Low Confidence or Keywords)**:
   - Refund requests
   - Major rescheduling
   - Complaints or concerns
   - Legal mentions
   - Anything involving money changes
   → Create request for tenant approval, inform customer of timeline

## Trust Tier Behaviors

- **T1 (Auto)**: Read operations, prep info, timeline updates
- **T2 (Soft Confirm)**: Minor adjustments, add-on confirmations
- **T3 (Hard Confirm)**: Refunds, cancellations, major changes

## Response Style

- Clear and concise
- Professional but warm
- Action-oriented
- Reassuring when handling uncertainty
`;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tier: string;
}

interface CustomerContext {
  customerId: string;
  customerName: string;
  projectId: string;
  bookingId: string;
}

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
}

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

const TIMEOUTS = {
  BACKEND_API: 15_000, // 15s for backend calls
  SPECIALIST_DEFAULT: 30_000, // 30s for marketing/storefront
  SPECIALIST_RESEARCH: 90_000, // 90s for research (web scraping)
  METADATA_SERVICE: 5_000, // 5s for GCP metadata
} as const;

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function callBackendAPI<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`;

  const response = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_API_SECRET,
      },
      ...(body && { body: JSON.stringify(body) }),
    },
    TIMEOUTS.BACKEND_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

function getContextFromSession(ctx: ToolContext): {
  contextType: 'customer' | 'tenant';
  tenantId: string;
  customerId?: string;
  projectId?: string;
} {
  const state = ctx.state as Record<string, unknown>;
  return {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId: (state.tenantId as string) || '',
    customerId: state.customerId as string | undefined,
    projectId: state.projectId as string | undefined,
  };
}

function shouldAlwaysEscalate(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ALWAYS_ESCALATE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

// =============================================================================
// CUSTOMER CONTEXT TOOLS
// =============================================================================

const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description:
    'Get the current status of the customer project including booking details, timeline, and next steps.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID to check status for'),
  }),
  func: async ({ projectId }, ctx: ToolContext) => {
    const { tenantId } = getContextFromSession(ctx);

    try {
      const project = await callBackendAPI<Project>(`/project-hub/projects/${projectId}`, 'GET');

      return {
        success: true,
        project: {
          status: project.status,
          bookingDate: project.bookingDate,
          serviceName: project.serviceName,
          preferences: project.customerPreferences,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project status',
      };
    }
  },
});

const getPrepChecklist = new FunctionTool({
  name: 'get_prep_checklist',
  description:
    'Get the preparation checklist for the customer - what to bring, how to prepare, etc.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  func: async ({ projectId }, ctx: ToolContext) => {
    try {
      const checklist = await callBackendAPI<{
        items: Array<{ text: string; completed: boolean }>;
      }>(`/project-hub/projects/${projectId}/checklist`, 'GET');

      return {
        success: true,
        checklist: checklist.items,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get checklist',
      };
    }
  },
});

const answerPrepQuestion = new FunctionTool({
  name: 'answer_prep_question',
  description: 'Answer a preparation-related question using the service details and FAQ.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    question: z.string().describe('The customer question to answer'),
  }),
  func: async ({ projectId, question }, ctx: ToolContext) => {
    try {
      const answer = await callBackendAPI<{ answer: string; confidence: number; source: string }>(
        `/project-hub/projects/${projectId}/answer`,
        'POST',
        { question }
      );

      // Log the interaction
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'MESSAGE_FROM_AGENT',
        payload: { question, answer: answer.answer },
        visibleToCustomer: true,
        visibleToTenant: true,
      });

      return {
        success: true,
        answer: answer.answer,
        confidence: answer.confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to answer question',
      };
    }
  },
});

const submitRequest = new FunctionTool({
  name: 'submit_request',
  description:
    'Submit a customer request that requires tenant review (rescheduling, cancellation, refund, etc.)',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    requestType: z
      .enum([
        'RESCHEDULE',
        'ADD_ON',
        'QUESTION',
        'CHANGE_REQUEST',
        'CANCELLATION',
        'REFUND',
        'OTHER',
      ])
      .describe('Type of request'),
    details: z.string().describe('Details of the request'),
    urgency: z.enum(['low', 'medium', 'high']).default('medium').describe('Request urgency'),
  }),
  func: async ({ projectId, requestType, details, urgency }, ctx: ToolContext) => {
    try {
      // Calculate expiry (72 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ESCALATION_EXPIRY_HOURS);

      const request = await callBackendAPI<ProjectRequest>(
        `/project-hub/projects/${projectId}/requests`,
        'POST',
        {
          type: requestType,
          requestData: { details, urgency },
          expiresAt: expiresAt.toISOString(),
        }
      );

      // Log the event
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'REQUEST_SUBMITTED',
        payload: { requestId: request.id, type: requestType, details },
        visibleToCustomer: true,
        visibleToTenant: true,
      });

      return {
        success: true,
        requestId: request.id,
        message: `Your ${requestType.toLowerCase().replace('_', ' ')} request has been submitted. The service provider typically responds within 24-48 hours.`,
        expiresAt: request.expiresAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit request',
      };
    }
  },
});

const getTimeline = new FunctionTool({
  name: 'get_timeline',
  description: 'Get the project timeline showing key milestones and upcoming events.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  func: async ({ projectId }, ctx: ToolContext) => {
    try {
      const events = await callBackendAPI<ProjectEvent[]>(
        `/project-hub/projects/${projectId}/events?visibleToCustomer=true`,
        'GET'
      );

      // Filter and format for customer view
      const timeline = events.map((e) => ({
        date: e.createdAt,
        type: e.type,
        description: (e.payload as Record<string, string>).description || e.type,
      }));

      return {
        success: true,
        timeline,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get timeline',
      };
    }
  },
});

// =============================================================================
// TENANT CONTEXT TOOLS
// =============================================================================

const getPendingRequests = new FunctionTool({
  name: 'get_pending_requests',
  description: 'Get all pending customer requests that need tenant attention.',
  inputSchema: z.object({
    tenantId: z.string().describe('The tenant ID'),
    limit: z.number().default(10).describe('Maximum number of requests to return'),
  }),
  func: async ({ tenantId, limit }, ctx: ToolContext) => {
    try {
      const requests = await callBackendAPI<ProjectRequest[]>(
        `/project-hub/tenants/${tenantId}/pending-requests?limit=${limit}`,
        'GET'
      );

      return {
        success: true,
        requests: requests.map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          data: r.requestData,
          expiresAt: r.expiresAt,
        })),
        count: requests.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending requests',
      };
    }
  },
});

const getCustomerActivity = new FunctionTool({
  name: 'get_customer_activity',
  description: 'Get recent customer activity across all projects for the tenant.',
  inputSchema: z.object({
    tenantId: z.string().describe('The tenant ID'),
    days: z.number().default(7).describe('Number of days to look back'),
  }),
  func: async ({ tenantId, days }, ctx: ToolContext) => {
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
        recentEvents: activity.recentEvents.slice(0, 10),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity',
      };
    }
  },
});

const approveRequest = new FunctionTool({
  name: 'approve_request',
  description: 'Approve a pending customer request.',
  inputSchema: z.object({
    requestId: z.string().describe('The request ID to approve'),
    response: z.string().optional().describe('Optional response message to customer'),
  }),
  func: async ({ requestId, response }, ctx: ToolContext) => {
    try {
      const result = await callBackendAPI<{ success: boolean; request: ProjectRequest }>(
        `/project-hub/requests/${requestId}/approve`,
        'POST',
        { responseData: { message: response, approvedAt: new Date().toISOString() } }
      );

      return {
        success: true,
        message: 'Request approved successfully',
        request: result.request,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve request',
      };
    }
  },
});

const denyRequest = new FunctionTool({
  name: 'deny_request',
  description: 'Deny a pending customer request with a reason.',
  inputSchema: z.object({
    requestId: z.string().describe('The request ID to deny'),
    reason: z.string().describe('Reason for denial (will be shared with customer)'),
  }),
  func: async ({ requestId, reason }, ctx: ToolContext) => {
    try {
      const result = await callBackendAPI<{ success: boolean; request: ProjectRequest }>(
        `/project-hub/requests/${requestId}/deny`,
        'POST',
        { responseData: { reason, deniedAt: new Date().toISOString() } }
      );

      return {
        success: true,
        message: 'Request denied',
        request: result.request,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deny request',
      };
    }
  },
});

const sendMessageToCustomer = new FunctionTool({
  name: 'send_message_to_customer',
  description: 'Send a message directly to a customer about their project.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    message: z.string().describe('Message to send to the customer'),
    notifyByEmail: z.boolean().default(true).describe('Whether to also send email notification'),
  }),
  func: async ({ projectId, message, notifyByEmail }, ctx: ToolContext) => {
    try {
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'MESSAGE_FROM_TENANT',
        payload: { message },
        visibleToCustomer: true,
        visibleToTenant: true,
      });

      if (notifyByEmail) {
        await callBackendAPI(`/project-hub/projects/${projectId}/notify`, 'POST', {
          type: 'message',
          message,
        });
      }

      return {
        success: true,
        message: 'Message sent to customer',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  },
});

const updateProjectStatus = new FunctionTool({
  name: 'update_project_status',
  description: 'Update the status of a project (e.g., mark as completed, on hold).',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).describe('New status'),
    reason: z.string().optional().describe('Reason for status change'),
  }),
  func: async ({ projectId, status, reason }, ctx: ToolContext) => {
    try {
      const result = await callBackendAPI<{ success: boolean; project: Project }>(
        `/project-hub/projects/${projectId}/status`,
        'PUT',
        { status, reason }
      );

      // Log the status change
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'STATUS_CHANGED',
        payload: { oldStatus: 'ACTIVE', newStatus: status, reason },
        visibleToCustomer: status === 'COMPLETED',
        visibleToTenant: true,
      });

      return {
        success: true,
        project: result.project,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  },
});

// =============================================================================
// AGENT DEFINITION
// =============================================================================

// Customer-facing tools
const customerTools = [
  getProjectStatus,
  getPrepChecklist,
  answerPrepQuestion,
  submitRequest,
  getTimeline,
];

// Tenant-facing tools
const tenantTools = [
  getPendingRequests,
  getCustomerActivity,
  approveRequest,
  denyRequest,
  sendMessageToCustomer,
  updateProjectStatus,
];

// All tools (agent dynamically uses based on context)
const allTools = [...customerTools, ...tenantTools];

/**
 * Project Hub Agent
 *
 * Dual-faced agent that mediates between customers and tenants.
 * Uses session state to determine context and provide appropriate tools/behavior.
 */
export const agent = new LlmAgent({
  name: 'agent',
  model: 'gemini-2.0-flash',
  description: 'Dual-faced Project Hub agent mediating customer-tenant communication post-booking',
  instruction: PROJECT_HUB_SYSTEM_PROMPT,
  tools: allTools,
  config: {
    temperature: 0.4, // Balanced for helpful but consistent responses
    thinkingConfig: {
      thinkingBudget: 5000,
    },
  },
});
