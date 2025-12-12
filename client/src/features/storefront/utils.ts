/**
 * Storefront Tier Utilities
 *
 * Shared constants and functions for the 3-tier pricing system.
 * Extracted to avoid duplication across TierCard, TierSelector, and TierDetail.
 */

import type { PackageDto } from '@macon/contracts';

/** Standard tier levels in display order */
export const TIER_LEVELS = ['budget', 'middle', 'luxury'] as const;
export type TierLevel = (typeof TIER_LEVELS)[number];

/**
 * Get tier display name based on tier level
 * budget → Essential, middle → Popular, luxury → Premium
 */
export function getTierDisplayName(tierLevel: TierLevel): string {
  switch (tierLevel) {
    case 'budget':
      return 'Essential';
    case 'middle':
      return 'Popular';
    case 'luxury':
      return 'Premium';
  }
}

/**
 * Normalize grouping names to standard tier levels
 * Supports multiple naming conventions:
 * - budget/good/essential → budget
 * - middle/better/popular → middle
 * - luxury/best/premium → luxury
 */
function normalizeGrouping(grouping: string): TierLevel | null {
  const lower = grouping.toLowerCase();

  // Budget tier aliases
  if (['budget', 'good', 'essential', 'basic', 'starter'].includes(lower)) {
    return 'budget';
  }

  // Middle tier aliases
  if (['middle', 'better', 'popular', 'standard', 'recommended'].includes(lower)) {
    return 'middle';
  }

  // Luxury tier aliases
  if (['luxury', 'best', 'premium', 'deluxe', 'ultimate'].includes(lower)) {
    return 'luxury';
  }

  return null;
}

/**
 * Extract tiers from packages based on grouping field
 * Returns an object with budget, middle, luxury keys
 * Accepts multiple naming conventions (good/better/best, budget/middle/luxury, etc.)
 */
export function extractTiers(packages: PackageDto[]): Record<TierLevel, PackageDto | undefined> {
  const tiers: Record<TierLevel, PackageDto | undefined> = {
    budget: undefined,
    middle: undefined,
    luxury: undefined,
  };

  for (const pkg of packages) {
    if (!pkg.grouping) continue;

    const tierLevel = normalizeGrouping(pkg.grouping);
    if (tierLevel) {
      tiers[tierLevel] = pkg;
    }
  }

  return tiers;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** Max length for card description truncation */
export const CARD_DESCRIPTION_MAX_LENGTH = 150;
