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
// Service
// =============================================================================

export class ResearchService {
  private readonly researchAgentUrl: string | undefined;

  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly invalidateBootstrapCache: (tenantId: string) => void
  ) {
    this.researchAgentUrl = process.env.RESEARCH_AGENT_URL;
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
          // Store research results in branding.researchData
          const freshTenant = await this.tenantRepo.findById(tenantId);
          if (freshTenant) {
            const freshBranding = (freshTenant.branding as Record<string, unknown>) || {};
            await this.tenantRepo.update(tenantId, {
              branding: { ...freshBranding, researchData },
            });
            this.invalidateBootstrapCache(tenantId);
            logger.info({ tenantId }, '[ResearchService] Background research stored successfully');
          }
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

  /**
   * Clear the _researchTriggered flag so the next store-discovery-fact call
   * can retry the research trigger. Called on research failure.
   *
   * This fixes a bug where the flag was set BEFORE the async call, and if the
   * call failed, research could never be retried for that tenant.
   */
  private async clearResearchTriggeredFlag(tenantId: string): Promise<void> {
    try {
      const tenant = await this.tenantRepo.findById(tenantId);
      if (!tenant) return;

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

      if (discoveryFacts['_researchTriggered']) {
        delete discoveryFacts['_researchTriggered'];
        await this.tenantRepo.update(tenantId, {
          branding: { ...branding, discoveryFacts },
        });
        logger.info({ tenantId }, '[ResearchService] Cleared _researchTriggered flag for retry');
      }
    } catch (error) {
      // Log but don't throw -- this is cleanup during error handling
      logger.warn(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[ResearchService] Failed to clear _researchTriggered flag'
      );
    }
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
