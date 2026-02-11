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
  packagesCreated: z.number().optional(),
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
  const { tenantRepo, contextBuilder, catalogService, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // ===========================================================================
  // Service Initialization
  // ===========================================================================

  // ResearchService needs access to DiscoveryService's cache invalidation.
  // We create ResearchService first with a placeholder, then wire up after DiscoveryService.
  const researchService = new ResearchService(tenantRepo, (tenantId: string) =>
    discoveryService.invalidateBootstrapCache(tenantId)
  );

  const discoveryService = new DiscoveryService(tenantRepo, contextBuilder, researchService);

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
      const { tenantId, publishedUrl, packagesCreated, summary } = CompleteOnboardingSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, publishedUrl, packagesCreated, endpoint: '/complete-onboarding' },
        '[Agent] Completing onboarding'
      );

      // Fetch tenant to check current state (optimistic locking)
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if already completed (idempotent response)
      if (tenant.onboardingPhase === 'COMPLETED') {
        logger.info(
          { tenantId, endpoint: '/complete-onboarding' },
          '[Agent] Onboarding already completed - returning idempotent response'
        );
        res.json({
          success: true,
          wasAlreadyComplete: true,
          message: 'Onboarding was already completed',
          completedAt: tenant.onboardingCompletedAt?.toISOString() || null,
        });
        return;
      }

      // Validate prerequisites: at least one package must exist
      const packages = await catalogService.getAllPackages(tenantId);
      if (packages.length === 0) {
        logger.warn(
          { tenantId, endpoint: '/complete-onboarding' },
          '[Agent] Blocked onboarding completion - no packages exist'
        );
        res.status(400).json({
          error: 'Cannot complete onboarding without at least one package',
          suggestion: 'Create a service package first using the storefront tools',
          prerequisite: 'packages',
          required: 1,
          actual: 0,
        });
        return;
      }

      // Update tenant onboarding phase
      const completedAt = new Date();
      await tenantRepo.update(tenantId, {
        onboardingPhase: 'COMPLETED',
        onboardingCompletedAt: completedAt,
      });

      // Invalidate bootstrap cache so next request gets fresh data
      discoveryService.invalidateBootstrapCache(tenantId);

      res.json({
        success: true,
        wasAlreadyComplete: false,
        message: publishedUrl
          ? `Onboarding complete! Live at ${publishedUrl}`
          : 'Onboarding marked as complete.',
        completedAt: completedAt.toISOString(),
        ...(packagesCreated !== undefined && { packagesCreated }),
        ...(summary && { summary }),
      });
    } catch (error) {
      handleError(res, error, '/complete-onboarding');
    }
  });

  // ===========================================================================
  // POST /mark-reveal-completed - One-shot guard for reveal animation
  // ===========================================================================

  router.post('/mark-reveal-completed', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      // Idempotent: only write if not already set
      const tenant = await tenantRepo.findById(tenantId);

      if (!tenant) {
        res.status(404).json({ success: false, error: 'Tenant not found' });
        return;
      }

      if (tenant.revealCompletedAt) {
        res.json({ success: true, alreadyCompleted: true });
        return;
      }

      await tenantRepo.update(tenantId, { revealCompletedAt: new Date() });

      // Invalidate bootstrap cache so next request reflects revealCompleted state
      discoveryService.invalidateBootstrapCache(tenantId);

      logger.info({ tenantId }, '[InternalAgent] revealCompletedAt written');
      res.json({ success: true, alreadyCompleted: false });
    } catch (error) {
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
