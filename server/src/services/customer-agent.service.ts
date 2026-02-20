/**
 * Customer Agent Service
 *
 * Handles communication between customer chatbot and the unified Customer Agent.
 * Routes customer chat directly to the Customer Agent on Cloud Run.
 *
 * Architecture:
 * - Creates sessions scoped to tenant + customer
 * - Sends messages to Customer Agent via A2A protocol
 * - Persists sessions and messages to PostgreSQL via SessionService
 *
 * Security:
 * - All sessions are tenant-scoped
 * - Each customer gets isolated sessions
 * - Uses Google Cloud IAM for agent authentication
 *
 * Phase 4 Update (2026-01-31):
 * - Migrated from booking-agent to unified customer-agent
 * - Customer Agent now handles: booking, project-hub (customer view)
 * - Uses CUSTOMER_AGENT_URL instead of BOOKING_AGENT_URL
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import { createSessionService, type SessionService, type SessionWithMessages } from './session';
import { TIER_LIMITS, isOverQuota, getRemainingMessages } from '../config/tiers';
import { cloudRunAuth } from './cloud-run-auth.service';
import {
  AdkSessionResponseSchema,
  AdkRunResponseSchema,
  fetchWithTimeout,
  extractAgentResponse,
  extractToolCalls,
} from '../lib/adk-client';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Phase 4 Update: Unified customer-agent (booking + project-hub customer view)
function getCustomerAgentUrl(): string {
  const url = getConfig().CUSTOMER_AGENT_URL;
  if (!url) {
    throw new Error('Missing required environment variable: CUSTOMER_AGENT_URL');
  }
  return url;
}

// =============================================================================
// TYPES
// =============================================================================

export interface CustomerSession {
  sessionId: string;
  tenantId: string;
  customerId?: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  messages: Array<{ role: string; content: string }>;
}

export interface CustomerChatResponse {
  message: string;
  sessionId: string;
  toolResults?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  usage?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

// =============================================================================
// CUSTOMER AGENT SERVICE
// =============================================================================

export class CustomerAgentService {
  private sessionService: SessionService;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.sessionService = createSessionService(prisma);
  }

  /**
   * Get greeting message for customer chat
   */
  async getGreeting(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      return 'Hi! I can help you book an appointment. What are you looking for?';
    }

    return `Hi! I can help you book an appointment with ${tenant.name}. What are you looking for?`;
  }

  /**
   * Create a new customer session.
   * Each customer gets an isolated session (ARCH-2 security requirement).
   */
  async createSession(tenantId: string, customerId?: string): Promise<string> {
    // Create ADK session
    const adkUserId = customerId ? `${tenantId}:customer:${customerId}` : `${tenantId}:anonymous`;
    let adkSessionId: string | null = null;

    try {
      const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
      const response = await fetchWithTimeout(
        `${getCustomerAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ state: { tenantId, customerId } }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, status: response.status, error: errorText },
          '[CustomerAgent] Failed to create ADK session'
        );
        throw new Error(`ADK session creation failed: ${response.status}`);
      }

      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, error: parseResult.error.message },
          '[CustomerAgent] Invalid ADK session response'
        );
        throw new Error(`Invalid ADK session response: ${parseResult.error.message}`);
      }
      adkSessionId = parseResult.data.id;
      logger.info({ tenantId, adkSessionId }, '[CustomerAgent] ADK session created');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ tenantId }, '[CustomerAgent] ADK session creation timed out');
      }
      adkSessionId = null;
      logger.warn(
        { tenantId, error },
        '[CustomerAgent] ADK unreachable during createSession — storing null; chat() will trigger recovery'
      );
    }

    // Persist to database (creates new session with auto-generated CUID)
    const dbSession = await this.sessionService.getOrCreateSession(
      tenantId,
      null, // always create fresh — customer sessions are never resumed by ID
      'CUSTOMER',
      customerId
    );

    // Store adkSessionId on the session for later correlation.
    // CRITICAL: chat() must use this field for ADK calls, not the local CUID session ID.
    await this.prisma.agentSession.update({
      where: { id: dbSession.id },
      data: { adkSessionId },
    });

    logger.info(
      { sessionId: dbSession.id, tenantId, customerId, adkSessionId },
      '[CustomerAgent] Customer session created'
    );

    return dbSession.id;
  }

  /**
   * Get or create a customer session.
   * SECURITY: Always creates new isolated sessions for customers.
   */
  async getOrCreateSession(tenantId: string, customerId?: string): Promise<CustomerSession> {
    const sessionId = await this.createSession(tenantId, customerId);
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);

    if (!dbSession) {
      throw new Error('Failed to create session');
    }

    return this.toCustomerSession(dbSession);
  }

  /**
   * Get an existing session by ID.
   * Returns null if session doesn't exist or doesn't belong to tenant.
   */
  async getSession(tenantId: string, sessionId: string): Promise<CustomerSession | null> {
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!dbSession) {
      return null;
    }
    return this.toCustomerSession(dbSession);
  }

  /**
   * Send a message to the Booking Agent and get a response.
   * Includes AI quota checking for subscription limits.
   */
  async chat(
    tenantId: string,
    sessionId: string,
    userMessage: string
  ): Promise<CustomerChatResponse> {
    // 1. Check AI quota
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true, aiMessagesUsed: true, aiMessagesResetAt: true, name: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tier = (tenant.tier || 'FREE') as keyof typeof TIER_LIMITS;
    const limit = TIER_LIMITS[tier].aiMessages;
    const used = tenant.aiMessagesUsed || 0;

    if (isOverQuota(tier, used)) {
      logger.info({ tenantId, tier, used, limit }, '[CustomerAgent] AI quota exceeded');
      return {
        message: `You've used all ${limit} AI messages this month. Upgrade your plan to continue chatting.`,
        sessionId,
        usage: { used, limit, remaining: 0 },
      };
    }

    // 2. Get session
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);
    if (!dbSession) {
      throw new Error('Session not found');
    }

    // Get adkSessionId — CRITICAL: use this for ADK calls, not the local DB session ID.
    // The local CUID (sessionId) is unknown to the ADK; the ADK only tracks its own UUIDs.
    const sessionWithAdk = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { adkSessionId: true },
    });
    let adkSessionId = sessionWithAdk?.adkSessionId ?? null;
    // Sanitize legacy fallback values already in production DB (11023-B)
    if (adkSessionId?.startsWith('local:')) {
      logger.warn(
        { adkSessionId },
        '[CustomerAgent] Found local: fallback in DB — treating as null for recovery'
      );
      adkSessionId = null;
    }

    logger.info(
      { tenantId, sessionId, adkSessionId, messageLength: userMessage.length },
      '[CustomerAgent] Sending message'
    );

    // 3. Persist user message
    const userMsgResult = await this.sessionService.appendMessage(
      sessionId,
      tenantId,
      { role: 'user', content: userMessage },
      dbSession.version
    );

    if (!userMsgResult.success) {
      throw new Error(userMsgResult.error || 'Failed to save message');
    }

    const currentVersion = userMsgResult.newVersion!;

    try {
      // 4. Send to Customer Agent
      const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
      const adkUserId = dbSession.customerId
        ? `${tenantId}:customer:${dbSession.customerId}`
        : `${tenantId}:anonymous`;

      // If no adkSessionId, create a new ADK session before sending.
      // This handles sessions created before the adkSessionId fix was deployed.
      if (!adkSessionId) {
        logger.warn(
          { tenantId, sessionId },
          '[CustomerAgent] No adkSessionId found, creating new ADK session'
        );
        try {
          const sessionToken = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
          const sessionRes = await fetchWithTimeout(
            `${getCustomerAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
              },
              body: JSON.stringify({ state: { tenantId } }),
            }
          );
          if (sessionRes.ok) {
            const raw = await sessionRes.json();
            const parsed = AdkSessionResponseSchema.safeParse(raw);
            if (parsed.success) {
              adkSessionId = parsed.data.id;
              await this.prisma.agentSession.update({
                where: { id: sessionId },
                data: { adkSessionId },
              });
            }
          }
        } catch {
          // fall through — will get 404 and retry
        }
      }

      const response = await fetchWithTimeout(`${getCustomerAgentUrl()}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          appName: 'agent',
          userId: adkUserId,
          sessionId: adkSessionId ?? sessionId, // prefer ADK UUID; fall back for legacy sessions
          newMessage: {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle session not found - create new ADK session
        if (response.status === 404 && errorText.includes('Session not found')) {
          logger.info({ tenantId, sessionId }, '[CustomerAgent] Session not found, recreating');
          return this.retryWithNewADKSession(tenantId, sessionId, userMessage, currentVersion);
        }

        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[CustomerAgent] Agent error'
        );
        return {
          message: 'Sorry, I ran into an issue. Try again?',
          sessionId,
          usage: { used, limit, remaining: getRemainingMessages(tier, used) },
        };
      }

      // 5. Parse response
      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error(
          { tenantId, sessionId, error: parseResult.error.message },
          '[CustomerAgent] Invalid ADK response'
        );
        return {
          message: 'Sorry, I received an unexpected response. Try again?',
          sessionId,
          usage: { used, limit, remaining: getRemainingMessages(tier, used) },
        };
      }

      const data = parseResult.data;
      const agentResponse = extractAgentResponse(data);
      const toolResults = extractToolCalls(data);

      // 6. Persist agent response
      const schemaToolCalls =
        toolResults.length > 0
          ? toolResults.map((tc, idx) => ({
              id: `tc_${Date.now()}_${idx}`,
              name: tc.name,
              arguments: tc.args,
              result: tc.result,
            }))
          : undefined;

      await this.sessionService.appendMessage(
        sessionId,
        tenantId,
        { role: 'assistant', content: agentResponse, toolCalls: schemaToolCalls },
        currentVersion
      );

      // 7. Increment AI message counter
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { aiMessagesUsed: { increment: 1 } },
      });

      const newUsed = used + 1;
      logger.info(
        { tenantId, sessionId, responseLength: agentResponse.length },
        '[CustomerAgent] Response received'
      );

      return {
        message: agentResponse,
        sessionId,
        toolResults,
        usage: {
          used: newUsed,
          limit,
          remaining: getRemainingMessages(tier, newUsed),
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ tenantId, sessionId }, '[CustomerAgent] Request timed out');
        return {
          message: 'The request timed out. Please try again.',
          sessionId,
          usage: { used, limit, remaining: getRemainingMessages(tier, used) },
        };
      }

      logger.error({ tenantId, sessionId, error }, '[CustomerAgent] Failed to send message');
      return {
        message: 'Connection issue. Try again in a moment.',
        sessionId,
        usage: { used, limit, remaining: getRemainingMessages(tier, used) },
      };
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private toCustomerSession(dbSession: SessionWithMessages): CustomerSession {
    return {
      sessionId: dbSession.id,
      tenantId: dbSession.tenantId,
      customerId: dbSession.customerId || undefined,
      createdAt: dbSession.createdAt,
      lastMessageAt: dbSession.lastActivityAt,
      messageCount: dbSession.messages.length,
      messages: dbSession.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }

  private async retryWithNewADKSession(
    tenantId: string,
    dbSessionId: string,
    message: string,
    currentVersion: number
  ): Promise<CustomerChatResponse> {
    const dbSession = await this.sessionService.getSession(dbSessionId, tenantId);
    if (!dbSession) {
      throw new Error('Session not found');
    }

    // Create new ADK session
    const adkUserId = dbSession.customerId
      ? `${tenantId}:customer:${dbSession.customerId}`
      : `${tenantId}:anonymous`;
    let newAdkSessionId: string | null = null;

    try {
      const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
      const response = await fetchWithTimeout(
        `${getCustomerAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ state: { tenantId, customerId: dbSession.customerId } }),
        }
      );

      if (response.ok) {
        const rawResponse = await response.json();
        const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
        if (parseResult.success) {
          newAdkSessionId = parseResult.data.id;
          await this.prisma.agentSession.update({
            where: { id: dbSessionId },
            data: { adkSessionId: newAdkSessionId },
          });
          logger.info(
            { dbSessionId, newAdkSessionId },
            '[CustomerAgent] Persisted new ADK session ID after retry'
          );
        }
      }
    } catch {
      // Ignore errors, will return fallback response
    }

    if (!newAdkSessionId) {
      return {
        message: 'Sorry, I ran into an issue. Please try again.',
        sessionId: dbSessionId,
      };
    }

    // Retry with new session
    const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
    const response = await fetchWithTimeout(`${getCustomerAgentUrl()}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        appName: 'agent',
        userId: adkUserId,
        sessionId: newAdkSessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: message }],
        },
      }),
    });

    if (!response.ok) {
      return {
        message: 'Sorry, I ran into an issue. Try again?',
        sessionId: dbSessionId,
      };
    }

    const rawData = await response.json();
    const parseResult = AdkRunResponseSchema.safeParse(rawData);
    if (!parseResult.success) {
      return {
        message: 'Sorry, I received an unexpected response. Try again?',
        sessionId: dbSessionId,
      };
    }

    const data = parseResult.data;
    const agentResponse = extractAgentResponse(data);
    const toolResults = extractToolCalls(data);

    // Persist response
    const schemaToolCalls =
      toolResults.length > 0
        ? toolResults.map((tc, idx) => ({
            id: `tc_${Date.now()}_${idx}`,
            name: tc.name,
            arguments: tc.args,
            result: tc.result,
          }))
        : undefined;

    await this.sessionService.appendMessage(
      dbSessionId,
      tenantId,
      { role: 'assistant', content: agentResponse, toolCalls: schemaToolCalls },
      currentVersion
    );

    return {
      message: agentResponse,
      sessionId: dbSessionId,
      toolResults,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createCustomerAgentService(prisma: PrismaClient): CustomerAgentService {
  return new CustomerAgentService(prisma);
}
