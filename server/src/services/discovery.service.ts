/**
 * Discovery Service
 *
 * Business logic for tenant discovery fact management during onboarding.
 * Extracted from internal-agent-discovery.routes.ts to follow the service pattern.
 *
 * Responsibilities:
 * - Store discovery facts in tenant.branding.discoveryFacts (read-modify-write)
 * - Compute lightweight onboarding state after each fact storage
 * - Advance onboarding phase when thresholds are met
 * - Invalidate bootstrap cache after mutations
 *
 * CRITICAL: All methods require tenantId for multi-tenant isolation.
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { ContextBuilderService } from './context-builder.service';
import type { CatalogService } from './catalog.service';
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
  readyForReveal: boolean;
  missingForMVP: string[];
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

export type CompleteOnboardingResult =
  | {
      status: 'completed';
      completedAt: Date;
      publishedUrl?: string;
      tiersCreated?: number;
      summary?: string;
    }
  | {
      status: 'already_complete';
      completedAt: Date | null;
    }
  | {
      status: 'no_tiers';
    };

export type MarkRevealCompletedResult = { status: 'completed' } | { status: 'already_completed' };

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
    private readonly researchService: ResearchService,
    private readonly catalogService?: CatalogService
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
      onboardingDone: tenant.onboardingStatus === 'COMPLETE',
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
   * Performs a read-modify-write on tenant.branding.discoveryFacts,
   * computes lightweight onboarding state (replaces slot machine),
   * and advances the onboarding phase if needed.
   *
   * Research is no longer auto-fired — the agent triggers it on-demand
   * when the tenant asks for pricing help or market research.
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

    // Filter _-prefixed metadata keys from fact keys
    const knownFactKeys = Object.keys(discoveryFacts).filter((k) => !k.startsWith('_'));
    const previousStatus = (tenant.onboardingStatus as string) || 'PENDING_PAYMENT';

    // Lightweight state computation (replaces slot machine)
    const state = this.computeOnboardingState(knownFactKeys);

    // Advance status from PENDING_INTAKE → BUILDING when first fact is stored
    const shouldAdvanceStatus = previousStatus === 'PENDING_INTAKE' && knownFactKeys.length > 0;

    // Single DB write: store facts + advance status if needed
    const updateData: Record<string, unknown> = { branding: { ...branding, discoveryFacts } };
    if (shouldAdvanceStatus) {
      updateData.onboardingStatus = 'BUILDING';
      logger.info(
        { tenantId, from: previousStatus, to: 'BUILDING' },
        '[DiscoveryService] Onboarding status advanced'
      );
    }
    await this.tenantRepo.update(tenantId, updateData);

    // Invalidate bootstrap cache so next request gets updated facts
    this.invalidateBootstrapCache(tenantId);

    return {
      stored: true,
      key,
      value,
      totalFactsKnown: knownFactKeys.length,
      knownFactKeys,
      currentPhase: shouldAdvanceStatus ? 'BUILDING' : previousStatus,
      readyForReveal: state.readyForReveal,
      missingForMVP: state.missingForMVP,
      message: `Stored ${key} successfully. Now know: ${knownFactKeys.join(', ')}`,
    };
  }

  /**
   * Lightweight onboarding state computation.
   *
   * Replaces the slot machine's deterministic state engine with simple checks.
   * The LLM agent now drives the conversation adaptively instead of following
   * a fixed nextAction sequence.
   */
  private computeOnboardingState(factKeys: string[]): {
    readyForReveal: boolean;
    missingForMVP: string[];
  } {
    const hasSegment = factKeys.includes('primarySegment');
    const hasTiers = factKeys.includes('tiersConfigured');

    return {
      readyForReveal: hasSegment && hasTiers,
      missingForMVP: [!hasSegment && 'primarySegment', !hasTiers && 'tiersConfigured'].filter(
        (x): x is string => typeof x === 'string'
      ),
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

  // ===========================================================================
  // Onboarding Completion
  // ===========================================================================

  /**
   * Complete the onboarding process for a tenant.
   *
   * Validates prerequisites (at least one tier exists), performs idempotency
   * check, updates onboarding phase to COMPLETED, and invalidates cache.
   *
   * Returns a discriminated union so the route handler can map to HTTP responses.
   */
  async completeOnboarding(
    tenantId: string,
    opts?: { publishedUrl?: string; tiersCreated?: number; summary?: string }
  ): Promise<CompleteOnboardingResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    // Idempotent: already completed
    if (tenant.onboardingStatus === 'COMPLETE') {
      logger.info(
        { tenantId },
        '[DiscoveryService] Onboarding already completed - returning idempotent response'
      );
      return {
        status: 'already_complete',
        completedAt: tenant.onboardingCompletedAt ?? null,
      };
    }

    // Prerequisite: at least one tier must exist
    if (!this.catalogService) {
      throw new ServiceUnavailableError('Catalog service not configured');
    }
    const tierCount = await this.catalogService.countTiers(tenantId);
    if (tierCount === 0) {
      logger.warn(
        { tenantId },
        '[DiscoveryService] Blocked onboarding completion - no tiers exist'
      );
      return { status: 'no_tiers' };
    }

    // Update tenant onboarding phase
    const completedAt = new Date();
    await this.tenantRepo.update(tenantId, {
      onboardingStatus: 'COMPLETE',
      onboardingCompletedAt: completedAt,
    });

    this.invalidateBootstrapCache(tenantId);

    return {
      status: 'completed',
      completedAt,
      ...(opts?.publishedUrl !== undefined && { publishedUrl: opts.publishedUrl }),
      ...(opts?.tiersCreated !== undefined && { tiersCreated: opts.tiersCreated }),
      ...(opts?.summary !== undefined && { summary: opts.summary }),
    };
  }

  /**
   * Mark reveal animation as completed for a tenant.
   *
   * One-shot guard: idempotent — writes revealCompletedAt only if not already set.
   * Invalidates bootstrap cache so the next request reflects the new state.
   */
  async markRevealCompleted(tenantId: string): Promise<MarkRevealCompletedResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    if (tenant.revealCompletedAt) {
      return { status: 'already_completed' };
    }

    await this.tenantRepo.update(tenantId, { revealCompletedAt: new Date() });
    this.invalidateBootstrapCache(tenantId);

    logger.info({ tenantId }, '[DiscoveryService] revealCompletedAt written');
    return { status: 'completed' };
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

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
