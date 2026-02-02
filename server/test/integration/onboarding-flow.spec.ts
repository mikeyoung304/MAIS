/**
 * Integration Tests: Agent-Powered Onboarding Flow
 *
 * Tests the complete onboarding flow from discovery through services configuration.
 * Validates advisor memory persistence, session resumption, and tenant isolation.
 *
 * @see server/src/agent/onboarding/advisor-memory.service.ts
 * @see server/src/agent/tools/onboarding-tools.ts
 * @see server/src/agent/onboarding/state-machine.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// SKIPPED: These imports reference deleted files from Agent-First Architecture migration (a527969a)
// TODO: Rewrite tests for new agent-v2 architecture or remove this file entirely
// import { setupIntegrationTest, createMultiTenantSetup } from '../helpers/integration-setup';
// import { PrismaAdvisorMemoryRepository } from '../../src/adapters/prisma/advisor-memory.repository';
// import { AdvisorMemoryService } from '../../src/agent/onboarding/advisor-memory.service';
// import { appendEvent } from '../../src/agent/onboarding/event-sourcing';
// import type { OnboardingEventPayloads } from '@macon/contracts';

// ============================================================================
// Test Data Helpers - Schema-compliant payloads
// ============================================================================

/**
 * Create a valid DISCOVERY_COMPLETED payload that passes Zod validation.
 * Schema: DiscoveryDataSchema.extend({ completedAt: z.string().datetime() })
 */
function createDiscoveryPayload(
  overrides: Partial<OnboardingEventPayloads['DISCOVERY_COMPLETED']> = {}
): OnboardingEventPayloads['DISCOVERY_COMPLETED'] {
  return {
    businessType: 'photographer',
    businessName: 'Test Photography',
    location: { city: 'Austin', state: 'TX', country: 'US' },
    targetMarket: 'premium',
    yearsInBusiness: 5,
    currentAveragePrice: 150000,
    servicesOffered: ['weddings', 'portraits'],
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a valid MARKET_RESEARCH_COMPLETED payload that passes Zod validation.
 * Schema: MarketResearchDataSchema (with correct source enum and tier structure)
 */
function createMarketResearchPayload(
  overrides: Partial<OnboardingEventPayloads['MARKET_RESEARCH_COMPLETED']> = {}
): OnboardingEventPayloads['MARKET_RESEARCH_COMPLETED'] {
  return {
    pricingBenchmarks: {
      source: 'industry_benchmark', // NOT 'industry_benchmarks' - singular!
      marketLowCents: 50000,
      marketMedianCents: 100000,
      marketHighCents: 200000,
      dataFreshness: 'fresh', // Must be 'fresh' | 'cached' | 'fallback'
      recommendedTiers: [
        {
          name: 'Basic',
          description: 'Basic package',
          suggestedPriceCents: 50000,
          priceRangeLowCents: 40000,
          priceRangeHighCents: 60000,
          includedServices: ['30 min session', '10 edited photos'],
        },
        {
          name: 'Standard',
          description: 'Standard package',
          suggestedPriceCents: 100000,
          priceRangeLowCents: 80000,
          priceRangeHighCents: 120000,
          includedServices: ['60 min session', '25 edited photos', 'online gallery'],
        },
        {
          name: 'Premium',
          description: 'Premium package',
          suggestedPriceCents: 200000,
          priceRangeLowCents: 160000,
          priceRangeHighCents: 250000,
          includedServices: ['2 hour session', '50 edited photos', 'online gallery', 'prints'],
        },
      ],
    },
    marketInsights: ['Austin is a competitive market'],
    competitorNames: ['Competitor A'],
    researchCompletedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a valid SERVICES_CONFIGURED payload
 */
function createServicesPayload(
  overrides: Partial<OnboardingEventPayloads['SERVICES_CONFIGURED']> = {}
): OnboardingEventPayloads['SERVICES_CONFIGURED'] {
  return {
    segments: [
      {
        segmentName: 'Photography Sessions',
        segmentSlug: 'photography-sessions',
        packages: [
          {
            name: 'Mini Session',
            slug: 'mini-session',
            description: '30 minute session',
            priceCents: 50000,
            groupingOrder: 1,
          },
          {
            name: 'Full Session',
            slug: 'full-session',
            description: '60 minute session',
            priceCents: 100000,
            groupingOrder: 2,
          },
        ],
      },
    ],
    createdPackageIds: ['pkg_1', 'pkg_2'],
    createdSegmentIds: ['seg_1'],
    configuredAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a valid ONBOARDING_SKIPPED payload
 */
function createSkippedPayload(
  overrides: Partial<OnboardingEventPayloads['ONBOARDING_SKIPPED']> = {}
): OnboardingEventPayloads['ONBOARDING_SKIPPED'] {
  return {
    skippedAt: new Date().toISOString(),
    lastPhase: 'DISCOVERY',
    reason: 'User chose to skip',
    ...overrides,
  };
}

/**
 * Create a valid MARKETING_CONFIGURED payload
 */
function createMarketingPayload(
  overrides: Partial<OnboardingEventPayloads['MARKETING_CONFIGURED']> = {}
): OnboardingEventPayloads['MARKETING_CONFIGURED'] {
  return {
    headline: 'Transform Your Life',
    tagline: 'Expert coaching for ambitious professionals',
    brandVoice: 'professional',
    configuredAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a valid ONBOARDING_COMPLETED payload
 */
function createCompletedPayload(
  overrides: Partial<OnboardingEventPayloads['ONBOARDING_COMPLETED']> = {}
): OnboardingEventPayloads['ONBOARDING_COMPLETED'] {
  return {
    completedAt: new Date().toISOString(),
    phasesCompleted: ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING'],
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

const TEST_FILE_SLUG = 'onboarding-flow';

// SKIPPED: Test file references deleted modules from Agent-First Architecture migration
// PrismaAdvisorMemoryRepository and AdvisorMemoryService were removed in a527969a
// TODO: Rewrite for new agent-v2 architecture
describe.skip('Onboarding Flow Integration', () => {
  const { prisma, cleanup } = {} as any; // Placeholder - test skipped
  const { tenantA, tenantB, cleanupTenants } = {} as any; // Placeholder - test skipped

  let advisorMemoryRepo: any; // Type placeholder - test skipped
  let advisorMemoryService: any; // Type placeholder - test skipped

  beforeEach(async () => {
    await cleanupTenants();
    await tenantA.create();
    await tenantB.create();

    // Initialize services
    advisorMemoryRepo = new PrismaAdvisorMemoryRepository(prisma);
    advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepo);

    // Ensure tenants start with NOT_STARTED phase
    await prisma.tenant.update({
      where: { id: tenantA.id },
      data: { onboardingPhase: 'NOT_STARTED', onboardingVersion: 0 },
    });
    await prisma.tenant.update({
      where: { id: tenantB.id },
      data: { onboardingPhase: 'NOT_STARTED', onboardingVersion: 0 },
    });
  });

  afterEach(async () => {
    // Clean up onboarding events
    await prisma.onboardingEvent.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await cleanup();
  });

  // ============================================================================
  // Phase Transition Tests
  // ============================================================================

  describe('Phase Transitions', () => {
    it('should transition from NOT_STARTED to DISCOVERY with valid data', async () => {
      const tenantId = tenantA.id;

      // Append discovery completed event using schema-compliant payload
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0 // Expected version
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.version).toBe(1);
      }

      // Verify tenant phase updated
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingPhase: true, onboardingVersion: true },
      });

      expect(tenant?.onboardingPhase).toBe('DISCOVERY');
      expect(tenant?.onboardingVersion).toBe(1);
    });

    it('should successfully append market research event with schema-compliant data', async () => {
      const tenantId = tenantA.id;

      // Append market research event using schema-compliant payload
      const result = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload(),
        0
      );

      // Event sourcing doesn't validate transitions - it's the tool's job
      // But we can verify the event was created with correct schema
      expect(result.success).toBe(true);
    });

    it('should allow SKIP transition from any phase', async () => {
      const tenantId = tenantA.id;

      // First transition to DISCOVERY
      const discoveryResult = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );

      expect(discoveryResult.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Skip onboarding
      const skipResult = await appendEvent(
        prisma,
        tenantId,
        'ONBOARDING_SKIPPED',
        createSkippedPayload({ lastPhase: 'DISCOVERY' }),
        1
      );

      expect(skipResult.success).toBe(true);
      if (skipResult.success) {
        expect(skipResult.version).toBe(2);
      }

      // Update tenant phase to SKIPPED
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'SKIPPED', onboardingVersion: 2 },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingPhase: true },
      });

      expect(tenant?.onboardingPhase).toBe('SKIPPED');
    });
  });

  // ============================================================================
  // Advisor Memory Tests
  // ============================================================================

  describe('Advisor Memory Persistence', () => {
    it('should persist discovery data in advisor memory', async () => {
      const tenantId = tenantA.id;

      // Append discovery event using schema-compliant payload
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );

      expect(result.success).toBe(true);

      // Update tenant phase
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Get advisor memory
      const memory = await advisorMemoryRepo.getMemory(tenantId);

      expect(memory).not.toBeNull();
      expect(memory?.currentPhase).toBe('DISCOVERY');
      expect(memory?.discoveryData?.businessType).toBe('photographer');
      expect(memory?.discoveryData?.businessName).toBe('Test Photography');
      expect(memory?.discoveryData?.location.city).toBe('Austin');
      expect(memory?.lastEventVersion).toBe(1);
    });

    it('should project full state from event history', async () => {
      const tenantId = tenantA.id;

      // Add discovery event
      const discoveryResult = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );
      expect(discoveryResult.success).toBe(true);

      // Add market research event
      const marketResult = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload({
          marketInsights: ['Austin is a competitive market'],
        }),
        1
      );
      expect(marketResult.success).toBe(true);

      // Update tenant phase
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'MARKET_RESEARCH', onboardingVersion: 2 },
      });

      // Project from events
      const memory = await advisorMemoryRepo.projectFromEvents(tenantId);

      expect(memory.discoveryData).toBeDefined();
      expect(memory.discoveryData?.businessType).toBe('photographer');
      expect(memory.marketResearchData).toBeDefined();
      expect(memory.marketResearchData?.pricingBenchmarks.source).toBe('industry_benchmark');
      expect(memory.marketResearchData?.marketInsights).toContain('Austin is a competitive market');
      expect(memory.lastEventVersion).toBe(2);
    });

    it('should clear memory when requested', async () => {
      const tenantId = tenantA.id;

      // Add some events
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );
      expect(result.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Verify memory exists
      let memory = await advisorMemoryRepo.getMemory(tenantId);
      expect(memory?.discoveryData).toBeDefined();

      // Clear memory
      await advisorMemoryRepo.clearMemory(tenantId);

      // Verify memory is cleared
      memory = await advisorMemoryRepo.getMemory(tenantId);
      expect(memory?.currentPhase).toBe('NOT_STARTED');
      expect(memory?.lastEventVersion).toBe(0);
      expect(memory?.discoveryData).toBeUndefined();
    });
  });

  // ============================================================================
  // Session Resumption Tests
  // ============================================================================

  describe('Session Resumption', () => {
    it('should detect returning user with existing memory', async () => {
      const tenantId = tenantA.id;

      // Add discovery event (simulating previous session) - 1 day ago
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          completedAt: new Date(Date.now() - 86400000).toISOString(),
        }),
        0
      );
      expect(result.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Check onboarding context
      const onboardingContext = await advisorMemoryService.getOnboardingContext(tenantId);

      expect(onboardingContext.isReturning).toBe(true);
      expect(onboardingContext.memory).toBeDefined();
      expect(onboardingContext.memory?.discoveryData?.businessType).toBe('photographer');
    });

    it('should generate resume summary for returning users', async () => {
      const tenantId = tenantA.id;

      // Add discovery event with specific business name
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessName: 'Austin Photography',
          completedAt: new Date(Date.now() - 86400000).toISOString(),
        }),
        0
      );
      expect(result.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Get resume summary
      const summary = await advisorMemoryService.getResumeSummary(tenantId);

      expect(summary).toBeDefined();
      // The summary should contain relevant info about the business
      expect(summary).toMatch(/Austin Photography|photographer|Austin/i);
    });

    it('should not flag first-time user as returning', async () => {
      const tenantId = tenantA.id;

      // No events added - fresh tenant
      const onboardingContext = await advisorMemoryService.getOnboardingContext(tenantId);

      expect(onboardingContext.isReturning).toBe(false);
      expect(onboardingContext.memory?.lastEventVersion).toBe(0);
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should keep onboarding state isolated between tenants', async () => {
      // Tenant A completes discovery
      const resultA = await appendEvent(
        prisma,
        tenantA.id,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessName: 'Tenant A Photography',
        }),
        0
      );
      expect(resultA.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantA.id },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Tenant B completes discovery differently
      const resultB = await appendEvent(
        prisma,
        tenantB.id,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessType: 'coach',
          businessName: 'Tenant B Coaching',
          location: { city: 'New York', state: 'NY', country: 'US' },
          targetMarket: 'luxury',
        }),
        0
      );
      expect(resultB.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantB.id },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Verify each tenant sees only their data
      const memoryA = await advisorMemoryRepo.getMemory(tenantA.id);
      const memoryB = await advisorMemoryRepo.getMemory(tenantB.id);

      expect(memoryA?.discoveryData?.businessType).toBe('photographer');
      expect(memoryA?.discoveryData?.businessName).toBe('Tenant A Photography');
      expect(memoryA?.discoveryData?.location.city).toBe('Austin');

      expect(memoryB?.discoveryData?.businessType).toBe('coach');
      expect(memoryB?.discoveryData?.businessName).toBe('Tenant B Coaching');
      expect(memoryB?.discoveryData?.location.city).toBe('New York');
    });

    it('should isolate event history between tenants', async () => {
      // Add events to tenant A
      const result1 = await appendEvent(
        prisma,
        tenantA.id,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({ businessName: 'Tenant A' }),
        0
      );
      expect(result1.success).toBe(true);

      const result2 = await appendEvent(
        prisma,
        tenantA.id,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload(),
        1
      );
      expect(result2.success).toBe(true);

      // Add event to tenant B
      const result3 = await appendEvent(
        prisma,
        tenantB.id,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessType: 'coach',
          businessName: 'Tenant B',
          location: { city: 'NY', state: 'NY', country: 'US' },
        }),
        0
      );
      expect(result3.success).toBe(true);

      // Check event history for each tenant
      const historyA = await advisorMemoryRepo.getEventHistory(tenantA.id);
      const historyB = await advisorMemoryRepo.getEventHistory(tenantB.id);

      expect(historyA).toHaveLength(2);
      expect(historyB).toHaveLength(1);

      // Verify no cross-tenant data leakage
      const historyATypes = historyA.map((e) => e.eventType);
      expect(historyATypes).toContain('DISCOVERY_COMPLETED');
      expect(historyATypes).toContain('MARKET_RESEARCH_COMPLETED');
    });
  });

  // ============================================================================
  // Optimistic Locking Tests
  // ============================================================================

  describe('Optimistic Locking (Concurrent Modification)', () => {
    it('should detect concurrent modifications', async () => {
      const tenantId = tenantA.id;

      // First event succeeds
      const result1 = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );

      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.version).toBe(1);
      }

      // Second event with stale version fails
      const result2 = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload(),
        0 // Wrong version - should be 1
      );

      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('CONCURRENT_MODIFICATION');
        if (result2.error === 'CONCURRENT_MODIFICATION') {
          expect(result2.currentVersion).toBe(1);
        }
      }
    });

    it('should allow sequential events with correct versions', async () => {
      const tenantId = tenantA.id;

      const result1 = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );

      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.version).toBe(1);
      }

      const result2 = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload(),
        1 // Correct version
      );

      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.version).toBe(2);
      }
    });
  });

  // ============================================================================
  // Complete Flow Tests
  // ============================================================================

  describe('Complete Onboarding Flow', () => {
    it('should complete full onboarding flow: discovery → market research → services', async () => {
      const tenantId = tenantA.id;

      // Step 1: Discovery
      const discoveryResult = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessName: 'Austin Wedding Photography',
          yearsInBusiness: 5,
          currentAveragePrice: 300000,
          servicesOffered: ['weddings', 'engagements', 'portraits'],
        }),
        0
      );

      expect(discoveryResult.success).toBe(true);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Step 2: Market Research
      const marketResearchResult = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload({
          pricingBenchmarks: {
            source: 'industry_benchmark',
            marketLowCents: 200000,
            marketMedianCents: 400000,
            marketHighCents: 800000,
            dataFreshness: 'fresh',
            competitorCount: 15,
            recommendedTiers: [
              {
                name: 'Essential',
                description: 'Basic coverage',
                suggestedPriceCents: 250000,
                priceRangeLowCents: 200000,
                priceRangeHighCents: 300000,
                includedServices: ['4 hours coverage', '200 images'],
              },
              {
                name: 'Classic',
                description: 'Full day coverage',
                suggestedPriceCents: 450000,
                priceRangeLowCents: 380000,
                priceRangeHighCents: 520000,
                includedServices: ['8 hours coverage', '500 images'],
              },
              {
                name: 'Luxury',
                description: 'Premium experience',
                suggestedPriceCents: 750000,
                priceRangeLowCents: 650000,
                priceRangeHighCents: 900000,
                includedServices: ['Full day', 'engagement session', 'album'],
              },
            ],
          },
          marketInsights: [
            'Austin is a competitive wedding market',
            'Premium positioning works well in this area',
          ],
          competitorNames: ['Austin Weddings', 'Hill Country Photos'],
        }),
        1
      );

      expect(marketResearchResult.success).toBe(true);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'MARKET_RESEARCH', onboardingVersion: 2 },
      });

      // Step 3: Services Configuration
      const servicesResult = await appendEvent(
        prisma,
        tenantId,
        'SERVICES_CONFIGURED',
        createServicesPayload({
          segments: [
            {
              segmentName: 'Wedding Photography',
              segmentSlug: 'wedding-photography',
              packages: [
                {
                  name: 'Essential Coverage',
                  slug: 'essential-coverage',
                  description: '4 hours of coverage, 200 edited images',
                  priceCents: 250000,
                  groupingOrder: 1,
                },
                {
                  name: 'Classic Package',
                  slug: 'classic-package',
                  description: '8 hours of coverage, 500 edited images',
                  priceCents: 450000,
                  groupingOrder: 2,
                },
                {
                  name: 'Luxury Experience',
                  slug: 'luxury-experience',
                  description: 'Full day + engagement session',
                  priceCents: 750000,
                  groupingOrder: 3,
                },
              ],
            },
          ],
          createdPackageIds: ['pkg_1', 'pkg_2', 'pkg_3'],
          createdSegmentIds: ['seg_1'],
        }),
        2
      );

      expect(servicesResult.success).toBe(true);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'SERVICES', onboardingVersion: 3 },
      });

      // Verify final state
      const finalMemory = await advisorMemoryRepo.projectFromEvents(tenantId);

      expect(finalMemory.discoveryData?.businessType).toBe('photographer');
      expect(finalMemory.discoveryData?.businessName).toBe('Austin Wedding Photography');
      expect(finalMemory.marketResearchData?.pricingBenchmarks.recommendedTiers).toHaveLength(3);
      expect(finalMemory.servicesData?.segments).toHaveLength(1);
      expect(finalMemory.servicesData?.createdPackageIds).toHaveLength(3);
      expect(finalMemory.lastEventVersion).toBe(3);
    });

    it('should mark onboarding as complete after all phases', async () => {
      const tenantId = tenantA.id;

      // Add all phase events
      const r1 = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload({
          businessType: 'coach',
          businessName: 'Life Coaching Co',
          location: { city: 'Denver', state: 'CO', country: 'US' },
        }),
        0
      );
      expect(r1.success).toBe(true);

      const r2 = await appendEvent(
        prisma,
        tenantId,
        'MARKET_RESEARCH_COMPLETED',
        createMarketResearchPayload(),
        1
      );
      expect(r2.success).toBe(true);

      const r3 = await appendEvent(
        prisma,
        tenantId,
        'SERVICES_CONFIGURED',
        createServicesPayload({
          segments: [
            {
              segmentName: 'Coaching',
              segmentSlug: 'coaching',
              packages: [
                {
                  name: 'Session',
                  slug: 'session',
                  description: 'Single session',
                  priceCents: 15000,
                  groupingOrder: 1,
                },
              ],
            },
          ],
        }),
        2
      );
      expect(r3.success).toBe(true);

      const r4 = await appendEvent(
        prisma,
        tenantId,
        'MARKETING_CONFIGURED',
        createMarketingPayload(),
        3
      );
      expect(r4.success).toBe(true);

      // Mark as completed
      const r5 = await appendEvent(
        prisma,
        tenantId,
        'ONBOARDING_COMPLETED',
        createCompletedPayload(),
        4
      );
      expect(r5.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: 'COMPLETED',
          onboardingVersion: 5,
          onboardingCompletedAt: new Date(),
        },
      });

      // Verify completion
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingPhase: true,
          onboardingCompletedAt: true,
          onboardingVersion: true,
        },
      });

      expect(tenant?.onboardingPhase).toBe('COMPLETED');
      expect(tenant?.onboardingCompletedAt).toBeDefined();
      expect(tenant?.onboardingVersion).toBe(5);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing tenant gracefully', async () => {
      const fakeId = 'nonexistent-tenant-id';

      const memory = await advisorMemoryRepo.getMemory(fakeId);

      expect(memory).toBeNull();
    });

    it('should reject events with malformed payloads at validation stage', async () => {
      const tenantId = tenantA.id;

      // Try to add event with malformed payload (missing required fields)
      // The Zod validation should reject this
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          // Missing required fields - Zod will reject
          invalidField: 'test',
        } as any,
        0
      );

      // Should fail validation
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle projection of events with valid payloads', async () => {
      const tenantId = tenantA.id;

      // Add a valid event
      const result = await appendEvent(
        prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        createDiscoveryPayload(),
        0
      );
      expect(result.success).toBe(true);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Project should work correctly
      const memory = await advisorMemoryRepo.projectFromEvents(tenantId);

      expect(memory).toBeDefined();
      expect(memory.discoveryData?.businessType).toBe('photographer');
      expect(memory.lastEventVersion).toBe(1);
    });
  });
});
