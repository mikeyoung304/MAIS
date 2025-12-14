/**
 * Storefront Tier Utilities
 *
 * Shared constants and functions for the 3-tier pricing system.
 * Extracted to avoid duplication across TierCard, TierSelector, and TierDetail.
 *
 * Canonical tier names: tier_1, tier_2, tier_3
 * Display names (default): Essential, Popular, Premium
 * Tenants can customize display names via tierDisplayNames config.
 */

import type { PackageDto } from '@macon/contracts';

/**
 * Standard tier levels in display order (canonical names)
 * tier_1 = Entry level / Essential
 * tier_2 = Mid tier / Popular (recommended)
 * tier_3 = Premium tier
 */
export const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'] as const;
export type TierLevel = (typeof TIER_LEVELS)[number];

/**
 * Legacy tier level aliases for backward compatibility during migration
 * Maps old URL slugs to canonical tier names
 */
export const LEGACY_TIER_ALIASES: Record<string, TierLevel> = {
  // Old URL slugs
  budget: 'tier_1',
  middle: 'tier_2',
  luxury: 'tier_3',
  // Common naming conventions (will be removed after DB migration)
  good: 'tier_1',
  better: 'tier_2',
  best: 'tier_3',
  essential: 'tier_1',
  popular: 'tier_2',
  premium: 'tier_3',
  basic: 'tier_1',
  standard: 'tier_2',
  deluxe: 'tier_3',
  starter: 'tier_1',
  recommended: 'tier_2',
  ultimate: 'tier_3',
};

/**
 * Get tier display name based on tier level
 * tier_1 → Essential, tier_2 → Popular, tier_3 → Premium
 *
 * Note: Tenants can override these via tierDisplayNames config
 */
export function getTierDisplayName(tierLevel: TierLevel): string {
  switch (tierLevel) {
    case 'tier_1':
      return 'Essential';
    case 'tier_2':
      return 'Popular';
    case 'tier_3':
      return 'Premium';
  }
}

/**
 * Normalize grouping names to standard tier levels
 * Supports canonical names (tier_1/tier_2/tier_3) and legacy aliases
 * for backward compatibility during migration.
 *
 * After DB migration is complete, this will only need to handle
 * canonical tier names.
 */
export function normalizeGrouping(grouping: string): TierLevel | null {
  const lower = grouping.trim().toLowerCase();

  // Check canonical names first
  if (TIER_LEVELS.includes(lower as TierLevel)) {
    return lower as TierLevel;
  }

  // Check legacy aliases for backward compatibility
  if (lower in LEGACY_TIER_ALIASES) {
    return LEGACY_TIER_ALIASES[lower];
  }

  return null;
}

/**
 * Extract tiers from packages based on grouping field
 * Returns an object with tier_1, tier_2, tier_3 keys
 * Accepts both canonical and legacy naming conventions
 */
export function extractTiers(packages: PackageDto[]): Record<TierLevel, PackageDto | undefined> {
  const tiers: Record<TierLevel, PackageDto | undefined> = {
    tier_1: undefined,
    tier_2: undefined,
    tier_3: undefined,
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
