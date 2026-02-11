/**
 * Discovery Service
 *
 * Business logic for tenant discovery fact management during onboarding.
 * Extracted from internal-agent-discovery.routes.ts to follow the service pattern.
 *
 * Responsibilities:
 * - Store discovery facts in tenant.branding.discoveryFacts (read-modify-write)
 * - Compute slot machine result after each fact storage
 * - Advance onboarding phase when thresholds are met
 * - Evaluate research trigger conditions
 * - Invalidate bootstrap cache after mutations
 *
 * CRITICAL: All methods require tenantId for multi-tenant isolation.
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../lib/core/logger';
import { computeSlotMachine } from '../lib/slot-machine';
import type { SlotMachineResult } from '../lib/slot-machine';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { ContextBuilderService } from './context-builder.service';
import type { ResearchService } from './research.service';

// =============================================================================
// Types
// =============================================================================

export interface StoreFactResult {
  stored: boolean;
  key: string;
  value: unknown;
  totalFactsKnown: number;
  knownFactKeys: string[];
  currentPhase: string;
  phaseAdvanced: boolean;
  nextAction: string;
  readySections: string[];
  missingForNext: SlotMachineResult['missingForNext'];
  slotMetrics: SlotMachineResult['slotMetrics'];
  message: string;
}

export interface BootstrapData {
  tenantId: string;
  businessName: string;
  industry: string | null;
  tier: string;
  onboardingDone: boolean;
  discoveryData: Record<string, unknown> | null;
}

export interface BootstrapResult extends BootstrapData {
  hasBeenGreeted: boolean;
}

export interface DiscoveryFactsResult {
  success: boolean;
  facts: Record<string, unknown>;
  factCount: number;
  factKeys: string[];
  message: string;
}

// =============================================================================
// Service
// =============================================================================

export class DiscoveryService {
  // ===========================================================================
  // BOOTSTRAP CACHE - LRU with 30-minute TTL, 1000 max entries
  // Memory footprint: ~5 MB (1000 entries x ~5 KB per tenant bootstrap data)
  // ===========================================================================
  private bootstrapCache = new LRUCache<string, BootstrapData>({
    max: 1000,
    ttl: 30 * 60 * 1000, // 30 minutes
  });

  // ===========================================================================
  // GREETING STATE CACHE - Prevents infinite "Welcome back" loop
  //
  // ADK context.state.set() does NOT persist between turns, so we track
  // greeting state in the backend using compound key: tenantId:sessionId
  // ===========================================================================
  // Memory footprint: ~160 KB (5000 entries x ~32 bytes per compound key + timestamp)
  private greetedSessionsCache = new LRUCache<string, number>({
    max: 5000,
    ttl: 60 * 60 * 1000, // 1 hour
  });

  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly contextBuilder: ContextBuilderService | undefined,
    private readonly researchService: ResearchService
  ) {}

  // ===========================================================================
  // Bootstrap
  // ===========================================================================

  /**
   * Get bootstrap data for a tenant session.
   * Returns tenant context with onboarding state, discovery data, and greeting state.
   */
  async getBootstrap(tenantId: string, sessionId?: string): Promise<BootstrapResult> {
    const hasBeenGreeted = sessionId ? this.hasSessionBeenGreeted(tenantId, sessionId) : false;

    // Check cache first
    const cached = this.bootstrapCache.get(tenantId);
    if (cached) {
      logger.info(
        { tenantId, sessionId, cached: true, hasBeenGreeted },
        '[DiscoveryService] Bootstrap cache hit'
      );
      return { ...cached, hasBeenGreeted };
    }

    // Fetch tenant data
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    // Get discovery data from ContextBuilder (single source of truth)
    if (!this.contextBuilder) {
      throw new ServiceUnavailableError('Context builder service not configured');
    }

    let discoveryData: Record<string, unknown> | null = null;
    try {
      const bootstrapData = await this.contextBuilder.getBootstrapData(tenantId);
      discoveryData = bootstrapData.discoveryFacts;
    } catch (error) {
      logger.error(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[DiscoveryService] Failed to fetch context from ContextBuilder'
      );
      throw new Error('Failed to fetch tenant context');
    }

    // Fallback: Extract branding and discovery facts directly
    const branding = (tenant.branding as Record<string, unknown>) || {};
    const brandingDiscoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

    const mergedDiscoveryData =
      discoveryData ||
      (Object.keys(brandingDiscoveryFacts).length > 0 ? brandingDiscoveryFacts : null);

    const industry =
      (mergedDiscoveryData?.businessType as string) || (branding.industry as string) || null;

    const bootstrapResponse: BootstrapData = {
      tenantId: tenant.id,
      businessName: tenant.name,
      industry,
      tier: tenant.tier || 'FREE',
      onboardingDone:
        tenant.onboardingPhase === 'COMPLETED' || tenant.onboardingPhase === 'SKIPPED',
      discoveryData: mergedDiscoveryData,
    };

    // Cache response
    this.bootstrapCache.set(tenantId, bootstrapResponse);

    logger.info(
      {
        tenantId,
        sessionId,
        onboardingDone: bootstrapResponse.onboardingDone,
        hasBeenGreeted,
        cached: false,
      },
      '[DiscoveryService] Bootstrap response'
    );

    return { ...bootstrapResponse, hasBeenGreeted };
  }

  // ===========================================================================
  // Greeting State
  // ===========================================================================

  /**
   * Check if a session has been greeted
   */
  hasSessionBeenGreeted(tenantId: string, sessionId: string): boolean {
    return this.greetedSessionsCache.has(`${tenantId}:${sessionId}`);
  }

  /**
   * Mark a session as greeted to prevent duplicate greetings
   */
  markSessionGreeted(tenantId: string, sessionId: string): void {
    this.greetedSessionsCache.set(`${tenantId}:${sessionId}`, Date.now());
  }

  // ===========================================================================
  // Discovery Facts
  // ===========================================================================

  /**
   * Store a discovery fact learned during onboarding.
   *
   * Performs a read-modify-write on tenant.branding.discoveryFacts, computes
   * the slot machine result, advances the onboarding phase if needed,
   * and triggers background research when conditions are met.
   *
   * // TODO: Advisory lock for concurrent fact storage — the current
   * // read-modify-write on tenant.branding has no locking. Two concurrent
   * // store_discovery_fact calls can lose data. This is acceptable for now
   * // because onboarding is a single-user flow, but should be addressed
   * // if concurrent writes become possible.
   */
  async storeFact(tenantId: string, key: string, value: unknown): Promise<StoreFactResult> {
    logger.info({ tenantId, key }, '[DiscoveryService] Storing discovery fact');

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    // Read-modify-write on branding.discoveryFacts
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

    // Filter _-prefixed metadata keys from fact keys (slot machine only sees real facts)
    const knownFactKeys = Object.keys(discoveryFacts).filter((k) => !k.startsWith('_'));
    const previousPhase = (tenant.onboardingPhase as string) || 'NOT_STARTED';

    // Pass researchTriggered so slot machine returns ASK instead of TRIGGER_RESEARCH
    const researchTriggered = alreadyTriggered || shouldTriggerResearch;
    const slotResult = computeSlotMachine(knownFactKeys, previousPhase, researchTriggered);

    // Single DB write: store facts + advance phase if needed (merged from two sequential updates)
    const updateData: Record<string, unknown> = { branding: { ...branding, discoveryFacts } };
    if (slotResult.phaseAdvanced) {
      updateData.onboardingPhase = slotResult.currentPhase;
      logger.info(
        { tenantId, from: previousPhase, to: slotResult.currentPhase },
        '[DiscoveryService] Onboarding phase advanced'
      );
    }
    await this.tenantRepo.update(tenantId, updateData);

    // Invalidate bootstrap cache so next request gets updated facts
    this.invalidateBootstrapCache(tenantId);

    // Fire async backend research (fire-and-forget)
    if (shouldTriggerResearch) {
      const businessType = String(discoveryFacts['businessType'] || '');
      const location = String(discoveryFacts['location'] || '');
      this.researchService.triggerAsync(tenantId, businessType, location);
    }

    return {
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
    };
  }

  /**
   * Get all stored discovery facts for a tenant.
   */
  async getDiscoveryFacts(tenantId: string): Promise<DiscoveryFactsResult> {
    logger.info({ tenantId }, '[DiscoveryService] Fetching discovery facts');

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    const branding = (tenant.branding as Record<string, unknown>) || {};
    const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

    // Filter out _-prefixed internal metadata keys (e.g. _researchTriggered)
    const filteredFacts = Object.fromEntries(
      Object.entries(discoveryFacts).filter(([k]) => !k.startsWith('_'))
    );
    const factKeys = Object.keys(filteredFacts);

    return {
      success: true,
      facts: filteredFacts,
      factCount: factKeys.length,
      factKeys,
      message: factKeys.length > 0 ? `Known facts: ${factKeys.join(', ')}` : 'No facts stored yet.',
    };
  }

  /**
   * Invalidate bootstrap cache for a tenant.
   * Called after onboarding completion or significant changes.
   */
  invalidateBootstrapCache(tenantId: string): void {
    this.bootstrapCache.delete(tenantId);
  }
}

// =============================================================================
// Error Classes
// =============================================================================

export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = 'TenantNotFoundError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
