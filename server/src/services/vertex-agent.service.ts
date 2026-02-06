/**
 * Vertex Agent Service
 *
 * Handles communication between MAIS dashboard and the Tenant Agent.
 * Manages agent sessions, message sending, and response streaming.
 *
 * Architecture:
 * - Creates sessions scoped to tenant + user
 * - Sends messages to Tenant Agent via A2A protocol
 * - Receives responses and routes them to WebSocket clients
 * - Persists sessions and messages to PostgreSQL via SessionService
 *
 * Security:
 * - All sessions are tenant-scoped
 * - Uses Google Cloud IAM for agent authentication
 * - Messages encrypted at rest via SessionService
 * - Optimistic locking prevents concurrent modification
 *
 * Phase 4 Update (2026-01-31):
 * - Uses unified tenant-agent for all tenant-facing operations
 * - Tenant Agent handles: storefront, marketing, project management (tenant view)
 * - Customer Agent handles: booking, project hub (customer view)
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { createSessionService, type SessionService, type SessionWithMessages } from './session';
import type { ContextBuilderService } from './context-builder.service';
import { createContextBuilderService, type BootstrapData } from './context-builder.service';
import { cloudRunAuth } from './cloud-run-auth.service';

// =============================================================================
// ADK RESPONSE SCHEMAS (Pitfall #56: Runtime validation for external APIs)
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
 * Parts can contain text, function calls, or function responses.
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
 * ADK returns an array of events: [{ content: { role, parts } }, ...]
 * Also supports legacy format: { messages: [...] }
 */
const AdkRunResponseSchema = z.union([
  // Modern ADK format: array of events
  z.array(AdkEventSchema),
  // Legacy format: object with messages array
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
// FETCH WITH TIMEOUT
// =============================================================================

/**
 * Fetch with timeout for ADK agent calls.
 * Per CLAUDE.md Pitfall #42: agent calls use 30s timeout.
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
 * Get required environment variable, throwing clear error if missing.
 * Validation deferred to first access to avoid breaking test imports (CLAUDE.md pitfall #34, #41).
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Set this in your .env file.`);
  }
  return value;
}

// Agent URLs - no hardcoded fallbacks with project numbers
// Validation happens at first use, not at import time (to allow test imports)
function getTenantAgentUrl(): string {
  const url = process.env.TENANT_AGENT_URL;
  if (url) return url;

  throw new Error(
    'Missing required environment variable: TENANT_AGENT_URL. ' +
      'Set this in your .env file or Render dashboard.'
  );
}

function _getGoogleCloudProject(): string {
  return getRequiredEnv('GOOGLE_CLOUD_PROJECT');
}

const _GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

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
  private sessionService: SessionService;
  private contextBuilder: ContextBuilderService;
  private prisma: PrismaClient; // Direct access for adkSessionId updates

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    // Initialize persistent session service
    this.sessionService = createSessionService(prisma);
    // Initialize context builder for bootstrap data (Agent-First Architecture)
    this.contextBuilder = createContextBuilderService(prisma);
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
    // =========================================================================
    // AGENT-FIRST ARCHITECTURE: Inject context at session creation
    // This is the P0 fix - agent now knows facts at session start
    // =========================================================================

    // Step 1: Fetch bootstrap data (discovery facts, storefront state, forbidden slots)
    let bootstrap: BootstrapData | null = null;
    try {
      bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
      logger.info(
        {
          tenantId,
          businessName: bootstrap.businessName,
          factCount: Object.keys(bootstrap.discoveryFacts).length,
          forbiddenSlots: bootstrap.forbiddenSlots,
          onboardingComplete: bootstrap.onboardingComplete,
        },
        '[VertexAgent] Bootstrap data loaded for session'
      );
    } catch (error) {
      // Graceful degradation - create session without bootstrap
      logger.warn(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[VertexAgent] Failed to load bootstrap data, creating session with tenantId only'
      );
    }

    // Step 2: Build ADK session state with full context
    // Agent receives this at session start and knows what NOT to ask
    const sessionState = {
      tenantId,
      // Identity
      businessName: bootstrap?.businessName ?? null,
      slug: bootstrap?.slug ?? null,
      // Known facts (agent must NOT ask about these)
      knownFacts: bootstrap?.discoveryFacts ?? {},
      // Forbidden slots - enterprise slot-policy
      // Agent checks slot keys, not phrase matching
      forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
      // Storefront state summary
      storefrontState: bootstrap?.storefrontState ?? null,
      // Onboarding state
      onboardingComplete: bootstrap?.onboardingComplete ?? false,
      onboardingPhase: bootstrap?.onboardingPhase ?? 'NOT_STARTED',
    };

    // Create session on ADK with full context
    const adkUserId = `${tenantId}:${userId}`; // Combine tenant and user for ADK user_id
    let adkSessionId: string;

    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        // ADK app name is 'agent' (from /list-apps endpoint)
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(requestId && { 'X-Request-ID': requestId }),
          },
          // ADK expects state wrapped: { state: { key: value } }
          // NOW INCLUDES: knownFacts, forbiddenSlots, storefrontState, etc.
          body: JSON.stringify({ state: sessionState }),
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

      // Validate ADK response with Zod (Pitfall #56)
      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, userId, error: parseResult.error.message, rawResponse },
          '[VertexAgent] Invalid ADK session response format'
        );
        throw new Error(`Invalid ADK session response: ${parseResult.error.message}`);
      }
      adkSessionId = parseResult.data.id;
      logger.info({ tenantId, userId, adkSessionId }, '[VertexAgent] ADK session created');
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(
          { tenantId, userId },
          '[VertexAgent] ADK session creation timed out after 30 seconds'
        );
      }
      // Fallback to local session ID if ADK is unreachable
      adkSessionId = `local:${tenantId}:${userId}:${Date.now()}`;
      logger.warn(
        { tenantId, userId, adkSessionId, error },
        '[VertexAgent] Using local session (ADK unreachable)'
      );
    }

    // Persist session to PostgreSQL via SessionService
    const dbSession = await this.sessionService.getOrCreateSession(
      tenantId,
      `${tenantId}:${userId}`, // Use tenant:user format for session grouping
      'ADMIN', // Vertex agent sessions are admin sessions
      undefined, // No customer ID for admin sessions
      userAgent
    );

    // Store adkSessionId on the session for later correlation
    // This is CRITICAL: sendMessage must use this ID, not the local session ID
    await this.prisma.agentSession.update({
      where: { id: dbSession.id },
      data: { adkSessionId },
    });

    logger.info(
      {
        action: 'session.created',
        sessionId: dbSession.id,
        tenantId,
        sessionType: 'ADMIN',
        userId,
        adkSessionId,
      },
      'Session audit: session.created (adkSessionId stored)'
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
    // Get session to verify access and get adkSessionId
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!dbSession) {
      throw new Error('Session not found');
    }

    // Extract userId from session (we'll need it for ADK calls)
    const userId = dbSession.customerId || tenantId; // Admin sessions use tenantId

    // Get adkSessionId - CRITICAL: use this for ADK calls, not local sessionId
    // Need to fetch from DB since sessionService might not include this field
    const sessionWithAdk = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { adkSessionId: true },
    });
    let adkSessionId = sessionWithAdk?.adkSessionId;

    logger.info(
      { tenantId, sessionId, adkSessionId, messageLength: message.length },
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
    logger.debug(
      {
        action: 'session.message_appended',
        sessionId,
        tenantId,
        messageId: userMsgResult.message!.id,
        role: 'user',
      },
      'Session audit: session.message_appended'
    );

    try {
      // Get identity token for Cloud Run authentication
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());

      // If no adkSessionId, create one first
      if (!adkSessionId) {
        logger.info(
          { tenantId, sessionId },
          '[VertexAgent] No adkSessionId found, creating new ADK session'
        );
        adkSessionId = await this.createADKSession(tenantId, userId, requestId);
        if (adkSessionId) {
          // Store it for future calls
          await this.prisma.agentSession.update({
            where: { id: sessionId },
            data: { adkSessionId },
          });
        }
      }

      // Send to Tenant agent via A2A protocol
      // user_id must match the format used in session creation
      const adkUserId = `${tenantId}:${userId}`;
      const response = await fetchWithTimeout(`${getTenantAgentUrl()}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(requestId && { 'X-Request-ID': requestId }),
        },
        // ADK uses camelCase for A2A protocol parameters
        // Note: App name is 'agent' (from /list-apps), not 'concierge'
        // CRITICAL: Use adkSessionId (ADK's UUID), NOT local sessionId (our CUID)
        body: JSON.stringify({
          appName: 'agent',
          userId: adkUserId,
          sessionId: adkSessionId || sessionId, // Fallback to local ID if ADK unreachable
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
            { tenantId, sessionId, oldAdkSessionId: adkSessionId },
            '[VertexAgent] Session not found on ADK, creating new session and retrying'
          );

          // Create a new session on ADK (we keep our DB session)
          const newAdkSessionId = await this.createADKSession(tenantId, userId, requestId);
          if (newAdkSessionId) {
            // Store the new adkSessionId for future calls
            await this.prisma.agentSession.update({
              where: { id: sessionId },
              data: { adkSessionId: newAdkSessionId },
            });
            logger.info(
              { tenantId, sessionId, newAdkSessionId },
              '[VertexAgent] Stored new adkSessionId after retry'
            );

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
      // Validate with Zod (Pitfall #56)
      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error(
          { tenantId, sessionId, error: parseResult.error.message },
          '[VertexAgent] Invalid ADK run response format'
        );
        return {
          response: 'Sorry, I received an unexpected response format. Try again?',
          sessionId,
          version: currentVersion,
          error: `Invalid ADK response format: ${parseResult.error.message}`,
        };
      }
      const data = parseResult.data;

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
        logger.debug(
          {
            action: 'session.message_appended',
            sessionId,
            tenantId,
            messageId: agentMsgResult.message!.id,
            role: 'assistant',
          },
          'Session audit: session.message_appended'
        );
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
      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(
          { tenantId, sessionId },
          '[VertexAgent] ADK agent request timed out after 30 seconds'
        );
        return {
          response: 'The request timed out. Please try again.',
          sessionId,
          version: currentVersion,
          error: 'ADK agent request timed out after 30 seconds',
        };
      }

      logger.error({ tenantId, sessionId, error }, '[VertexAgent] Failed to send message');

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

    let response: Response;
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      response = await fetchWithTimeout(`${getTenantAgentUrl()}/run`, {
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
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(
          { tenantId, adkSessionId },
          '[VertexAgent] ADK retry request timed out after 30 seconds'
        );
        return {
          response: 'The request timed out. Please try again.',
          sessionId: dbSessionId,
          version: currentVersion,
          error: 'ADK agent request timed out after 30 seconds',
        };
      }
      throw error;
    }

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

    // Validate with Zod (Pitfall #56)
    const rawData = await response.json();
    const parseResult = AdkRunResponseSchema.safeParse(rawData);
    if (!parseResult.success) {
      logger.error(
        { tenantId, adkSessionId, error: parseResult.error.message },
        '[VertexAgent] Invalid ADK retry response format'
      );
      return {
        response: 'Sorry, I received an unexpected response format. Try again?',
        sessionId: dbSessionId,
        version: currentVersion,
        error: `Invalid ADK response format: ${parseResult.error.message}`,
      };
    }
    const data = parseResult.data;
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
      logger.info({ tenantId, sessionId }, '[VertexAgent] Session closed');
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Create a new session on ADK Cloud Run with full bootstrap context.
   * Returns the session ID if successful, null if failed.
   * @param requestId - Optional request ID for correlation
   */
  private async createADKSession(
    tenantId: string,
    userId: string,
    requestId?: string
  ): Promise<string | null> {
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const adkUserId = `${tenantId}:${userId}`;

      // Fetch bootstrap data for context injection (same as createSession)
      let bootstrap: BootstrapData | null = null;
      try {
        bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
        logger.info(
          { tenantId, forbiddenSlots: bootstrap.forbiddenSlots },
          '[VertexAgent] Bootstrap data loaded for ADK session retry'
        );
      } catch (error) {
        logger.warn(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[VertexAgent] Failed to load bootstrap data for retry, using tenantId only'
        );
      }

      // Build session state with full context (same structure as createSession)
      const sessionState = {
        tenantId,
        businessName: bootstrap?.businessName ?? null,
        slug: bootstrap?.slug ?? null,
        knownFacts: bootstrap?.discoveryFacts ?? {},
        forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
        storefrontState: bootstrap?.storefrontState ?? null,
        onboardingComplete: bootstrap?.onboardingComplete ?? false,
        onboardingPhase: bootstrap?.onboardingPhase ?? 'NOT_STARTED',
      };

      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(requestId && { 'X-Request-ID': requestId }),
          },
          body: JSON.stringify({ state: sessionState }),
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

      // Validate ADK response with Zod (Pitfall #56)
      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, userId, error: parseResult.error.message, rawResponse },
          '[VertexAgent] Invalid ADK session response format in retry'
        );
        return null;
      }
      logger.info(
        { tenantId, userId, adkSessionId: parseResult.data.id },
        '[VertexAgent] ADK session created in retry'
      );
      return parseResult.data.id;
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(
          { tenantId, userId },
          '[VertexAgent] ADK session creation timed out after 30 seconds'
        );
        return null;
      }
      logger.error({ tenantId, userId, error }, '[VertexAgent] Error creating ADK session');
      return null;
    }
  }

  /**
   * Extract the text response from A2A response format.
   * ADK returns an array of events: [{ content: { role, parts } }, ...]
   * Data is pre-validated by AdkRunResponseSchema (Pitfall #56)
   */
  private extractAgentResponse(data: AdkRunResponse): string {
    // ADK format: [{ content: { role: 'model', parts: [{ text: '...' }] } }]
    // Also support legacy format: { messages: [...] }

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
      // Handle object format with messages array (legacy)
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
   * Extract tool calls from A2A response format.
   * ADK returns an array of events: [{ content: { parts: [{ functionCall }] } }, ...]
   * Data is pre-validated by AdkRunResponseSchema (Pitfall #56)
   */
  private extractToolCalls(
    data: AdkRunResponse
  ): Array<{ name: string; args: Record<string, unknown>; result?: unknown }> {
    // Use the inferred part type from our schema
    type PartType = z.infer<typeof AdkPartSchema>;

    const allParts: PartType[] = [];

    // Handle array format (ADK standard)
    if (Array.isArray(data)) {
      for (const event of data) {
        if (event.content?.parts) {
          allParts.push(...event.content.parts);
        }
      }
    } else {
      // Handle legacy format with messages array
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
