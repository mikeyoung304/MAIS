/**
 * Internal Agent Health Routes
 *
 * Health check endpoint for all deployed ADK agents on Cloud Run.
 * Called by GitHub Actions after deployment to verify agents are responding.
 *
 * Issue #3 Fix:
 * - Uses /list-apps endpoint (ADK's built-in endpoint) instead of /health
 * - ADK agents don't serve /health, they serve /list-apps, /run, /apps, etc.
 *
 * Security:
 * - Secured with X-Internal-Secret header (shared secret)
 *
 * Endpoints:
 * - GET /v1/internal/agents/health - Check all agent health via /list-apps
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { logger } from '../lib/core/logger';

// =============================================================================
// Types
// =============================================================================

interface AgentHealth {
  name: string;
  reachable: boolean;
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  healthy: boolean;
  timestamp: string;
  agents: AgentHealth[];
}

// =============================================================================
// Configuration
// =============================================================================

const AGENT_URLS = {
  booking: process.env.BOOKING_AGENT_URL,
  marketing: process.env.MARKETING_AGENT_URL,
  storefront: process.env.STOREFRONT_AGENT_URL,
  research: process.env.RESEARCH_AGENT_URL,
  concierge: process.env.CONCIERGE_AGENT_URL,
  'project-hub': process.env.PROJECT_HUB_AGENT_URL, // Issue #3 Fix: Add project-hub agent
} as const;

// =============================================================================
// Route Factory
// =============================================================================

interface InternalAgentHealthRoutesDeps {
  internalApiSecret?: string;
}

/**
 * Create internal agent health routes
 *
 * @param deps - Dependencies including config
 * @returns Express router with health endpoints
 */
export function createInternalAgentHealthRoutes(deps: InternalAgentHealthRoutesDeps): Router {
  const router = Router();

  const { internalApiSecret } = deps;

  // ===========================================================================
  // Authentication Middleware
  // ===========================================================================

  /**
   * Middleware to verify internal API secret
   * Uses X-Internal-Secret header
   */
  const verifyInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = internalApiSecret;

    // If no secret configured, reject all requests (fail-safe)
    if (!expectedSecret) {
      logger.warn('Internal API secret not configured - rejecting health check request');
      res.status(503).json({
        error: 'Internal API not configured',
      });
      return;
    }

    // Verify secret matches
    if (!secret || secret !== expectedSecret) {
      logger.warn({ ip: req.ip }, 'Invalid internal API secret for health check');
      res.status(403).json({
        error: 'Invalid API secret',
      });
      return;
    }

    next();
  };

  // Apply auth to all routes
  router.use(verifyInternalSecret);

  // ===========================================================================
  // GET /agents/health - Check all agent health
  // ===========================================================================

  /**
   * Health check for all deployed agents.
   * Called by GitHub Actions after deployment.
   */
  router.get('/agents/health', async (_req: Request, res: Response) => {
    const results: AgentHealth[] = [];

    for (const [name, url] of Object.entries(AGENT_URLS)) {
      if (!url) {
        results.push({
          name,
          reachable: false,
          latencyMs: -1,
          error: 'URL not configured',
        });
        continue;
      }

      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // Issue #3 Fix: ADK agents use /list-apps endpoint, not /health
        // /list-apps returns 200 if agent is responsive, no auth required
        const response = await fetch(`${url}/list-apps`, {
          signal: controller.signal,
          headers: { 'X-Health-Check': 'true' },
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        results.push({
          name,
          reachable: response.ok,
          latencyMs,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        });
      } catch (error) {
        results.push({
          name,
          reachable: false,
          latencyMs: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const allReachable = results.every((r) => r.reachable);

    const response: HealthResponse = {
      healthy: allReachable,
      timestamp: new Date().toISOString(),
      agents: results,
    };

    logger.info({ agentHealth: response }, 'Agent health check completed');

    res.status(allReachable ? 200 : 503).json(response);
  });

  return router;
}
