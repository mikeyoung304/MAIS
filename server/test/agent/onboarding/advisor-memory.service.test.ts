/**
 * Advisor Memory Service Tests
 *
 * Tests for the Phase 3 AdvisorMemoryService that provides context summaries
 * for session resumption in the onboarding agent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvisorMemoryService } from '../../../src/agent/onboarding/advisor-memory.service';
import type { AdvisorMemoryRepository } from '../../../src/lib/ports';
import type { AdvisorMemory, OnboardingPhase } from '@macon/contracts';

describe('AdvisorMemoryService', () => {
  let mockRepository: jest.Mocked<AdvisorMemoryRepository>;
  let service: AdvisorMemoryService;

  beforeEach(() => {
    mockRepository = {
      getMemory: vi.fn(),
      projectFromEvents: vi.fn(),
      clearMemory: vi.fn(),
      getEventHistory: vi.fn(),
    } as unknown as jest.Mocked<AdvisorMemoryRepository>;

    service = new AdvisorMemoryService(mockRepository);
  });

  describe('getOnboardingContext', () => {
    it('returns empty context for new user (no memory)', async () => {
      mockRepository.getMemory.mockResolvedValue(null);

      const context = await service.getOnboardingContext('tenant_123');

      expect(context).toEqual({
        tenantId: 'tenant_123',
        currentPhase: 'NOT_STARTED',
        memory: null,
        summaries: {
          discovery: '',
          marketContext: '',
          preferences: '',
          decisions: '',
          pendingQuestions: "Let's get started!",
        },
        isReturning: false,
        lastActiveAt: null,
      });
    });

    it('returns returning user context with memory', async () => {
      const mockMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'MARKET_RESEARCH' as OnboardingPhase,
        discoveryData: {
          businessType: 'photographer',
          businessName: 'Test Studio',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
        },
        lastEventVersion: 2,
        lastEventTimestamp: new Date().toISOString(),
      };

      mockRepository.getMemory.mockResolvedValue(mockMemory);

      const context = await service.getOnboardingContext('tenant_123');

      expect(context.isReturning).toBe(true);
      expect(context.currentPhase).toBe('MARKET_RESEARCH');
      expect(context.memory).toEqual(mockMemory);
      expect(context.summaries.discovery).toContain('photographer');
      expect(context.summaries.discovery).toContain('Austin');
    });
  });

  describe('isOnboardingComplete', () => {
    it('returns true for COMPLETED phase', async () => {
      mockRepository.getMemory.mockResolvedValue({
        tenantId: 'tenant_123',
        currentPhase: 'COMPLETED' as OnboardingPhase,
        lastEventVersion: 5,
        lastEventTimestamp: new Date().toISOString(),
      });

      const isComplete = await service.isOnboardingComplete('tenant_123');
      expect(isComplete).toBe(true);
    });

    it('returns true for SKIPPED phase', async () => {
      mockRepository.getMemory.mockResolvedValue({
        tenantId: 'tenant_123',
        currentPhase: 'SKIPPED' as OnboardingPhase,
        lastEventVersion: 1,
        lastEventTimestamp: new Date().toISOString(),
      });

      const isComplete = await service.isOnboardingComplete('tenant_123');
      expect(isComplete).toBe(true);
    });

    it('returns false for in-progress phases', async () => {
      mockRepository.getMemory.mockResolvedValue({
        tenantId: 'tenant_123',
        currentPhase: 'SERVICES' as OnboardingPhase,
        lastEventVersion: 3,
        lastEventTimestamp: new Date().toISOString(),
      });

      const isComplete = await service.isOnboardingComplete('tenant_123');
      expect(isComplete).toBe(false);
    });
  });

  describe('getResumeSummary', () => {
    it('returns null for new user', async () => {
      mockRepository.getMemory.mockResolvedValue(null);

      const summary = await service.getResumeSummary('tenant_123');
      expect(summary).toBeNull();
    });

    it('returns context summary for returning user', async () => {
      const mockMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'SERVICES' as OnboardingPhase,
        discoveryData: {
          businessType: 'photographer',
          businessName: 'Test Studio',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'luxury',
          yearsInBusiness: 5,
        },
        marketResearchData: {
          pricingBenchmarks: {
            source: 'web_search',
            marketLowCents: 200000,
            marketMedianCents: 350000,
            marketHighCents: 500000,
            recommendedTiers: [],
            dataFreshness: 'fresh',
            competitorCount: 3,
          },
          researchCompletedAt: new Date().toISOString(),
        },
        lastEventVersion: 3,
        lastEventTimestamp: new Date().toISOString(),
      };

      mockRepository.getMemory.mockResolvedValue(mockMemory);

      const summary = await service.getResumeSummary('tenant_123');

      expect(summary).not.toBeNull();
      expect(summary).toContain('Welcome back');
      expect(summary).toContain('photographer');
    });
  });

  describe('summary projections', () => {
    it('summarizes discovery data correctly', async () => {
      const mockMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'DISCOVERY' as OnboardingPhase,
        discoveryData: {
          businessType: 'wedding_planner',
          businessName: 'Perfect Day Events',
          location: { city: 'Denver', state: 'CO', country: 'US' },
          targetMarket: 'luxury',
          yearsInBusiness: 10,
          servicesOffered: ['Full planning', 'Day-of coordination', 'Design'],
        },
        lastEventVersion: 1,
        lastEventTimestamp: new Date().toISOString(),
      };

      mockRepository.getMemory.mockResolvedValue(mockMemory);

      const context = await service.getOnboardingContext('tenant_123');

      expect(context.summaries.discovery).toContain('wedding_planner');
      expect(context.summaries.discovery).toContain('Denver');
      expect(context.summaries.discovery).toContain('CO');
      expect(context.summaries.discovery).toContain('10 years');
      expect(context.summaries.discovery).toContain('Luxury market');
    });

    it('summarizes market research data correctly', async () => {
      const mockMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'SERVICES' as OnboardingPhase,
        marketResearchData: {
          pricingBenchmarks: {
            source: 'industry_benchmark',
            marketLowCents: 150000, // $1,500
            marketMedianCents: 300000, // $3,000
            marketHighCents: 600000, // $6,000
            recommendedTiers: [],
            dataFreshness: 'fallback',
            competitorCount: 5,
          },
          marketInsights: ['High demand for elopement photography'],
          researchCompletedAt: new Date().toISOString(),
        },
        lastEventVersion: 2,
        lastEventTimestamp: new Date().toISOString(),
      };

      mockRepository.getMemory.mockResolvedValue(mockMemory);

      const context = await service.getOnboardingContext('tenant_123');

      expect(context.summaries.marketContext).toContain('$1,500');
      expect(context.summaries.marketContext).toContain('$6,000');
      expect(context.summaries.marketContext).toContain('industry averages');
      expect(context.summaries.marketContext).toContain('5 competitors');
    });

    it('summarizes services data correctly', async () => {
      const mockMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'MARKETING' as OnboardingPhase,
        servicesData: {
          segments: [
            {
              segmentName: 'Weddings',
              segmentSlug: 'weddings',
              packages: [
                { name: 'Elopement', slug: 'elopement', priceCents: 200000, groupingOrder: 1 },
                { name: 'Full Day', slug: 'full-day', priceCents: 500000, groupingOrder: 2 },
              ],
            },
          ],
          createdPackageIds: ['pkg_1', 'pkg_2'],
          createdSegmentIds: ['seg_1'],
        },
        lastEventVersion: 3,
        lastEventTimestamp: new Date().toISOString(),
      };

      mockRepository.getMemory.mockResolvedValue(mockMemory);

      const context = await service.getOnboardingContext('tenant_123');

      expect(context.summaries.decisions).toContain('2 packages');
      expect(context.summaries.decisions).toContain('Weddings');
    });
  });
});
