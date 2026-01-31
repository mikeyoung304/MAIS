/**
 * Tenant Admin Tenant Agent Routes
 *
 * Dashboard API endpoints for chatting with the new unified Tenant Agent.
 * This is part of Phase 2a of the Semantic Storefront Architecture.
 *
 * The Tenant Agent consolidates:
 * - Concierge (routing)
 * - Storefront (website editing)
 * - Marketing (copy generation)
 * - Project Hub (project management)
 *
 * Endpoints:
 * - POST /chat - Send a message to the Tenant Agent
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
// Note: Config utilities not needed - using process.env directly for simplicity

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get the Tenant Agent Cloud Run URL.
 * Uses environment variable with fallback for local development.
 */
function getTenantAgentUrl(): string {
  // In production, this should be set via environment variable
  const envUrl = process.env.TENANT_AGENT_URL;
  if (envUrl) {
    return envUrl;
  }

  // Fallback for local development (pointing to deployed Cloud Run)
  return 'https://tenant-agent-506923455711.us-central1.run.app';
}

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
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
}

/**
 * Create tenant admin routes for the unified Tenant Agent.
 *
 * @param deps - Dependencies (prisma is required)
 * @returns Express router
 */
export function createTenantAdminTenantAgentRoutes(deps: TenantAgentRoutesDeps): Router {
  const router = Router();
  const { prisma } = deps;

  // ===========================================================================
  // POST /chat - Send a message to the Tenant Agent
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

      logger.info(
        { tenantId, messageLength: message.length },
        '[TenantAgentChat] Message received'
      );

      // Use provided session ID or generate a new one
      // Note: ADK manages its own sessions - we just need to provide a consistent ID
      const sessionId = providedSessionId || `tenant-${tenantId}-${Date.now()}`;

      // Get identity token for Cloud Run authentication (if in GCP environment)
      const token = await getIdentityToken();

      // Call the Tenant Agent via A2A protocol
      const agentUrl = getTenantAgentUrl();
      logger.debug({ agentUrl, sessionId }, '[TenantAgentChat] Calling Tenant Agent');

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
              parts: [{ text: message }],
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
          '[TenantAgentChat] Agent call failed'
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
          '[TenantAgentChat] Invalid response format'
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

      logger.info(
        { tenantId, sessionId, responseLength: agentResponse.length },
        '[TenantAgentChat] Response received'
      );

      res.json({
        success: true,
        sessionId,
        response: agentResponse,
        dashboardActions,
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
        logger.error({ error }, '[TenantAgentChat] Request timed out');
        res.status(504).json({
          success: false,
          error: 'Agent request timed out',
        });
        return;
      }

      logger.error({ error }, '[TenantAgentChat] Internal error');
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
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
 * In Cloud Run, uses the metadata service.
 * In local dev, uses Application Default Credentials via GoogleAuth.
 */
async function getIdentityToken(): Promise<string | null> {
  // Check if we're in Cloud Run (has metadata service)
  if (process.env.K_SERVICE) {
    try {
      const metadataUrl =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
      const audience = getTenantAgentUrl();

      const response = await fetch(`${metadataUrl}?audience=${audience}`, {
        headers: { 'Metadata-Flavor': 'Google' },
      });

      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      logger.warn({ error }, '[TenantAgentChat] Failed to get metadata token');
    }
  }

  // In local development, try GoogleAuth
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(getTenantAgentUrl());
    const headers = await client.getRequestHeaders();
    // headers is { [key: string]: string } - access via bracket notation
    const authHeader = (headers as unknown as Record<string, string>)['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
  } catch (error) {
    // Expected in local dev without ADC
    logger.debug({ error }, '[TenantAgentChat] GoogleAuth not available');
  }

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
