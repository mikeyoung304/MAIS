/**
 * Scaling Price Service — Per-Person Pricing Calculation Engine
 *
 * Pure functions for calculating per-person scaling pricing on tiers.
 * No database access, no side effects — designed for use on both
 * backend (authoritative) and can be mirrored client-side (display).
 *
 * Backend ALWAYS recalculates — never trusts client-submitted totals.
 *
 * @see packages/contracts/src/schemas/scaling-rules.schema.ts
 */

import type { ScalingRules } from '@macon/contracts';

export interface ScalingComponentBreakdown {
  name: string;
  includedGuests: number;
  additionalGuests: number;
  perPersonCents: number;
  subtotalCents: number;
}

export interface ScalingPriceResult {
  basePriceCents: number;
  scalingTotalCents: number;
  totalBeforeCommission: number;
  componentBreakdown: ScalingComponentBreakdown[];
}

export interface ScalingPriceTier {
  priceCents: number;
  scalingRules: ScalingRules | null;
  maxGuests: number | null;
}

/**
 * Calculate the total price for a tier with per-person scaling.
 *
 * If the tier has no scaling rules, returns the flat base price.
 * Otherwise, computes per-component charges for guests beyond the included count.
 *
 * @throws Error if guestCount exceeds tier's maxGuests
 * @throws Error if guestCount exceeds a component's maxGuests
 * @throws Error if guestCount < 1
 */
export function calculateScalingPrice(
  tier: ScalingPriceTier,
  guestCount: number
): ScalingPriceResult {
  // No scaling rules → flat pricing
  if (!tier.scalingRules || tier.scalingRules.components.length === 0) {
    return {
      basePriceCents: tier.priceCents,
      scalingTotalCents: 0,
      totalBeforeCommission: tier.priceCents,
      componentBreakdown: [],
    };
  }

  if (guestCount < 1) {
    throw new Error('Guest count must be at least 1');
  }

  // Validate against tier-level max
  if (tier.maxGuests !== null && guestCount > tier.maxGuests) {
    throw new Error(`Guest count ${guestCount} exceeds maximum of ${tier.maxGuests} for this tier`);
  }

  const componentBreakdown: ScalingComponentBreakdown[] = [];
  let scalingTotalCents = 0;

  for (const component of tier.scalingRules.components) {
    // Validate against component-level max
    if (component.maxGuests !== undefined && guestCount > component.maxGuests) {
      throw new Error(
        `Guest count ${guestCount} exceeds maximum of ${component.maxGuests} for "${component.name}"`
      );
    }

    const additionalGuests = Math.max(0, guestCount - component.includedGuests);
    const subtotalCents = additionalGuests * component.perPersonCents;

    componentBreakdown.push({
      name: component.name,
      includedGuests: component.includedGuests,
      additionalGuests,
      perPersonCents: component.perPersonCents,
      subtotalCents,
    });

    scalingTotalCents += subtotalCents;
  }

  return {
    basePriceCents: tier.priceCents,
    scalingTotalCents,
    totalBeforeCommission: tier.priceCents + scalingTotalCents,
    componentBreakdown,
  };
}
