/**
 * Internal Agent Discovery Routes
 *
 * Tenant-agent endpoints for bootstrap, onboarding, and fact discovery.
 * 6 endpoints: bootstrap, mark-greeted, complete-onboarding, mark-reveal-completed,
 * store-discovery-fact, get-discovery-facts.
 *
 * Called by: tenant-agent (concierge flow)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import { logger } from '../lib/core/logger';
import { computeSlotMachine } from '../lib/slot-machine';
import { cloudRunAuth } from '../services/cloud-run-auth.service';
import {
  verifyInternalSecret,
  handleError,
  TenantIdSchema,
  DISCOVERY_FACT_KEYS,
} from './internal-agent-shared';
import type { DiscoveryRoutesDeps } from './internal-agent-shared';

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
  // BOOTSTRAP CACHE - LRU with 30-minute TTL, 1000 max entries
  // ===========================================================================

  interface BootstrapData {
    tenantId: string;
    businessName: string;
    industry: string | null;
    tier: string;
    onboardingDone: boolean;
    discoveryData: Record<string, unknown> | null;
  }

  // Memory footprint: ~5 MB (1000 entries × ~5 KB per tenant bootstrap data)
  const bootstrapCache = new LRUCache<string, BootstrapData>({
    max: 1000,
    ttl: 30 * 60 * 1000, // 30 minutes
  });

  /**
   * Invalidate bootstrap cache for a tenant.
   * Called after onboarding completion or significant changes.
   */
  function invalidateBootstrapCache(tenantId: string): void {
    bootstrapCache.delete(tenantId);
  }

  // ===========================================================================
  // GREETING STATE CACHE - Issue #5 Fix: Prevents infinite "Welcome back" loop
  //
  // ADK context.state.set() does NOT persist between turns, so we track
  // greeting state in the backend using compound key: tenantId:sessionId
  // ===========================================================================

  /**
   * Cache of greeted sessions to prevent duplicate greetings
   * Key format: `${tenantId}:${sessionId}`
   * Value: timestamp when greeted
   */
  // Memory footprint: ~160 KB (5000 entries × ~32 bytes per compound key + timestamp)
  const greetedSessionsCache = new LRUCache<string, number>({
    max: 5000, // More sessions than tenants (many sessions per tenant)
    ttl: 60 * 60 * 1000, // 1 hour TTL - sessions rarely last longer
  });

  /**
   * Build compound key for greeting state
   */
  function buildGreetingKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
  }

  /**
   * Check if a session has been greeted
   */
  function hasSessionBeenGreeted(tenantId: string, sessionId: string): boolean {
    return greetedSessionsCache.has(buildGreetingKey(tenantId, sessionId));
  }

  /**
   * Mark a session as greeted
   */
  function markSessionGreeted(tenantId: string, sessionId: string): void {
    greetedSessionsCache.set(buildGreetingKey(tenantId, sessionId), Date.now());
  }

  // ===========================================================================
  // POST /bootstrap - Session context for Concierge agent
  // Returns tenant context with onboarding state and discovery data
  // ===========================================================================

  router.post('/bootstrap', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = BootstrapRequestSchema.parse(req.body);

      logger.info({ tenantId, sessionId, endpoint: '/bootstrap' }, '[Agent] Bootstrap request');

      // Check if session has been greeted (Issue #5 Fix)
      const hasBeenGreeted = sessionId ? hasSessionBeenGreeted(tenantId, sessionId) : false;

      // Check cache first (LRU handles TTL automatically)
      const cached = bootstrapCache.get(tenantId);
      if (cached) {
        logger.info(
          { tenantId, sessionId, cached: true, hasBeenGreeted },
          '[Agent] Bootstrap cache hit'
        );
        // Return cached data + session-specific greeting state
        res.json({ ...cached, hasBeenGreeted });
        return;
      }

      // Fetch tenant data
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Get discovery data from ContextBuilder (single source of truth)
      // ContextBuilder provides discovery data for agent context injection
      // CORE SERVICE for agents - return 503 if unavailable
      if (!contextBuilder) {
        res.status(503).json({ error: 'Context builder service not configured' });
        return;
      }

      let discoveryData: Record<string, unknown> | null = null;
      try {
        const bootstrapData = await contextBuilder.getBootstrapData(tenantId);
        discoveryData = bootstrapData.discoveryFacts;
      } catch (error) {
        // If ContextBuilder fails to fetch, this is an error condition
        logger.error(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[Agent] Failed to fetch context from ContextBuilder'
        );
        res.status(500).json({ error: 'Failed to fetch tenant context' });
        return;
      }

      // Fallback: Extract branding and discovery facts directly if contextBuilder unavailable
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const brandingDiscoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

      // Use contextBuilder data or fallback to branding.discoveryFacts
      const mergedDiscoveryData =
        discoveryData ||
        (Object.keys(brandingDiscoveryFacts).length > 0 ? brandingDiscoveryFacts : null);

      // Extract industry from discovery data or branding
      const industry =
        (mergedDiscoveryData?.businessType as string) || (branding.industry as string) || null;

      // Build bootstrap response
      const bootstrapResponse = {
        tenantId: tenant.id,
        businessName: tenant.name,
        industry,
        tier: tenant.tier || 'FREE',
        onboardingDone:
          tenant.onboardingPhase === 'COMPLETED' || tenant.onboardingPhase === 'SKIPPED',
        discoveryData: mergedDiscoveryData,
      };

      // Cache response (LRU handles max size and TTL automatically)
      bootstrapCache.set(tenantId, bootstrapResponse);

      logger.info(
        {
          tenantId,
          sessionId,
          onboardingDone: bootstrapResponse.onboardingDone,
          hasBeenGreeted,
          cached: false,
        },
        '[Agent] Bootstrap response'
      );
      // Return cached tenant data + session-specific greeting state
      res.json({ ...bootstrapResponse, hasBeenGreeted });
    } catch (error) {
      handleError(res, error, '/bootstrap');
    }
  });

  // ===========================================================================
  // POST /mark-greeted - Issue #5 Fix: Mark session as greeted
  // Called by Concierge agent AFTER sending greeting to prevent repeat greetings
  // ===========================================================================

  router.post('/mark-greeted', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = MarkGreetedSchema.parse(req.body);

      logger.info(
        { tenantId, sessionId, endpoint: '/mark-greeted' },
        '[Agent] Mark greeted request'
      );

      // Mark this session as greeted
      markSessionGreeted(tenantId, sessionId);

      res.json({ success: true, message: 'Session marked as greeted' });
    } catch (error) {
      handleError(res, error, '/mark-greeted');
    }
  });

  // ===========================================================================
  // POST /complete-onboarding - Mark onboarding as complete
  // Called by Concierge when user publishes their storefront
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
      invalidateBootstrapCache(tenantId);

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
  // Called by build_first_draft tool after generating first draft content
  // Sets revealCompletedAt so the frontend skips the reveal on future visits
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
      invalidateBootstrapCache(tenantId);

      logger.info({ tenantId }, '[InternalAgent] revealCompletedAt written');
      res.json({ success: true, alreadyCompleted: false });
    } catch (error) {
      handleError(res, error, '/mark-reveal-completed');
    }
  });

  // ===========================================================================
  // POST /store-discovery-fact - Store a fact learned during onboarding
  // Called by Concierge when it learns something about the business
  // ===========================================================================

  // Phase computation and slot machine imported from ../lib/slot-machine.ts

  router.post('/store-discovery-fact', async (req: Request, res: Response) => {
    try {
      const { tenantId, key, value } = StoreDiscoveryFactSchema.parse(req.body);

      logger.info(
        { tenantId, key, endpoint: '/store-discovery-fact' },
        '[Agent] Storing discovery fact'
      );

      // Agent-First Architecture: Store discovery facts directly in tenant.branding.discoveryFacts
      // This is the canonical storage location. ContextBuilder reads from here.

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Store in branding.discoveryFacts for now (simple approach)
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};
      discoveryFacts[key] = value;

      // Check if research should be triggered (businessType + location now known)
      const hasBusinessType = key === 'businessType' || !!discoveryFacts['businessType'];
      const hasLocation = key === 'location' || !!discoveryFacts['location'];
      const alreadyTriggered = !!discoveryFacts['_researchTriggered'];
      const shouldTriggerResearch = hasBusinessType && hasLocation && !alreadyTriggered;

      // Mark research as triggered BEFORE the async call to prevent re-triggers
      if (shouldTriggerResearch) {
        discoveryFacts['_researchTriggered'] = true;
      }

      await tenantRepo.update(tenantId, {
        branding: { ...branding, discoveryFacts },
      });

      // Filter _-prefixed metadata keys from fact keys (slot machine only sees real facts)
      const knownFactKeys = Object.keys(discoveryFacts).filter((k) => !k.startsWith('_'));
      const previousPhase = (tenant.onboardingPhase as string) || 'NOT_STARTED';

      // Pass researchTriggered so slot machine returns ASK instead of TRIGGER_RESEARCH
      const researchTriggered = alreadyTriggered || shouldTriggerResearch;
      const slotResult = computeSlotMachine(knownFactKeys, previousPhase, researchTriggered);

      // Advance phase if needed (monotonic — never moves backward)
      if (slotResult.phaseAdvanced) {
        await tenantRepo.update(tenantId, {
          onboardingPhase: slotResult.currentPhase,
        });
        logger.info(
          { tenantId, from: previousPhase, to: slotResult.currentPhase },
          '[Agent] Onboarding phase advanced'
        );
      }

      // Invalidate bootstrap cache so next request gets updated facts
      invalidateBootstrapCache(tenantId);

      // Fire async backend research (fire-and-forget — no await)
      if (shouldTriggerResearch) {
        const businessType = String(discoveryFacts['businessType'] || '');
        const location = String(discoveryFacts['location'] || '');
        const researchAgentUrl = process.env.RESEARCH_AGENT_URL;

        if (researchAgentUrl) {
          logger.info(
            { tenantId, businessType, location },
            '[Agent] Firing async background research'
          );

          // Fire-and-forget: do NOT await — user continues chatting
          void (async () => {
            try {
              const idToken = await cloudRunAuth.getIdentityToken(researchAgentUrl);
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

              const response = await fetch(`${researchAgentUrl}/research`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  query: `${businessType} pricing and positioning in ${location}`,
                  businessType,
                  location,
                  tenantId,
                }),
                signal: AbortSignal.timeout(90_000), // 90s timeout per pitfall #42
              });

              if (response.ok) {
                const researchData = await response.json();
                // Store research results in branding.researchData
                const freshTenant = await tenantRepo.findById(tenantId);
                if (freshTenant) {
                  const freshBranding = (freshTenant.branding as Record<string, unknown>) || {};
                  await tenantRepo.update(tenantId, {
                    branding: { ...freshBranding, researchData },
                  });
                  invalidateBootstrapCache(tenantId);
                  logger.info({ tenantId }, '[Agent] Background research stored successfully');
                }
              } else {
                logger.warn(
                  { tenantId, status: response.status },
                  '[Agent] Background research failed'
                );
              }
            } catch (error) {
              logger.warn(
                { tenantId, error: error instanceof Error ? error.message : String(error) },
                '[Agent] Background research error (non-blocking)'
              );
            }
          })();
        } else {
          logger.warn(
            { tenantId },
            '[Agent] RESEARCH_AGENT_URL not configured — skipping research'
          );
        }
      }

      // Return facts + slot machine result so agent knows what to do next
      res.json({
        stored: true,
        key,
        value,
        totalFactsKnown: knownFactKeys.length,
        knownFactKeys,
        currentPhase: slotResult.currentPhase,
        phaseAdvanced: slotResult.phaseAdvanced,
        nextAction: slotResult.nextAction,
        readySections: slotResult.readySections,
        missingForNext: slotResult.missingForNext,
        slotMetrics: slotResult.slotMetrics,
        message: `Stored ${key} successfully. Now know: ${knownFactKeys.join(', ')}`,
      });
    } catch (error) {
      handleError(res, error, '/store-discovery-fact');
    }
  });

  // ===========================================================================
  // POST /get-research-data - Get pre-computed research results for a tenant
  // Called by tenant-agent's delegate_to_research tool to check for cached results
  // before making an expensive 30-90s direct call to the research agent
  // ===========================================================================

  router.post('/get-research-data', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const researchData = branding.researchData as Record<string, unknown> | undefined;

      res.json({
        success: true,
        hasData: !!researchData,
        researchData: researchData || null,
      });
    } catch (error) {
      handleError(res, error, '/get-research-data');
    }
  });

  // ===========================================================================
  // POST /get-discovery-facts - Get all stored discovery facts for a tenant
  // Called by Concierge to check what it knows without re-bootstrapping
  // ===========================================================================

  router.post('/get-discovery-facts', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/get-discovery-facts' },
        '[Agent] Fetching discovery facts'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Extract discovery facts from branding
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};
      const factKeys = Object.keys(discoveryFacts);

      res.json({
        success: true,
        facts: discoveryFacts,
        factCount: factKeys.length,
        factKeys,
        message:
          factKeys.length > 0 ? `Known facts: ${factKeys.join(', ')}` : 'No facts stored yet.',
      });
    } catch (error) {
      handleError(res, error, '/get-discovery-facts');
    }
  });

  return router;
}
