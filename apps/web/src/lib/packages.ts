/**
 * Package Utilities
 *
 * Shared utilities for package sorting and grouping.
 */

/**
 * Tier ordering for package display
 *
 * Lower numbers appear first. Used for consistent sorting
 * across services page and landing page.
 */
export const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PREMIUM: 2,
  CUSTOM: 3,
  // Lowercase variants for segment-based sorting
  basic: 0,
  standard: 1,
  premium: 2,
  custom: 3,
};

/**
 * Package with tier information
 */
interface PackageWithTier {
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
}

/**
 * Sort packages by tier for display
 *
 * Orders packages from Basic → Standard → Premium → Custom.
 *
 * @param packages - Array of packages with tier property
 * @returns New sorted array (does not mutate original)
 *
 * @example
 * const sorted = sortPackagesByTier(packages);
 */
export function sortPackagesByTier<T extends PackageWithTier>(packages: T[]): T[] {
  return [...packages].sort((a, b) => {
    const orderA = TIER_ORDER[a.tier] ?? 99;
    const orderB = TIER_ORDER[b.tier] ?? 99;
    return orderA - orderB;
  });
}

/**
 * Get tier order value for a tier string
 *
 * @param tier - Tier name (case-insensitive)
 * @returns Numeric order (0-3), or 99 if unknown
 */
export function getTierOrder(tier: string): number {
  return TIER_ORDER[tier] ?? TIER_ORDER[tier.toUpperCase()] ?? 99;
}
