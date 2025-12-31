/**
 * Prisma Advisor Memory Repository
 *
 * Implements AdvisorMemoryRepository interface for onboarding agent.
 * Projects memory state from event history using event sourcing pattern.
 *
 * Architecture:
 * - Reads from OnboardingEvent table
 * - Projects current state by replaying events
 * - Uses Zod schemas for payload validation
 */

import type { PrismaClient } from '../../generated/prisma';
import type { AdvisorMemoryRepository, AdvisorMemory } from '../../lib/ports';
import {
  DiscoveryDataSchema,
  MarketResearchDataSchema,
  ServicesDataSchema,
  MarketingDataSchema,
} from '@macon/contracts';
import { logger } from '../../lib/core/logger';

/**
 * Prisma implementation of AdvisorMemoryRepository
 */
export class PrismaAdvisorMemoryRepository implements AdvisorMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get current advisor memory for a tenant.
   * Returns null if tenant doesn't exist or has no onboarding state.
   */
  async getMemory(tenantId: string): Promise<AdvisorMemory | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        onboardingPhase: true,
        onboardingVersion: true,
      },
    });

    if (!tenant) {
      return null;
    }

    // If version is 0 and phase is NOT_STARTED, no events exist yet
    if (tenant.onboardingVersion === 0 && tenant.onboardingPhase === 'NOT_STARTED') {
      return {
        tenantId,
        currentPhase: tenant.onboardingPhase,
        lastEventVersion: 0,
        lastEventTimestamp: new Date().toISOString(),
      };
    }

    // Project full state from events
    return this.projectFromEvents(tenantId);
  }

  /**
   * Project memory from event history.
   * Replays all events in order to build current state.
   */
  async projectFromEvents(tenantId: string): Promise<AdvisorMemory> {
    // Get tenant's current phase
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingPhase: true, onboardingVersion: true },
    });

    // Get all events in order
    const events = await this.prisma.onboardingEvent.findMany({
      where: { tenantId },
      orderBy: { version: 'asc' },
    });

    // Initialize memory with defaults
    const memory: AdvisorMemory = {
      tenantId,
      currentPhase: tenant?.onboardingPhase || 'NOT_STARTED',
      lastEventVersion: tenant?.onboardingVersion || 0,
      lastEventTimestamp: events.length > 0
        ? events[events.length - 1].timestamp.toISOString()
        : new Date().toISOString(),
    };

    // Replay events to build state
    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;

      try {
        switch (event.eventType) {
          case 'DISCOVERY_COMPLETED': {
            const parsed = DiscoveryDataSchema.safeParse(payload);
            if (parsed.success) {
              memory.discoveryData = {
                businessType: parsed.data.businessType,
                businessName: parsed.data.businessName,
                location: parsed.data.location,
                targetMarket: parsed.data.targetMarket,
                yearsInBusiness: parsed.data.yearsInBusiness,
                currentAveragePrice: parsed.data.currentAveragePrice,
                servicesOffered: parsed.data.servicesOffered,
              };
            } else {
              logger.warn(
                { tenantId, eventId: event.id, error: parsed.error },
                'Failed to parse DISCOVERY_COMPLETED payload'
              );
            }
            break;
          }

          case 'MARKET_RESEARCH_COMPLETED': {
            const parsed = MarketResearchDataSchema.safeParse(payload);
            if (parsed.success) {
              memory.marketResearchData = {
                pricingBenchmarks: {
                  source: parsed.data.pricingBenchmarks.source,
                  marketLowCents: parsed.data.pricingBenchmarks.marketLowCents,
                  marketMedianCents: parsed.data.pricingBenchmarks.marketMedianCents,
                  marketHighCents: parsed.data.pricingBenchmarks.marketHighCents,
                  recommendedTiers: parsed.data.pricingBenchmarks.recommendedTiers,
                  competitorCount: parsed.data.pricingBenchmarks.competitorCount,
                  dataFreshness: parsed.data.pricingBenchmarks.dataFreshness,
                },
                marketInsights: parsed.data.marketInsights,
                competitorNames: parsed.data.competitorNames,
                researchCompletedAt: parsed.data.researchCompletedAt,
              };
            } else {
              logger.warn(
                { tenantId, eventId: event.id, error: parsed.error },
                'Failed to parse MARKET_RESEARCH_COMPLETED payload'
              );
            }
            break;
          }

          case 'SERVICES_CONFIGURED': {
            const parsed = ServicesDataSchema.safeParse(payload);
            if (parsed.success) {
              memory.servicesData = {
                segments: parsed.data.segments.map((s) => ({
                  segmentName: s.segmentName,
                  segmentSlug: s.segmentSlug,
                  packages: s.packages.map((p) => ({
                    name: p.name,
                    slug: p.slug,
                    description: p.description,
                    priceCents: p.priceCents,
                    groupingOrder: p.groupingOrder,
                  })),
                })),
                createdPackageIds: parsed.data.createdPackageIds,
                createdSegmentIds: parsed.data.createdSegmentIds,
              };
            } else {
              logger.warn(
                { tenantId, eventId: event.id, error: parsed.error },
                'Failed to parse SERVICES_CONFIGURED payload'
              );
            }
            break;
          }

          case 'MARKETING_CONFIGURED': {
            const parsed = MarketingDataSchema.safeParse(payload);
            if (parsed.success) {
              memory.marketingData = {
                headline: parsed.data.headline,
                tagline: parsed.data.tagline,
                brandVoice: parsed.data.brandVoice,
                heroImageUrl: parsed.data.heroImageUrl,
                primaryColor: parsed.data.primaryColor,
              };
            } else {
              logger.warn(
                { tenantId, eventId: event.id, error: parsed.error },
                'Failed to parse MARKETING_CONFIGURED payload'
              );
            }
            break;
          }

          // Other events don't contribute to memory state
          // (DISCOVERY_STARTED, MARKET_RESEARCH_STARTED, etc. are tracking events)
        }
      } catch (error) {
        logger.error(
          { tenantId, eventId: event.id, eventType: event.eventType, error },
          'Error processing onboarding event'
        );
      }

      // Update last event info
      memory.lastEventVersion = event.version;
      memory.lastEventTimestamp = event.timestamp.toISOString();
    }

    return memory;
  }

  /**
   * Clear all onboarding memory for a tenant.
   * Deletes all events and resets tenant onboarding state.
   */
  async clearMemory(tenantId: string): Promise<void> {
    await this.prisma.$transaction([
      // Delete all onboarding events
      this.prisma.onboardingEvent.deleteMany({
        where: { tenantId },
      }),
      // Reset tenant onboarding state
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: 'NOT_STARTED',
          onboardingVersion: 0,
          onboardingCompletedAt: null,
        },
      }),
    ]);

    logger.info({ tenantId }, 'Cleared onboarding memory');
  }

  /**
   * Get event history for a tenant.
   * Returns events in descending order (newest first).
   */
  async getEventHistory(
    tenantId: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      eventType: string;
      version: number;
      timestamp: Date;
    }>
  > {
    const events = await this.prisma.onboardingEvent.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        version: true,
        timestamp: true,
      },
    });

    return events;
  }
}
