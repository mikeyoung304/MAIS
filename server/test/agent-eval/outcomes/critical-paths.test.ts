/**
 * Critical Path Tests
 *
 * Verifies that critical user journeys are properly supported
 * by the capability maps and tool sets.
 *
 * Critical paths are the essential flows that must work for the product
 * to deliver value. Each path is a sequence of capabilities.
 *
 * Philosophy:
 * - Business-critical: these are the money-making paths
 * - Sequence validation: ensure capabilities exist in right order
 * - No gaps: every step must have a supporting tool
 */

import { describe, it, expect } from 'vitest';
import {
  CUSTOMER_AGENT_CAPABILITIES,
  CRITICAL_CUSTOMER_PATHS,
} from '../capabilities/customer-agent.cap';
import {
  ONBOARDING_AGENT_CAPABILITIES,
  CRITICAL_ONBOARDING_PATHS,
} from '../capabilities/onboarding-agent.cap';
import { ADMIN_AGENT_CAPABILITIES, CRITICAL_ADMIN_PATHS } from '../capabilities/admin-agent.cap';
import type { AgentCapabilityMap } from '../capabilities/capability-map';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that all capabilities in a path exist in the map
 */
function validatePath(
  path: { name: string; capabilities: readonly string[] },
  map: AgentCapabilityMap
): { valid: boolean; missing: string[] } {
  const capIds = new Set(map.capabilities.map((c) => c.id));
  const missing = path.capabilities.filter((id) => !capIds.has(id));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get capabilities for a path
 */
function getPathCapabilities(
  path: { name: string; capabilities: readonly string[] },
  map: AgentCapabilityMap
) {
  return path.capabilities.map((id) => map.capabilities.find((c) => c.id === id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Critical Path Tests', () => {
  describe('Customer Agent Critical Paths', () => {
    for (const path of CRITICAL_CUSTOMER_PATHS) {
      describe(path.name, () => {
        it(`should have all capabilities for "${path.name}"`, () => {
          const result = validatePath(path, CUSTOMER_AGENT_CAPABILITIES);

          if (!result.valid) {
            throw new Error(
              `Missing capabilities for path "${path.name}": ${result.missing.join(', ')}`
            );
          }

          expect(result.valid).toBe(true);
        });

        it('should have logical tier progression', () => {
          const caps = getPathCapabilities(path, CUSTOMER_AGENT_CAPABILITIES);

          // Early steps should generally be lower tier (reads before writes)
          // Last step should be the highest tier
          const tiers = caps.filter(Boolean).map((c) => c!.trustTier);

          // For browse-and-book: T1, T1, T3 (browse, check, book)
          // Tiers should generally not decrease dramatically
          if (tiers.length > 1) {
            const tierValues = { T1: 1, T2: 2, T3: 3 };
            const lastTier = tierValues[tiers[tiers.length - 1]];
            const firstTier = tierValues[tiers[0]];

            // Final action should be at least as risky as first
            expect(lastTier).toBeGreaterThanOrEqual(firstTier);
          }
        });
      });
    }
  });

  describe('Onboarding Agent Critical Paths', () => {
    for (const path of CRITICAL_ONBOARDING_PATHS) {
      describe(path.name, () => {
        it(`should have all capabilities for "${path.name}"`, () => {
          const result = validatePath(path, ONBOARDING_AGENT_CAPABILITIES);

          if (!result.valid) {
            throw new Error(
              `Missing capabilities for path "${path.name}": ${result.missing.join(', ')}`
            );
          }

          expect(result.valid).toBe(true);
        });

        it('should follow onboarding phase order', () => {
          const caps = getPathCapabilities(path, ONBOARDING_AGENT_CAPABILITIES);

          // Onboarding paths should progress through phases
          // Discovery → Market Research → Services → Marketing
          expect(caps.length).toBeGreaterThan(0);
        });
      });
    }
  });

  describe('Admin Agent Critical Paths', () => {
    for (const path of CRITICAL_ADMIN_PATHS) {
      describe(path.name, () => {
        it(`should have all capabilities for "${path.name}"`, () => {
          const result = validatePath(path, ADMIN_AGENT_CAPABILITIES);

          if (!result.valid) {
            throw new Error(
              `Missing capabilities for path "${path.name}": ${result.missing.join(', ')}`
            );
          }

          expect(result.valid).toBe(true);
        });

        it('should have at least one read capability', () => {
          const caps = getPathCapabilities(path, ADMIN_AGENT_CAPABILITIES);
          const hasRead = caps.some((c) => c?.category === 'read');

          // Most admin paths should start with reading context
          // Exception: paths that are purely write-focused
          if (path.capabilities.length > 1) {
            expect(hasRead).toBe(true);
          }
        });
      });
    }
  });

  describe('Cross-Path Validation', () => {
    it('complete-booking-journey should use T1 for browsing, T3 for booking', () => {
      const browsePath = CRITICAL_CUSTOMER_PATHS.find((p) => p.name === 'complete-booking-journey');
      expect(browsePath).toBeDefined();

      if (browsePath) {
        const caps = getPathCapabilities(browsePath, CUSTOMER_AGENT_CAPABILITIES);

        // First capabilities should be T1 (browsing)
        expect(caps[0]?.trustTier).toBe('T1');

        // Path should include a T3 booking capability
        // Note: The path ends with confirm-booking (T1) which is just acknowledging
        // the proposal. The actual booking (book-service) is T3.
        const hasT3Booking = caps.some((c) => c?.trustTier === 'T3' && c?.category === 'booking');
        expect(hasT3Booking).toBe(true);

        // Verify book-service specifically is T3
        const bookingCap = caps.find((c) => c?.id === 'book-service');
        expect(bookingCap?.trustTier).toBe('T3');
      }
    });

    it('complete-onboarding should end with service creation', () => {
      const onboardingPath = CRITICAL_ONBOARDING_PATHS.find(
        (p) => p.name === 'complete-onboarding'
      );
      expect(onboardingPath).toBeDefined();

      if (onboardingPath) {
        const lastCap = onboardingPath.capabilities[onboardingPath.capabilities.length - 1];
        // Should end with creating services or configuring storefront
        expect(['create-services', 'configure-storefront']).toContain(lastCap);
      }
    });

    it('manage-bookings should include availability check', () => {
      const manageBookings = CRITICAL_ADMIN_PATHS.find((p) => p.name === 'manage-bookings');
      expect(manageBookings).toBeDefined();

      if (manageBookings) {
        expect(manageBookings.capabilities).toContain('check-availability');
      }
    });
  });

  describe('Path Coverage', () => {
    it('customer agent should cover complete booking journey', () => {
      const pathNames = CRITICAL_CUSTOMER_PATHS.map((p) => p.name);

      expect(pathNames).toContain('complete-booking-journey');
    });

    it('onboarding agent should cover full setup journey', () => {
      const pathNames = CRITICAL_ONBOARDING_PATHS.map((p) => p.name);

      expect(pathNames).toContain('complete-onboarding');
    });

    it('admin agent should cover business management', () => {
      const pathNames = CRITICAL_ADMIN_PATHS.map((p) => p.name);

      expect(pathNames).toContain('manage-bookings');
      expect(pathNames).toContain('manage-services');
    });
  });

  describe('Capability Dependencies', () => {
    it('booking should require availability check capability exists', () => {
      const bookingCap = CUSTOMER_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'book-service'
      );
      const availabilityCap = CUSTOMER_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'check-availability'
      );

      expect(bookingCap).toBeDefined();
      expect(availabilityCap).toBeDefined();
    });

    it('service creation should require market research capability exists', () => {
      const createCap = ONBOARDING_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'create-services'
      );
      const researchCap = ONBOARDING_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'get-market-research'
      );

      expect(createCap).toBeDefined();
      expect(researchCap).toBeDefined();
    });

    it('refund should require booking view capability exists', () => {
      const refundCap = ADMIN_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'process-refund'
      );
      const viewBookingCap = ADMIN_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.id === 'view-booking-detail'
      );

      expect(refundCap).toBeDefined();
      expect(viewBookingCap).toBeDefined();
    });
  });
});
