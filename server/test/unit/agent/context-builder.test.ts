/**
 * Tests for agent context builder functions
 */
import { describe, it, expect } from 'vitest';
import {
  detectOnboardingState,
  getHandledGreeting,
  type AgentSessionContext,
  type OnboardingState,
} from '../../../src/agent/context/context-builder';

describe('Agent Context Builder', () => {
  describe('detectOnboardingState', () => {
    const createContext = (
      overrides: Partial<AgentSessionContext['quickStats']> = {}
    ): AgentSessionContext => ({
      tenantId: 'test-tenant-123',
      sessionId: 'test-session-456',
      businessName: 'Test Business',
      businessSlug: 'test-biz',
      contextPrompt: '',
      quickStats: {
        stripeConnected: true,
        packageCount: 3,
        upcomingBookings: 2,
        totalBookings: 10,
        revenueThisMonth: 50000,
        ...overrides,
      },
    });

    it('returns needs_stripe when Stripe is not connected', () => {
      const context = createContext({ stripeConnected: false });
      expect(detectOnboardingState(context)).toBe('needs_stripe');
    });

    it('returns needs_packages when Stripe connected but no packages', () => {
      const context = createContext({ packageCount: 0 });
      expect(detectOnboardingState(context)).toBe('needs_packages');
    });

    it('returns needs_bookings when packages exist but no bookings', () => {
      const context = createContext({ totalBookings: 0 });
      expect(detectOnboardingState(context)).toBe('needs_bookings');
    });

    it('returns ready when business is fully set up', () => {
      const context = createContext();
      expect(detectOnboardingState(context)).toBe('ready');
    });

    it('prioritizes Stripe check over packages check', () => {
      const context = createContext({ stripeConnected: false, packageCount: 0 });
      expect(detectOnboardingState(context)).toBe('needs_stripe');
    });

    it('prioritizes packages check over bookings check', () => {
      const context = createContext({ packageCount: 0, totalBookings: 0 });
      expect(detectOnboardingState(context)).toBe('needs_packages');
    });
  });

  describe('getHandledGreeting', () => {
    const createContext = (
      overrides: Partial<AgentSessionContext['quickStats']> = {}
    ): AgentSessionContext => ({
      tenantId: 'test-tenant-123',
      sessionId: 'test-session-456',
      businessName: 'Test Business',
      businessSlug: 'test-biz',
      contextPrompt: '',
      quickStats: {
        stripeConnected: true,
        packageCount: 3,
        upcomingBookings: 2,
        totalBookings: 10,
        revenueThisMonth: 50000,
        ...overrides,
      },
    });

    it('prompts for packages when none exist', () => {
      const context = createContext({ packageCount: 0, upcomingBookings: 0 });
      const greeting = getHandledGreeting(context);
      expect(greeting).toContain('What do you sell');
    });

    it('prompts to share booking link when packages exist but no bookings', () => {
      const context = createContext({ totalBookings: 0, upcomingBookings: 0 });
      const greeting = getHandledGreeting(context);
      expect(greeting).toContain('Packages set');
      expect(greeting).toContain('bookings');
    });

    it('shows upcoming bookings count for returning users', () => {
      const context = createContext({ upcomingBookings: 5 });
      const greeting = getHandledGreeting(context);
      expect(greeting).toContain('5 bookings coming up');
    });

    it('shows singular booking for 1 upcoming', () => {
      const context = createContext({ upcomingBookings: 1 });
      const greeting = getHandledGreeting(context);
      expect(greeting).toContain('1 booking coming up');
    });

    it('shows terse greeting for active business with no upcoming', () => {
      const context = createContext({ upcomingBookings: 0 });
      const greeting = getHandledGreeting(context);
      expect(greeting).toContain("What's next?");
    });

    it('uses HANDLED brand voice (no hype words)', () => {
      const context = createContext();
      const greeting = getHandledGreeting(context);

      // Should not contain hype words
      expect(greeting.toLowerCase()).not.toContain('revolutionary');
      expect(greeting.toLowerCase()).not.toContain('amazing');
      expect(greeting.toLowerCase()).not.toContain('game-changing');
      expect(greeting.toLowerCase()).not.toContain('optimize');
    });
  });
});
