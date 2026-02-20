/**
 * Tenant Admin Tenant Agent Routes
 *
 * Dashboard API endpoints for chatting with the unified Tenant Agent.
 * This is the canonical route file after the Concierge → Tenant Agent migration.
 *
 * The Tenant Agent consolidates:
 * - Concierge (routing)
 * - Storefront (website editing)
 * - Marketing (copy generation)
 * - Project Hub (project management)
 *
 * Endpoints:
 * - POST /session - Create a new ADK session with bootstrap context
 * - GET /session/:id - Get session history from ADK
 * - DELETE /session/:id - Close a session
 * - POST /chat - Send a message to the Tenant Agent
 * - GET /onboarding-state - Get onboarding phase and context
 * - POST /skip-onboarding - Skip the onboarding flow
 *
 * CRITICAL: Session creation injects forbiddenSlots to fix Pitfall #83
 * (Agent asking known questions). Context is injected at session start,
 * not inferred from conversation.
 *
 * @see docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import type { ContextBuilderService, BootstrapData } from '../services/context-builder.service';
import { cloudRunAuth } from '../services/cloud-run-auth.service';
import {
  AdkSessionResponseSchema,
  AdkSessionDataSchema,
  AdkRunResponseSchema,
  fetchWithTimeout,
  extractAgentResponse,
  extractToolCalls,
  extractDashboardActions,
  type AdkRunResponse,
} from '../lib/adk-client';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get the Tenant Agent Cloud Run URL.
 * Uses environment variable - no hardcoded fallbacks per Pitfall #34.
 */
function getTenantAgentUrl(): string {
  const envUrl = getConfig().TENANT_AGENT_URL;
  if (!envUrl) {
    throw new Error('TENANT_AGENT_URL environment variable is required');
  }
  return envUrl;
}

// =============================================================================
// REQUEST/RESPONSE SCHEMAS (Pitfall #56: Zod validation for runtime data)
// =============================================================================

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
});

const SessionIdSchema = z.object({
  id: z.string().min(1),
});

// AdkSessionResponseSchema, AdkSessionDataSchema, AdkRunResponseSchema imported from '../lib/adk-client'

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface TenantAgentRoutesDeps {
  prisma: PrismaClient;
  contextBuilder: ContextBuilderService;
  tenantOnboarding?: import('../services/tenant-onboarding.service').TenantOnboardingService;
}

/**
 * Create tenant admin routes for the unified Tenant Agent.
 *
 * @param deps - Dependencies (prisma, contextBuilder)
 * @returns Express router
 */
export function createTenantAdminTenantAgentRoutes(deps: TenantAgentRoutesDeps): Router {
  const router = Router();
  const { prisma, contextBuilder, tenantOnboarding } = deps;

  // ===========================================================================
  // POST /session - Create a new ADK session with bootstrap context
  // ===========================================================================
  // This is the P0 fix for Pitfall #83 (Agent asking known questions).
  // Context is injected at session creation, not inferred from conversation.
  // ===========================================================================

  router.post('/session', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = `${tenantId}:${slug}`;

      // =========================================================================
      // AGENT-FIRST ARCHITECTURE: Inject context at session creation
      // This is the P0 fix - agent now knows facts at session start
      // =========================================================================

      // Step 1: Fetch bootstrap data (discovery facts, storefront state, forbidden slots)
      let bootstrap: BootstrapData | null = null;
      try {
        bootstrap = await contextBuilder.getBootstrapData(tenantId);
        logger.info(
          {
            tenantId,
            businessName: bootstrap.businessName,
            factCount: Object.keys(bootstrap.discoveryFacts).length,
            forbiddenSlots: bootstrap.forbiddenSlots,
            onboardingComplete: bootstrap.onboardingComplete,
          },
          '[TenantAgent] Bootstrap data loaded for session'
        );
      } catch (error) {
        // Graceful degradation - create session without bootstrap
        logger.warn(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[TenantAgent] Failed to load bootstrap data, creating session with tenantId only'
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
        // Forbidden slots - enterprise slot-policy (Pitfall #83 fix)
        // Agent checks slot keys, not phrase matching
        forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
        // Storefront state summary
        storefrontState: bootstrap?.storefrontState ?? null,
        // Onboarding state
        onboardingComplete: bootstrap?.onboardingComplete ?? false,
        onboardingPhase: bootstrap?.onboardingPhase ?? 'NOT_STARTED',
      };

      // Step 3: Create session on ADK with full context
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const agentUrl = getTenantAgentUrl();

      // ADK app name is 'agent' (from /list-apps endpoint)
      const response = await fetchWithTimeout(
        `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          // ADK expects state wrapped: { state: { key: value } }
          // NOW INCLUDES: knownFacts, forbiddenSlots, storefrontState, etc.
          body: JSON.stringify({ state: sessionState }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, status: response.status, error: errorText },
          '[TenantAgent] Failed to create ADK session'
        );
        res.status(502).json({
          success: false,
          error: 'Agent temporarily unavailable',
          details: getConfig().NODE_ENV === 'development' ? errorText : undefined,
        });
        return;
      }

      // Validate ADK response with Zod (Pitfall #56)
      const rawResponse = await response.json();
      const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        logger.error(
          { tenantId, error: parseResult.error.message, rawResponse },
          '[TenantAgent] Invalid ADK session response format'
        );
        res.status(502).json({
          success: false,
          error: 'Invalid agent response format',
        });
        return;
      }

      const sessionId = parseResult.data.id;
      logger.info({ tenantId, sessionId }, '[TenantAgent] Session created');

      res.json({
        success: true,
        sessionId,
        version: 0, // New sessions start at version 0
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // GET /session/:id - Get session history from ADK
  // ===========================================================================

  router.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = `${tenantId}:${slug}`;

      // Fetch session from ADK
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
      const agentUrl = getTenantAgentUrl();

      const response = await fetchWithTimeout(
        `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
        15_000 // 15s timeout for reads
      );

      if (!response.ok) {
        if (response.status === 404) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
        const errorText = await response.text();
        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[TenantAgent] Failed to fetch session'
        );
        res.status(502).json({
          success: false,
          error: 'Agent temporarily unavailable',
        });
        return;
      }

      const rawSessionData = await response.json();

      // Validate ADK response with Zod (Pitfall #56)
      const sessionParseResult = AdkSessionDataSchema.safeParse(rawSessionData);
      if (!sessionParseResult.success) {
        logger.error(
          { tenantId, sessionId, error: sessionParseResult.error.message, rawSessionData },
          '[TenantAgent] Invalid ADK session response format'
        );
        res.status(502).json({
          success: false,
          error: 'Invalid agent session format',
        });
        return;
      }

      const sessionData = sessionParseResult.data;

      // Transform ADK session format to our API format
      // ADK returns: { id, userId, appName, state, events[] }
      const messages = extractMessagesFromEvents(sessionData.events || []);

      res.json({
        session: {
          sessionId: sessionData.id,
          createdAt: sessionData.createdAt || new Date().toISOString(),
          lastMessageAt: sessionData.updatedAt || new Date().toISOString(),
          messageCount: messages.length,
          version: 0, // ADK doesn't track versions - we use 0 for compatibility
        },
        messages,
        hasMore: false, // ADK doesn't paginate events
        total: messages.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // DELETE /session/:id - Close a session
  // ===========================================================================

  router.delete('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId } = SessionIdSchema.parse({ id: req.params.id });

      // Get tenant context from auth middleware
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // ADK doesn't have a session close endpoint - we just acknowledge the request
      // Sessions naturally expire based on ADK configuration
      logger.info({ tenantId, sessionId }, '[TenantAgent] Session close requested');

      res.json({
        success: true,
        message: 'Session closed',
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /chat - Send a message to the Tenant Agent
  // ===========================================================================
  // Fixed: Creates proper ADK session with bootstrap context when no sessionId
  // ===========================================================================

  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = SendMessageSchema.parse(req.body);

      // Get tenant context from auth middleware (res.locals.tenantAuth)
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string; slug: string } })
        .tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId, slug } = tenantAuth;
      const userId = `${tenantId}:${slug}`;

      logger.info({ tenantId, messageLength: message.length }, '[TenantAgent] Message received');

      // Get or create session
      let sessionId = providedSessionId;

      // Bootstrap data for context injection - hoisted for access later (P0 fix)
      let bootstrap: BootstrapData | null = null;

      if (!sessionId) {
        // =========================================================================
        // FIX: Create proper ADK session with bootstrap context
        // Previously used fake ID: `tenant-${tenantId}-${Date.now()}` (Pitfall #77)
        // =========================================================================

        // Step 1: Fetch bootstrap data
        try {
          bootstrap = await contextBuilder.getBootstrapData(tenantId);
        } catch (error) {
          logger.warn(
            { tenantId, error: error instanceof Error ? error.message : String(error) },
            '[TenantAgent] Failed to load bootstrap data for inline session'
          );
        }

        // Step 2: Build session state
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

        // Step 3: Create ADK session
        const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());
        const agentUrl = getTenantAgentUrl();

        try {
          const createResponse = await fetchWithTimeout(
            `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({ state: sessionState }),
            }
          );

          if (createResponse.ok) {
            const createData = await createResponse.json();
            const parseResult = AdkSessionResponseSchema.safeParse(createData);
            if (parseResult.success) {
              sessionId = parseResult.data.id;
              logger.info(
                { tenantId, sessionId },
                '[TenantAgent] Inline session created with bootstrap context'
              );
            }
          }
        } catch {
          // Fall through to use a fallback session ID
        }

        // Fallback if ADK session creation failed (shouldn't happen often)
        if (!sessionId) {
          sessionId = `LOCAL:tenant-${tenantId}-${Date.now()}`;
          logger.warn(
            { tenantId, sessionId },
            '[TenantAgent] Using fallback local session ID - ADK session creation failed'
          );
        }
      }

      // Get identity token for Cloud Run authentication (if in GCP environment)
      const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());

      // Call the Tenant Agent via A2A protocol
      const agentUrl = getTenantAgentUrl();
      logger.debug({ agentUrl, sessionId }, '[TenantAgent] Calling Tenant Agent');

      // =========================================================================
      // P0 FIX (Pitfall #83): Inject context directly into message
      // The LLM doesn't automatically see session state - we must prefix the
      // first message with forbiddenSlots so the agent knows what NOT to ask.
      // =========================================================================
      let messageWithContext = message;

      // On first message (newly created session), inject context prefix
      // This ensures the LLM sees the data, not just instructions about it
      if (!providedSessionId && bootstrap) {
        const contextPrefix = buildContextPrefix(bootstrap);
        if (contextPrefix) {
          messageWithContext = `${contextPrefix}\n\n${message}`;
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

      // 120s timeout: multi-tool agent turns (manage_tiers x3 + build_first_draft + update_section x3)
      // realistically take 20-45s. Matches Cloud Run max request timeout.
      const response = await fetchWithTimeout(
        `${agentUrl}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            // A2A protocol format (Pitfall #28 - must use camelCase)
            appName: 'agent',
            userId,
            sessionId,
            newMessage: {
              role: 'user',
              parts: [{ text: messageWithContext }],
            },
            // Pass tenant context in state for the agent to use
            state: {
              tenantId,
            },
          }),
        },
        120_000
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[TenantAgent] Agent call failed'
        );
        res.status(502).json({
          success: false,
          error: 'Agent temporarily unavailable',
          details: getConfig().NODE_ENV === 'development' ? errorText : undefined,
        });
        return;
      }

      // Parse ADK response (Pitfall #35 - handle both array and legacy formats)
      const rawData = await response.json();
      const parseResult = AdkRunResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error(
          { tenantId, sessionId, error: parseResult.error.message, rawData },
          '[TenantAgent] Invalid response format'
        );
        res.status(502).json({
          success: false,
          error: 'Invalid agent response format',
        });
        return;
      }

      // Extract text response from the last model message
      const agentResponse = extractAgentResponse(parseResult.data);
      const dashboardActions = extractDashboardActions(parseResult.data);
      const toolCalls = extractToolCalls(parseResult.data);

      logger.info(
        { tenantId, sessionId, responseLength: agentResponse.length },
        '[TenantAgent] Response received'
      );

      res.json({
        success: true,
        sessionId,
        version: 0, // Simplified version tracking for new system
        response: agentResponse,
        dashboardActions,
        toolCalls,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // GET /onboarding-state - Get current onboarding phase and context
  // ===========================================================================

  router.get('/onboarding-state', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // Use ContextBuilder for onboarding state
      const state = await contextBuilder.getOnboardingState(tenantId);

      logger.info(
        { tenantId, phase: state.phase, factCount: state.factCount },
        '[TenantAgent] Onboarding state retrieved'
      );

      res.json({
        phase: state.phase,
        isComplete: state.isComplete,
        isReturning: false, // Simplified: ContextBuilder doesn't track sessions
        lastActiveAt: null,
        revealCompleted: state.revealCompleted,
        summaries: {
          discovery: null,
          marketContext: null,
          preferences: null,
          decisions: null,
          pendingQuestions: null,
        },
        resumeMessage: null,
        // Provide discovery facts in a consistent format
        memory: {
          currentPhase: state.phase,
          discoveryData: state.discoveryFacts,
          marketResearchData: null,
          servicesData: null,
          marketingData: null,
          lastEventVersion: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /skip-onboarding - Skip the onboarding process
  // ===========================================================================

  router.post('/skip-onboarding', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      const { reason } = req.body as { reason?: string };

      if (!tenantOnboarding) {
        res.status(503).json({ error: 'Onboarding service unavailable' });
        return;
      }

      try {
        const result = await tenantOnboarding.skipOnboarding(tenantId);

        logger.info(
          { tenantId, previousPhase: result.previousPhase, reason },
          '[TenantAgent] Onboarding skipped'
        );

        res.json({
          success: true,
          phase: result.phase,
          message: 'Onboarding skipped. You can set up your business manually.',
        });
      } catch (serviceError) {
        const err = serviceError as Error & { phase?: string };
        if (err.message === 'Tenant not found') {
          res.status(404).json({ error: 'Tenant not found' });
          return;
        }
        if (err.message === 'Onboarding already finished') {
          res.status(409).json({ error: 'Onboarding already finished', phase: err.phase });
          return;
        }
        throw serviceError;
      }
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // POST /mark-reveal-completed - Frontend calls after reveal animation finishes
  // One-shot guard: only writes revealCompletedAt if not already set.
  // ===========================================================================

  router.post(
    '/mark-reveal-completed',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Tenant authentication required' });
          return;
        }

        const { tenantId } = tenantAuth;

        if (!tenantOnboarding) {
          res.status(503).json({ error: 'Onboarding service unavailable' });
          return;
        }

        try {
          const result = await tenantOnboarding.completeReveal(tenantId);

          if (!result.alreadyCompleted) {
            logger.info({ tenantId }, '[TenantAgent] revealCompletedAt written (frontend trigger)');
          }
          res.json({ success: true, alreadyCompleted: result.alreadyCompleted });
        } catch (serviceError) {
          if ((serviceError as Error).message === 'Tenant not found') {
            res.status(404).json({ success: false, error: 'Tenant not found' });
            return;
          }
          throw serviceError;
        }
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// extractAgentResponse, extractDashboardActions, extractToolCalls imported from '../lib/adk-client'

/**
 * Strip [SESSION CONTEXT]...[END CONTEXT] prefix injected by context injection.
 * The server injects this block into the first user message for the LLM to see,
 * but it should never be displayed in chat history.
 *
 * Uses indexOf (not regex) for guaranteed O(n) with no backtracking.
 */
function stripSessionContext(content: string): string {
  const startTag = '[SESSION CONTEXT]';
  const endTag = '[END CONTEXT]';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endTag, startIdx);
  if (endIdx === -1) return content; // Malformed — return as-is
  return content.slice(endIdx + endTag.length).trim();
}

/**
 * Extract messages from ADK session events.
 * Transforms ADK event format to our API message format.
 * Strips [SESSION CONTEXT] blocks from user messages (injected by context injection).
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

    // Strip context injection prefix from user messages
    if (role === 'user') {
      content = stripSessionContext(content);
    }

    if (content) {
      messages.push({
        role,
        content,
        timestamp: new Date(), // ADK doesn't provide timestamps in events
      });
    }
  }

  return messages;
}

/**
 * Build a context prefix to inject into the first message.
 *
 * This is the P0 fix for Pitfall #83 (Agent asking known questions).
 * The LLM doesn't automatically see session state, so we inject
 * forbiddenSlots directly into the message.
 *
 * Format is designed to be parseable by the system prompt instructions
 * in "Session State (Enterprise Slot-Policy)" section.
 *
 * @param bootstrap - Bootstrap data from ContextBuilder
 * @returns Context prefix string, or null if no context to inject
 */
function buildContextPrefix(bootstrap: BootstrapData): string | null {
  const parts: string[] = [];

  // Only inject if there's meaningful context
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
    return null; // New user with no context - no prefix needed
  }

  parts.push('[SESSION CONTEXT]');

  // Forbidden slots (what NOT to ask)
  if (hasForbidden) {
    parts.push(`forbiddenSlots: ${JSON.stringify(bootstrap.forbiddenSlots)}`);
  }

  // Known facts (what we already know)
  if (hasFacts) {
    // Format each fact on its own line for readability
    const factLines = Object.entries(bootstrap.discoveryFacts)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`);

    if (factLines.length > 0) {
      parts.push('knownFacts:');
      parts.push(...factLines);
    }
  }

  // Onboarding state
  parts.push(`onboardingComplete: ${bootstrap.onboardingComplete}`);
  if (bootstrap.onboardingPhase) {
    parts.push(`onboardingPhase: ${bootstrap.onboardingPhase}`);
  }

  // Business identity (for personalization)
  if (bootstrap.businessName) {
    parts.push(`businessName: ${JSON.stringify(bootstrap.businessName)}`);
  }

  // Brain dump (primary context for onboarding)
  if (bootstrap.brainDump) {
    parts.push(`brainDump: ${JSON.stringify(bootstrap.brainDump)}`);
  }
  // Location from signup
  if (bootstrap.city || bootstrap.state) {
    parts.push(`location: ${[bootstrap.city, bootstrap.state].filter(Boolean).join(', ')}`);
  }

  parts.push('[END CONTEXT]');

  return parts.join('\n');
}
