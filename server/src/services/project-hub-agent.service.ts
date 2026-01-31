/**
 * Project Hub Agent Service
 *
 * Handles communication between MAIS backend and the Customer Agent on Cloud Run
 * for project hub functionality.
 *
 * Phase 4 Update (2026-01-31):
 * - Migrated from project-hub-agent to unified customer-agent
 * - Customer Agent now handles: booking + project-hub (customer view)
 * - Uses CUSTOMER_AGENT_URL instead of PROJECT_HUB_AGENT_URL
 * - Tenant view of project-hub is now handled by tenant-agent
 *
 * Key features:
 * - Uses CUSTOMER_AGENT_URL (unified customer-agent deployment)
 * - Sets contextType in session state at creation (security-critical)
 * - Simpler session model (no persistent storage needed)
 *
 * Security:
 * - contextType is set by backend from verified token/session (never from request body)
 * - Uses Google Cloud IAM Identity Token for Cloud Run authentication
 * - All operations are tenant-scoped
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { GoogleAuth, JWT } from 'google-auth-library';
import { z } from 'zod';
import { logger } from '../lib/core/logger';

// =============================================================================
// ADK RESPONSE SCHEMAS (Pitfall #62: Runtime validation for external APIs)
// =============================================================================

/**
 * Schema for ADK session creation response.
 * POST /apps/{appName}/users/{userId}/sessions returns { id: string }
 */
const AdkSessionResponseSchema = z.object({
  id: z.string(),
});

/**
 * Schema for a single part in an ADK message.
 */
const AdkPartSchema = z.object({
  text: z.string().optional(),
  functionCall: z
    .object({
      name: z.string(),
      args: z.record(z.unknown()),
    })
    .optional(),
  functionResponse: z
    .object({
      name: z.string(),
      response: z.unknown(),
    })
    .optional(),
});

/**
 * Schema for ADK content structure.
 */
const AdkContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(AdkPartSchema).optional(),
});

/**
 * Schema for a single ADK event in the response array.
 */
const AdkEventSchema = z.object({
  content: AdkContentSchema.optional(),
});

/**
 * Schema for ADK /run endpoint response.
 */
const AdkRunResponseSchema = z.union([
  z.array(AdkEventSchema),
  z.object({
    messages: z.array(
      z.object({
        role: z.string(),
        parts: z.array(AdkPartSchema).optional(),
      })
    ),
  }),
]);

type AdkRunResponse = z.infer<typeof AdkRunResponseSchema>;

// =============================================================================
// FETCH WITH TIMEOUT (Pitfall #46: All fetch calls need timeout)
// =============================================================================

/**
 * Fetch with timeout for ADK agent calls.
 * Per CLAUDE.md Pitfall #46: agent calls use 30s timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get Customer Agent URL from environment.
 * Phase 4 Update: Now uses CUSTOMER_AGENT_URL (unified customer-agent).
 * Throws clear error if not configured (Pitfall #45: fail-fast on missing config).
 */
function getCustomerAgentUrl(): string {
  // Primary: new unified customer-agent URL
  const newUrl = process.env.CUSTOMER_AGENT_URL;
  if (newUrl) return newUrl;

  // Fallback: legacy variable names (deprecated - remove after migration complete)
  const legacyProjectHubUrl = process.env.PROJECT_HUB_AGENT_URL;
  if (legacyProjectHubUrl) return legacyProjectHubUrl;

  const legacyBookingUrl = process.env.BOOKING_AGENT_URL;
  if (legacyBookingUrl) return legacyBookingUrl;

  throw new Error(
    'Missing required environment variable: CUSTOMER_AGENT_URL. ' +
      'Set this in Render dashboard or .env file.'
  );
}

// =============================================================================
// TYPES
// =============================================================================

export interface SendMessageResult {
  response: string;
  sessionId: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  error?: string;
}

export type ContextType = 'customer' | 'tenant';

// =============================================================================
// PROJECT HUB AGENT SERVICE
// =============================================================================

export class ProjectHubAgentService {
  private auth: GoogleAuth;
  private serviceAccountCredentials: { client_email: string; private_key: string } | null = null;

  constructor() {
    // Initialize Google Auth for Cloud Run authentication
    // Priority: GOOGLE_SERVICE_ACCOUNT_JSON (Render) > ADC (GCP/local)
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.auth = new GoogleAuth({ credentials });
        this.serviceAccountCredentials = {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        };
        logger.info('[ProjectHubAgent] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON');
      } catch (e) {
        logger.error({ error: e }, '[ProjectHubAgent] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
        this.auth = new GoogleAuth();
      }
    } else {
      this.auth = new GoogleAuth();
    }
  }

  /**
   * Create a new ADK session for Project Hub interactions.
   *
   * SECURITY CRITICAL: contextType is set HERE in session state.
   * It is determined by the backend from verified token/session,
   * NEVER from the request body. This prevents context escalation attacks.
   *
   * @param tenantId - The tenant ID
   * @param customerId - Customer ID (email) for customer context, undefined for tenant
   * @param projectId - The project ID for context
   * @param contextType - 'customer' or 'tenant' (verified by backend)
   * @param requestId - Optional request ID for correlation
   * @returns ADK session ID
   */
  async createSession(
    tenantId: string,
    customerId: string | undefined,
    projectId: string,
    contextType: ContextType,
    requestId?: string
  ): Promise<string> {
    // Build user ID: tenant:customer for customers, tenant:tenant for tenants
    const userId = `${tenantId}:${customerId || 'tenant'}`;

    try {
      const token = await this.getIdentityToken();
      const agentUrl = getCustomerAgentUrl();

      const response = await fetchWithTimeout(
        `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(requestId && { 'X-Request-ID': requestId }),
          },
          // SECURITY: Set contextType in session state (backend-controlled)
          // This is the ONLY place contextType should be set
          body: JSON.stringify({
            state: {
              tenantId,
              customerId,
              projectId,
              contextType, // Backend-verified, not from request body
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, projectId, contextType, status: response.status, error: errorText },
          '[ProjectHubAgent] Failed to create session'
        );
        throw new Error(`Session creation failed: ${response.status}`);
      }

      // Validate response with Zod (Pitfall #62)
      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, projectId, error: parseResult.error.message },
          '[ProjectHubAgent] Invalid session response format'
        );
        throw new Error(`Invalid session response: ${parseResult.error.message}`);
      }

      logger.info(
        { tenantId, projectId, contextType, sessionId: parseResult.data.id },
        '[ProjectHubAgent] Session created'
      );

      return parseResult.data.id;
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(
          { tenantId, projectId, contextType },
          '[ProjectHubAgent] Session creation timed out'
        );
        throw new Error('Session creation timed out');
      }

      // Generate fallback session ID for local dev/testing
      if (process.env.NODE_ENV === 'development') {
        const fallbackId = `local:${tenantId}:${projectId}:${Date.now()}`;
        logger.warn(
          { tenantId, projectId, fallbackId, error },
          '[ProjectHubAgent] Using local session (ADK unreachable)'
        );
        return fallbackId;
      }

      throw error;
    }
  }

  /**
   * Send a message to the Project Hub agent.
   *
   * SECURITY: The backend must have already verified the user's role
   * from their token/session before calling this method. The contextType
   * parameter is for logging only - the actual context enforcement
   * happens in the agent via session state set at creation.
   *
   * @param sessionId - The ADK session ID
   * @param tenantId - The tenant ID
   * @param customerId - Customer ID for user identification
   * @param message - The user's message
   * @param requestId - Optional request ID for correlation
   * @returns Agent response
   */
  async sendMessage(
    sessionId: string,
    tenantId: string,
    customerId: string | undefined,
    message: string,
    requestId?: string
  ): Promise<SendMessageResult> {
    const userId = `${tenantId}:${customerId || 'tenant'}`;

    logger.info(
      { tenantId, sessionId, messageLength: message.length },
      '[ProjectHubAgent] Sending message'
    );

    try {
      const token = await this.getIdentityToken();
      const agentUrl = getCustomerAgentUrl();
      const fullUrl = `${agentUrl}/run`;

      logger.info(
        { tenantId, sessionId, agentUrl, fullUrl },
        '[ProjectHubAgent] Calling agent /run endpoint'
      );

      const response = await fetchWithTimeout(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(requestId && { 'X-Request-ID': requestId }),
        },
        // ADK uses camelCase for A2A protocol (Pitfall #32)
        // Note: /run does NOT accept state - state must be set on session creation
        body: JSON.stringify({
          appName: 'agent', // Project Hub agent's ADK app name
          userId,
          sessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle session not found - this shouldn't happen if session was just created
        if (response.status === 404 && errorText.includes('Session not found')) {
          logger.warn(
            { tenantId, sessionId },
            '[ProjectHubAgent] Session not found on ADK - client should create new session'
          );
          return {
            response: 'Your session has expired. Please refresh the page to continue.',
            sessionId,
            error: 'session_not_found',
          };
        }

        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText, fullUrl },
          '[ProjectHubAgent] Agent error'
        );

        return {
          response: 'Sorry, I ran into an issue. Please try again.',
          sessionId,
          error: `Agent returned ${response.status}`,
        };
      }

      // Validate response with Zod (Pitfall #62)
      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error(
          { tenantId, sessionId, error: parseResult.error.message },
          '[ProjectHubAgent] Invalid run response format'
        );
        return {
          response: 'Sorry, I received an unexpected response. Please try again.',
          sessionId,
          error: `Invalid response format: ${parseResult.error.message}`,
        };
      }

      const agentResponse = this.extractAgentResponse(parseResult.data);
      const toolCalls = this.extractToolCalls(parseResult.data);

      logger.info(
        {
          tenantId,
          sessionId,
          responseLength: agentResponse.length,
          toolCallCount: toolCalls.length,
        },
        '[ProjectHubAgent] Response received'
      );

      return {
        response: agentResponse,
        sessionId,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ tenantId, sessionId }, '[ProjectHubAgent] Request timed out');
        return {
          response: 'The request timed out. Please try again.',
          sessionId,
          error: 'timeout',
        };
      }

      logger.error({ tenantId, sessionId, error }, '[ProjectHubAgent] Failed to send message');

      return {
        response: 'Connection issue. Please try again in a moment.',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Get identity token for Cloud Run authentication.
   * Priority: JWT (service account) > GoogleAuth (ADC) > gcloud CLI (local dev)
   */
  private async getIdentityToken(): Promise<string | null> {
    const targetUrl = getCustomerAgentUrl();

    // First try: JWT with service account credentials (most reliable for Render)
    if (this.serviceAccountCredentials) {
      try {
        const jwtClient = new JWT({
          email: this.serviceAccountCredentials.client_email,
          key: this.serviceAccountCredentials.private_key,
        });
        const idToken = await jwtClient.fetchIdToken(targetUrl);
        if (idToken) {
          logger.debug('[ProjectHubAgent] Got identity token via JWT');
          return idToken;
        }
      } catch (e) {
        logger.warn(
          { error: e instanceof Error ? e.message : String(e) },
          '[ProjectHubAgent] JWT fetchIdToken failed'
        );
      }
    }

    // Second try: GoogleAuth (works with ADC on GCP)
    try {
      const client = await this.auth.getIdTokenClient(targetUrl);
      const headers = await client.getRequestHeaders();
      const authHeader = (headers as unknown as Record<string, string>)['Authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        logger.debug('[ProjectHubAgent] Got identity token via GoogleAuth');
        return token;
      }
    } catch (e) {
      logger.warn(
        { error: e instanceof Error ? e.message : String(e) },
        '[ProjectHubAgent] GoogleAuth failed, trying fallback'
      );
    }

    // Third try: gcloud CLI (works with user credentials locally)
    try {
      const { execSync } = await import('child_process');
      const token = execSync('gcloud auth print-identity-token', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (token) {
        logger.debug('[ProjectHubAgent] Using gcloud CLI identity token (local dev)');
        return token;
      }
    } catch {
      // gcloud CLI not available - expected on Render
    }

    logger.warn('[ProjectHubAgent] No identity token available - calls will be unauthenticated');
    return null;
  }

  /**
   * Extract text response from ADK response format.
   */
  private extractAgentResponse(data: AdkRunResponse): string {
    // Handle array format (ADK standard)
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        const event = data[i];
        if (event.content?.role === 'model') {
          const textPart = event.content.parts?.find((p) => p.text);
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    } else {
      // Handle legacy format with messages array
      const messages = data.messages;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'model') {
          const textPart = msg.parts?.find((p) => p.text);
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    }

    return 'No response from agent.';
  }

  /**
   * Extract tool calls from ADK response format.
   */
  private extractToolCalls(
    data: AdkRunResponse
  ): Array<{ name: string; args: Record<string, unknown>; result?: unknown }> {
    type PartType = z.infer<typeof AdkPartSchema>;
    const allParts: PartType[] = [];

    if (Array.isArray(data)) {
      for (const event of data) {
        if (event.content?.parts) {
          allParts.push(...event.content.parts);
        }
      }
    } else {
      for (const msg of data.messages) {
        if (msg.parts) {
          allParts.push(...msg.parts);
        }
      }
    }

    if (allParts.length === 0) {
      return [];
    }

    const toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result?: unknown;
    }> = [];

    const pendingCalls = new Map<string, { name: string; args: Record<string, unknown> }>();

    for (const part of allParts) {
      if (part.functionCall) {
        const callId = `${part.functionCall.name}:${JSON.stringify(part.functionCall.args)}`;
        pendingCalls.set(callId, {
          name: part.functionCall.name,
          args: part.functionCall.args,
        });
      }
      if (part.functionResponse) {
        for (const [callId, call] of pendingCalls) {
          if (callId.startsWith(part.functionResponse.name)) {
            toolCalls.push({
              ...call,
              result: part.functionResponse.response,
            });
            pendingCalls.delete(callId);
            break;
          }
        }
      }
    }

    // Add any calls without responses
    for (const call of pendingCalls.values()) {
      toolCalls.push(call);
    }

    return toolCalls;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

// Singleton instance for reuse
let serviceInstance: ProjectHubAgentService | null = null;

/**
 * Get or create ProjectHubAgentService instance.
 *
 * Uses singleton pattern since the service has no per-request state
 * and the Google Auth client benefits from reuse.
 */
export function createProjectHubAgentService(): ProjectHubAgentService {
  if (!serviceInstance) {
    serviceInstance = new ProjectHubAgentService();
  }
  return serviceInstance;
}

/**
 * Reset singleton for testing.
 */
export function resetProjectHubAgentService(): void {
  serviceInstance = null;
}
