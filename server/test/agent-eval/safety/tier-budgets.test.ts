/**
 * Tier Budget Tests
 *
 * Verifies per-tier recursion budget enforcement.
 * Based on DoorDash "Budgeting the Loop" pattern.
 *
 * Philosophy:
 * - Prevent T1 tools (metadata) from starving T2/T3 (writes/bookings)
 * - Each tier has independent budget that decrements on use
 * - Budget exhaustion blocks further calls to that tier
 */

import { describe, it, expect } from 'vitest';
import {
  createBudgetTracker,
  DEFAULT_TIER_BUDGETS,
  type BudgetTracker,
  type TierBudgets,
} from '../../../src/agent/orchestrator/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier Budget Tracker', () => {
  describe('createBudgetTracker()', () => {
    it('should create tracker with initial budgets', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      expect(tracker.remaining.T1).toBe(DEFAULT_TIER_BUDGETS.T1);
      expect(tracker.remaining.T2).toBe(DEFAULT_TIER_BUDGETS.T2);
      expect(tracker.remaining.T3).toBe(DEFAULT_TIER_BUDGETS.T3);
    });

    it('should start with zero used counts', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      expect(tracker.used.T1).toBe(0);
      expect(tracker.used.T2).toBe(0);
      expect(tracker.used.T3).toBe(0);
    });

    it('should accept custom budgets', () => {
      const customBudgets: TierBudgets = { T1: 5, T2: 2, T3: 1 };
      const tracker = createBudgetTracker(customBudgets);

      expect(tracker.remaining.T1).toBe(5);
      expect(tracker.remaining.T2).toBe(2);
      expect(tracker.remaining.T3).toBe(1);
    });
  });

  describe('consume()', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);
    });

    it('should return true when budget available', () => {
      const result = tracker.consume('T1');

      expect(result).toBe(true);
    });

    it('should decrement remaining budget', () => {
      const initialRemaining = tracker.remaining.T1;

      tracker.consume('T1');

      expect(tracker.remaining.T1).toBe(initialRemaining - 1);
    });

    it('should increment used count', () => {
      tracker.consume('T1');
      tracker.consume('T1');

      expect(tracker.used.T1).toBe(2);
    });

    it('should return false when budget exhausted', () => {
      // Exhaust T3 budget (only 1 by default)
      const firstResult = tracker.consume('T3');
      const secondResult = tracker.consume('T3');

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false);
    });

    it('should not modify state when budget exhausted', () => {
      // Exhaust T3 budget
      tracker.consume('T3');

      const remainingBefore = tracker.remaining.T3;
      const usedBefore = tracker.used.T3;

      tracker.consume('T3'); // Should fail

      expect(tracker.remaining.T3).toBe(remainingBefore);
      expect(tracker.used.T3).toBe(usedBefore);
    });

    it('should track tiers independently', () => {
      // Use some T1 budget
      tracker.consume('T1');
      tracker.consume('T1');

      // T2 should be unaffected
      expect(tracker.remaining.T2).toBe(DEFAULT_TIER_BUDGETS.T2);

      // Use T2
      tracker.consume('T2');

      // T1 and T3 should be unaffected by T2 consumption
      expect(tracker.remaining.T1).toBe(DEFAULT_TIER_BUDGETS.T1 - 2);
      expect(tracker.remaining.T3).toBe(DEFAULT_TIER_BUDGETS.T3);
    });
  });

  describe('DEFAULT_TIER_BUDGETS', () => {
    it('should have T1 > T2 > T3 hierarchy', () => {
      expect(DEFAULT_TIER_BUDGETS.T1).toBeGreaterThan(DEFAULT_TIER_BUDGETS.T2);
      expect(DEFAULT_TIER_BUDGETS.T2).toBeGreaterThan(DEFAULT_TIER_BUDGETS.T3);
    });

    it('should have expected values', () => {
      expect(DEFAULT_TIER_BUDGETS.T1).toBe(10); // Generous for metadata
      expect(DEFAULT_TIER_BUDGETS.T2).toBe(3); // Limited writes per turn
      expect(DEFAULT_TIER_BUDGETS.T3).toBe(1); // One booking at a time
    });

    it('should allow reasonable T1 operations in a turn', () => {
      // A turn might involve: get_tenant, get_packages, check_availability x3
      // That's 5 T1 calls - should be allowed
      expect(DEFAULT_TIER_BUDGETS.T1).toBeGreaterThanOrEqual(5);
    });

    it('should limit T3 to prevent multiple bookings per turn', () => {
      // Only one booking operation should be allowed per turn
      expect(DEFAULT_TIER_BUDGETS.T3).toBe(1);
    });
  });

  describe('Immutability', () => {
    it('remaining property should return copy', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);
      const remaining = tracker.remaining;

      // Modifying the returned object should not affect tracker
      // @ts-expect-error - Testing runtime behavior
      remaining.T1 = 999;

      expect(tracker.remaining.T1).toBe(DEFAULT_TIER_BUDGETS.T1);
    });

    it('used property should return copy', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);
      tracker.consume('T1');
      const used = tracker.used;

      // Modifying the returned object should not affect tracker
      // @ts-expect-error - Testing runtime behavior
      used.T1 = 999;

      expect(tracker.used.T1).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero budgets', () => {
      const zeroBudgets: TierBudgets = { T1: 0, T2: 0, T3: 0 };
      const tracker = createBudgetTracker(zeroBudgets);

      expect(tracker.consume('T1')).toBe(false);
      expect(tracker.consume('T2')).toBe(false);
      expect(tracker.consume('T3')).toBe(false);
    });

    it('should handle large budgets', () => {
      const largeBudgets: TierBudgets = { T1: 1000, T2: 500, T3: 100 };
      const tracker = createBudgetTracker(largeBudgets);

      for (let i = 0; i < 100; i++) {
        tracker.consume('T1');
      }

      expect(tracker.used.T1).toBe(100);
      expect(tracker.remaining.T1).toBe(900);
    });

    it('should work with all tiers simultaneously', () => {
      const tracker = createBudgetTracker({ T1: 3, T2: 2, T3: 1 });

      // Consume all tiers in interleaved pattern
      expect(tracker.consume('T1')).toBe(true);
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.consume('T3')).toBe(true);
      expect(tracker.consume('T1')).toBe(true);
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.consume('T3')).toBe(false); // Exhausted
      expect(tracker.consume('T1')).toBe(true);
      expect(tracker.consume('T1')).toBe(false); // Exhausted

      expect(tracker.remaining).toEqual({ T1: 0, T2: 0, T3: 0 });
      expect(tracker.used).toEqual({ T1: 3, T2: 2, T3: 1 });
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical admin turn: multiple reads, one write', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      // Typical pattern: read tenant, read packages, read bookings, update package
      expect(tracker.consume('T1')).toBe(true); // get_tenant
      expect(tracker.consume('T1')).toBe(true); // get_packages
      expect(tracker.consume('T1')).toBe(true); // get_bookings
      expect(tracker.consume('T2')).toBe(true); // upsert_package

      // Still have budget for more operations
      expect(tracker.remaining.T1).toBe(7);
      expect(tracker.remaining.T2).toBe(2);
    });

    it('should prevent T1 from starving T2/T3', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      // Exhaust T1 budget
      for (let i = 0; i < DEFAULT_TIER_BUDGETS.T1; i++) {
        tracker.consume('T1');
      }

      expect(tracker.consume('T1')).toBe(false);

      // T2 and T3 should still be available
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.consume('T3')).toBe(true);
    });

    it('should handle customer chatbot turn: browse, check, book', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      // Customer flow: view services, check dates, book
      expect(tracker.consume('T1')).toBe(true); // get_services
      expect(tracker.consume('T1')).toBe(true); // check_availability
      expect(tracker.consume('T1')).toBe(true); // check_availability (second date)
      expect(tracker.consume('T3')).toBe(true); // book_service

      // Can't book again in same turn
      expect(tracker.consume('T3')).toBe(false);
    });

    it('should handle onboarding turn: research and create', () => {
      const tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);

      // Onboarding flow: get research, create segment with packages
      expect(tracker.consume('T1')).toBe(true); // get_market_research
      expect(tracker.consume('T2')).toBe(true); // upsert_services
      expect(tracker.consume('T2')).toBe(true); // update_storefront

      // Still have budget
      expect(tracker.remaining.T2).toBe(1);
    });
  });
});
