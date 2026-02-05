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

import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { createSessionService, type SessionService, type SessionWithMessages } from './session';
import { TIER_LIMITS, isOverQuota, getRemainingMessages } from '../config/tiers';
import { cloudRunAuth } from './cloud-run-auth.service';

// =============================================================================
// ADK RESPONSE SCHEMAS (Pitfall #62: Runtime validation for external APIs)
// =============================================================================

const AdkSessionResponseSchema = z.object({
  id: z.string(),
});

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

const AdkContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(AdkPartSchema).optional(),
});

const AdkEventSchema = z.object({
  content: AdkContentSchema.optional(),
});

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
// FETCH WITH TIMEOUT
// =============================================================================

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

function _getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Set this in your .env file.`);
  }
  return value;
}

// Phase 4 Update: Unified customer-agent (booking + project-hub customer view)
function getCustomerAgentUrl(): string {
  const url = process.env.CUSTOMER_AGENT_URL;
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
    let adkSessionId: string;

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
      // Fallback to local session ID
      adkSessionId = `local:customer:${tenantId}:${Date.now()}`;
      logger.warn(
        { tenantId, adkSessionId, error },
        '[CustomerAgent] Using local session (ADK unreachable)'
      );
    }

    // Persist to database
    const dbSession = await this.sessionService.getOrCreateSession(
      tenantId,
      adkSessionId,
      'CUSTOMER',
      customerId
    );

    logger.info(
      { sessionId: dbSession.id, tenantId, customerId },
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

    logger.info(
      { tenantId, sessionId, messageLength: userMessage.length },
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
      // 4. Send to Booking Agent
      const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());
      const adkUserId = dbSession.customerId
        ? `${tenantId}:customer:${dbSession.customerId}`
        : `${tenantId}:anonymous`;

      const response = await fetchWithTimeout(`${getCustomerAgentUrl()}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          appName: 'agent',
          userId: adkUserId,
          sessionId: sessionId,
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
      const agentResponse = this.extractAgentResponse(data);
      const toolResults = this.extractToolCalls(data);

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
    const agentResponse = this.extractAgentResponse(data);
    const toolResults = this.extractToolCalls(data);

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

  private extractAgentResponse(data: AdkRunResponse): string {
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

    const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: unknown }> = [];
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

    for (const call of pendingCalls.values()) {
      toolCalls.push(call);
    }

    return toolCalls;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createCustomerAgentService(prisma: PrismaClient): CustomerAgentService {
  return new CustomerAgentService(prisma);
}
