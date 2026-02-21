/**
 * Tenant Agent Service
 *
 * Handles communication between tenant dashboard chatbot and the Tenant Agent
 * on Cloud Run. Mirrors CustomerAgentService architecture but focused on
 * tenant editing workflows with PostgreSQL persistence.
 *
 * Architecture:
 * - Creates sessions scoped to tenant
 * - Sends messages to Tenant Agent via A2A protocol
 * - Persists sessions and messages to PostgreSQL via SessionService
 * - Cold start recovery via context summary injection
 *
 * Security:
 * - All sessions are tenant-scoped
 * - Messages encrypted at rest (AES-256-GCM via SessionService)
 * - Optimistic locking prevents concurrent message corruption
 *
 * @see docs/plans/2026-02-20-feat-tenant-agent-session-persistence-plan.md
 * @see server/src/services/customer-agent.service.ts (reference implementation)
 */

import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import { createSessionService, type SessionService } from './session';
import type { ContextBuilderService, BootstrapData } from './context-builder.service';
import { cloudRunAuth } from './cloud-run-auth.service';
import {
  AdkSessionResponseSchema,
  AdkSessionDataSchema,
  AdkRunResponseSchema,
  fetchWithTimeout,
  extractAgentResponse,
  extractToolCalls,
  extractDashboardActions,
  type AdkRunResponse,
  type DashboardAction,
} from '../lib/adk-client';

// =============================================================================
// CONFIGURATION
// =============================================================================

function getTenantAgentUrl(): string {
  const url = getConfig().TENANT_AGENT_URL;
  if (!url) {
    throw new Error('TENANT_AGENT_URL environment variable is required');
  }
  return url;
}

// =============================================================================
// TYPES
// =============================================================================

export interface TenantSession {
  sessionId: string;
  version: number;
}

export interface TenantChatResponse {
  message: string;
  sessionId: string;
  version: number;
  dashboardActions: DashboardAction[];
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface TenantSessionHistory {
  session: {
    sessionId: string;
    createdAt: string;
    lastMessageAt: string;
    messageCount: number;
    version: number;
  };
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  hasMore: boolean;
  total: number;
}

// =============================================================================
// TENANT AGENT SERVICE
// =============================================================================

export class TenantAgentService {
  private sessionService: SessionService;
  private prisma: PrismaClient;
  private contextBuilder: ContextBuilderService;

  constructor(prisma: PrismaClient, contextBuilder: ContextBuilderService) {
    this.prisma = prisma;
    this.contextBuilder = contextBuilder;
    this.sessionService = createSessionService(prisma);
  }

  /**
   * Create a new tenant agent session with bootstrap context injection.
   *
   * Flow:
   * 1. Load bootstrap data (discovery facts, storefront state, forbidden slots)
   * 2. Create ADK session with full context state
   * 3. Create PostgreSQL session for persistence
   * 4. Link ADK session ID to PostgreSQL session
   */
  async createSession(tenantId: string, slug: string): Promise<TenantSession> {
    const userId = `${tenantId}:${slug}`;

    // Step 1: Fetch bootstrap data for context injection (Pitfall #83 fix)
    let bootstrap: BootstrapData | null = null;
    try {
      bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
      logger.info(
        {
          tenantId,
          businessName: bootstrap.businessName,
          factCount: Object.keys(bootstrap.discoveryFacts).length,
          forbiddenSlots: bootstrap.forbiddenSlots,
        },
        '[TenantAgent] Bootstrap data loaded for session'
      );
    } catch (error) {
      logger.warn(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[TenantAgent] Failed to load bootstrap data, creating session with tenantId only'
      );
    }

    // Step 2: Build ADK session state
    const sessionState = {
      tenantId,
      businessName: bootstrap?.businessName ?? null,
      slug: bootstrap?.slug ?? null,
      knownFacts: bootstrap?.discoveryFacts ?? {},
      forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
      storefrontState: bootstrap?.storefrontState ?? null,
      onboardingComplete: bootstrap?.onboardingComplete ?? false,
      onboardingStatus: bootstrap?.onboardingStatus ?? 'PENDING_PAYMENT',
    };

    // Step 3: Create ADK session
    let adkSessionId: string | null = null;
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ state: sessionState }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, status: response.status, error: errorText },
          '[TenantAgent] Failed to create ADK session'
        );
        throw new Error(`ADK session creation failed: ${response.status}`);
      }

      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, error: parseResult.error.message },
          '[TenantAgent] Invalid ADK session response'
        );
        throw new Error(`Invalid ADK session response: ${parseResult.error.message}`);
      }
      adkSessionId = parseResult.data.id;
      logger.info({ tenantId, adkSessionId }, '[TenantAgent] ADK session created');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ tenantId }, '[TenantAgent] ADK session creation timed out');
      }
      adkSessionId = null;
      logger.warn(
        { tenantId, error },
        '[TenantAgent] ADK unreachable during createSession — storing null; chat() will trigger recovery'
      );
    }

    // Step 4: Persist to PostgreSQL
    const dbSession = await this.sessionService.getOrCreateSession(
      tenantId,
      null, // always create fresh
      'ADMIN'
    );

    // Step 5: Link ADK session ID for later correlation
    await this.prisma.agentSession.update({
      where: { id: dbSession.id },
      data: { adkSessionId },
    });

    logger.info(
      { sessionId: dbSession.id, tenantId, adkSessionId },
      '[TenantAgent] Session created with PostgreSQL persistence'
    );

    return { sessionId: dbSession.id, version: dbSession.version };
  }

  /**
   * Send a message to the Tenant Agent and persist both sides.
   *
   * Flow:
   * 1. Load or create session (graceful migration from localStorage)
   * 2. Inject context prefix on first message
   * 3. Persist user message with optimistic locking
   * 4. Call ADK /run
   * 5. On 404 → cold start recovery
   * 6. Parse response, extract dashboard actions
   * 7. Persist assistant message
   */
  async chat(
    tenantId: string,
    slug: string,
    userMessage: string,
    sessionId?: string,
    _version?: number
  ): Promise<TenantChatResponse> {
    const userId = `${tenantId}:${slug}`;
    let isNewSession = false;

    // Step 1: Get or create session
    let dbSessionId = sessionId;
    let bootstrap: BootstrapData | null = null;

    if (!dbSessionId) {
      // No session provided — create one (handles localStorage migration)
      const session = await this.createSession(tenantId, slug);
      dbSessionId = session.sessionId;
      isNewSession = true;

      // Load bootstrap for context injection
      try {
        bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
      } catch (error) {
        logger.warn(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[TenantAgent] Failed to load bootstrap for context prefix'
        );
      }
    }

    // Verify session exists in PostgreSQL
    const dbSession = await this.sessionService.getSession(dbSessionId, tenantId);
    if (!dbSession) {
      // Session not found — graceful migration (create new)
      logger.info(
        { tenantId, sessionId: dbSessionId },
        '[TenantAgent] Session not found in PostgreSQL, creating new'
      );
      const newSession = await this.createSession(tenantId, slug);
      dbSessionId = newSession.sessionId;
      isNewSession = true;

      // Load bootstrap for context injection
      try {
        bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
      } catch {
        // Non-fatal
      }

      // Re-fetch the newly created session
      const freshSession = await this.sessionService.getSession(dbSessionId, tenantId);
      if (!freshSession) {
        throw new Error('Failed to create session');
      }
    }

    // Get ADK session ID
    const sessionRow = await this.prisma.agentSession.findUnique({
      where: { id: dbSessionId },
      select: { adkSessionId: true, version: true },
    });
    let adkSessionId = sessionRow?.adkSessionId ?? null;
    const currentDbVersion = sessionRow?.version ?? 0;

    // Step 2: Build message with context prefix (first message only)
    let messageWithContext = userMessage;
    if (isNewSession && bootstrap) {
      const contextPrefix = buildContextPrefix(bootstrap);
      if (contextPrefix) {
        messageWithContext = `${contextPrefix}\n\n${userMessage}`;
        logger.info(
          {
            tenantId,
            forbiddenSlots: bootstrap.forbiddenSlots,
            factCount: Object.keys(bootstrap.discoveryFacts).length,
          },
          '[TenantAgent] Injected context prefix into first message'
        );
      }
    }

    // Step 3: Persist user message
    const userMsgResult = await this.sessionService.appendMessage(
      dbSessionId,
      tenantId,
      { role: 'user', content: userMessage }, // Store without context prefix (display-clean)
      currentDbVersion
    );
    if (!userMsgResult.success) {
      throw new Error(userMsgResult.error || 'Failed to save user message');
    }
    const currentVersion = userMsgResult.newVersion!;

    // Step 4: Create ADK session if missing
    if (!adkSessionId) {
      adkSessionId = await this.createAdkSession(tenantId, slug, userId);
      if (adkSessionId) {
        await this.prisma.agentSession.update({
          where: { id: dbSessionId },
          data: { adkSessionId },
        });
      }
    }

    try {
      // Step 5: Call ADK /run
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            appName: 'agent',
            userId,
            sessionId: adkSessionId ?? dbSessionId,
            newMessage: {
              role: 'user',
              parts: [{ text: messageWithContext }],
            },
            state: { tenantId },
          }),
        },
        120_000 // 120s: multi-tool agent turns
      );

      if (!response.ok) {
        const errorText = await response.text();

        // Handle session not found — cold start recovery
        if (response.status === 404 && errorText.includes('Session not found')) {
          logger.info(
            { tenantId, sessionId: dbSessionId },
            '[TenantAgent] ADK session not found, triggering recovery'
          );
          return this.recoverSession(tenantId, slug, dbSessionId, userMessage, currentVersion);
        }

        logger.error(
          { tenantId, sessionId: dbSessionId, status: response.status, error: errorText },
          '[TenantAgent] Agent call failed'
        );
        return {
          message: 'Agent temporarily unavailable. Try again in a moment.',
          sessionId: dbSessionId,
          version: currentVersion,
          dashboardActions: [],
        };
      }

      // Step 6: Parse response
      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error(
          { tenantId, sessionId: dbSessionId, error: parseResult.error.message },
          '[TenantAgent] Invalid ADK response format'
        );
        return {
          message: 'Received an unexpected response. Try again?',
          sessionId: dbSessionId,
          version: currentVersion,
          dashboardActions: [],
        };
      }

      const data = parseResult.data;
      const agentResponse = extractAgentResponse(data);
      const dashboardActions = extractDashboardActions(data);
      const toolResults = extractToolCalls(data);

      // Step 7: Persist assistant message
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

      logger.info(
        { tenantId, sessionId: dbSessionId, responseLength: agentResponse.length },
        '[TenantAgent] Response received and persisted'
      );

      return {
        message: agentResponse,
        sessionId: dbSessionId,
        version: currentVersion + 1,
        dashboardActions,
        toolCalls: toolResults,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ tenantId, sessionId: dbSessionId }, '[TenantAgent] Request timed out');
        return {
          message: 'The request timed out. Please try again.',
          sessionId: dbSessionId,
          version: currentVersion,
          dashboardActions: [],
        };
      }

      logger.error(
        { tenantId, sessionId: dbSessionId, error },
        '[TenantAgent] Failed to send message'
      );
      return {
        message: 'Connection issue. Try again in a moment.',
        sessionId: dbSessionId,
        version: currentVersion,
        dashboardActions: [],
      };
    }
  }

  /**
   * Get session history from PostgreSQL (primary) with ADK fallback.
   */
  async getSessionHistory(
    tenantId: string,
    slug: string,
    sessionId: string
  ): Promise<TenantSessionHistory> {
    // Primary: load from PostgreSQL
    const dbSession = await this.sessionService.getSession(sessionId, tenantId);

    if (dbSession) {
      const messages = dbSession.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: stripSessionContext(m.content),
        timestamp: m.createdAt,
      }));

      return {
        session: {
          sessionId: dbSession.id,
          createdAt: dbSession.createdAt.toISOString(),
          lastMessageAt: dbSession.lastActivityAt.toISOString(),
          messageCount: messages.length,
          version: dbSession.version,
        },
        messages,
        hasMore: false,
        total: messages.length,
      };
    }

    // Fallback: try ADK directly (legacy sessions not yet in PostgreSQL)
    return this.getSessionHistoryFromAdk(tenantId, slug, sessionId);
  }

  /**
   * Cold start recovery.
   *
   * When an ADK session 404s (Cloud Run cold start wiped InMemorySessionService):
   * 1. Load last ~10 messages from PostgreSQL
   * 2. Build context summary from messages + storefront state
   * 3. Create new ADK session with summary injected as state
   * 4. Update adkSessionId on PostgreSQL session
   * 5. Retry the user's message
   */
  async recoverSession(
    tenantId: string,
    slug: string,
    dbSessionId: string,
    userMessage: string,
    currentVersion: number
  ): Promise<TenantChatResponse> {
    const userId = `${tenantId}:${slug}`;
    logger.info({ tenantId, sessionId: dbSessionId }, '[TenantAgent] Starting cold start recovery');

    // Step 1: Build context summary from PostgreSQL + storefront state
    const contextSummary = await this.buildContextSummary(tenantId, dbSessionId);

    // Step 2: Load bootstrap for session state
    let bootstrap: BootstrapData | null = null;
    try {
      bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
    } catch {
      // Non-fatal, proceed with summary only
    }

    // Step 3: Create new ADK session with recovery context
    const sessionState = {
      tenantId,
      businessName: bootstrap?.businessName ?? null,
      slug: bootstrap?.slug ?? null,
      knownFacts: bootstrap?.discoveryFacts ?? {},
      forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
      storefrontState: bootstrap?.storefrontState ?? null,
      onboardingComplete: bootstrap?.onboardingComplete ?? false,
      onboardingStatus: bootstrap?.onboardingStatus ?? 'PENDING_PAYMENT',
      // Injected recovery context
      recoveryContext: contextSummary,
    };

    let newAdkSessionId: string | null = null;
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ state: sessionState }),
        }
      );

      if (response.ok) {
        const raw = await response.json();
        const parsed = AdkSessionResponseSchema.safeParse(raw);
        if (parsed.success) {
          newAdkSessionId = parsed.data.id;
          await this.prisma.agentSession.update({
            where: { id: dbSessionId },
            data: { adkSessionId: newAdkSessionId },
          });
          logger.info(
            { tenantId, newAdkSessionId },
            '[TenantAgent] Recovery: new ADK session created'
          );
        }
      }
    } catch {
      // Will return fallback response
    }

    if (!newAdkSessionId) {
      logger.error(
        { tenantId, sessionId: dbSessionId },
        '[TenantAgent] Recovery failed: could not create new ADK session'
      );
      return {
        message: 'I had a brief interruption. Please try again.',
        sessionId: dbSessionId,
        version: currentVersion,
        dashboardActions: [],
      };
    }

    // Step 4: Inject context summary + retry message
    let retryMessage = userMessage;
    if (contextSummary) {
      retryMessage = `[SESSION CONTEXT]\n${contextSummary}\n[END CONTEXT]\n\n${userMessage}`;
    } else if (bootstrap) {
      const prefix = buildContextPrefix(bootstrap);
      if (prefix) {
        retryMessage = `${prefix}\n\n${userMessage}`;
      }
    }

    // Step 5: Retry the message on the new session
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            appName: 'agent',
            userId,
            sessionId: newAdkSessionId,
            newMessage: {
              role: 'user',
              parts: [{ text: retryMessage }],
            },
            state: { tenantId },
          }),
        },
        120_000
      );

      if (!response.ok) {
        return {
          message: 'I had a brief interruption. Please try sending your message again.',
          sessionId: dbSessionId,
          version: currentVersion,
          dashboardActions: [],
        };
      }

      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        return {
          message: 'Received an unexpected response after recovery. Try again?',
          sessionId: dbSessionId,
          version: currentVersion,
          dashboardActions: [],
        };
      }

      const data = parseResult.data;
      const agentResponse = extractAgentResponse(data);
      const dashboardActions = extractDashboardActions(data);
      const toolResults = extractToolCalls(data);

      // Persist assistant response
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

      logger.info(
        { tenantId, sessionId: dbSessionId },
        '[TenantAgent] Recovery successful — session restored'
      );

      return {
        message: agentResponse,
        sessionId: dbSessionId,
        version: currentVersion + 1,
        dashboardActions,
        toolCalls: toolResults,
      };
    } catch {
      return {
        message: 'Connection issue during recovery. Try again in a moment.',
        sessionId: dbSessionId,
        version: currentVersion,
        dashboardActions: [],
      };
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Build context summary for cold start recovery.
   *
   * Loads last ~10 messages from PostgreSQL + current storefront state.
   * Produces a concise summary for ADK session re-creation.
   */
  private async buildContextSummary(tenantId: string, sessionId: string): Promise<string | null> {
    try {
      // Load recent messages
      const history = await this.sessionService.getSessionHistory(sessionId, tenantId, 10, 0);
      if (history.messages.length === 0) return null;

      // Load current storefront state
      let bootstrap: BootstrapData | null = null;
      try {
        bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
      } catch {
        // Non-fatal
      }

      const parts: string[] = ['Previous conversation summary:'];

      // Business identity
      if (bootstrap?.businessName) {
        parts.push(`- Business: ${bootstrap.businessName}`);
      }

      // Onboarding state
      if (bootstrap?.onboardingComplete) {
        parts.push('- Onboarding: COMPLETED');
      } else if (bootstrap?.onboardingStatus) {
        parts.push(`- Onboarding: ${bootstrap.onboardingStatus}`);
      }

      // Storefront state
      if (bootstrap?.storefrontState) {
        const sf = bootstrap.storefrontState;
        parts.push(
          `- Storefront: ${sf.completion}% complete, ${sf.hasDraft ? 'has drafts' : 'no drafts'}`
        );
      }

      // Recent conversation topics (extract from messages)
      const recentTopics: string[] = [];
      for (const msg of history.messages) {
        const cleaned = stripSessionContext(msg.content);
        if (cleaned.length > 0) {
          // Take first 80 chars of each message as a topic hint
          recentTopics.push(cleaned.slice(0, 80).trim());
        }
      }
      if (recentTopics.length > 0) {
        parts.push(`- Recent topics: ${recentTopics.slice(0, 5).join('; ')}`);
      }

      // Last message for immediate context
      const lastMsg = history.messages[history.messages.length - 1];
      if (lastMsg) {
        const cleaned = stripSessionContext(lastMsg.content);
        parts.push(`- Last message (${lastMsg.role}): ${cleaned.slice(0, 120).trim()}`);
      }

      return parts.join('\n');
    } catch (error) {
      logger.warn(
        { tenantId, sessionId, error: error instanceof Error ? error.message : String(error) },
        '[TenantAgent] Failed to build context summary, falling back to bootstrap-only'
      );
      return null;
    }
  }

  /**
   * Create an ADK session (without PostgreSQL — used for recovery/retry).
   */
  private async createAdkSession(
    tenantId: string,
    slug: string,
    userId: string
  ): Promise<string | null> {
    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ state: { tenantId, slug } }),
        }
      );

      if (response.ok) {
        const raw = await response.json();
        const parsed = AdkSessionResponseSchema.safeParse(raw);
        if (parsed.success) return parsed.data.id;
      }
    } catch {
      // Non-fatal
    }
    return null;
  }

  /**
   * Get session history from ADK directly (legacy fallback).
   */
  private async getSessionHistoryFromAdk(
    tenantId: string,
    slug: string,
    sessionId: string
  ): Promise<TenantSessionHistory> {
    const userId = `${tenantId}:${slug}`;

    try {
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const response = await fetchWithTimeout(
        `${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
        15_000
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Session not found');
        }
        throw new Error(`ADK session fetch failed: ${response.status}`);
      }

      const rawData = await response.json();
      const parseResult = AdkSessionDataSchema.safeParse(rawData);
      if (!parseResult.success) {
        throw new Error(`Invalid ADK session format: ${parseResult.error.message}`);
      }

      const sessionData = parseResult.data;
      const messages = extractMessagesFromEvents(sessionData.events || []);

      return {
        session: {
          sessionId: sessionData.id,
          createdAt: sessionData.createdAt || new Date().toISOString(),
          lastMessageAt: sessionData.updatedAt || new Date().toISOString(),
          messageCount: messages.length,
          version: 0,
        },
        messages,
        hasMore: false,
        total: messages.length,
      };
    } catch (error) {
      logger.error(
        { tenantId, sessionId, error: error instanceof Error ? error.message : String(error) },
        '[TenantAgent] Failed to fetch session from ADK'
      );
      throw error;
    }
  }
}

// =============================================================================
// STANDALONE HELPERS (used by both service and route)
// =============================================================================

/**
 * Strip [SESSION CONTEXT]...[END CONTEXT] prefix from messages.
 * Uses indexOf (not regex) for guaranteed O(n) with no backtracking.
 */
export function stripSessionContext(content: string): string {
  const startTag = '[SESSION CONTEXT]';
  const endTag = '[END CONTEXT]';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endTag, startIdx);
  if (endIdx === -1) return content; // Malformed — return as-is
  return content.slice(endIdx + endTag.length).trim();
}

/**
 * Build context prefix for first message injection.
 * Formats bootstrap data as [SESSION CONTEXT]...[END CONTEXT] block.
 */
export function buildContextPrefix(bootstrap: BootstrapData): string | null {
  const parts: string[] = [];

  const hasFacts = Object.keys(bootstrap.discoveryFacts).length > 0;
  const hasForbidden = bootstrap.forbiddenSlots.length > 0;

  if (
    !hasFacts &&
    !hasForbidden &&
    !bootstrap.onboardingComplete &&
    !bootstrap.brainDump &&
    !bootstrap.city &&
    !bootstrap.state
  ) {
    return null;
  }

  parts.push('[SESSION CONTEXT]');

  if (hasForbidden) {
    parts.push(`forbiddenSlots: ${JSON.stringify(bootstrap.forbiddenSlots)}`);
  }

  if (hasFacts) {
    const factLines = Object.entries(bootstrap.discoveryFacts)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`);

    if (factLines.length > 0) {
      parts.push('knownFacts:');
      parts.push(...factLines);
    }
  }

  parts.push(`onboardingComplete: ${bootstrap.onboardingComplete}`);
  if (bootstrap.onboardingStatus) {
    parts.push(`onboardingStatus: ${bootstrap.onboardingStatus}`);
  }

  if (bootstrap.businessName) {
    parts.push(`businessName: ${JSON.stringify(bootstrap.businessName)}`);
  }

  if (bootstrap.brainDump) {
    parts.push(`brainDump: ${JSON.stringify(bootstrap.brainDump)}`);
  }
  if (bootstrap.city || bootstrap.state) {
    parts.push(`location: ${[bootstrap.city, bootstrap.state].filter(Boolean).join(', ')}`);
  }

  parts.push('[END CONTEXT]');

  return parts.join('\n');
}

/**
 * Extract messages from ADK session events.
 * Strips [SESSION CONTEXT] blocks from user messages.
 */
function extractMessagesFromEvents(
  events: Array<{ content?: { role?: string; parts?: Array<{ text?: string }> } }>
): Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];

  for (const event of events) {
    if (!event.content || !event.content.role || !event.content.parts) continue;

    const role = event.content.role === 'user' ? 'user' : 'assistant';
    let content = event.content.parts
      .filter((p) => p.text)
      .map((p) => p.text)
      .join('');

    if (role === 'user') {
      content = stripSessionContext(content);
    }

    if (content) {
      messages.push({ role, content, timestamp: new Date() });
    }
  }

  return messages;
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTenantAgentService(
  prisma: PrismaClient,
  contextBuilder: ContextBuilderService
): TenantAgentService {
  return new TenantAgentService(prisma, contextBuilder);
}
