/**
 * Internal Agent Discovery Routes
 *
 * Thin route handlers for bootstrap, onboarding, and fact discovery.
 * Business logic lives in DiscoveryService and ResearchService.
 *
 * 7 endpoints: bootstrap, mark-greeted, complete-onboarding, mark-reveal-completed,
 * store-discovery-fact, get-discovery-facts, get-research-data.
 *
 * Called by: tenant-agent (concierge flow)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import {
  verifyInternalSecret,
  handleError,
  TenantIdSchema,
  DISCOVERY_FACT_KEYS,
} from './internal-agent-shared';
import type { DiscoveryRoutesDeps } from './internal-agent-shared';
import {
  DiscoveryService,
  TenantNotFoundError,
  ServiceUnavailableError,
} from '../services/discovery.service';
import { ResearchService, ResearchTenantNotFoundError } from '../services/research.service';

// =============================================================================
// Schemas
// =============================================================================

// Extended schema for bootstrap - includes optional sessionId for greeting tracking
const BootstrapRequestSchema = TenantIdSchema.extend({
  sessionId: z.string().optional(), // Issue #5 Fix: Track greeting state per session
});

const MarkGreetedSchema = TenantIdSchema.extend({
  sessionId: z.string().min(1),
});

const CompleteOnboardingSchema = TenantIdSchema.extend({
  publishedUrl: z.string().optional(),
  tiersCreated: z.number().optional(),
  summary: z.string().optional(),
});

const StoreDiscoveryFactSchema = TenantIdSchema.extend({
  key: z.enum(DISCOVERY_FACT_KEYS),
  value: z.unknown(),
});

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal agent discovery routes.
 *
 * Mounted at `/` by the aggregator (root-level paths like `/bootstrap`, `/store-discovery-fact`).
 */
export function createInternalAgentDiscoveryRoutes(deps: DiscoveryRoutesDeps): Router {
  const router = Router();
  const { internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // ===========================================================================
  // Service Resolution — prefer DI-provided, fallback to local construction
  // ===========================================================================

  let discoveryService: DiscoveryService;
  let researchService: ResearchService;

  if (deps.discoveryService && deps.researchService) {
    // Services provided by DI container (production path)
    discoveryService = deps.discoveryService;
    researchService = deps.researchService;
  } else {
    // Fallback: construct locally (backward compatibility for tests)
    const { tenantRepo, contextBuilder, catalogService } = deps;
    researchService = new ResearchService(tenantRepo, getConfig().RESEARCH_AGENT_URL);
    discoveryService = new DiscoveryService(
      tenantRepo,
      contextBuilder,
      researchService,
      catalogService
    );
    researchService.setBootstrapCacheInvalidator((tenantId) =>
      discoveryService.invalidateBootstrapCache(tenantId)
    );
  }

  // ===========================================================================
  // POST /bootstrap - Session context for Concierge agent
  // ===========================================================================

  router.post('/bootstrap', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = BootstrapRequestSchema.parse(req.body);

      logger.info({ tenantId, sessionId, endpoint: '/bootstrap' }, '[Agent] Bootstrap request');

      const result = await discoveryService.getBootstrap(tenantId, sessionId);
      res.json(result);
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      if (error instanceof ServiceUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Failed to fetch tenant context') {
        res.status(500).json({ error: 'Failed to fetch tenant context' });
        return;
      }
      handleError(res, error, '/bootstrap');
    }
  });

  // ===========================================================================
  // POST /mark-greeted - Mark session as greeted
  // ===========================================================================

  router.post('/mark-greeted', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = MarkGreetedSchema.parse(req.body);

      logger.info(
        { tenantId, sessionId, endpoint: '/mark-greeted' },
        '[Agent] Mark greeted request'
      );

      discoveryService.markSessionGreeted(tenantId, sessionId);
      res.json({ success: true, message: 'Session marked as greeted' });
    } catch (error) {
      handleError(res, error, '/mark-greeted');
    }
  });

  // ===========================================================================
  // POST /complete-onboarding - Mark onboarding as complete
  // ===========================================================================

  router.post('/complete-onboarding', async (req: Request, res: Response) => {
    try {
      const { tenantId, publishedUrl, tiersCreated, summary } = CompleteOnboardingSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, publishedUrl, tiersCreated, endpoint: '/complete-onboarding' },
        '[Agent] Completing onboarding'
      );

      const result = await discoveryService.completeOnboarding(tenantId, {
        publishedUrl,
        tiersCreated,
        summary,
      });

      if (result.status === 'already_complete') {
        res.json({
          success: true,
          wasAlreadyComplete: true,
          message: 'Onboarding was already completed',
          completedAt: result.completedAt?.toISOString() || null,
        });
        return;
      }

      if (result.status === 'no_tiers') {
        res.status(400).json({
          error: 'Cannot complete onboarding without at least one tier',
          suggestion: 'Create a service tier first using the storefront tools',
          prerequisite: 'tiers',
          required: 1,
          actual: 0,
        });
        return;
      }

      res.json({
        success: true,
        wasAlreadyComplete: false,
        message: result.publishedUrl
          ? `Onboarding complete! Live at ${result.publishedUrl}`
          : 'Onboarding marked as complete.',
        completedAt: result.completedAt.toISOString(),
        ...(result.tiersCreated !== undefined && { tiersCreated: result.tiersCreated }),
        ...(result.summary && { summary: result.summary }),
      });
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      if (error instanceof ServiceUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      handleError(res, error, '/complete-onboarding');
    }
  });

  // ===========================================================================
  // POST /mark-reveal-completed - One-shot guard for reveal animation
  // ===========================================================================

  router.post('/mark-reveal-completed', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      const result = await discoveryService.markRevealCompleted(tenantId);
      res.json({
        success: true,
        alreadyCompleted: result.status === 'already_completed',
      });
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        res.status(404).json({ success: false, error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/mark-reveal-completed');
    }
  });

  // ===========================================================================
  // POST /store-discovery-fact - Store a fact learned during onboarding
  // ===========================================================================

  router.post('/store-discovery-fact', async (req: Request, res: Response) => {
    try {
      const { tenantId, key, value } = StoreDiscoveryFactSchema.parse(req.body);

      const result = await discoveryService.storeFact(tenantId, key, value);
      res.json(result);
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/store-discovery-fact');
    }
  });

  // ===========================================================================
  // POST /get-research-data - Get pre-computed research results
  // ===========================================================================

  router.post('/get-research-data', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      const result = await researchService.getPrecomputedResults(tenantId);
      res.json(result);
    } catch (error) {
      if (error instanceof ResearchTenantNotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/get-research-data');
    }
  });

  // ===========================================================================
  // POST /get-discovery-facts - Get all stored discovery facts
  // ===========================================================================

  router.post('/get-discovery-facts', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      const result = await discoveryService.getDiscoveryFacts(tenantId);
      res.json(result);
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/get-discovery-facts');
    }
  });

  return router;
}
