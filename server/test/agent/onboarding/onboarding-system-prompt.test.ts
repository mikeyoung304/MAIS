/**
 * Onboarding System Prompt Tests
 *
 * Tests for the Phase 3 onboarding system prompt with phase injection.
 */

import { describe, it, expect } from 'vitest';
import {
  buildOnboardingSystemPrompt,
  getOnboardingGreeting,
} from '../../../src/agent/prompts/onboarding-system-prompt';
import type { AdvisorMemory, OnboardingPhase } from '@macon/contracts';

describe('buildOnboardingSystemPrompt', () => {
  describe('prompt structure', () => {
    it('includes business name in prompt', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Photography',
        currentPhase: 'NOT_STARTED',
        isResume: false,
      });

      expect(prompt).toContain('Test Photography');
    });

    it('includes HANDLED brand voice guidelines', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'DISCOVERY',
        isResume: false,
      });

      expect(prompt).toContain('Cheeky but professional');
      expect(prompt).toContain('Anti-hype');
      expect(prompt).toContain('Words to avoid');
    });

    it('includes trust tier documentation', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'SERVICES',
        isResume: false,
      });

      expect(prompt).toContain('T1');
      expect(prompt).toContain('T2');
      expect(prompt).toContain('update_onboarding_state');
      expect(prompt).toContain('upsert_services');
    });
  });

  describe('phase-specific guidance', () => {
    it('includes discovery phase guidance for NOT_STARTED', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'NOT_STARTED',
        isResume: false,
      });

      expect(prompt).toContain('Getting Started');
      expect(prompt).toContain('kind of services');
      expect(prompt).toContain('Where are you based');
    });

    it('includes market research guidance for MARKET_RESEARCH phase', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'MARKET_RESEARCH',
        isResume: false,
      });

      expect(prompt).toContain('Market Research');
      expect(prompt).toContain('get_market_research');
      expect(prompt).toContain('pricing');
    });

    it('includes services guidance for SERVICES phase', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'SERVICES',
        isResume: false,
      });

      expect(prompt).toContain('Service Design');
      expect(prompt).toContain('Three-Tier Framework');
      expect(prompt).toContain('upsert_services');
    });

    it('includes marketing guidance for MARKETING phase', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'MARKETING',
        isResume: false,
      });

      expect(prompt).toContain('Website Setup');
      expect(prompt).toContain('headline');
      expect(prompt).toContain('update_page_section');
    });

    it('includes completion guidance for COMPLETED phase', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Test Studio',
        currentPhase: 'COMPLETED',
        isResume: false,
      });

      expect(prompt).toContain('Onboarding Complete');
      expect(prompt).toContain('Celebrate');
      expect(prompt).toContain('Next Steps');
    });
  });

  describe('resume context injection', () => {
    it('includes resume context for returning user', () => {
      const advisorMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'SERVICES' as OnboardingPhase,
        discoveryData: {
          businessType: 'photographer',
          businessName: 'Austin Shots',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
        },
        marketResearchData: {
          pricingBenchmarks: {
            source: 'web_search',
            marketLowCents: 250000,
            marketMedianCents: 400000,
            marketHighCents: 700000,
            recommendedTiers: [],
            dataFreshness: 'fresh',
          },
          researchCompletedAt: new Date().toISOString(),
        },
        lastEventVersion: 3,
        lastEventTimestamp: new Date().toISOString(),
      };

      const prompt = buildOnboardingSystemPrompt({
        businessName: 'Austin Shots',
        currentPhase: 'SERVICES',
        advisorMemory,
        isResume: true,
      });

      expect(prompt).toContain('What We Know So Far');
      expect(prompt).toContain('photographer');
      expect(prompt).toContain('Austin');
      expect(prompt).toContain('$2,500');
      expect(prompt).toContain('$7,000');
    });

    it('does not include resume context for new user', () => {
      const prompt = buildOnboardingSystemPrompt({
        businessName: 'New Studio',
        currentPhase: 'NOT_STARTED',
        isResume: false,
      });

      expect(prompt).not.toContain('What We Know So Far');
    });
  });
});

describe('getOnboardingGreeting', () => {
  describe('new user greetings', () => {
    it('returns welcome greeting for NOT_STARTED', () => {
      const greeting = getOnboardingGreeting({
        businessName: 'Test Studio',
        currentPhase: 'NOT_STARTED',
        isResume: false,
      });

      expect(greeting).toContain('help you set up');
      expect(greeting).toContain('Test Studio');
      expect(greeting).toContain('what kind of services');
    });

    it('returns appropriate greeting for DISCOVERY', () => {
      const greeting = getOnboardingGreeting({
        businessName: 'Test Studio',
        currentPhase: 'DISCOVERY',
        isResume: false,
      });

      expect(greeting).toContain('pick up where we left off');
    });

    it('returns appropriate greeting for COMPLETED', () => {
      const greeting = getOnboardingGreeting({
        businessName: 'Test Studio',
        currentPhase: 'COMPLETED',
        isResume: false,
      });

      expect(greeting).toContain('complete');
      expect(greeting).toContain('live');
    });
  });

  describe('returning user greetings', () => {
    it('returns welcome back greeting with context', () => {
      const advisorMemory: AdvisorMemory = {
        tenantId: 'tenant_123',
        currentPhase: 'SERVICES' as OnboardingPhase,
        discoveryData: {
          businessType: 'photographer',
          businessName: 'Austin Photography',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'luxury',
        },
        servicesData: {
          segments: [{ segmentName: 'Weddings', segmentSlug: 'weddings', packages: [] }],
          createdPackageIds: ['pkg_1', 'pkg_2', 'pkg_3'],
          createdSegmentIds: ['seg_1'],
        },
        lastEventVersion: 4,
        lastEventTimestamp: new Date().toISOString(),
      };

      const greeting = getOnboardingGreeting({
        businessName: 'Austin Photography',
        currentPhase: 'SERVICES',
        advisorMemory,
        isResume: true,
      });

      expect(greeting).toContain('Welcome back');
      expect(greeting).toContain('photographer');
      expect(greeting).toContain('Austin');
      expect(greeting).toContain('3 packages');
    });
  });
});
