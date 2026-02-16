/**
 * Project Tools - Migrated from project-hub-agent (customer view)
 *
 * Customer-facing tools for post-booking project management.
 * Includes status checking, prep information, and request submission.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import {
  getSessionContext,
  callBackendAPI,
  logger,
  wrapToolExecute,
  validateParams,
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
}

interface CustomerBootstrapData {
  project: {
    id: string;
    status: string;
    bookingDate: string;
    serviceName: string;
  };
  hasPendingRequests: boolean;
  pendingRequestCount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALWAYS_ESCALATE_KEYWORDS = ['refund', 'complaint', 'lawyer', 'legal', 'cancel', 'sue'];
const AUTO_HANDLE_THRESHOLD = 0.8;
const ESCALATE_THRESHOLD = 0.5;

// T3 request types requiring explicit customer confirmation
const T3_REQUEST_TYPES = ['CANCELLATION', 'REFUND'] as const;

// =============================================================================
// HELPERS
// =============================================================================

function shouldAlwaysEscalate(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ALWAYS_ESCALATE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const ProjectIdSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
});

const ProjectIdWithQuestionSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  question: z.string().min(1, 'Question required'),
});

const SubmitRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  requestType: z.enum([
    'RESCHEDULE',
    'ADD_ON',
    'QUESTION',
    'CHANGE_REQUEST',
    'CANCELLATION',
    'REFUND',
    'OTHER',
  ]),
  details: z.string().min(1, 'Details required'),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  confirmationReceived: z.boolean().optional(),
});

// =============================================================================
// BOOTSTRAP TOOL
// =============================================================================

/**
 * Bootstrap Customer Session Tool
 *
 * ALWAYS called FIRST in any new conversation.
 * Returns context about the customer's project status for personalized greetings.
 */
export const bootstrapCustomerSessionTool = new FunctionTool({
  name: 'bootstrap_customer_session',
  description: `Initialize customer session context. ALWAYS call this FIRST in any new conversation.

Returns context about the customer:
- Whether they have an active project
- Project status, booking date, service name
- Pending requests if any
- A personalized greeting to use

Use the returned greeting to start the conversation appropriately.`,
  parameters: z.object({}),
  execute: async (_params, ctx: ToolContext | undefined) => {
    // Handle missing context gracefully
    if (!ctx) {
      logger.warn({}, '[CustomerAgent] Bootstrap called without context');
      return {
        error: 'No session context available',
        fallback: {
          hasProject: false,
          greeting:
            "Hi! I'm here to help you with services and bookings. How can I assist you today?",
          isBootstrapError: true,
        },
      };
    }

    // Extract session context
    let session;
    try {
      session = getSessionContext(ctx);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[CustomerAgent] Failed to extract session context in bootstrap'
      );
      return {
        error: 'Failed to extract session context',
        fallback: {
          hasProject: false,
          greeting:
            "Hi! I'm here to help you with services and bookings. How can I assist you today?",
          isBootstrapError: true,
        },
      };
    }

    const { tenantId, projectId, customerId } = session;

    logger.info({ tenantId, projectId, customerId }, '[CustomerAgent] Bootstrap session starting');

    // No project context - customer is browsing
    if (!projectId) {
      return {
        tenantId,
        customerId,
        hasProject: false,
        greeting:
          "Hi! I'm here to help you explore our services, check availability, or make a booking. What can I help you with today?",
        suggestedTools: ['get_services', 'get_business_info', 'check_availability'],
      };
    }

    // Has project - get details
    try {
      const bootstrapData = await callBackendAPI<CustomerBootstrapData>(
        `/project-hub/bootstrap-customer`,
        'POST',
        { tenantId, customerId, projectId }
      );

      // Build personalized greeting based on project status and booking date
      const bookingDate = new Date(bootstrapData.project.bookingDate);
      const now = new Date();
      const daysUntil = Math.ceil((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let greeting: string;
      if (daysUntil <= 0) {
        greeting = `Welcome back! Your ${bootstrapData.project.serviceName} was scheduled for ${bookingDate.toLocaleDateString()}. How can I help you today?`;
      } else if (daysUntil === 1) {
        greeting = `Hi! Your ${bootstrapData.project.serviceName} is tomorrow. Exciting! Is there anything you'd like to know before the big day?`;
      } else if (daysUntil <= 7) {
        greeting = `Hi! Your ${bootstrapData.project.serviceName} is coming up in ${daysUntil} days. How can I help you prepare?`;
      } else {
        greeting = `Welcome to your Project Hub! Your ${bootstrapData.project.serviceName} is scheduled for ${bookingDate.toLocaleDateString()}. I'm here to help with any questions.`;
      }

      // Add pending request context
      if (bootstrapData.hasPendingRequests) {
        greeting += ` I see you have ${bootstrapData.pendingRequestCount} pending request${bootstrapData.pendingRequestCount > 1 ? 's' : ''} awaiting response.`;
      }

      return {
        tenantId,
        customerId,
        projectId,
        hasProject: true,
        project: bootstrapData.project,
        hasPendingRequests: bootstrapData.hasPendingRequests,
        pendingRequestCount: bootstrapData.pendingRequestCount,
        daysUntilBooking: daysUntil,
        greeting,
        suggestedTools: ['get_project_status', 'get_prep_checklist', 'get_timeline'],
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), projectId },
        '[CustomerAgent] Failed to fetch customer bootstrap data'
      );
      return {
        tenantId,
        customerId,
        projectId,
        hasProject: true,
        isBootstrapError: true,
        greeting: `Hi! I'm your Project Hub assistant. How can I help you with your upcoming service?`,
        errorMessage: error instanceof Error ? error.message : 'Failed to load project details',
      };
    }
  },
});

// =============================================================================
// PROJECT STATUS TOOLS
// =============================================================================

/**
 * T1: Get project status
 */
export const getProjectStatusTool = new FunctionTool({
  name: 'get_project_status',
  description:
    'Get the current status of the customer project including booking details, timeline, and next steps.',
  parameters: z.object({
    projectId: z.string().describe('The project ID to check status for'),
  }),
  execute: wrapToolExecute(async (params, ctx) => {
    const { projectId } = validateParams(ProjectIdSchema, params);
    const session = getSessionContext(ctx);

    // P1 Security: Ownership verification
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    const project = await callBackendAPI<Project>(`/project-hub/project-details`, 'POST', {
      tenantId: session.tenantId,
      projectId,
    });

    return {
      success: true,
      project: {
        status: project.status,
        bookingDate: project.bookingDate,
        serviceName: project.serviceName,
        preferences: project.customerPreferences,
      },
      // State indicators for agent context (Pitfall #48)
      projectStatus: project.status,
      lastUpdated: new Date().toISOString(),
    };
  }),
});

/**
 * T1: Get preparation checklist
 */
export const getPrepChecklistTool = new FunctionTool({
  name: 'get_prep_checklist',
  description:
    'Get the preparation checklist for the customer - what to bring, how to prepare, etc.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: wrapToolExecute(async (params, ctx) => {
    const { projectId } = validateParams(ProjectIdSchema, params);
    const session = getSessionContext(ctx);

    // P1 Security: Ownership verification
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    const checklist = await callBackendAPI<{
      items: Array<{ text: string; completed: boolean }>;
    }>(`/project-hub/projects/${projectId}/checklist`, 'GET');

    return {
      success: true,
      checklist: checklist.items,
      // State indicators for agent context (Pitfall #48)
      checklistItemCount: checklist.items.length,
      completedItemCount: checklist.items.filter((item) => item.completed).length,
      lastUpdated: new Date().toISOString(),
    };
  }),
});

/**
 * T1: Answer preparation questions
 */
export const answerPrepQuestionTool = new FunctionTool({
  name: 'answer_prep_question',
  description: 'Answer a preparation-related question using the service details and FAQ.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    question: z.string().describe('The customer question to answer'),
  }),
  execute: wrapToolExecute(async (params, ctx) => {
    const { projectId, question } = validateParams(ProjectIdWithQuestionSchema, params);
    const session = getSessionContext(ctx);

    // P1 Security: Ownership verification
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    // Mediation: Check for escalation keywords BEFORE answering
    if (shouldAlwaysEscalate(question)) {
      const detectedKeywords = ALWAYS_ESCALATE_KEYWORDS.filter((kw) =>
        question.toLowerCase().includes(kw)
      );
      logger.info(
        { projectId, detectedKeywords },
        '[CustomerAgent] Escalation keywords detected in question'
      );
      return {
        success: false,
        requiresEscalation: true,
        reason: 'This question contains keywords requiring provider review',
        suggestedAction: 'Use submit_request tool to escalate to provider',
        detectedKeywords,
      };
    }

    const answer = await callBackendAPI<{ answer: string; confidence: number; source: string }>(
      `/project-hub/projects/${projectId}/answer`,
      'POST',
      { question }
    );

    // Mediation: Check confidence thresholds
    if (answer.confidence < ESCALATE_THRESHOLD) {
      logger.info(
        { projectId, confidence: answer.confidence },
        '[CustomerAgent] Low confidence answer - recommending escalation'
      );
      return {
        success: true,
        answer: answer.answer,
        confidence: answer.confidence,
        shouldEscalate: true,
        escalationReason:
          'Low confidence answer - consider escalating to provider for accurate response',
        suggestedAction: 'Use submit_request tool to get provider input',
      };
    }

    if (answer.confidence < AUTO_HANDLE_THRESHOLD) {
      logger.info(
        { projectId, confidence: answer.confidence },
        '[CustomerAgent] Medium confidence answer - flagging for provider'
      );
      return {
        success: true,
        answer: answer.answer,
        confidence: answer.confidence,
        flaggedForProvider: true,
        message: 'Answer provided but flagged for provider visibility',
        questionAnswered: true,
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      success: true,
      answer: answer.answer,
      confidence: answer.confidence,
      questionAnswered: true,
      lastUpdated: new Date().toISOString(),
    };
  }),
});

/**
 * T1: Get project timeline
 */
export const getTimelineTool = new FunctionTool({
  name: 'get_timeline',
  description: 'Get the project timeline showing key milestones and upcoming events.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: wrapToolExecute(async (params, ctx) => {
    const { projectId } = validateParams(ProjectIdSchema, params);
    const session = getSessionContext(ctx);

    // P1 Security: Ownership verification
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    const result = await callBackendAPI<{ events: ProjectEvent[]; count: number }>(
      `/project-hub/timeline`,
      'POST',
      { tenantId: session.tenantId, projectId, actor: 'customer' }
    );

    // Filter and format for customer view
    const timeline = result.events.map((e) => ({
      date: e.createdAt,
      type: e.type,
      description: (e.payload as Record<string, string>).description || e.type,
    }));

    return {
      success: true,
      timeline,
      eventCount: timeline.length,
      hasEvents: timeline.length > 0,
      lastUpdated: new Date().toISOString(),
    };
  }),
});

// =============================================================================
// REQUEST SUBMISSION
// =============================================================================

/**
 * T2/T3: Submit a request to the provider
 *
 * T2 for most requests (reschedule, add-on, question)
 * T3 for cancellation/refund (requires explicit confirmation)
 */
export const submitRequestTool = new FunctionTool({
  name: 'submit_request',
  description:
    'Submit a customer request that requires provider review (rescheduling, cancellation, refund, etc.). For CANCELLATION or REFUND, requires explicit customer confirmation.',
  parameters: z.object({
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
    confirmationReceived: z
      .boolean()
      .optional()
      .describe(
        'Required for CANCELLATION/REFUND - must be true after customer explicitly confirms they want to proceed'
      ),
  }),
  execute: wrapToolExecute(async (params, ctx) => {
    const { projectId, requestType, details, urgency, confirmationReceived } = validateParams(
      SubmitRequestSchema,
      params
    );
    const session = getSessionContext(ctx);

    // P1 Security: Ownership verification
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    // T3 confirmation for high-risk actions (Pitfall #45)
    if (
      T3_REQUEST_TYPES.includes(requestType as (typeof T3_REQUEST_TYPES)[number]) &&
      !confirmationReceived
    ) {
      return {
        requiresConfirmation: true,
        confirmationType: 'T3_HIGH_RISK',
        message: `A ${requestType.toLowerCase()} request is a significant action. Please confirm with the customer: "Are you sure you want to ${requestType.toLowerCase() === 'cancellation' ? 'cancel your booking' : 'request a refund'}? This will be submitted to the service provider for review."`,
        nextStep: `After customer confirms, call this tool again with confirmationReceived: true`,
      };
    }

    // Mediation: Auto-escalate urgency for sensitive keywords
    let effectiveUrgency = urgency;
    if (shouldAlwaysEscalate(details) && urgency !== 'high') {
      logger.info(
        { projectId, originalUrgency: urgency },
        '[CustomerAgent] Auto-escalating urgency due to sensitive keywords'
      );
      effectiveUrgency = 'high';
    }

    const result = await callBackendAPI<{ success: boolean; request: ProjectRequest }>(
      `/project-hub/create-request`,
      'POST',
      {
        tenantId: session.tenantId,
        projectId,
        type: requestType,
        requestData: { details, urgency: effectiveUrgency },
      }
    );
    const request = result.request;

    return {
      success: true,
      requestId: request.id,
      message: `Your ${requestType.toLowerCase().replace('_', ' ')} request has been submitted. The service provider typically responds within 24-48 hours.`,
      expiresAt: request.expiresAt,
      // State indicators for agent context (Pitfall #48)
      hasPendingRequest: true,
      requestStatus: 'PENDING' as const,
      projectStatus: 'awaiting_provider_response',
    };
  }),
});
