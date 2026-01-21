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
import { getTenantId } from '../../../shared/tenant-context';

// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

/**
 * Lightweight structured logger for Cloud Run agents
 * Outputs JSON for easy parsing in Cloud Logging
 */
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(
      JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// Mediation thresholds
const AUTO_HANDLE_THRESHOLD = 0.8;
const ESCALATE_THRESHOLD = 0.5;
const ALWAYS_ESCALATE_KEYWORDS = ['refund', 'complaint', 'lawyer', 'legal', 'cancel', 'sue'];

// Escalation expiry
const ESCALATION_EXPIRY_HOURS = 72;

// =============================================================================
// QUERY DEFAULTS
// =============================================================================

/**
 * Default values for query parameters and display limits.
 * Extracted from inline magic numbers for maintainability.
 */
const DEFAULTS = {
  /** Maximum pending requests to return in a single query (reasonable page size) */
  PENDING_REQUESTS_LIMIT: 10,
  /** Number of days to look back for customer activity (one week window) */
  ACTIVITY_LOOKBACK_DAYS: 7,
  /** Maximum recent events to display in activity summary (avoids UI overwhelm) */
  RECENT_EVENTS_DISPLAY_LIMIT: 10,
} as const;

// =============================================================================
// LLM CONFIGURATION
// =============================================================================

/**
 * LLM generation settings for consistent agent behavior.
 * Temperature and token limits tuned for professional responses.
 */
const LLM_CONFIG = {
  /** Lower temperature (0.4) for consistent, professional responses without being robotic */
  TEMPERATURE: 0.4,
  /** Sufficient tokens (2048) for detailed responses without excessive verbosity */
  MAX_OUTPUT_TOKENS: 2048,
} as const;

// =============================================================================
// SYSTEM PROMPT - Dual-Faced Customer-Tenant Communication
// =============================================================================

const PROJECT_HUB_SYSTEM_PROMPT = `# HANDLED Project Hub - System Prompt

## Identity

You are the HANDLED Project Hub assistant - a helpful, professional, and reassuring presence that bridges communication between customers and service providers after a booking is confirmed.

## FIRST ACTION: Bootstrap Check

ALWAYS call bootstrap_project_hub_session FIRST in any new conversation. This tells you:
- Who you're talking to (customer vs tenant)
- Current project status and context
- Any pending requests or actions needed
- A personalized greeting to use

DO NOT skip this step. Even if the user's first message seems urgent, call bootstrap first.

## Your Role

You manage post-booking communication, ensuring:
1. Customers get timely, helpful information about their upcoming service
2. Routine questions are answered instantly
3. Complex requests are properly escalated to the service provider
4. Both parties stay informed throughout the project lifecycle

## Context Detection

After bootstrap, you'll know the context:
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

## CRITICAL: Tool-First Protocol

IMPORTANT: You MUST call the appropriate tool BEFORE responding with text.
Never acknowledge a request without actually executing it via tool call.

### For Project Status Requests
1. IMMEDIATELY call get_project_status
2. WAIT for tool result
3. THEN respond with actual status

### For Prep Questions
1. IMMEDIATELY call answer_prep_question or get_prep_checklist
2. WAIT for tool result
3. THEN respond with actual information

### For Requests/Escalations
1. IMMEDIATELY call submit_request
2. WAIT for tool result
3. THEN confirm submission with details

### For Tenant: Pending Requests
1. IMMEDIATELY call get_pending_requests
2. WAIT for tool result
3. THEN show actual pending items

### For Tenant: Request Actions
1. IMMEDIATELY call approve_request or deny_request
2. WAIT for tool result
3. THEN confirm the action was taken

## What You Must NEVER Do

❌ Say "Let me check on that" without calling a tool
❌ Acknowledge a request without executing the tool
❌ Fabricate project information or status
❌ Guess at prep instructions or booking details
❌ Say "I'll submit that for you" without calling submit_request
❌ Tell a tenant about requests without calling get_pending_requests

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

  try {
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
      logger.error(
        { endpoint, method, status: response.status, error: errorText },
        '[ProjectHub] Backend API error'
      );
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ endpoint, method, timeout: TIMEOUTS.BACKEND_API }, '[ProjectHub] API timeout');
      throw new Error(`Backend API timeout after ${TIMEOUTS.BACKEND_API}ms`);
    }
    // Re-throw if already a handled error (from !response.ok block)
    if (error instanceof Error && error.message.startsWith('Backend API error:')) {
      throw error;
    }
    logger.error(
      { endpoint, method, error: error instanceof Error ? error.message : String(error) },
      '[ProjectHub] Network error'
    );
    throw error;
  }
}

/**
 * Session context with proper typing
 */
interface SessionContext {
  contextType: 'customer' | 'tenant';
  tenantId: string;
  customerId?: string;
  projectId?: string;
}

/**
 * Extract session context using 4-tier tenant ID pattern.
 * @throws Error if tenant ID cannot be extracted (fail-fast)
 */
function getContextFromSession(ctx: ToolContext): SessionContext {
  // Use 4-tier tenant ID extraction (handles all ADK scenarios)
  const tenantId = getTenantId(ctx, { agentName: 'ProjectHub' });
  if (!tenantId) {
    logger.error({}, '[ProjectHub] No tenant context available - check session configuration');
    throw new Error('No tenant context available - check session configuration');
  }

  // Cast through unknown because ADK's State type doesn't have an index signature
  const state = ctx.state as unknown as Record<string, unknown>;

  const sessionContext: SessionContext = {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId,
    customerId: state.customerId as string | undefined,
    projectId: state.projectId as string | undefined,
  };

  logger.info(
    { tenantId, contextType: sessionContext.contextType, projectId: sessionContext.projectId },
    '[ProjectHub] Extracted session context'
  );

  return sessionContext;
}

/**
 * Context guard - returns error if tool called from wrong context.
 * Used for enforcing customer/tenant tool separation.
 */
function requireContext(
  ctx: ToolContext | undefined,
  required: 'customer' | 'tenant'
): { error: string } | null {
  if (!ctx) {
    return { error: 'Tool context is required' };
  }
  const { contextType } = getContextFromSession(ctx);
  if (contextType !== required) {
    return { error: `This tool is only available in ${required} context` };
  }
  return null;
}

function shouldAlwaysEscalate(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ALWAYS_ESCALATE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

// =============================================================================
// BOOTSTRAP TYPES
// =============================================================================

/**
 * Response type for customer bootstrap data
 */
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

/**
 * Response type for tenant bootstrap data
 */
interface TenantBootstrapData {
  activeProjects: number;
  pendingRequestCount: number;
  recentActivityCount: number;
}

// =============================================================================
// BOOTSTRAP TOOL (SHARED - BOTH CONTEXTS)
// =============================================================================

/**
 * Bootstrap Project Hub Session Tool
 *
 * ALWAYS called FIRST in any new conversation.
 * Returns context-appropriate data for personalized greetings and context awareness.
 *
 * For customers: Project status, upcoming booking, pending requests
 * For tenants: Active projects, pending requests requiring attention
 */
const bootstrapProjectHubSession = new FunctionTool({
  name: 'bootstrap_project_hub_session',
  description: `Initialize session context. ALWAYS call this FIRST in any new conversation.

Returns context about who you're talking to and their current state:
- For customers: project status, booking date, pending requests
- For tenants: active projects, requests needing attention

Use the returned greeting to start the conversation.`,
  parameters: z.object({}),
  execute: async (_params, ctx: ToolContext | undefined) => {
    // Handle missing context gracefully
    if (!ctx) {
      logger.warn({}, '[ProjectHub] Bootstrap called without context - returning minimal response');
      return {
        error: 'No session context available',
        fallback: {
          contextType: 'unknown' as const,
          greeting: "Hi! I'm your Project Hub assistant. How can I help you today?",
          isBootstrapError: true,
        },
        retryGuidance:
          'Session context is missing. Ask the user to refresh or check their connection.',
      };
    }

    // Extract session context - this may throw if tenantId is missing
    let session: SessionContext;
    try {
      session = getContextFromSession(ctx);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[ProjectHub] Failed to extract session context in bootstrap'
      );
      return {
        error: 'Failed to extract session context',
        fallback: {
          contextType: 'unknown' as const,
          greeting: "Hi! I'm your Project Hub assistant. How can I help you today?",
          isBootstrapError: true,
        },
        retryGuidance: 'Check session configuration and tenant context.',
      };
    }

    const { contextType, tenantId, projectId, customerId } = session;

    logger.info(
      { tenantId, contextType, projectId, customerId },
      '[ProjectHub] Bootstrap session starting'
    );

    // Customer context: Get project-specific information
    if (contextType === 'customer') {
      if (!projectId) {
        return {
          contextType: 'customer' as const,
          tenantId,
          customerId,
          hasProject: false,
          greeting:
            "Hi! I'm your Project Hub assistant. It looks like you don't have an active project yet. How can I help you?",
        };
      }

      try {
        const bootstrapData = await callBackendAPI<CustomerBootstrapData>(
          `/project-hub/bootstrap/customer/${projectId}`,
          'GET'
        );

        // Build personalized greeting based on project status and booking date
        const bookingDate = new Date(bootstrapData.project.bookingDate);
        const now = new Date();
        const daysUntil = Math.ceil(
          (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

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
          contextType: 'customer' as const,
          tenantId,
          customerId,
          projectId,
          hasProject: true,
          project: bootstrapData.project,
          hasPendingRequests: bootstrapData.hasPendingRequests,
          pendingRequestCount: bootstrapData.pendingRequestCount,
          daysUntilBooking: daysUntil,
          greeting,
        };
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error), projectId },
          '[ProjectHub] Failed to fetch customer bootstrap data'
        );
        return {
          contextType: 'customer' as const,
          tenantId,
          customerId,
          projectId,
          hasProject: true,
          isBootstrapError: true,
          greeting: `Hi! I'm your Project Hub assistant. How can I help you with your upcoming service?`,
          errorMessage: error instanceof Error ? error.message : 'Failed to load project details',
        };
      }
    }

    // Tenant context: Get business overview
    try {
      const bootstrapData = await callBackendAPI<TenantBootstrapData>(
        `/project-hub/bootstrap/tenant/${tenantId}`,
        'GET'
      );

      // Build personalized greeting based on activity
      let greeting: string;
      if (bootstrapData.pendingRequestCount > 0) {
        greeting = `Welcome back! You have ${bootstrapData.pendingRequestCount} pending request${bootstrapData.pendingRequestCount > 1 ? 's' : ''} from customers that need${bootstrapData.pendingRequestCount > 1 ? '' : 's'} your attention.`;
      } else if (bootstrapData.activeProjects > 0) {
        greeting = `All caught up! You have ${bootstrapData.activeProjects} active project${bootstrapData.activeProjects > 1 ? 's' : ''} running smoothly.`;
      } else {
        greeting = `Welcome to your Project Hub! No active projects at the moment. Ready to help when your next booking comes in.`;
      }

      return {
        contextType: 'tenant' as const,
        tenantId,
        activeProjects: bootstrapData.activeProjects,
        pendingRequestCount: bootstrapData.pendingRequestCount,
        recentActivityCount: bootstrapData.recentActivityCount,
        hasPendingRequests: bootstrapData.pendingRequestCount > 0,
        greeting,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), tenantId },
        '[ProjectHub] Failed to fetch tenant bootstrap data'
      );
      return {
        contextType: 'tenant' as const,
        tenantId,
        isBootstrapError: true,
        greeting: `Welcome to your Project Hub! How can I help you manage your projects today?`,
        errorMessage: error instanceof Error ? error.message : 'Failed to load dashboard data',
      };
    }
  },
});

// =============================================================================
// CUSTOMER CONTEXT TOOLS
// =============================================================================

const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description:
    'Get the current status of the customer project including booking details, timeline, and next steps. CUSTOMER CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID to check status for'),
  }),
  execute: async ({ projectId }: { projectId: string }, ctx: ToolContext | undefined) => {
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

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
    'Get the preparation checklist for the customer - what to bring, how to prepare, etc. CUSTOMER CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: async ({ projectId }: { projectId: string }, ctx: ToolContext | undefined) => {
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

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
  description:
    'Answer a preparation-related question using the service details and FAQ. CUSTOMER CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    question: z.string().describe('The customer question to answer'),
  }),
  execute: async (
    { projectId, question }: { projectId: string; question: string },
    ctx: ToolContext | undefined
  ) => {
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    // Mediation: Check for escalation keywords BEFORE answering
    // Keywords like 'refund', 'complaint', 'lawyer', 'legal', 'cancel', 'sue' require tenant review
    if (shouldAlwaysEscalate(question)) {
      const detectedKeywords = ALWAYS_ESCALATE_KEYWORDS.filter((kw) =>
        question.toLowerCase().includes(kw)
      );
      logger.info(
        { projectId, detectedKeywords },
        '[ProjectHub] Escalation keywords detected in question'
      );
      return {
        success: false,
        requiresEscalation: true,
        reason: 'This question contains keywords requiring tenant review',
        suggestedAction: 'Use submit_request tool to escalate to tenant',
        detectedKeywords,
      };
    }

    try {
      const answer = await callBackendAPI<{ answer: string; confidence: number; source: string }>(
        `/project-hub/projects/${projectId}/answer`,
        'POST',
        { question }
      );

      // Mediation: Check confidence thresholds
      if (answer.confidence < ESCALATE_THRESHOLD) {
        // Low confidence (<50%) - escalate to tenant
        logger.info(
          { projectId, confidence: answer.confidence },
          '[ProjectHub] Low confidence answer - recommending escalation'
        );
        return {
          success: true,
          answer: answer.answer,
          confidence: answer.confidence,
          shouldEscalate: true,
          escalationReason:
            'Low confidence answer - consider escalating to tenant for accurate response',
          suggestedAction: 'Use submit_request tool to get tenant input',
        };
      }

      if (answer.confidence < AUTO_HANDLE_THRESHOLD) {
        // Medium confidence (50-80%) - handle but flag for visibility
        logger.info(
          { projectId, confidence: answer.confidence },
          '[ProjectHub] Medium confidence answer - flagging for tenant'
        );
        // Fire-and-forget event logging (non-blocking for faster response)
        callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
          type: 'MESSAGE_FROM_AGENT',
          actor: 'agent',
          actorType: 'agent',
          payload: {
            question,
            answer: answer.answer,
            flagged: true,
            confidence: answer.confidence,
          },
          visibleToCustomer: true,
          visibleToTenant: true,
        }).catch((err) =>
          logger.error(
            { err: err instanceof Error ? err.message : String(err), projectId },
            '[ProjectHub] Failed to log flagged answer event'
          )
        );

        return {
          success: true,
          answer: answer.answer,
          confidence: answer.confidence,
          flaggedForTenant: true,
          message: 'Answer provided but flagged for tenant visibility due to medium confidence',
        };
      }

      // High confidence (>=80%) - auto-handle
      // Fire-and-forget event logging (non-blocking for faster response)
      callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'MESSAGE_FROM_AGENT',
        actor: 'agent',
        actorType: 'agent',
        payload: { question, answer: answer.answer },
        visibleToCustomer: true,
        visibleToTenant: true,
      }).catch((err) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err), projectId },
          '[ProjectHub] Failed to log answer event'
        )
      );

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

// T3 request types requiring explicit customer confirmation
const T3_REQUEST_TYPES = ['CANCELLATION', 'REFUND'] as const;

const submitRequest = new FunctionTool({
  name: 'submit_request',
  description:
    'Submit a customer request that requires tenant review (rescheduling, cancellation, refund, etc.). CUSTOMER CONTEXT ONLY. For CANCELLATION or REFUND, requires explicit customer confirmation.',
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
  execute: async (params, ctx: ToolContext | undefined) => {
    const { projectId, requestType, details, urgency, confirmationReceived } = params as {
      projectId: string;
      requestType: string;
      details: string;
      urgency: string;
      confirmationReceived?: boolean;
    };
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    // P1 Security: T3 confirmation for high-risk actions
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

    // Mediation: Auto-escalate urgency for sensitive keywords in details
    let effectiveUrgency = urgency;
    if (shouldAlwaysEscalate(details) && urgency !== 'high') {
      logger.info(
        { projectId, originalUrgency: urgency },
        '[ProjectHub] Auto-escalating urgency due to sensitive keywords in request details'
      );
      effectiveUrgency = 'high';
    }

    try {
      // Calculate expiry (72 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ESCALATION_EXPIRY_HOURS);

      const request = await callBackendAPI<ProjectRequest>(
        `/project-hub/projects/${projectId}/requests`,
        'POST',
        {
          type: requestType,
          requestData: { details, urgency: effectiveUrgency },
          expiresAt: expiresAt.toISOString(),
        }
      );

      // Fire-and-forget event logging (non-blocking for faster response)
      callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'REQUEST_SUBMITTED',
        actor: session.customerId || 'unknown-customer',
        actorType: 'customer',
        payload: { requestId: request.id, type: requestType, details },
        visibleToCustomer: true,
        visibleToTenant: true,
      }).catch((err) =>
        logger.error(
          {
            err: err instanceof Error ? err.message : String(err),
            projectId,
            requestId: request.id,
          },
          '[ProjectHub] Failed to log request submission event'
        )
      );

      return {
        success: true,
        requestId: request.id,
        message: `Your ${requestType.toLowerCase().replace('_', ' ')} request has been submitted. The service provider typically responds within 24-48 hours.`,
        expiresAt: request.expiresAt,
        // State indicators for agent context (Pitfall #52)
        hasPendingRequest: true,
        requestStatus: 'PENDING' as const,
        projectStatus: 'awaiting_tenant_response',
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
  description:
    'Get the project timeline showing key milestones and upcoming events. CUSTOMER CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: async ({ projectId }: { projectId: string }, ctx: ToolContext | undefined) => {
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

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
  description: 'Get all pending customer requests that need tenant attention. TENANT CONTEXT ONLY.',
  parameters: z.object({
    limit: z
      .number()
      .default(DEFAULTS.PENDING_REQUESTS_LIMIT)
      .describe('Maximum number of requests to return'),
  }),
  execute: async ({ limit }: { limit: number }, ctx: ToolContext | undefined) => {
    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Use tenant ID from session, not parameter (prevent IDOR)
    const session = getContextFromSession(ctx!);
    const tenantId = session.tenantId;

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
  description:
    'Get recent customer activity across all projects for the tenant. TENANT CONTEXT ONLY.',
  parameters: z.object({
    days: z
      .number()
      .default(DEFAULTS.ACTIVITY_LOOKBACK_DAYS)
      .describe('Number of days to look back'),
  }),
  execute: async ({ days }: { days: number }, ctx: ToolContext | undefined) => {
    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Use tenant ID from session, not parameter (prevent IDOR)
    const session = getContextFromSession(ctx!);
    const tenantId = session.tenantId;

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
  description: 'Approve a pending customer request. TENANT CONTEXT ONLY.',
  parameters: z.object({
    requestId: z.string().describe('The request ID to approve'),
    response: z.string().optional().describe('Optional response message to customer'),
  }),
  execute: async (
    { requestId, response }: { requestId: string; response?: string },
    ctx: ToolContext | undefined
  ) => {
    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Get tenant ID from session for backend verification
    const session = getContextFromSession(ctx!);

    try {
      // Backend verifies tenant owns this request via tenantId header
      const result = await callBackendAPI<{ success: boolean; request: ProjectRequest }>(
        `/project-hub/requests/${requestId}/approve`,
        'POST',
        {
          responseData: { message: response, approvedAt: new Date().toISOString() },
          tenantId: session.tenantId, // For backend ownership verification
        }
      );

      return {
        success: true,
        message: 'Request approved successfully',
        request: result.request,
        // State indicators for agent context (Pitfall #52)
        requestStatus: 'APPROVED' as const,
        projectStatus: 'active',
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
  description: 'Deny a pending customer request with a reason. TENANT CONTEXT ONLY.',
  parameters: z.object({
    requestId: z.string().describe('The request ID to deny'),
    reason: z.string().describe('Reason for denial (will be shared with customer)'),
  }),
  execute: async (
    { requestId, reason }: { requestId: string; reason: string },
    ctx: ToolContext | undefined
  ) => {
    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Get tenant ID from session for backend verification
    const session = getContextFromSession(ctx!);

    try {
      // Backend verifies tenant owns this request via tenantId
      const result = await callBackendAPI<{ success: boolean; request: ProjectRequest }>(
        `/project-hub/requests/${requestId}/deny`,
        'POST',
        {
          responseData: { reason, deniedAt: new Date().toISOString() },
          tenantId: session.tenantId, // For backend ownership verification
        }
      );

      return {
        success: true,
        message: 'Request denied',
        request: result.request,
        // State indicators for agent context (Pitfall #52)
        requestStatus: 'DENIED' as const,
        projectStatus: 'active',
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
  description: 'Send a message directly to a customer about their project. TENANT CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    message: z.string().describe('Message to send to the customer'),
    notifyByEmail: z.boolean().default(true).describe('Whether to also send email notification'),
  }),
  execute: async (
    {
      projectId,
      message,
      notifyByEmail,
    }: { projectId: string; message: string; notifyByEmail: boolean },
    ctx: ToolContext | undefined
  ) => {
    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Get tenant ID from session for backend verification
    const session = getContextFromSession(ctx!);

    try {
      // Backend verifies tenant owns this project via tenantId
      // This is the critical operation - must await
      await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'MESSAGE_FROM_TENANT',
        actor: session.tenantId,
        actorType: 'tenant',
        payload: { message },
        visibleToCustomer: true,
        visibleToTenant: true,
        tenantId: session.tenantId, // For backend ownership verification
      });

      // Fire-and-forget email notification (non-blocking for faster response)
      if (notifyByEmail) {
        callBackendAPI(`/project-hub/projects/${projectId}/notify`, 'POST', {
          type: 'message',
          message,
          tenantId: session.tenantId,
        }).catch((err) =>
          logger.error(
            { err: err instanceof Error ? err.message : String(err), projectId },
            '[ProjectHub] Failed to send email notification'
          )
        );
      }

      return {
        success: true,
        message: 'Message sent to customer',
        // State indicators for agent context (Pitfall #52)
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

const updateProjectStatus = new FunctionTool({
  name: 'update_project_status',
  description:
    'Update the status of a project (e.g., mark as completed, on hold). TENANT CONTEXT ONLY.',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).describe('New status'),
    reason: z.string().optional().describe('Reason for status change'),
  }),
  execute: async (params, ctx: ToolContext | undefined) => {
    const { projectId, status, reason } = params as {
      projectId: string;
      status: string;
      reason?: string;
    };

    // P1 Security: Context guard - tenant tools only
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // P1 Security: Get tenant ID from session for backend verification
    const session = getContextFromSession(ctx!);

    try {
      // Backend verifies tenant owns this project via tenantId
      // This is the critical operation - must await
      const result = await callBackendAPI<{ success: boolean; project: Project }>(
        `/project-hub/projects/${projectId}/status`,
        'PUT',
        { status, reason, tenantId: session.tenantId }
      );

      // Fire-and-forget event logging (non-blocking for faster response)
      callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
        type: 'STATUS_CHANGED',
        actor: session.tenantId,
        actorType: 'tenant',
        payload: { oldStatus: 'ACTIVE', newStatus: status, reason },
        visibleToCustomer: status === 'COMPLETED',
        visibleToTenant: true,
        tenantId: session.tenantId,
      }).catch((err) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err), projectId, status },
          '[ProjectHub] Failed to log status change event'
        )
      );

      return {
        success: true,
        project: result.project,
        // State indicators for agent context (Pitfall #52)
        projectStatus: status,
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

// Shared tools (available in both contexts)
const sharedTools = [bootstrapProjectHubSession];

// All tools (agent dynamically uses based on context)
const allTools = [...sharedTools, ...customerTools, ...tenantTools];

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
  generateContentConfig: {
    temperature: LLM_CONFIG.TEMPERATURE,
    maxOutputTokens: LLM_CONFIG.MAX_OUTPUT_TOKENS,
  },

  // Lifecycle callbacks for observability
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { toolName: tool.name, args: JSON.stringify(args).substring(0, 200) },
      '[ProjectHub] Calling tool'
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    const preview =
      typeof response === 'object'
        ? JSON.stringify(response).substring(0, 200)
        : String(response).substring(0, 200);
    logger.info({ toolName: tool.name }, `[ProjectHub] Result: ${tool.name} → ${preview}...`);
    return undefined;
  },
});
