/**
 * Research Service
 *
 * Manages async background research triggers and result storage.
 * Extracted from internal-agent-discovery.routes.ts to follow the service pattern.
 *
 * Responsibilities:
 * - Fire-and-forget async HTTP call to the research agent (Cloud Run)
 * - Store research results in tenant.branding.researchData
 * - Read pre-computed research results
 * - Clear _researchTriggered flag on failure so retry is possible
 *
 * RACE CONDITION MITIGATION:
 * Both storeResults() and clearResearchTriggeredFlag() perform a read-modify-write
 * on the tenant.branding JSON column, which can clobber concurrent writes from
 * DiscoveryService.storeFact(). We mitigate this with an optimistic retry pattern:
 * after writing, we re-read and verify our target key persists. If clobbered, we
 * retry the full read-modify-write cycle. This is sufficient because onboarding is
 * a single-user flow and the race window is sub-millisecond.
 *
 * CRITICAL: All methods require tenantId for multi-tenant isolation.
 */

import { logger } from '../lib/core/logger';
import { cloudRunAuth } from './cloud-run-auth.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';

// =============================================================================
// Types
// =============================================================================

export interface ResearchDataResult {
  success: boolean;
  hasData: boolean;
  researchData: Record<string, unknown> | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Max retries for optimistic read-modify-write on tenant.branding */
const BRANDING_WRITE_MAX_RETRIES = 2;

/** Delay between retries in ms (allows concurrent write to settle) */
const BRANDING_WRITE_RETRY_DELAY_MS = 50;

// =============================================================================
// Service
// =============================================================================

export class ResearchService {
  private readonly researchAgentUrl: string | undefined;
  private onBootstrapCacheInvalidate: ((tenantId: string) => void) | undefined;

  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    researchAgentUrl?: string
  ) {
    this.researchAgentUrl = researchAgentUrl;
  }

  /**
   * Set the bootstrap cache invalidation callback.
   * Used by DI to break the circular dependency: ResearchService ↔ DiscoveryService.
   * Must be called before triggerAsync() is invoked.
   */
  setBootstrapCacheInvalidator(fn: (tenantId: string) => void): void {
    this.onBootstrapCacheInvalidate = fn;
  }

  /**
   * Fire-and-forget async research trigger.
   *
   * Calls the research agent via HTTP, stores results in tenant.branding.researchData,
   * and clears the _researchTriggered flag on failure so the next store-discovery-fact
   * call can retry.
   *
   * This method does NOT await -- it starts the async operation and returns immediately.
   */
  triggerAsync(tenantId: string, businessType: string, location: string): void {
    if (!this.researchAgentUrl) {
      logger.warn(
        { tenantId },
        '[ResearchService] RESEARCH_AGENT_URL not configured -- skipping research'
      );
      return;
    }

    logger.info(
      { tenantId, businessType, location },
      '[ResearchService] Firing async background research'
    );

    const researchAgentUrl = this.researchAgentUrl;

    // Fire-and-forget: do NOT await -- user continues chatting
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
          await this.storeResearchData(tenantId, researchData);
          this.onBootstrapCacheInvalidate?.(tenantId);
          logger.info({ tenantId }, '[ResearchService] Background research stored successfully');
        } else {
          logger.warn(
            { tenantId, status: response.status },
            '[ResearchService] Background research failed'
          );
          // Clear _researchTriggered flag so retry is possible on next fact storage
          await this.clearResearchTriggeredFlag(tenantId);
        }
      } catch (error) {
        logger.warn(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[ResearchService] Background research error (non-blocking)'
        );
        // Clear _researchTriggered flag so retry is possible on next fact storage
        await this.clearResearchTriggeredFlag(tenantId);
      }
    })();
  }

  /**
   * Get pre-computed research results for a tenant.
   * Used by tenant-agent's delegate_to_research tool to check for cached results
   * before making an expensive 30-90s direct call to the research agent.
   */
  async getPrecomputedResults(tenantId: string): Promise<ResearchDataResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new ResearchTenantNotFoundError(tenantId);
    }

    const branding = (tenant.branding as Record<string, unknown>) || {};
    const researchData = branding.researchData as Record<string, unknown> | undefined;

    return {
      success: true,
      hasData: !!researchData,
      researchData: researchData || null,
    };
  }

  // ===========================================================================
  // Private — Atomic-safe branding mutations (optimistic retry)
  // ===========================================================================

  /**
   * Store research data in tenant.branding.researchData with optimistic retry.
   *
   * Performs read-modify-write with post-write verification: after writing,
   * re-reads the tenant to confirm `researchData` was not clobbered by a
   * concurrent DiscoveryService.storeFact() write. Retries if clobbered.
   */
  private async storeResearchData(tenantId: string, researchData: unknown): Promise<void> {
    for (let attempt = 0; attempt <= BRANDING_WRITE_MAX_RETRIES; attempt++) {
      const tenant = await this.tenantRepo.findById(tenantId);
      if (!tenant) return;

      const branding = (tenant.branding as Record<string, unknown>) || {};
      await this.tenantRepo.update(tenantId, {
        branding: { ...branding, researchData },
      });

      // Verify write was not clobbered
      const verification = await this.tenantRepo.findById(tenantId);
      const verifyBranding = (verification?.branding as Record<string, unknown>) || {};
      if (verifyBranding.researchData !== undefined) {
        return; // Write persisted — success
      }

      // Write was clobbered by concurrent update — retry
      logger.warn(
        { tenantId, attempt },
        '[ResearchService] researchData clobbered by concurrent write, retrying'
      );
      await this.delay(BRANDING_WRITE_RETRY_DELAY_MS);
    }

    // Exhausted retries — log but don't throw (fire-and-forget context)
    logger.error(
      { tenantId, maxRetries: BRANDING_WRITE_MAX_RETRIES },
      '[ResearchService] Failed to persist researchData after retries'
    );
  }

  /**
   * Clear the _researchTriggered flag so the next store-discovery-fact call
   * can retry the research trigger. Called on research failure.
   *
   * Uses optimistic retry to avoid clobbering concurrent discoveryFacts writes.
   * After deleting the flag and writing back, verifies the flag is actually gone
   * and that other discoveryFacts keys were not lost.
   */
  private async clearResearchTriggeredFlag(tenantId: string): Promise<void> {
    try {
      for (let attempt = 0; attempt <= BRANDING_WRITE_MAX_RETRIES; attempt++) {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) return;

        const branding = (tenant.branding as Record<string, unknown>) || {};
        const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

        if (!discoveryFacts['_researchTriggered']) {
          return; // Flag already cleared — nothing to do
        }

        // Snapshot non-metadata fact keys before write (for clobber detection)
        const factKeysBefore = Object.keys(discoveryFacts).filter((k) => !k.startsWith('_'));

        delete discoveryFacts['_researchTriggered'];
        await this.tenantRepo.update(tenantId, {
          branding: { ...branding, discoveryFacts },
        });

        // Verify: flag is gone AND no real fact keys were lost
        const verification = await this.tenantRepo.findById(tenantId);
        const verifyBranding = (verification?.branding as Record<string, unknown>) || {};
        const verifyFacts = (verifyBranding.discoveryFacts as Record<string, unknown>) || {};
        const factKeysAfter = Object.keys(verifyFacts).filter((k) => !k.startsWith('_'));

        const flagCleared = !verifyFacts['_researchTriggered'];
        const noFactsLost = factKeysBefore.every((k) => k in verifyFacts);

        if (flagCleared && noFactsLost) {
          logger.info({ tenantId }, '[ResearchService] Cleared _researchTriggered flag for retry');
          return; // Success
        }

        // Clobbered — concurrent write restored the flag or lost fact keys
        logger.warn(
          {
            tenantId,
            attempt,
            flagCleared,
            factKeysBefore,
            factKeysAfter,
          },
          '[ResearchService] _researchTriggered clear clobbered by concurrent write, retrying'
        );
        await this.delay(BRANDING_WRITE_RETRY_DELAY_MS);
      }

      // Exhausted retries — log but don't throw (cleanup during error handling)
      logger.error(
        { tenantId, maxRetries: BRANDING_WRITE_MAX_RETRIES },
        '[ResearchService] Failed to clear _researchTriggered flag after retries'
      );
    } catch (error) {
      // Log but don't throw -- this is cleanup during error handling
      logger.warn(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[ResearchService] Failed to clear _researchTriggered flag'
      );
    }
  }

  /** Small delay for retry backoff */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Error Classes
// =============================================================================

export class ResearchTenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = 'ResearchTenantNotFoundError';
  }
}
