/**
 * Client-Side Pricing Utilities
 *
 * Pure functions for calculating and displaying per-person scaling prices.
 * Mirrors the server-side `calculateScalingPrice` for display purposes.
 *
 * IMPORTANT: Backend ALWAYS recalculates authoritatively — these are
 * display-only calculations. Never submit client-calculated totals.
 *
 * @see server/src/services/scaling-price.service.ts (authoritative)
 */

import type { TierData } from './tenant.client';
import { formatPrice } from './format';

export interface PriceComponentBreakdown {
  name: string;
  includedGuests: number;
  additionalGuests: number;
  perPersonCents: number;
  subtotalCents: number;
}

export interface PriceBreakdown {
  basePriceCents: number;
  scalingTotalCents: number;
  totalCents: number;
  components: PriceComponentBreakdown[];
}

/**
 * Returns true if a tier has per-person scaling pricing
 */
export function hasScalingPricing(tier: TierData): boolean {
  return Boolean(
    tier.scalingRules && tier.scalingRules.components && tier.scalingRules.components.length > 0
  );
}

/**
 * Calculate the price breakdown for a tier with per-person scaling.
 * For display only — backend recalculates authoritatively.
 */
export function calculateClientPrice(tier: TierData, guestCount: number): PriceBreakdown {
  const basePriceCents = tier.priceCents;

  if (!tier.scalingRules || tier.scalingRules.components.length === 0) {
    return {
      basePriceCents,
      scalingTotalCents: 0,
      totalCents: basePriceCents,
      components: [],
    };
  }

  const components: PriceComponentBreakdown[] = [];
  let scalingTotalCents = 0;

  for (const component of tier.scalingRules.components) {
    const additionalGuests = Math.max(0, guestCount - component.includedGuests);
    const subtotalCents = additionalGuests * component.perPersonCents;

    components.push({
      name: component.name,
      includedGuests: component.includedGuests,
      additionalGuests,
      perPersonCents: component.perPersonCents,
      subtotalCents,
    });

    scalingTotalCents += subtotalCents;
  }

  return {
    basePriceCents,
    scalingTotalCents,
    totalCents: basePriceCents + scalingTotalCents,
    components,
  };
}

/**
 * Format the display price for a tier card.
 * - Flat pricing: "$2,500"
 * - Display price override: "From $1,000"
 * - Scaling pricing: "From $2,500" (base price)
 */
export function formatPriceDisplay(tier: TierData): string {
  // If tier has a display price, use it
  if (tier.displayPriceCents) {
    return `From ${formatPrice(tier.displayPriceCents)}`;
  }

  // If tier has scaling rules, show "From" prefix
  if (hasScalingPricing(tier)) {
    return `From ${formatPrice(tier.priceCents)}`;
  }

  // Flat price
  return formatPrice(tier.priceCents);
}

/**
 * Format per-person rate for display (e.g., "+$110/person")
 */
export function formatPerPersonRate(perPersonCents: number): string {
  return `+${formatPrice(perPersonCents)}/person`;
}
