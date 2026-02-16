import { describe, it, expect } from 'vitest';
import { calculateScalingPrice, type ScalingPriceTier } from './scaling-price.service';

describe('ScalingPriceService', () => {
  // ──────────────────────────────────────────────
  // Flat pricing (no scaling rules)
  // ──────────────────────────────────────────────

  describe('flat pricing (no scaling rules)', () => {
    it('returns base price when scalingRules is null', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: null,
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 1);

      expect(result.basePriceCents).toBe(50000);
      expect(result.scalingTotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(50000);
      expect(result.componentBreakdown).toEqual([]);
    });

    it('returns base price when scalingRules has empty components', () => {
      const tier: ScalingPriceTier = {
        priceCents: 30000,
        scalingRules: { components: [] },
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 5);

      expect(result.totalBeforeCommission).toBe(30000);
      expect(result.componentBreakdown).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // Single component scenarios
  // ──────────────────────────────────────────────

  describe('single component', () => {
    const dinnerTier: ScalingPriceTier = {
      priceCents: 100000, // $1,000 base
      scalingRules: {
        components: [
          {
            name: 'Private Chef Dinner',
            includedGuests: 2,
            perPersonCents: 11000, // $110/person
            maxGuests: 10,
          },
        ],
      },
      maxGuests: 10,
    };

    it('calculates correct total for 6 guests (2 included + 4 extra)', () => {
      const result = calculateScalingPrice(dinnerTier, 6);

      expect(result.basePriceCents).toBe(100000);
      expect(result.scalingTotalCents).toBe(44000); // 4 * $110 = $440
      expect(result.totalBeforeCommission).toBe(144000); // $1,000 + $440 = $1,440

      expect(result.componentBreakdown).toEqual([
        {
          name: 'Private Chef Dinner',
          includedGuests: 2,
          additionalGuests: 4,
          perPersonCents: 11000,
          subtotalCents: 44000,
        },
      ]);
    });

    it('no extra charge when guests <= included', () => {
      const result = calculateScalingPrice(dinnerTier, 2);

      expect(result.scalingTotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(100000);
      expect(result.componentBreakdown[0].additionalGuests).toBe(0);
    });

    it('no extra charge for 1 guest (below included)', () => {
      const result = calculateScalingPrice(dinnerTier, 1);

      expect(result.scalingTotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(100000);
    });

    it('calculates correctly at max guests', () => {
      const result = calculateScalingPrice(dinnerTier, 10);

      expect(result.scalingTotalCents).toBe(88000); // 8 * $110 = $880
      expect(result.totalBeforeCommission).toBe(188000); // $1,000 + $880
    });
  });

  // ──────────────────────────────────────────────
  // Multi-component scenarios
  // ──────────────────────────────────────────────

  describe('multi-component', () => {
    const retreatTier: ScalingPriceTier = {
      priceCents: 250000, // $2,500 base
      scalingRules: {
        components: [
          {
            name: 'Floral Arrangements',
            includedGuests: 4,
            perPersonCents: 6000, // $60/person
          },
          {
            name: 'Meal Service',
            includedGuests: 4,
            perPersonCents: 9000, // $90/person
          },
        ],
      },
      maxGuests: 20,
    };

    it('calculates correct total for 6 guests across both components', () => {
      const result = calculateScalingPrice(retreatTier, 6);

      // Floral: 2 extra * $60 = $120
      // Meal: 2 extra * $90 = $180
      expect(result.scalingTotalCents).toBe(30000); // $120 + $180 = $300
      expect(result.totalBeforeCommission).toBe(280000); // $2,500 + $300

      expect(result.componentBreakdown).toHaveLength(2);
      expect(result.componentBreakdown[0].subtotalCents).toBe(12000);
      expect(result.componentBreakdown[1].subtotalCents).toBe(18000);
    });

    it('handles components with different included counts', () => {
      const mixedTier: ScalingPriceTier = {
        priceCents: 200000,
        scalingRules: {
          components: [
            {
              name: 'Lodging',
              includedGuests: 2,
              perPersonCents: 15000, // $150/person
            },
            {
              name: 'Activities',
              includedGuests: 6,
              perPersonCents: 5000, // $50/person
            },
          ],
        },
        maxGuests: 10,
      };

      const result = calculateScalingPrice(mixedTier, 4);

      // Lodging: 2 extra * $150 = $300
      // Activities: 0 extra (4 <= 6 included)
      expect(result.componentBreakdown[0].additionalGuests).toBe(2);
      expect(result.componentBreakdown[0].subtotalCents).toBe(30000);
      expect(result.componentBreakdown[1].additionalGuests).toBe(0);
      expect(result.componentBreakdown[1].subtotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(230000);
    });
  });

  // ──────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────

  describe('error cases', () => {
    it('throws when guest count exceeds tier maxGuests', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: {
          components: [{ name: 'Dinner', includedGuests: 2, perPersonCents: 5000 }],
        },
        maxGuests: 8,
      };

      expect(() => calculateScalingPrice(tier, 9)).toThrow(
        'Guest count 9 exceeds maximum of 8 for this tier'
      );
    });

    it('throws when guest count exceeds component maxGuests', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: {
          components: [
            {
              name: 'Chef Service',
              includedGuests: 2,
              perPersonCents: 5000,
              maxGuests: 6,
            },
          ],
        },
        maxGuests: 10, // Tier allows 10 but component caps at 6
      };

      expect(() => calculateScalingPrice(tier, 7)).toThrow(
        'Guest count 7 exceeds maximum of 6 for "Chef Service"'
      );
    });

    it('throws when guest count < 1', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: {
          components: [{ name: 'Dinner', includedGuests: 2, perPersonCents: 5000 }],
        },
        maxGuests: null,
      };

      expect(() => calculateScalingPrice(tier, 0)).toThrow('Guest count must be at least 1');
    });
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles component with 0 included guests (every guest costs extra)', () => {
      const tier: ScalingPriceTier = {
        priceCents: 0, // Venue only, all costs are per-person
        scalingRules: {
          components: [{ name: 'Per-Person Fee', includedGuests: 0, perPersonCents: 7500 }],
        },
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 4);

      expect(result.basePriceCents).toBe(0);
      expect(result.scalingTotalCents).toBe(30000); // 4 * $75
      expect(result.totalBeforeCommission).toBe(30000);
    });

    it('handles all components having includedGuests > guestCount', () => {
      const tier: ScalingPriceTier = {
        priceCents: 100000,
        scalingRules: {
          components: [
            { name: 'Meal', includedGuests: 10, perPersonCents: 5000 },
            { name: 'Setup', includedGuests: 8, perPersonCents: 3000 },
          ],
        },
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 3);

      expect(result.scalingTotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(100000);
      expect(result.componentBreakdown.every((c) => c.additionalGuests === 0)).toBe(true);
    });

    it('handles component with 0 perPersonCents (free extra guests)', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: {
          components: [{ name: 'Free seating', includedGuests: 2, perPersonCents: 0 }],
        },
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 10);

      expect(result.scalingTotalCents).toBe(0);
      expect(result.totalBeforeCommission).toBe(50000);
    });

    it('no maxGuests on tier allows unlimited guests', () => {
      const tier: ScalingPriceTier = {
        priceCents: 50000,
        scalingRules: {
          components: [{ name: 'Per head', includedGuests: 0, perPersonCents: 1000 }],
        },
        maxGuests: null,
      };

      const result = calculateScalingPrice(tier, 100);

      expect(result.scalingTotalCents).toBe(100000);
      expect(result.totalBeforeCommission).toBe(150000);
    });
  });

  // ──────────────────────────────────────────────
  // Real-world sample data from brainstorm
  // ──────────────────────────────────────────────

  describe('real-world scenarios from brainstorm', () => {
    it('elopement: Curated Weekend, 6 guests, dinner + floral', () => {
      // "Curated Weekend" tier: $4,800 base, dinner $110/person (2 included), floral $60/person (2 included)
      const tier: ScalingPriceTier = {
        priceCents: 480000,
        scalingRules: {
          components: [
            {
              name: 'Private Chef Dinner',
              includedGuests: 2,
              perPersonCents: 11000,
              maxGuests: 10,
            },
            {
              name: 'Floral Package',
              includedGuests: 2,
              perPersonCents: 6000,
              maxGuests: 10,
            },
          ],
        },
        maxGuests: 10,
      };

      const result = calculateScalingPrice(tier, 6);

      // Dinner: 4 extra * $110 = $440
      // Floral: 4 extra * $60 = $240
      // Total: $4,800 + $440 + $240 = $5,480
      expect(result.totalBeforeCommission).toBe(548000);
    });

    it('retreat: Team Recharge, 12 guests, meals only', () => {
      const tier: ScalingPriceTier = {
        priceCents: 350000, // $3,500 base
        scalingRules: {
          components: [
            {
              name: 'Catered Meals',
              includedGuests: 8,
              perPersonCents: 9000,
              maxGuests: 20,
            },
          ],
        },
        maxGuests: 20,
      };

      const result = calculateScalingPrice(tier, 12);

      // 4 extra * $90 = $360
      // Total: $3,500 + $360 = $3,860
      expect(result.totalBeforeCommission).toBe(386000);
    });
  });
});
