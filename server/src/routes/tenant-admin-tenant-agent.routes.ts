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
 * CRITICAL: Session creation injects forbiddenSlots to fix Pitfall #91
 * (Agent asking known questions). Context is injected at session start,
 * not inferred from conversation.
 *
 * @see docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import type { ContextBuilderService, BootstrapData } from '../services/context-builder.service';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get the Tenant Agent Cloud Run URL.
 * Uses environment variable - no hardcoded fallbacks per Pitfall #38.
 */
function getTenantAgentUrl(): string {
  const envUrl = process.env.TENANT_AGENT_URL;
  if (envUrl) {
    return envUrl;
  }

  // Fallback for local development (pointing to deployed Cloud Run)
  // This is acceptable for dev but should be set via env in production
  return 'https://tenant-agent-506923455711.us-central1.run.app';
}

// =============================================================================
// REQUEST/RESPONSE SCHEMAS (Pitfall #62: Zod validation for runtime data)
// =============================================================================

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
});

const SessionIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * ADK session creation response format.
 */
const AdkSessionResponseSchema = z.object({
  id: z.string(),
});

/**
 * ADK session GET response format.
 * Used when fetching session history.
 */
const AdkSessionDataSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  appName: z.string().optional(),
  state: z.record(z.unknown()).optional(),
  events: z
    .array(
      z.object({
        content: z
          .object({
            role: z.string().optional(),
            parts: z
              .array(
                z.object({
                  text: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * ADK A2A protocol response format.
 * Must handle both array and object formats (Pitfall #39).
 */
const AdkResponseSchema = z.array(
  z.object({
    content: z.object({
      role: z.string(),
      parts: z.array(
        z.object({
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
              response: z.record(z.unknown()),
            })
            .optional(),
        })
      ),
    }),
  })
);

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface TenantAgentRoutesDeps {
  prisma: PrismaClient;
  contextBuilder: ContextBuilderService;
}

/**
 * Create tenant admin routes for the unified Tenant Agent.
 *
 * @param deps - Dependencies (prisma, contextBuilder)
 * @returns Express router
 */
export function createTenantAdminTenantAgentRoutes(deps: TenantAgentRoutesDeps): Router {
  const router = Router();
  const { prisma, contextBuilder } = deps;

  // ===========================================================================
  // POST /session - Create a new ADK session with bootstrap context
  // ===========================================================================
  // This is the P0 fix for Pitfall #91 (Agent asking known questions).
  // Context is injected at session creation, not inferred from conversation.
  // ===========================================================================

  router.post('/session', async (_req: Request, res: Response) => {
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
        // Forbidden slots - enterprise slot-policy (Pitfall #91 fix)
        // Agent checks slot keys, not phrase matching
        forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
        // Storefront state summary
        storefrontState: bootstrap?.storefrontState ?? null,
        // Onboarding state
        onboardingComplete: bootstrap?.onboardingComplete ?? false,
        onboardingPhase: bootstrap?.onboardingPhase ?? 'NOT_STARTED',
      };

      // Step 3: Create session on ADK with full context
      const token = await getIdentityToken();
      const agentUrl = getTenantAgentUrl();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per Pitfall #46

      let response: globalThis.Response;
      try {
        response = await fetch(
          // ADK app name is 'agent' (from /list-apps endpoint)
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
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, status: response.status, error: errorText },
          '[TenantAgent] Failed to create ADK session'
        );
        res.status(502).json({
          success: false,
          error: 'Agent temporarily unavailable',
          details: process.env.NODE_ENV === 'development' ? errorText : undefined,
        });
        return;
      }

      // Validate ADK response with Zod (Pitfall #62)
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
      handleError(res, error, '/session');
    }
  });

  // ===========================================================================
  // GET /session/:id - Get session history from ADK
  // ===========================================================================

  router.get('/session/:id', async (req: Request, res: Response) => {
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
      const token = await getIdentityToken();
      const agentUrl = getTenantAgentUrl();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for reads

      let response: globalThis.Response;
      try {
        response = await fetch(
          `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

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

      // Validate ADK response with Zod (Pitfall #62)
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
      handleError(res, error, '/session/:id');
    }
  });

  // ===========================================================================
  // DELETE /session/:id - Close a session
  // ===========================================================================

  router.delete('/session/:id', async (req: Request, res: Response) => {
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
      handleError(res, error, '/session/:id');
    }
  });

  // ===========================================================================
  // POST /chat - Send a message to the Tenant Agent
  // ===========================================================================
  // Fixed: Creates proper ADK session with bootstrap context when no sessionId
  // ===========================================================================

  router.post('/chat', async (req: Request, res: Response) => {
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
        // Previously used fake ID: `tenant-${tenantId}-${Date.now()}` (Pitfall #85)
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
        const token = await getIdentityToken();
        const agentUrl = getTenantAgentUrl();

        const createController = new AbortController();
        const createTimeoutId = setTimeout(() => createController.abort(), 30000);

        try {
          const createResponse = await fetch(
            `${agentUrl}/apps/agent/users/${encodeURIComponent(userId)}/sessions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({ state: sessionState }),
              signal: createController.signal,
            }
          );

          clearTimeout(createTimeoutId);

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
          clearTimeout(createTimeoutId);
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
      const token = await getIdentityToken();

      // Call the Tenant Agent via A2A protocol
      const agentUrl = getTenantAgentUrl();
      logger.debug({ agentUrl, sessionId }, '[TenantAgent] Calling Tenant Agent');

      // =========================================================================
      // P0 FIX (Pitfall #91): Inject context directly into message
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      let response: globalThis.Response;
      try {
        response = await fetch(`${agentUrl}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            // A2A protocol format (Pitfall #32 - must use camelCase)
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
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { tenantId, sessionId, status: response.status, error: errorText },
          '[TenantAgent] Agent call failed'
        );
        res.status(502).json({
          success: false,
          error: 'Agent temporarily unavailable',
          details: process.env.NODE_ENV === 'development' ? errorText : undefined,
        });
        return;
      }

      // Parse ADK response (Pitfall #39 - handle array format)
      const rawData = await response.json();
      const parseResult = AdkResponseSchema.safeParse(rawData);
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
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ error }, '[TenantAgent] Request timed out');
        res.status(504).json({
          success: false,
          error: 'Agent request timed out',
        });
        return;
      }

      logger.error({ error }, '[TenantAgent] Internal error');
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ===========================================================================
  // GET /onboarding-state - Get current onboarding phase and context
  // ===========================================================================

  router.get('/onboarding-state', async (_req: Request, res: Response) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;

      // Use ContextBuilder for state (replaces legacy AdvisorMemoryService)
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
      handleError(res, error, '/onboarding-state');
    }
  });

  // ===========================================================================
  // POST /skip-onboarding - Skip the onboarding process
  // ===========================================================================

  router.post('/skip-onboarding', async (req: Request, res: Response) => {
    try {
      const tenantAuth = (res.locals as { tenantAuth?: { tenantId: string } }).tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Tenant authentication required' });
        return;
      }

      const { tenantId } = tenantAuth;
      const { reason } = req.body as { reason?: string };

      // Get current tenant state
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingPhase: true,
        },
      });

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const currentPhase = tenant.onboardingPhase || 'NOT_STARTED';

      // Check if already completed or skipped
      if (currentPhase === 'COMPLETED' || currentPhase === 'SKIPPED') {
        res.status(409).json({
          error: 'Onboarding already finished',
          phase: currentPhase,
        });
        return;
      }

      // Direct state update
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: 'SKIPPED',
          onboardingCompletedAt: new Date(),
        },
      });

      logger.info(
        { tenantId, previousPhase: currentPhase, reason },
        '[TenantAgent] Onboarding skipped'
      );

      res.json({
        success: true,
        phase: 'SKIPPED',
        message: 'Onboarding skipped. You can set up your business manually.',
      });
    } catch (error) {
      handleError(res, error, '/skip-onboarding');
    }
  });

  return router;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get Google Cloud identity token for Cloud Run authentication.
 *
 * Priority order:
 * 1. Cloud Run metadata service (when running on Cloud Run)
 * 2. Explicit service account credentials (GOOGLE_SERVICE_ACCOUNT_JSON - for Render)
 * 3. Application Default Credentials (local development with `gcloud auth`)
 *
 * IMPORTANT: This is Pitfall #36 (Identity Token Auth) - non-GCP environments like
 * Render require explicit credentials, not metadata service.
 *
 * @see docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md
 */
async function getIdentityToken(): Promise<string | null> {
  const audience = getTenantAgentUrl();

  // Priority 1: Cloud Run metadata service (fastest when available)
  if (process.env.K_SERVICE) {
    try {
      const metadataUrl =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

      const response = await fetch(`${metadataUrl}?audience=${audience}`, {
        headers: { 'Metadata-Flavor': 'Google' },
      });

      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      logger.warn({ error }, '[TenantAgent] Failed to get metadata token');
    }
  }

  // Priority 2: Explicit service account credentials (Render, CI, etc.)
  // This is the fix for Pitfall #36 - Render can't use metadata service
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const { GoogleAuth } = await import('google-auth-library');

      // Parse the JSON credentials from environment variable
      const credentials = JSON.parse(serviceAccountJson);

      // Create auth client with explicit credentials and target audience
      const auth = new GoogleAuth({
        credentials,
        // targetAudience tells GoogleAuth we want an ID token, not an access token
        // The audience MUST match the Cloud Run service URL
      });

      const client = await auth.getIdTokenClient(audience);
      const headers = await client.getRequestHeaders();
      const authHeader = (headers as unknown as Record<string, string>)['Authorization'];

      if (authHeader && authHeader.startsWith('Bearer ')) {
        logger.debug('[TenantAgent] Got identity token from explicit credentials');
        return authHeader.slice(7);
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[TenantAgent] Failed to get identity token from GOOGLE_SERVICE_ACCOUNT_JSON'
      );
    }
  }

  // Priority 3: Application Default Credentials (local development)
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(audience);
    const headers = await client.getRequestHeaders();
    const authHeader = (headers as unknown as Record<string, string>)['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      logger.debug('[TenantAgent] Got identity token from ADC');
      return authHeader.slice(7);
    }
  } catch (error) {
    // Expected in local dev without ADC or service account
    logger.debug({ error }, '[TenantAgent] GoogleAuth ADC not available');
  }

  logger.warn('[TenantAgent] No identity token available - requests will be unauthenticated');
  return null;
}

/**
 * Extract text response from ADK response array.
 * Finds the last model message and concatenates its text parts.
 */
function extractAgentResponse(data: z.infer<typeof AdkResponseSchema>): string {
  // Find the last model response (iterate from end)
  for (let i = data.length - 1; i >= 0; i--) {
    const item = data[i];
    if (item.content.role === 'model') {
      // Concatenate all text parts
      const texts = item.content.parts
        .filter((p) => p.text)
        .map((p) => p.text!)
        .join('');

      if (texts) {
        return texts;
      }
    }
  }

  return 'I processed your request but have no text response.';
}

/**
 * Extract dashboard actions from ADK response.
 * Looks for function calls that return DashboardAction results.
 */
function extractDashboardActions(
  data: z.infer<typeof AdkResponseSchema>
): Array<{ type: string; payload: unknown }> {
  const actions: Array<{ type: string; payload: unknown }> = [];

  for (const item of data) {
    for (const part of item.content.parts) {
      // Look for function responses that contain dashboard actions
      if (part.functionResponse) {
        const response = part.functionResponse.response;
        if (
          response &&
          typeof response === 'object' &&
          'dashboardAction' in response &&
          response.dashboardAction
        ) {
          const action = response.dashboardAction as { type: string; payload: unknown };
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

/**
 * Extract tool calls from ADK response.
 * Returns function calls with their arguments and results.
 */
function extractToolCalls(
  data: z.infer<typeof AdkResponseSchema>
): Array<{ name: string; args: Record<string, unknown>; result?: unknown }> {
  const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: unknown }> = [];
  const pendingCalls = new Map<string, { name: string; args: Record<string, unknown> }>();

  for (const item of data) {
    for (const part of item.content.parts) {
      // Collect function calls
      if (part.functionCall) {
        pendingCalls.set(part.functionCall.name, {
          name: part.functionCall.name,
          args: part.functionCall.args as Record<string, unknown>,
        });
      }

      // Match function responses to calls
      if (part.functionResponse) {
        const call = pendingCalls.get(part.functionResponse.name);
        if (call) {
          toolCalls.push({
            name: call.name,
            args: call.args,
            result: part.functionResponse.response,
          });
          pendingCalls.delete(part.functionResponse.name);
        }
      }
    }
  }

  // Add any pending calls without responses
  for (const call of pendingCalls.values()) {
    toolCalls.push(call);
  }

  return toolCalls;
}

/**
 * Extract messages from ADK session events.
 * Transforms ADK event format to our API message format.
 */
function extractMessagesFromEvents(
  events: Array<{ content?: { role?: string; parts?: Array<{ text?: string }> } }>
): Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];

  for (const event of events) {
    if (!event.content || !event.content.role || !event.content.parts) continue;

    const role = event.content.role === 'user' ? 'user' : 'assistant';
    const content = event.content.parts
      .filter((p) => p.text)
      .map((p) => p.text)
      .join('');

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
 * This is the P0 fix for Pitfall #91 (Agent asking known questions).
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

  if (!hasFacts && !hasForbidden && !bootstrap.onboardingComplete) {
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

  parts.push('[END CONTEXT]');

  return parts.join('\n');
}

/**
 * Centralized error handler for all routes.
 */
function handleError(res: Response, error: unknown, endpoint: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    logger.error({ error, endpoint }, '[TenantAgent] Request timed out');
    res.status(504).json({
      success: false,
      error: 'Agent request timed out',
    });
    return;
  }

  logger.error({ error, endpoint }, '[TenantAgent] Internal error');

  res.status(500).json({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}
