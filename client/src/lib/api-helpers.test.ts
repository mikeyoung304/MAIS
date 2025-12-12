import { describe, it, expect } from 'vitest';
import { toCents, fromCents } from './api-helpers';

describe('Money conversion utilities', () => {
  describe('toCents', () => {
    it('converts typical dollar values to cents correctly', () => {
      expect(toCents(1.00)).toBe(100);
      expect(toCents(0.01)).toBe(1);
      expect(toCents(19.99)).toBe(1999);
      expect(toCents(500.00)).toBe(50000);
      expect(toCents(999.99)).toBe(99999);
    });

    it('handles zero correctly', () => {
      expect(toCents(0)).toBe(0);
      expect(toCents(0.00)).toBe(0);
    });

    it('handles floating-point edge cases with Math.round', () => {
      // JavaScript floating point: 0.1 + 0.2 = 0.30000000000000004
      expect(toCents(0.1 + 0.2)).toBe(30);

      // These values are subject to floating-point representation issues
      // Math.round should correct them
      expect(toCents(0.07)).toBe(7);
      expect(toCents(0.33)).toBe(33);
    });

    it('rounds fractional cents correctly using Math.round', () => {
      // 0.5 and above rounds up
      expect(toCents(0.005)).toBe(1); // 0.5 cents rounds to 1
      expect(toCents(0.015)).toBe(2); // 1.5 cents rounds to 2

      // Below 0.5 rounds down
      expect(toCents(0.004)).toBe(0); // 0.4 cents rounds to 0
      expect(toCents(0.014)).toBe(1); // 1.4 cents rounds to 1
    });

    it('handles large dollar amounts', () => {
      expect(toCents(10000.00)).toBe(1000000);
      expect(toCents(99999.99)).toBe(9999999);
    });

    it('handles negative values (for refunds)', () => {
      expect(toCents(-19.99)).toBe(-1999);
      expect(toCents(-500.00)).toBe(-50000);
    });
  });

  describe('fromCents', () => {
    it('converts typical cent values to dollars correctly', () => {
      expect(fromCents(100)).toBe(1.00);
      expect(fromCents(1)).toBe(0.01);
      expect(fromCents(1999)).toBe(19.99);
      expect(fromCents(50000)).toBe(500.00);
      expect(fromCents(99999)).toBe(999.99);
    });

    it('handles zero correctly', () => {
      expect(fromCents(0)).toBe(0);
    });

    it('handles large cent amounts', () => {
      expect(fromCents(1000000)).toBe(10000.00);
      expect(fromCents(9999999)).toBe(99999.99);
    });

    it('handles negative values (for refunds)', () => {
      expect(fromCents(-1999)).toBe(-19.99);
      expect(fromCents(-50000)).toBe(-500.00);
    });
  });

  describe('round-trip conversion', () => {
    it('preserves value through toCents -> fromCents for standard prices', () => {
      const testValues = [0, 0.01, 1.00, 19.99, 100.00, 500.00, 999.99];

      for (const dollars of testValues) {
        const cents = toCents(dollars);
        const backToDollars = fromCents(cents);
        expect(backToDollars).toBe(dollars);
      }
    });

    it('preserves value through fromCents -> toCents for standard prices', () => {
      const testValues = [0, 1, 100, 1999, 10000, 50000, 99999];

      for (const cents of testValues) {
        const dollars = fromCents(cents);
        const backToCents = toCents(dollars);
        expect(backToCents).toBe(cents);
      }
    });
  });
});
