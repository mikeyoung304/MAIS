/**
 * Internal Agent Health Routes
 *
 * Health check endpoint for all deployed ADK agents on Cloud Run.
 * Called by GitHub Actions after deployment and by operations for monitoring.
 *
 * Issue #3 Fix:
 * - Uses /list-apps endpoint (ADK's built-in endpoint) instead of /health
 * - ADK agents don't serve /health, they serve /list-apps, /run, /apps, etc.
 *
 * Todo #11028 Enhancement:
 * - Uses Cloud Run identity tokens to verify full auth chain
 * - Distinguishes between: ok | unreachable | unauthorized | timeout | not_configured
 * - 5-second per-agent timeout to prevent health checks from hanging
 * - Returns latencyMs for monitoring and alerting
 *
 * Security:
 * - Secured with X-Internal-Secret header (shared secret)
 *
 * Endpoints:
 * - GET /v1/internal/agents/health - Check all agent health via /list-apps
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import { verifyInternalSecret } from './internal-agent-shared';
import { cloudRunAuth } from '../services/cloud-run-auth.service';

// =============================================================================
// Types
// =============================================================================

/** Per-agent health status */
type AgentStatus = 'ok' | 'unreachable' | 'unauthorized' | 'timeout' | 'not_configured';

interface AgentHealth {
  name: string;
  status: AgentStatus;
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  healthy: boolean;
  timestamp: string;
  agents: AgentHealth[];
}

// =============================================================================
// Constants
// =============================================================================

/** Per-agent timeout in milliseconds. Prevents health check from hanging. */
const AGENT_HEALTH_TIMEOUT_MS = 5_000;

// =============================================================================
// Configuration
// =============================================================================

// Phase 4 Update (2026-01-31): Consolidated to 3 agents
// - customer-agent: booking + project-hub (customer view)
// - tenant-agent: concierge + storefront + marketing + project-hub (tenant view)
// - research-agent: unchanged
function getAgentUrls(): Record<string, string | undefined> {
  const cfg = getConfig();
  return {
    customer: cfg.CUSTOMER_AGENT_URL,
    tenant: cfg.TENANT_AGENT_URL,
    research: cfg.RESEARCH_AGENT_URL,
  };
}

// =============================================================================
// Health Check Logic
// =============================================================================

/**
 * Check a single agent's health by calling its /list-apps endpoint
 * with a Cloud Run identity token.
 *
 * This tests the full auth chain:
 * 1. Identity token acquisition (service account or gcloud CLI)
 * 2. Network connectivity to Cloud Run
 * 3. Cloud Run IAM authorization
 * 4. ADK agent responsiveness
 */
async function checkAgentHealth(name: string, url: string): Promise<AgentHealth> {
  const start = Date.now();

  try {
    // Acquire Cloud Run identity token (tests auth chain)
    const token = await cloudRunAuth.getIdentityToken(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_HEALTH_TIMEOUT_MS);

    try {
      // Issue #3 Fix: ADK agents use /list-apps endpoint, not /health
      const response = await fetch(`${url}/list-apps`, {
        signal: controller.signal,
        headers: {
          'X-Health-Check': 'true',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { name, status: 'ok', latencyMs };
      }

      // Distinguish auth failures from other errors
      if (response.status === 401 || response.status === 403) {
        return {
          name,
          status: 'unauthorized',
          latencyMs,
          error: `HTTP ${response.status} - auth chain broken (token ${token ? 'present' : 'missing'})`,
        };
      }

      return {
        name,
        status: 'unreachable',
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    } catch (fetchError) {
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;

      // AbortError means timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          name,
          status: 'timeout',
          latencyMs,
          error: `Timed out after ${AGENT_HEALTH_TIMEOUT_MS}ms`,
        };
      }

      return {
        name,
        status: 'unreachable',
        latencyMs,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
      };
    }
  } catch (authError) {
    // Token acquisition itself failed
    return {
      name,
      status: 'unauthorized',
      latencyMs: Date.now() - start,
      error: `Token acquisition failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`,
    };
  }
}

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

  // Apply auth to all routes
  router.use(verifyInternalSecret(internalApiSecret));

  // ===========================================================================
  // GET /agents/health - Check all agent health
  // ===========================================================================

  /**
   * Health check for all deployed agents.
   * Called by GitHub Actions after deployment and by ops for monitoring.
   *
   * Tests the full connectivity chain:
   * 1. Identity token acquisition
   * 2. Network reachability
   * 3. Cloud Run IAM authorization
   * 4. ADK agent responsiveness
   *
   * Returns per-agent status:
   * - ok: Agent is reachable and authenticated
   * - unreachable: Network error or non-auth HTTP error
   * - unauthorized: 401/403 or token acquisition failure
   * - timeout: Agent did not respond within 5 seconds
   * - not_configured: Agent URL env var is not set
   */
  router.get('/agents/health', async (_req: Request, res: Response) => {
    const agentUrls = getAgentUrls();

    // Check all agents in parallel for faster response
    const healthChecks = Object.entries(agentUrls).map(
      async ([name, url]): Promise<AgentHealth> => {
        if (!url) {
          return {
            name,
            status: 'not_configured',
            latencyMs: -1,
            error: 'URL not configured',
          };
        }

        return checkAgentHealth(name, url);
      }
    );

    const results = await Promise.all(healthChecks);
    const allHealthy = results.every((r) => r.status === 'ok');

    const response: HealthResponse = {
      healthy: allHealthy,
      timestamp: new Date().toISOString(),
      agents: results,
    };

    logger.info({ agentHealth: response }, 'Agent health check completed');

    res.status(allHealthy ? 200 : 503).json(response);
  });

  return router;
}
