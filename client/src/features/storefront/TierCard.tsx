/**
 * TierCard Component
 *
 * Thin wrapper around ChoiceCardBase for tier (package) display.
 * Used in TierSelector for the 3-tier pricing layout.
 *
 * Features:
 * - Maps PackageDto fields to ChoiceCardBase props
 * - Shows price (tier cards always display price)
 * - "Most Popular" badge only when exactly 3 tiers AND tier is middle
 * - CTA: "View Details"
 * - Uses relative links for tenant storefront compatibility
 * - Memoized to prevent unnecessary re-renders
 */

import { memo } from 'react';
import type { PackageDto } from '@macon/contracts';
import { ChoiceCardBase } from './ChoiceCardBase';
import { useTierDisplayName } from './hooks';
import { truncateText, CARD_DESCRIPTION_MAX_LENGTH, type TierLevel } from './utils';

interface TierCardProps {
  package: PackageDto;
  /** The tier level: tier_1, tier_2, or tier_3 */
  tierLevel: TierLevel;
  /** Optional segment slug for routing */
  segmentSlug?: string;
  /** Total number of configured tiers (used for highlighting logic) */
  totalTierCount: number;
}

export const TierCard = memo(function TierCard({
  package: pkg,
  tierLevel,
  segmentSlug,
  totalTierCount,
}: TierCardProps) {
  // Get display name using tenant's custom names or defaults
  const tierDisplayName = useTierDisplayName(tierLevel);

  // Only highlight middle tier when exactly 3 tiers exist
  const isHighlighted = totalTierCount === 3 && tierLevel === 'tier_2';

  // Build relative link based on whether we're in a segment context
  // Relative paths resolve correctly within /t/:tenantSlug routes
  const href = segmentSlug ? `${tierLevel}` : `tiers/${tierLevel}`;

  // Get image URL, preferring new photos array over legacy photoUrl
  const imageUrl = pkg.photos?.[0]?.url || pkg.photoUrl || null;

  return (
    <ChoiceCardBase
      title={pkg.title}
      description={truncateText(pkg.description, CARD_DESCRIPTION_MAX_LENGTH)}
      imageUrl={imageUrl}
      imageAlt={`${tierDisplayName} tier: ${pkg.title}`}
      categoryLabel={tierDisplayName}
      price={pkg.priceCents}
      cta="View Details"
      href={href}
      highlighted={isHighlighted}
      testId={`tier-card-${tierLevel}`}
    />
  );
});
