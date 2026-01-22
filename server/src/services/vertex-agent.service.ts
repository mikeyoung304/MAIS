/**
 * Vertex Agent Service
 *
 * Handles communication between MAIS dashboard and the Concierge agent.
 * Manages agent sessions, message sending, and response streaming.
 *
 * Architecture:
 * - Creates sessions scoped to tenant + user
 * - Sends messages to Concierge via A2A protocol
 * - Receives responses and routes them to WebSocket clients
 * - Persists sessions and messages to PostgreSQL via SessionService
 *
 * Security:
 * - All sessions are tenant-scoped
 * - Uses Google Cloud IAM for agent authentication
 * - Messages encrypted at rest via SessionService
 * - Optimistic locking prevents concurrent modification
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 3
 */

import { GoogleAuth, JWT } from 'google-auth-library';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import {
  createSessionService,
  type SessionService,
  type SessionWithMessages,
  sessionMetrics,
  auditSessionCreated,
  auditMessageAppended,
} from './session';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONCIERGE_AGENT_URL =
  process.env.CONCIERGE_AGENT_URL || 'https://concierge-agent-506923455711.us-central1.run.app';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'handled-484216';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentSession {
  sessionId: string;
  tenantId: string;
  userId: string; // Could be tenant admin or a specific user
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  version: number; // For optimistic locking
}

export interface AgentMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface SendMessageResult {
  response: string;
  sessionId: string;
  version: number; // Return new version for client-side tracking
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  error?: string;
}

// =============================================================================
// VERTEX AGENT SERVICE
// =============================================================================

export class VertexAgentService {
  private auth: GoogleAuth;
  private serviceAccountCredentials: { client_email: string; private_key: string } | null = null;
  private sessionService: SessionService;

  constructor(prisma: PrismaClient) {
    // Initialize persistent session service
    this.sessionService = createSessionService(prisma);

    // Initialize Google Auth for Cloud Run authentication
    // Priority: GOOGLE_SERVICE_ACCOUNT_JSON (Render) > ADC (GCP/local)
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.auth = new GoogleAuth({ credentials });
        // Store credentials for JWT-based ID token generation
        this.serviceAccountCredentials = {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        };
        logger.info('[VertexAgent] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON');
      } catch (e) {
        logger.error({ error: e }, '[VertexAgent] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
        this.auth = new GoogleAuth();
      }
    } else {
      this.auth = new GoogleAuth();
    }
  }

  /**
   * Create a new agent session for a tenant user.
   *
   * Now persists to PostgreSQL via SessionService for enterprise durability.
   *
   * @param tenantId - The tenant ID
   * @param userId - The user ID (usually tenant admin)
   * @param requestId - Optional request ID for correlation
   * @param userAgent - Optional user agent for debugging
   * @returns Session ID
   */
  async createSession(
    tenantId: string,
    userId: string,
    requestId?: string,
    userAgent?: string
  ): Promise<string> {
    // Create session on ADK first to get a valid session ID
    const adkUserId = `${tenantId}:${userId}`; // Combine tenant and user for ADK user_id
    let adkSessionId: string;

    try {
      const token = await this.getIdentityToken();
      const response = await fetch(
        // ADK app name is 'agent' (from /list-apps endpoint)
        `${CONCIERGE_AGENT_URL}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(requestId && { 'X-Request-ID': requestId }),
          },
          // When using POST /apps/{appName}/users/{userId}/sessions (auto-generate ID),
          // ADK expects state wrapped: { state: { key: value } }
          // This is different from POST .../sessions/{sessionId} which uses direct key-values
          body: JSON.stringify({ state: { tenantId } }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, userId, status: response.status, error: errorText },
          '[VertexAgent] Failed to create ADK session'
        );
        throw new Error(`ADK session creation failed: ${response.status}`);
      }

      const adkSession = (await response.json()) as { id: string };
      adkSessionId = adkSession.id;
      logger.info({ tenantId, userId, adkSessionId }, '[VertexAgent] ADK session created');
    } catch (error) {
      // Fallback to local session ID if ADK is unreachable
      adkSessionId = `local:${tenantId}:${userId}:${Date.now()}`;
      logger.warn(
        { tenantId, userId, adkSessionId, error },
        '[VertexAgent] Using local session (ADK unreachable)'
      );
    }

    // Persist session to PostgreSQL via SessionService
    // The session ID from ADK becomes our database session ID
    const dbSession = await this.sessionService.getOrCreateSession(
      tenantId,
      adkSessionId, // Use ADK session ID as our session ID for correlation
      'ADMIN', // Vertex agent sessions are admin sessions
      undefined, // No customer ID for admin sessions
      userAgent
    );

    // Record metrics and audit
    sessionMetrics.recordSessionCreated();
    auditSessionCreated(dbSession.id, tenantId, 'ADMIN');

    logger.info(
      { tenantId, userId, sessionId: dbSession.id, adkSessionId },
      '[VertexAgent] Session created and persisted'
    );

    return dbSession.id;
  }

  /**
   * Get an existing session or create a new one.
   *
   * Now restores sessions from PostgreSQL, surviving server restarts.
   *
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param existingSessionId - Optional existing session ID to restore
   * @param userAgent - Optional user agent for debugging
   * @returns Session details
   */
  async getOrCreateSession(
    tenantId: string,
    userId: string,
    existingSessionId?: string,
    userAgent?: string
  ): Promise<AgentSession> {
    // Try to restore existing session from database
    if (existingSessionId) {
      const dbSession = await this.sessionService.getSession(existingSessionId, tenantId);
      if (dbSession) {
        // Check if session is still fresh (last activity within 30 minutes)
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - dbSession.lastActivityAt.getTime() < thirtyMinutes) {
          sessionMetrics.recordSessionRestored();
          return this.toAgentSession(dbSession, userId);
        }
      }
    }

    // Create new session
    const sessionId = await this.createSession(tenantId, userId, undefined, userAgent);
    const newSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!newSession) {
      throw new Error('Failed to create session');
    }
    return this.toAgentSession(newSession, userId);
  }

  /**
   * Convert SessionWithMessages to AgentSession format
   */
  private toAgentSession(dbSession: SessionWithMessages, userId: string): AgentSession {
    return {
      sessionId: dbSession.id,
      tenantId: dbSession.tenantId,
      userId,
      createdAt: dbSession.createdAt,
      lastMessageAt: dbSession.lastActivityAt,
      messageCount: dbSession.messages.length,
      version: dbSession.version,
    };
  }

  /**
   * Send a message to the Concierge agent and get a response.
   *
   * Now persists both user and agent messages to PostgreSQL for durability.
   *
   * @param sessionId - The session ID
   * @param tenantId - The tenant ID
   * @param message - User message
   * @param version - Session version for optimistic locking
   * @param requestId - Optional request ID for correlation
   * @returns Agent response with updated version
   */
  async sendMessage(
    sessionId: string,
    tenantId: string,
    message: string,
    version: number,
    requestId?: string
  ): Promise<SendMessageResult> {
    // Get session to verify access and get userId
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!dbSession) {
      throw new Error('Session not found');
    }

    // Extract userId from session (we'll need it for ADK calls)
    const userId = dbSession.customerId || tenantId; // Admin sessions use tenantId

    logger.info(
      { tenantId, sessionId, messageLength: message.length },
      '[VertexAgent] Sending message'
    );

    // Persist user message to database first
    let currentVersion = version;
    const userMsgResult = await this.sessionService.appendMessage(
      sessionId,
      tenantId,
      {
        role: 'user',
        content: message,
      },
      currentVersion
    );

    if (!userMsgResult.success) {
      // Handle concurrent modification
      if (userMsgResult.error === 'Concurrent modification detected') {
        sessionMetrics.recordConcurrentModification();
        return {
          response: 'Session was modified. Please refresh and try again.',
          sessionId,
          version: userMsgResult.newVersion || currentVersion,
          error: userMsgResult.error,
        };
      }
      throw new Error(userMsgResult.error || 'Failed to save message');
    }

    currentVersion = userMsgResult.newVersion!;
    sessionMetrics.recordMessageAppended();
    auditMessageAppended(sessionId, tenantId, userMsgResult.message!.id, 'user');

    try {
      // Get identity token for Cloud Run authentication
      const token = await this.getIdentityToken();

      // Send to Concierge agent via A2A protocol
      // user_id must match the format used in session creation
      const adkUserId = `${tenantId}:${userId}`;
      const response = await fetch(`${CONCIERGE_AGENT_URL}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(requestId && { 'X-Request-ID': requestId }),
        },
        // ADK uses camelCase for A2A protocol parameters
        // Note: App name is 'agent' (from /list-apps), not 'concierge'
        // IMPORTANT: /run endpoint does NOT accept state - state must be set on session creation
        body: JSON.stringify({
          appName: 'agent',
          userId: adkUserId,
          sessionId: sessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle 404 "Session not found" by creating a new ADK session and retrying
        if (response.status === 404 && errorText.includes('Session not found')) {
          logger.info(
            { tenantId, sessionId },
            '[VertexAgent] Session not found on ADK, creating new session and retrying'
          );

          // Create a new session on ADK (we keep our DB session)
          const newAdkSessionId = await this.createADKSession(tenantId, userId, requestId);
          if (newAdkSessionId) {
            // Retry with same DB session but new ADK session
            // Note: we don't update currentVersion here since we already saved the user message
            return this.sendMessageToADK(
              sessionId,
              tenantId,
              newAdkSessionId,
              message,
              currentVersion
            );
          }
        }

        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[VertexAgent] Agent error'
        );
        return {
          response: 'Sorry, I ran into an issue. Try again?',
          sessionId,
          version: currentVersion,
          error: `Agent returned ${response.status}`,
        };
      }

      // ADK returns an array of events, not an object
      const data = (await response.json()) as unknown;

      // Extract response from A2A format
      const agentResponse = this.extractAgentResponse(data);
      const toolCalls = this.extractToolCalls(data);

      // Persist agent response to database
      // Transform toolCalls to schema format (with id and arguments)
      const schemaToolCalls =
        toolCalls.length > 0
          ? toolCalls.map((tc, idx) => ({
              id: `tc_${Date.now()}_${idx}`,
              name: tc.name,
              arguments: tc.args,
              result: tc.result,
            }))
          : undefined;

      const agentMsgResult = await this.sessionService.appendMessage(
        sessionId,
        tenantId,
        {
          role: 'assistant',
          content: agentResponse,
          toolCalls: schemaToolCalls,
        },
        currentVersion
      );

      if (agentMsgResult.success) {
        currentVersion = agentMsgResult.newVersion!;
        sessionMetrics.recordMessageAppended();
        auditMessageAppended(sessionId, tenantId, agentMsgResult.message!.id, 'assistant');
      } else {
        // Log but don't fail - user message was sent and response received
        logger.warn(
          { sessionId, tenantId, error: agentMsgResult.error },
          '[VertexAgent] Failed to persist agent response'
        );
      }

      logger.info(
        { tenantId, sessionId, responseLength: agentResponse.length },
        '[VertexAgent] Response received'
      );

      return {
        response: agentResponse,
        sessionId,
        version: currentVersion,
        toolCalls,
      };
    } catch (error) {
      logger.error({ tenantId, sessionId, error }, '[VertexAgent] Failed to send message');
      sessionMetrics.recordError();

      return {
        response: 'Connection issue. Try again in a moment.',
        sessionId,
        version: currentVersion,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper to send message to ADK when we need to use a different ADK session ID
   */
  private async sendMessageToADK(
    dbSessionId: string,
    tenantId: string,
    adkSessionId: string,
    message: string,
    currentVersion: number
  ): Promise<SendMessageResult> {
    const userId = tenantId; // Admin sessions use tenantId
    const adkUserId = `${tenantId}:${userId}`;

    const token = await this.getIdentityToken();
    const response = await fetch(`${CONCIERGE_AGENT_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        appName: 'agent',
        userId: adkUserId,
        sessionId: adkSessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: message }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { tenantId, adkSessionId, status: response.status, error: errorText },
        '[VertexAgent] ADK retry failed'
      );
      return {
        response: 'Sorry, I ran into an issue. Try again?',
        sessionId: dbSessionId,
        version: currentVersion,
        error: `Agent returned ${response.status}`,
      };
    }

    const data = await response.json();
    const agentResponse = this.extractAgentResponse(data);
    const toolCalls = this.extractToolCalls(data);

    // Transform toolCalls to schema format (with id and arguments)
    const schemaToolCalls =
      toolCalls.length > 0
        ? toolCalls.map((tc, idx) => ({
            id: `tc_${Date.now()}_${idx}`,
            name: tc.name,
            arguments: tc.args,
            result: tc.result,
          }))
        : undefined;

    // Persist agent response
    const agentMsgResult = await this.sessionService.appendMessage(
      dbSessionId,
      tenantId,
      {
        role: 'assistant',
        content: agentResponse,
        toolCalls: schemaToolCalls,
      },
      currentVersion
    );

    const finalVersion = agentMsgResult.success ? agentMsgResult.newVersion! : currentVersion;

    return {
      response: agentResponse,
      sessionId: dbSessionId,
      version: finalVersion,
      toolCalls,
    };
  }

  /**
   * Get session history from database.
   *
   * @param sessionId - The session ID
   * @param tenantId - The tenant ID
   * @param limit - Maximum messages to return (default 100)
   * @param offset - Offset for pagination (default 0)
   * @returns Array of messages
   */
  async getSessionHistory(
    sessionId: string,
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: AgentMessage[]; total: number; hasMore: boolean }> {
    const result = await this.sessionService.getSessionHistory(sessionId, tenantId, limit, offset);

    // Transform to AgentMessage format
    return {
      messages: result.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : (m.role as 'user' | 'model'),
        content: m.content,
        timestamp: m.createdAt,
        toolCalls: m.toolCalls?.map((tc) => ({
          name: tc.name,
          args: tc.arguments,
          result: tc.result,
        })),
      })),
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * Get session details from database.
   *
   * @param sessionId - The session ID
   * @param tenantId - The tenant ID
   * @returns Session details or null
   */
  async getSession(sessionId: string, tenantId: string): Promise<AgentSession | null> {
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!dbSession) {
      return null;
    }

    const userId = dbSession.customerId || tenantId;
    return this.toAgentSession(dbSession, userId);
  }

  /**
   * Close a session (soft delete).
   *
   * @param sessionId - The session ID
   * @param tenantId - The tenant ID
   */
  async closeSession(sessionId: string, tenantId: string): Promise<void> {
    const deleted = await this.sessionService.deleteSession(sessionId, tenantId);
    if (deleted) {
      sessionMetrics.recordSessionDeleted();
      logger.info({ tenantId, sessionId }, '[VertexAgent] Session closed');
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Create a new session on ADK Cloud Run.
   * Returns the session ID if successful, null if failed.
   * @param requestId - Optional request ID for correlation
   */
  private async createADKSession(
    tenantId: string,
    userId: string,
    requestId?: string
  ): Promise<string | null> {
    try {
      const token = await this.getIdentityToken();
      const adkUserId = `${tenantId}:${userId}`;

      const response = await fetch(
        `${CONCIERGE_AGENT_URL}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(requestId && { 'X-Request-ID': requestId }),
          },
          body: JSON.stringify({ state: { tenantId } }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, userId, status: response.status, error: errorText },
          '[VertexAgent] Failed to create ADK session in retry'
        );
        return null;
      }

      const adkSession = (await response.json()) as { id: string };
      logger.info(
        { tenantId, userId, adkSessionId: adkSession.id },
        '[VertexAgent] ADK session created in retry'
      );
      return adkSession.id;
    } catch (error) {
      logger.error({ tenantId, userId, error }, '[VertexAgent] Error creating ADK session');
      return null;
    }
  }

  /**
   * Get identity token for Cloud Run authentication.
   * Priority: JWT (service account) > GoogleAuth (ADC) > gcloud CLI (local dev)
   */
  private async getIdentityToken(): Promise<string | null> {
    // First try: JWT with service account credentials (most reliable for Render)
    // This directly uses the private key to sign an ID token request
    if (this.serviceAccountCredentials) {
      try {
        const jwtClient = new JWT({
          email: this.serviceAccountCredentials.client_email,
          key: this.serviceAccountCredentials.private_key,
        });
        const idToken = await jwtClient.fetchIdToken(CONCIERGE_AGENT_URL);
        if (idToken) {
          logger.info('[VertexAgent] Got identity token via JWT (service account)');
          return idToken;
        }
        logger.warn('[VertexAgent] JWT.fetchIdToken returned empty token');
      } catch (e) {
        logger.warn(
          { error: e instanceof Error ? e.message : String(e) },
          '[VertexAgent] JWT fetchIdToken failed'
        );
      }
    }

    // Second try: GoogleAuth (works with ADC on GCP)
    try {
      const client = await this.auth.getIdTokenClient(CONCIERGE_AGENT_URL);
      const headers = await client.getRequestHeaders();
      // getRequestHeaders returns { Authorization: 'Bearer ...' } or empty object
      const authHeader = (headers as unknown as Record<string, string>)['Authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        logger.info('[VertexAgent] Got identity token via GoogleAuth');
        return token;
      }
    } catch (e) {
      logger.warn(
        { error: e instanceof Error ? e.message : String(e) },
        '[VertexAgent] GoogleAuth failed, trying fallback'
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
        logger.info('[VertexAgent] Using gcloud CLI identity token (local dev)');
        return token;
      }
    } catch {
      // gcloud CLI not available or failed - this is expected on Render
    }

    logger.warn(
      '[VertexAgent] No identity token available - Cloud Run calls will be unauthenticated'
    );
    return null;
  }

  /**
   * Extract the text response from A2A response format.
   * ADK returns an array of events: [{ content: { role, parts } }, ...]
   */
  private extractAgentResponse(data: unknown): string {
    // ADK format: [{ content: { role: 'model', parts: [{ text: '...' }] } }]
    // Also support legacy format: { messages: [...] }

    // Handle array format (ADK standard)
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        const event = data[i] as { content?: { role?: string; parts?: Array<{ text?: string }> } };
        if (event.content?.role === 'model') {
          const textPart = event.content.parts?.find((p) => p.text);
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    }

    // Handle object format with messages array (legacy)
    const dataObj = data as Record<string, unknown>;
    const messages = dataObj.messages as Array<{
      role: string;
      parts: Array<{ text?: string; functionCall?: unknown }>;
    }>;

    if (messages && Array.isArray(messages)) {
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
   * Extract tool calls from A2A response format.
   * ADK returns an array of events: [{ content: { parts: [{ functionCall }] } }, ...]
   */
  private extractToolCalls(
    data: unknown
  ): Array<{ name: string; args: Record<string, unknown>; result?: unknown }> {
    // Normalize to array of parts
    type PartType = {
      text?: string;
      functionCall?: { name: string; args: Record<string, unknown> };
      functionResponse?: { name: string; response: unknown };
    };

    const allParts: PartType[] = [];

    // Handle array format (ADK standard)
    if (Array.isArray(data)) {
      for (const event of data) {
        const content = (event as { content?: { parts?: PartType[] } }).content;
        if (content?.parts) {
          allParts.push(...content.parts);
        }
      }
    } else {
      // Handle legacy format with messages array
      const dataObj = data as Record<string, unknown>;
      const messages = dataObj.messages as Array<{ parts?: PartType[] }>;
      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          if (msg.parts) {
            allParts.push(...msg.parts);
          }
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

    // Extract all function calls and their responses
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
        // Find matching call and add result
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

/**
 * Create a new VertexAgentService instance.
 *
 * Requires PrismaClient for session persistence.
 * In production, this would be a singleton managed by DI.
 *
 * @param prisma - Prisma client for database operations
 */
export function createVertexAgentService(prisma: PrismaClient): VertexAgentService {
  return new VertexAgentService(prisma);
}
