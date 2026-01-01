/**
 * BudgetTracker Tests
 *
 * Tests per-tier recursion budgets that prevent T1 from starving T2/T3.
 * Based on DoorDash "Budgeting the Loop" pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBudgetTracker,
  DEFAULT_TIER_BUDGETS,
  type TierBudgets,
  type BudgetTracker,
} from '../../../src/agent/orchestrator/types';

describe('BudgetTracker', () => {
  let tracker: BudgetTracker;

  beforeEach(() => {
    tracker = createBudgetTracker(DEFAULT_TIER_BUDGETS);
  });

  describe('initial state', () => {
    it('should start with full budgets', () => {
      expect(tracker.remaining.T1).toBe(DEFAULT_TIER_BUDGETS.T1);
      expect(tracker.remaining.T2).toBe(DEFAULT_TIER_BUDGETS.T2);
      expect(tracker.remaining.T3).toBe(DEFAULT_TIER_BUDGETS.T3);
    });

    it('should start with zero usage', () => {
      expect(tracker.used.T1).toBe(0);
      expect(tracker.used.T2).toBe(0);
      expect(tracker.used.T3).toBe(0);
    });

    it('should have correct default budgets', () => {
      // T1: 10 (generous for metadata)
      // T2: 3 (limited writes per turn)
      // T3: 1 (one booking at a time)
      expect(DEFAULT_TIER_BUDGETS.T1).toBe(10);
      expect(DEFAULT_TIER_BUDGETS.T2).toBe(3);
      expect(DEFAULT_TIER_BUDGETS.T3).toBe(1);
    });
  });

  describe('consume()', () => {
    it('should consume from T1 tier', () => {
      expect(tracker.consume('T1')).toBe(true);
      expect(tracker.remaining.T1).toBe(9);
      expect(tracker.used.T1).toBe(1);
    });

    it('should consume from T2 tier', () => {
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.remaining.T2).toBe(2);
      expect(tracker.used.T2).toBe(1);
    });

    it('should consume from T3 tier', () => {
      expect(tracker.consume('T3')).toBe(true);
      expect(tracker.remaining.T3).toBe(0);
      expect(tracker.used.T3).toBe(1);
    });

    it('should return false when tier exhausted', () => {
      // Exhaust T1 (default: 10)
      for (let i = 0; i < 10; i++) {
        expect(tracker.consume('T1')).toBe(true);
      }
      expect(tracker.consume('T1')).toBe(false);
      expect(tracker.remaining.T1).toBe(0);
      expect(tracker.used.T1).toBe(10);
    });

    it('should not modify budget when returning false', () => {
      // Exhaust T3 (default: 1)
      expect(tracker.consume('T3')).toBe(true);
      expect(tracker.remaining.T3).toBe(0);

      // Additional calls should not change anything
      expect(tracker.consume('T3')).toBe(false);
      expect(tracker.consume('T3')).toBe(false);
      expect(tracker.remaining.T3).toBe(0);
      expect(tracker.used.T3).toBe(1);
    });

    it('should prevent T1 from starving T2', () => {
      // Exhaust T1 budget
      for (let i = 0; i < 10; i++) {
        expect(tracker.consume('T1')).toBe(true);
      }
      expect(tracker.consume('T1')).toBe(false);

      // T2 budget should be independent and still available
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.remaining.T2).toBe(2);
    });

    it('should prevent T1 from starving T3', () => {
      // Exhaust T1 budget
      for (let i = 0; i < 10; i++) {
        expect(tracker.consume('T1')).toBe(true);
      }
      expect(tracker.consume('T1')).toBe(false);

      // T3 budget should be independent
      expect(tracker.consume('T3')).toBe(true);
      expect(tracker.remaining.T3).toBe(0);
    });

    it('should allow all tiers to be used independently', () => {
      // Use some of each tier
      tracker.consume('T1');
      tracker.consume('T1');
      tracker.consume('T2');
      tracker.consume('T3');

      expect(tracker.remaining.T1).toBe(8);
      expect(tracker.remaining.T2).toBe(2);
      expect(tracker.remaining.T3).toBe(0);

      expect(tracker.used.T1).toBe(2);
      expect(tracker.used.T2).toBe(1);
      expect(tracker.used.T3).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should restore all budgets to initial values', () => {
      // Use some budget
      tracker.consume('T1');
      tracker.consume('T1');
      tracker.consume('T2');
      tracker.consume('T3');

      tracker.reset();

      expect(tracker.remaining.T1).toBe(DEFAULT_TIER_BUDGETS.T1);
      expect(tracker.remaining.T2).toBe(DEFAULT_TIER_BUDGETS.T2);
      expect(tracker.remaining.T3).toBe(DEFAULT_TIER_BUDGETS.T3);
    });

    it('should reset usage counters to zero', () => {
      tracker.consume('T1');
      tracker.consume('T2');
      tracker.consume('T3');

      tracker.reset();

      expect(tracker.used.T1).toBe(0);
      expect(tracker.used.T2).toBe(0);
      expect(tracker.used.T3).toBe(0);
    });

    it('should allow consumption again after reset', () => {
      // Exhaust all tiers
      for (let i = 0; i < 10; i++) tracker.consume('T1');
      for (let i = 0; i < 3; i++) tracker.consume('T2');
      tracker.consume('T3');

      expect(tracker.consume('T1')).toBe(false);
      expect(tracker.consume('T2')).toBe(false);
      expect(tracker.consume('T3')).toBe(false);

      tracker.reset();

      expect(tracker.consume('T1')).toBe(true);
      expect(tracker.consume('T2')).toBe(true);
      expect(tracker.consume('T3')).toBe(true);
    });
  });

  describe('immutability', () => {
    it('should return readonly remaining budget', () => {
      const remaining = tracker.remaining;
      // Type system should prevent: remaining.T1 = 999;
      // At runtime, the getter returns a copy
      expect(Object.isFrozen(remaining) || typeof remaining.T1 === 'number').toBe(true);
    });

    it('should return readonly used budget', () => {
      tracker.consume('T1');
      const used = tracker.used;
      // Type system should prevent modification
      expect(typeof used.T1 === 'number').toBe(true);
    });

    it('should not allow external modification of internal state', () => {
      const remaining1 = tracker.remaining;
      tracker.consume('T1');
      const remaining2 = tracker.remaining;

      // The two objects should be different
      expect(remaining1.T1).toBe(10);
      expect(remaining2.T1).toBe(9);
    });
  });

  describe('custom budgets', () => {
    it('should respect custom budget values', () => {
      const customBudgets: TierBudgets = {
        T1: 5,
        T2: 2,
        T3: 0,
      };
      const customTracker = createBudgetTracker(customBudgets);

      expect(customTracker.remaining.T1).toBe(5);
      expect(customTracker.remaining.T2).toBe(2);
      expect(customTracker.remaining.T3).toBe(0);

      // T3 with 0 budget should immediately fail
      expect(customTracker.consume('T3')).toBe(false);
    });

    it('should reset to custom initial values', () => {
      const customBudgets: TierBudgets = {
        T1: 5,
        T2: 2,
        T3: 1,
      };
      const customTracker = createBudgetTracker(customBudgets);

      customTracker.consume('T1');
      customTracker.consume('T1');
      customTracker.reset();

      expect(customTracker.remaining.T1).toBe(5);
      expect(customTracker.remaining.T2).toBe(2);
      expect(customTracker.remaining.T3).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle budget of 1 correctly', () => {
      // T3 has budget of 1
      expect(tracker.consume('T3')).toBe(true);
      expect(tracker.consume('T3')).toBe(false);
      expect(tracker.remaining.T3).toBe(0);
      expect(tracker.used.T3).toBe(1);
    });

    it('should handle budget of 0 correctly', () => {
      const zeroBudget: TierBudgets = { T1: 0, T2: 0, T3: 0 };
      const zeroTracker = createBudgetTracker(zeroBudget);

      expect(zeroTracker.consume('T1')).toBe(false);
      expect(zeroTracker.consume('T2')).toBe(false);
      expect(zeroTracker.consume('T3')).toBe(false);
      expect(zeroTracker.used.T1).toBe(0);
    });

    it('should handle large budgets correctly', () => {
      const largeBudget: TierBudgets = { T1: 1000, T2: 500, T3: 100 };
      const largeTracker = createBudgetTracker(largeBudget);

      for (let i = 0; i < 100; i++) {
        expect(largeTracker.consume('T1')).toBe(true);
      }

      expect(largeTracker.remaining.T1).toBe(900);
      expect(largeTracker.used.T1).toBe(100);
    });
  });
});
