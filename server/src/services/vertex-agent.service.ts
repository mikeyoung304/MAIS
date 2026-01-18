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
 *
 * Security:
 * - All sessions are tenant-scoped
 * - Uses Google Cloud IAM for agent authentication
 * - Session IDs include tenant ID for isolation
 */

import { GoogleAuth } from 'google-auth-library';
import { logger } from '../lib/core/logger';

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
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  error?: string;
}

// In-memory session store (in production, use Redis or a database)
const sessions = new Map<string, AgentSession>();
const sessionMessages = new Map<string, AgentMessage[]>();

// =============================================================================
// VERTEX AGENT SERVICE
// =============================================================================

export class VertexAgentService {
  private auth: GoogleAuth;

  constructor() {
    // Initialize Google Auth for Cloud Run authentication
    this.auth = new GoogleAuth();
  }

  /**
   * Create a new agent session for a tenant user.
   *
   * @param tenantId - The tenant ID
   * @param userId - The user ID (usually tenant admin)
   * @returns Session ID
   */
  async createSession(tenantId: string, userId: string): Promise<string> {
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

    const session: AgentSession = {
      sessionId: adkSessionId,
      tenantId,
      userId,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: 0,
    };

    sessions.set(adkSessionId, session);
    sessionMessages.set(adkSessionId, []);

    logger.info({ tenantId, userId, sessionId: adkSessionId }, '[VertexAgent] Session created');

    return adkSessionId;
  }

  /**
   * Get an existing session or create a new one.
   *
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @returns Session details
   */
  async getOrCreateSession(tenantId: string, userId: string): Promise<AgentSession> {
    // Look for an active session for this tenant/user
    for (const [sessionId, session] of sessions) {
      if (session.tenantId === tenantId && session.userId === userId) {
        // Check if session is still fresh (last activity within 30 minutes)
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - session.lastMessageAt.getTime() < thirtyMinutes) {
          return session;
        }
      }
    }

    // Create new session
    const sessionId = await this.createSession(tenantId, userId);
    return sessions.get(sessionId)!;
  }

  /**
   * Send a message to the Concierge agent and get a response.
   *
   * @param sessionId - The session ID
   * @param message - User message
   * @returns Agent response
   */
  async sendMessage(sessionId: string, message: string): Promise<SendMessageResult> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { tenantId, userId } = session;

    logger.info(
      { tenantId, sessionId, messageLength: message.length },
      '[VertexAgent] Sending message'
    );

    // Record user message
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    sessionMessages.get(sessionId)?.push(userMessage);

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

          // Create a new session on ADK
          const newSessionId = await this.createADKSession(tenantId, userId);
          if (newSessionId) {
            // Update local session with new ADK session ID
            session.sessionId = newSessionId;
            sessions.delete(sessionId);
            sessions.set(newSessionId, session);

            // Move message history to new session
            const history = sessionMessages.get(sessionId) || [];
            sessionMessages.delete(sessionId);
            sessionMessages.set(newSessionId, history);

            // Retry the message with new session
            return this.sendMessage(newSessionId, message);
          }
        }

        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[VertexAgent] Agent error'
        );
        return {
          response: 'Sorry, I ran into an issue. Try again?',
          sessionId,
          error: `Agent returned ${response.status}`,
        };
      }

      // ADK returns an array of events, not an object
      const data = (await response.json()) as unknown;

      // Extract response from A2A format
      const agentResponse = this.extractAgentResponse(data);
      const toolCalls = this.extractToolCalls(data);

      // Record agent message
      const modelMessage: AgentMessage = {
        role: 'model',
        content: agentResponse,
        timestamp: new Date(),
        toolCalls,
      };
      sessionMessages.get(sessionId)?.push(modelMessage);

      // Update session
      session.lastMessageAt = new Date();
      session.messageCount += 1;

      logger.info(
        { tenantId, sessionId, responseLength: agentResponse.length },
        '[VertexAgent] Response received'
      );

      return {
        response: agentResponse,
        sessionId,
        toolCalls,
      };
    } catch (error) {
      logger.error({ tenantId, sessionId, error }, '[VertexAgent] Failed to send message');

      return {
        response: 'Connection issue. Try again in a moment.',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get session history.
   *
   * @param sessionId - The session ID
   * @returns Array of messages
   */
  getSessionHistory(sessionId: string): AgentMessage[] {
    return sessionMessages.get(sessionId) || [];
  }

  /**
   * Get session details.
   *
   * @param sessionId - The session ID
   * @returns Session details or null
   */
  getSession(sessionId: string): AgentSession | null {
    return sessions.get(sessionId) || null;
  }

  /**
   * Close a session.
   *
   * @param sessionId - The session ID
   */
  closeSession(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      logger.info(
        { tenantId: session.tenantId, sessionId, messageCount: session.messageCount },
        '[VertexAgent] Session closed'
      );
    }
    sessions.delete(sessionId);
    sessionMessages.delete(sessionId);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Create a new session on ADK Cloud Run.
   * Returns the session ID if successful, null if failed.
   */
  private async createADKSession(tenantId: string, userId: string): Promise<string | null> {
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
   * Uses ADC (Application Default Credentials) when available.
   * Falls back to gcloud CLI for local development.
   */
  private async getIdentityToken(): Promise<string | null> {
    // First try: GoogleAuth (works with service accounts on GCP)
    try {
      const client = await this.auth.getIdTokenClient(CONCIERGE_AGENT_URL);
      const headers = await client.getRequestHeaders();
      // getRequestHeaders returns { Authorization: 'Bearer ...' } or empty object
      const authHeader = (headers as unknown as Record<string, string>)['Authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        return token;
      }
    } catch {
      // GoogleAuth failed - try gcloud CLI fallback
    }

    // Second try: gcloud CLI (works with user credentials locally)
    try {
      const { execSync } = await import('child_process');
      const token = execSync('gcloud auth print-identity-token', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (token) {
        logger.debug('[VertexAgent] Using gcloud CLI identity token (local dev)');
        return token;
      }
    } catch {
      // gcloud CLI not available or failed
    }

    logger.debug('[VertexAgent] No identity token available');
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
 * In production, this would be a singleton managed by DI.
 */
export function createVertexAgentService(): VertexAgentService {
  return new VertexAgentService();
}
