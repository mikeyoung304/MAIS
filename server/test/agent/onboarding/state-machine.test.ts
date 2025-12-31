/**
 * Unit tests for Onboarding State Machine
 *
 * Tests the XState v5 state machine implementation for tenant onboarding.
 * Uses createActor to simulate state transitions without database.
 */

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  onboardingMachine,
  stateToPhase,
  phaseToState,
  getValidTransitions,
  isValidTransition,
} from '../../../src/agent/onboarding/state-machine';
import type { DiscoveryData, MarketResearchData, ServicesData, MarketingData } from '@macon/contracts';

describe('Onboarding State Machine', () => {
  // Sample test data
  const discoveryData: DiscoveryData = {
    businessType: 'photographer',
    businessName: 'Test Photography',
    location: { city: 'New York', state: 'NY', country: 'US' },
    targetMarket: 'premium',
  };

  const marketResearchData: MarketResearchData = {
    pricingBenchmarks: {
      source: 'industry_benchmark',
      marketLowCents: 150000,
      marketMedianCents: 350000,
      marketHighCents: 800000,
      recommendedTiers: [
        {
          name: 'Essential',
          description: 'Entry-level package',
          suggestedPriceCents: 200000,
          priceRangeLowCents: 150000,
          priceRangeHighCents: 300000,
          includedServices: ['4 hours coverage'],
        },
      ],
      dataFreshness: 'fallback',
    },
    researchCompletedAt: new Date().toISOString(),
  };

  const servicesData: ServicesData = {
    segments: [
      {
        segmentName: 'Wedding Photography',
        segmentSlug: 'wedding-photography',
        packages: [
          {
            name: 'Essential',
            slug: 'essential',
            priceCents: 200000,
            groupingOrder: 1,
          },
        ],
      },
    ],
    createdPackageIds: ['pkg_1'],
    createdSegmentIds: ['seg_1'],
  };

  const marketingData: MarketingData = {
    headline: 'Capturing Your Special Moments',
    tagline: 'Professional Photography Services',
    brandVoice: 'professional',
  };

  describe('State Transitions', () => {
    it('should start in notStarted state', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });

      expect(actor.getSnapshot().value).toBe('notStarted');
    });

    it('should transition from notStarted to discovery on START', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });

      expect(actor.getSnapshot().value).toBe('discovery');
    });

    it('should transition from discovery to marketResearch on COMPLETE_DISCOVERY', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });

      expect(actor.getSnapshot().value).toBe('marketResearch');
      expect(actor.getSnapshot().context.discovery).toEqual(discoveryData);
    });

    it('should transition from marketResearch to services on COMPLETE_MARKET_RESEARCH', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
      actor.send({ type: 'COMPLETE_MARKET_RESEARCH', data: marketResearchData });

      expect(actor.getSnapshot().value).toBe('services');
      expect(actor.getSnapshot().context.marketResearch).toEqual(marketResearchData);
    });

    it('should transition from services to marketing on COMPLETE_SERVICES', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
      actor.send({ type: 'COMPLETE_MARKET_RESEARCH', data: marketResearchData });
      actor.send({ type: 'COMPLETE_SERVICES', data: servicesData });

      expect(actor.getSnapshot().value).toBe('marketing');
      expect(actor.getSnapshot().context.services).toEqual(servicesData);
    });

    it('should transition from marketing to completed on COMPLETE_MARKETING', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
      actor.send({ type: 'COMPLETE_MARKET_RESEARCH', data: marketResearchData });
      actor.send({ type: 'COMPLETE_SERVICES', data: servicesData });
      actor.send({ type: 'COMPLETE_MARKETING', data: marketingData });

      expect(actor.getSnapshot().value).toBe('completed');
      expect(actor.getSnapshot().context.marketing).toEqual(marketingData);
    });

    it('should allow skipping from any state to skipped', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'SKIP' });

      expect(actor.getSnapshot().value).toBe('skipped');
    });

    it('should allow going back from marketResearch to discovery', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
      actor.send({ type: 'GO_BACK' });

      expect(actor.getSnapshot().value).toBe('discovery');
    });

    it('should increment eventVersion on each transition', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'test-tenant', sessionId: 'test-session' },
      });
      actor.start();

      expect(actor.getSnapshot().context.eventVersion).toBe(0);

      actor.send({ type: 'START' });
      expect(actor.getSnapshot().context.eventVersion).toBe(1);

      actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
      expect(actor.getSnapshot().context.eventVersion).toBe(2);
    });
  });

  describe('Helper Functions', () => {
    describe('stateToPhase', () => {
      it('should map XState states to OnboardingPhase', () => {
        expect(stateToPhase('notStarted')).toBe('NOT_STARTED');
        expect(stateToPhase('discovery')).toBe('DISCOVERY');
        expect(stateToPhase('marketResearch')).toBe('MARKET_RESEARCH');
        expect(stateToPhase('services')).toBe('SERVICES');
        expect(stateToPhase('marketing')).toBe('MARKETING');
        expect(stateToPhase('completed')).toBe('COMPLETED');
        expect(stateToPhase('skipped')).toBe('SKIPPED');
        expect(stateToPhase('error')).toBe('NOT_STARTED');
      });
    });

    describe('phaseToState', () => {
      it('should map OnboardingPhase to XState states', () => {
        expect(phaseToState('NOT_STARTED')).toBe('notStarted');
        expect(phaseToState('DISCOVERY')).toBe('discovery');
        expect(phaseToState('MARKET_RESEARCH')).toBe('marketResearch');
        expect(phaseToState('SERVICES')).toBe('services');
        expect(phaseToState('MARKETING')).toBe('marketing');
        expect(phaseToState('COMPLETED')).toBe('completed');
        expect(phaseToState('SKIPPED')).toBe('skipped');
      });
    });

    describe('getValidTransitions', () => {
      it('should return valid next phases for each phase', () => {
        expect(getValidTransitions('NOT_STARTED')).toEqual(['DISCOVERY', 'SKIPPED']);
        expect(getValidTransitions('DISCOVERY')).toEqual(['MARKET_RESEARCH', 'SKIPPED']);
        expect(getValidTransitions('MARKET_RESEARCH')).toEqual(['SERVICES', 'DISCOVERY', 'SKIPPED']);
        expect(getValidTransitions('SERVICES')).toEqual(['MARKETING', 'MARKET_RESEARCH', 'COMPLETED', 'SKIPPED']);
        expect(getValidTransitions('MARKETING')).toEqual(['COMPLETED', 'SERVICES', 'SKIPPED']);
        expect(getValidTransitions('COMPLETED')).toEqual([]);
        expect(getValidTransitions('SKIPPED')).toEqual([]);
      });
    });

    describe('isValidTransition', () => {
      it('should validate forward transitions', () => {
        expect(isValidTransition('NOT_STARTED', 'DISCOVERY')).toBe(true);
        expect(isValidTransition('DISCOVERY', 'MARKET_RESEARCH')).toBe(true);
        expect(isValidTransition('MARKET_RESEARCH', 'SERVICES')).toBe(true);
        expect(isValidTransition('SERVICES', 'MARKETING')).toBe(true);
        expect(isValidTransition('MARKETING', 'COMPLETED')).toBe(true);
      });

      it('should validate backward transitions', () => {
        expect(isValidTransition('MARKET_RESEARCH', 'DISCOVERY')).toBe(true);
        expect(isValidTransition('SERVICES', 'MARKET_RESEARCH')).toBe(true);
        expect(isValidTransition('MARKETING', 'SERVICES')).toBe(true);
      });

      it('should reject invalid transitions', () => {
        expect(isValidTransition('NOT_STARTED', 'COMPLETED')).toBe(false);
        expect(isValidTransition('DISCOVERY', 'MARKETING')).toBe(false);
        expect(isValidTransition('COMPLETED', 'DISCOVERY')).toBe(false);
      });

      it('should validate skip transitions from any state', () => {
        expect(isValidTransition('NOT_STARTED', 'SKIPPED')).toBe(true);
        expect(isValidTransition('DISCOVERY', 'SKIPPED')).toBe(true);
        expect(isValidTransition('MARKET_RESEARCH', 'SKIPPED')).toBe(true);
        expect(isValidTransition('SERVICES', 'SKIPPED')).toBe(true);
        expect(isValidTransition('MARKETING', 'SKIPPED')).toBe(true);
      });
    });
  });

  describe('Context Initialization', () => {
    it('should initialize context from input', () => {
      const actor = createActor(onboardingMachine, {
        input: { tenantId: 'tenant-123', sessionId: 'session-456' },
      });

      const context = actor.getSnapshot().context;

      expect(context.tenantId).toBe('tenant-123');
      expect(context.sessionId).toBe('session-456');
      expect(context.eventVersion).toBe(0);
      expect(context.discovery).toBeUndefined();
      expect(context.marketResearch).toBeUndefined();
      expect(context.services).toBeUndefined();
      expect(context.marketing).toBeUndefined();
      expect(context.error).toBeUndefined();
    });
  });
});
