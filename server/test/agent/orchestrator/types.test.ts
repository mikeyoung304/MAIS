/**
 * Agent Orchestrator Types Tests
 *
 * Tests for shared utilities and types.
 */

import { describe, it, expect } from 'vitest';
import { isOnboardingActive } from '../../../src/agent/orchestrator/types';

describe('isOnboardingActive', () => {
  describe('returns true for active onboarding phases', () => {
    it('should return true for NOT_STARTED', () => {
      expect(isOnboardingActive('NOT_STARTED')).toBe(true);
    });

    it('should return true for DISCOVERY', () => {
      expect(isOnboardingActive('DISCOVERY')).toBe(true);
    });

    it('should return true for MARKET_RESEARCH', () => {
      expect(isOnboardingActive('MARKET_RESEARCH')).toBe(true);
    });

    it('should return true for SERVICES', () => {
      expect(isOnboardingActive('SERVICES')).toBe(true);
    });

    it('should return true for MARKETING', () => {
      expect(isOnboardingActive('MARKETING')).toBe(true);
    });
  });

  describe('returns false for terminal phases', () => {
    it('should return false for COMPLETED', () => {
      expect(isOnboardingActive('COMPLETED')).toBe(false);
    });

    it('should return false for SKIPPED', () => {
      expect(isOnboardingActive('SKIPPED')).toBe(false);
    });
  });

  describe('handles null/undefined', () => {
    it('should return false for null', () => {
      expect(isOnboardingActive(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isOnboardingActive(undefined)).toBe(false);
    });
  });

  describe('handles raw string values from database', () => {
    it('should parse raw string and return correct result', () => {
      // Simulates raw database value
      expect(isOnboardingActive('DISCOVERY')).toBe(true);
      expect(isOnboardingActive('COMPLETED')).toBe(false);
    });

    it('should handle unknown phase strings gracefully', () => {
      // Unknown values should be parsed as NOT_STARTED by parseOnboardingPhase
      expect(isOnboardingActive('UNKNOWN_PHASE')).toBe(true);
    });
  });
});
