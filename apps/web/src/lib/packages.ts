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
