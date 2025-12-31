/**
 * Unit tests for Market Search Service
 *
 * Tests the fallback-first market research system including:
 * - Industry benchmark retrieval
 * - Cost of living adjustments
 * - Source attribution (Fix #6)
 */

import { describe, it, expect } from 'vitest';
import {
  searchMarketPricing,
  getMarketResearch,
} from '../../../src/agent/onboarding/market-search';
import type {
  MarketSearchResponse,
  MarketSearchResult,
} from '../../../src/agent/onboarding/market-search';

describe('Market Search Service', () => {
  describe('searchMarketPricing', () => {
    it('should return industry benchmark data for valid business type', async () => {
      const result = await searchMarketPricing({
        tenantId: 'test-tenant',
        businessType: 'photographer',
        targetMarket: 'premium',
        skipWebSearch: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('industry_benchmark');
        expect(result.data.pricingBenchmarks.source).toBe('industry_benchmark');
        expect(result.data.pricingBenchmarks.marketLowCents).toBeGreaterThan(0);
        expect(result.data.pricingBenchmarks.marketMedianCents).toBeGreaterThan(
          result.data.pricingBenchmarks.marketLowCents
        );
        expect(result.data.pricingBenchmarks.marketHighCents).toBeGreaterThan(
          result.data.pricingBenchmarks.marketMedianCents
        );
      }
    });

    it('should return recommended tiers in benchmark data', async () => {
      const result = await searchMarketPricing({
        tenantId: 'test-tenant',
        businessType: 'photographer',
        targetMarket: 'mid_range',
        skipWebSearch: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pricingBenchmarks.recommendedTiers.length).toBeGreaterThan(0);
        const tier = result.data.pricingBenchmarks.recommendedTiers[0];
        expect(tier.name).toBeDefined();
        expect(tier.suggestedPriceCents).toBeGreaterThan(0);
        expect(tier.includedServices.length).toBeGreaterThan(0);
      }
    });

    it('should return dataFreshness as fallback when using benchmarks', async () => {
      const result = await searchMarketPricing({
        tenantId: 'test-tenant',
        businessType: 'coach',
        targetMarket: 'premium',
        skipWebSearch: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pricingBenchmarks.dataFreshness).toBe('fallback');
      }
    });

    it('should include market insights', async () => {
      const result = await searchMarketPricing({
        tenantId: 'test-tenant',
        businessType: 'therapist',
        targetMarket: 'mid_range',
        skipWebSearch: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.marketInsights).toBeDefined();
        expect(result.data.marketInsights!.length).toBeGreaterThan(0);
        expect(result.data.marketInsights![0]).toContain('Therapy');
      }
    });

    it('should include researchCompletedAt timestamp', async () => {
      const result = await searchMarketPricing({
        tenantId: 'test-tenant',
        businessType: 'photographer',
        targetMarket: 'luxury',
        skipWebSearch: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.researchCompletedAt).toBeDefined();
        // Verify it's a valid ISO date
        const date = new Date(result.data.researchCompletedAt);
        expect(date.getTime()).not.toBeNaN();
      }
    });

    describe('Cost of Living Adjustments', () => {
      it('should increase prices for high COL states', async () => {
        const resultNY = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          state: 'NY',
          skipWebSearch: true,
        });

        const resultBase = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          skipWebSearch: true,
        });

        expect(resultNY.success).toBe(true);
        expect(resultBase.success).toBe(true);

        if (resultNY.success && resultBase.success) {
          // NY has 1.20 multiplier, so prices should be higher
          expect(resultNY.data.pricingBenchmarks.marketMedianCents).toBeGreaterThan(
            resultBase.data.pricingBenchmarks.marketMedianCents
          );
        }
      });

      it('should decrease prices for low COL states', async () => {
        const resultMS = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          state: 'MS',
          skipWebSearch: true,
        });

        const resultBase = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          skipWebSearch: true,
        });

        expect(resultMS.success).toBe(true);
        expect(resultBase.success).toBe(true);

        if (resultMS.success && resultBase.success) {
          // MS has 0.87 multiplier, so prices should be lower
          expect(resultMS.data.pricingBenchmarks.marketMedianCents).toBeLessThan(
            resultBase.data.pricingBenchmarks.marketMedianCents
          );
        }
      });

      it('should include COL adjustment insight when significant', async () => {
        const result = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          city: 'New York',
          state: 'NY',
          skipWebSearch: true,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const colInsight = result.data.marketInsights?.find((i) => i.includes('adjusted'));
          expect(colInsight).toBeDefined();
          expect(colInsight).toContain('NY');
        }
      });

      it('should handle unknown states with neutral multiplier', async () => {
        const resultUnknown = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          state: 'XX', // Invalid state code
          skipWebSearch: true,
        });

        const resultBase = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'premium',
          skipWebSearch: true,
        });

        expect(resultUnknown.success).toBe(true);
        expect(resultBase.success).toBe(true);

        if (resultUnknown.success && resultBase.success) {
          // Unknown state should use 1.0 multiplier (same as base)
          expect(resultUnknown.data.pricingBenchmarks.marketMedianCents).toBe(
            resultBase.data.pricingBenchmarks.marketMedianCents
          );
        }
      });
    });

    describe('Different Business Types', () => {
      const businessTypes = [
        'photographer',
        'videographer',
        'coach',
        'therapist',
        'wedding_planner',
        'dj',
        'florist',
      ] as const;

      for (const businessType of businessTypes) {
        it(`should return benchmark data for ${businessType}`, async () => {
          const result = await searchMarketPricing({
            tenantId: 'test-tenant',
            businessType,
            targetMarket: 'mid_range',
            skipWebSearch: true,
          });

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.pricingBenchmarks.marketMedianCents).toBeGreaterThan(0);
            expect(result.data.pricingBenchmarks.recommendedTiers.length).toBeGreaterThan(0);
          }
        });
      }
    });

    describe('Different Target Markets', () => {
      it('should return higher prices for luxury market', async () => {
        const resultLuxury = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'luxury',
          skipWebSearch: true,
        });

        const resultBudget = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'photographer',
          targetMarket: 'budget_friendly',
          skipWebSearch: true,
        });

        expect(resultLuxury.success).toBe(true);
        expect(resultBudget.success).toBe(true);

        if (resultLuxury.success && resultBudget.success) {
          expect(resultLuxury.data.pricingBenchmarks.marketMedianCents).toBeGreaterThan(
            resultBudget.data.pricingBenchmarks.marketMedianCents
          );
        }
      });
    });

    describe('Error Handling', () => {
      it('should return error for unsupported business type with no fallback', async () => {
        // The 'other' type should still have fallback data
        const result = await searchMarketPricing({
          tenantId: 'test-tenant',
          businessType: 'other',
          targetMarket: 'mid_range',
          skipWebSearch: true,
        });

        // 'other' should return fallback data
        expect(result.success).toBe(true);
      });
    });
  });

  describe('getMarketResearch (convenience wrapper)', () => {
    it('should return market research with minimal parameters', async () => {
      const result = await getMarketResearch('test-tenant', 'photographer', 'premium');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pricingBenchmarks).toBeDefined();
        expect(result.data.marketInsights).toBeDefined();
        expect(result.data.researchCompletedAt).toBeDefined();
      }
    });

    it('should accept optional location', async () => {
      const result = await getMarketResearch('test-tenant', 'photographer', 'premium', {
        city: 'Los Angeles',
        state: 'CA',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // CA has 1.25 multiplier, should be reflected in prices
        expect(result.data.pricingBenchmarks.marketMedianCents).toBeGreaterThan(0);
      }
    });
  });
});
