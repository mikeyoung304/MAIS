/**
 * Storefront React Hooks
 *
 * Custom hooks for storefront components to access tenant-specific
 * configuration and display settings.
 */

import { useOutletContext } from 'react-router-dom';
import type { TenantPublicDto, TierDisplayNames } from '@macon/contracts';
import { getTierDisplayName, type TierLevel } from './utils';

/**
 * Context type for storefront outlet
 */
interface StorefrontContext {
  tenant: TenantPublicDto;
}

/**
 * Hook to access the current tenant from outlet context
 *
 * Only works within routes nested under TenantStorefrontLayout
 *
 * @returns The tenant object or undefined if not in storefront context
 */
export function useTenant(): TenantPublicDto | undefined {
  // Always call the hook - React requires hooks to be called in the same order
  // Use a wrapper to safely handle missing context
  const context = useOutletContext<StorefrontContext | null>();
  return context?.tenant;
}

/**
 * Get the display name for a tier level
 *
 * Uses tenant's custom display names if configured, otherwise falls back
 * to default names (Essential, Popular, Premium).
 *
 * @param tierLevel - The canonical tier level (tier_1, tier_2, tier_3)
 * @param tierDisplayNames - Optional tenant tier display names config
 * @returns The display name for the tier
 *
 * @example
 * // With custom config
 * getTierDisplayNameWithFallback('tier_1', { tier_1: 'The Grounding Reset' })
 * // => 'The Grounding Reset'
 *
 * // Without custom config
 * getTierDisplayNameWithFallback('tier_1')
 * // => 'Essential'
 */
export function getTierDisplayNameWithFallback(
  tierLevel: TierLevel,
  tierDisplayNames?: TierDisplayNames | null
): string {
  // Check for tenant's custom display name
  if (tierDisplayNames?.[tierLevel]) {
    return tierDisplayNames[tierLevel]!;
  }

  // Fall back to default display names
  return getTierDisplayName(tierLevel);
}

/**
 * Hook to get the display name for a tier level using tenant config
 *
 * Automatically uses the current tenant's tierDisplayNames if configured,
 * otherwise falls back to default names (Essential, Popular, Premium).
 *
 * Only works within routes nested under TenantStorefrontLayout.
 * Returns default display name if not in storefront context.
 *
 * @param tierLevel - The canonical tier level (tier_1, tier_2, tier_3)
 * @returns The display name for the tier
 *
 * @example
 * function TierCard({ tierLevel }) {
 *   const displayName = useTierDisplayName(tierLevel);
 *   return <Badge>{displayName}</Badge>;
 * }
 */
export function useTierDisplayName(tierLevel: TierLevel): string {
  const tenant = useTenant();
  return getTierDisplayNameWithFallback(tierLevel, tenant?.tierDisplayNames);
}
