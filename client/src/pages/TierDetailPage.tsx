/**
 * TierDetailPage
 *
 * Displays the full detail view for a selected tier.
 * Routes:
 * - /s/:slug/:tier - Segment-specific tier
 * - /tiers/:tier - Root tier (no segment)
 *
 * Customer flow:
 * 1. Customer selects a tier from TierSelector
 * 2. This page shows full details with prev/next navigation
 * 3. Customer can book or navigate to other tiers
 */

import { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
  TierDetail,
  TIER_LEVELS,
  LEGACY_TIER_ALIASES,
  normalizeGrouping,
  type TierLevel,
} from '@/features/storefront';
import { Loading } from '@/ui/Loading';
import { FeatureErrorBoundary } from '@/components/errors';
import { useSegmentWithPackages, usePackages } from '@/features/catalog/hooks';
import type { PackageDto } from '@macon/contracts';

/**
 * Segment Tier Detail - /s/:slug/:tier
 */
function SegmentTierDetailContent() {
  const { slug, tier } = useParams<{ slug: string; tier: string }>();
  const { data: segment, isLoading, error } = useSegmentWithPackages(slug || '');

  // Validate params - use ".." to go up to parent (segment tiers page)
  if (!slug || !tier) {
    return <Navigate to=".." replace />;
  }

  // Handle legacy URL redirects (budget→tier_1, middle→tier_2, luxury→tier_3, etc.)
  const lowerTier = tier.toLowerCase();
  if (lowerTier in LEGACY_TIER_ALIASES) {
    return <Navigate to={`../${LEGACY_TIER_ALIASES[lowerTier]}`} replace />;
  }

  // Validate tier level - go back to segment tiers page if invalid
  const tierLevel = lowerTier;
  if (!TIER_LEVELS.includes(tierLevel as TierLevel)) {
    return <Navigate to=".." replace />;
  }

  // Loading state
  if (isLoading) {
    return <Loading label="Loading tier details..." />;
  }

  // Error or not found - go back to storefront home
  if (error || !segment) {
    return <Navigate to="../.." replace />;
  }

  const packages = segment.packages || [];

  // Find the package matching this tier (using normalizeGrouping to handle naming conventions)
  const pkg = packages.find((p: PackageDto) => {
    if (!p.grouping) return false;
    return normalizeGrouping(p.grouping) === tierLevel;
  });

  if (!pkg) {
    return <Navigate to=".." replace />;
  }

  return (
    <TierDetail
      package={pkg}
      tierLevel={tierLevel as TierLevel}
      allPackages={packages}
      segmentSlug={slug}
      segmentName={segment.name}
    />
  );
}

/**
 * Root Tier Detail - /tiers/:tier (no segment)
 */
function RootTierDetailContent() {
  const { tier } = useParams<{ tier: string }>();
  const { data: packages, isLoading, error } = usePackages();

  // Filter to root packages (no segment) with valid tier groupings - memoized
  // Use normalizeGrouping to handle various naming conventions (Good/Better/Best, etc.)
  // Must be called before any early returns to comply with Rules of Hooks
  const rootPackages = useMemo(
    () =>
      (packages ?? []).filter(
        (p: PackageDto) => !p.segmentId && p.grouping && normalizeGrouping(p.grouping) !== null
      ),
    [packages]
  );

  // Validate tier param - use ".." to go back to tiers list
  if (!tier) {
    return <Navigate to=".." replace />;
  }

  // Handle legacy URL redirects (budget→tier_1, middle→tier_2, luxury→tier_3, etc.)
  const lowerTier = tier.toLowerCase();
  if (lowerTier in LEGACY_TIER_ALIASES) {
    return <Navigate to={`../${LEGACY_TIER_ALIASES[lowerTier]}`} replace />;
  }

  // Validate tier level - use ".." to go back to tiers list
  const tierLevel = lowerTier;
  if (!TIER_LEVELS.includes(tierLevel as TierLevel)) {
    return <Navigate to=".." replace />;
  }

  // Loading state
  if (isLoading) {
    return <Loading label="Loading tier details..." />;
  }

  // Error or not found - use ".." to go back to tiers list
  if (error || !packages) {
    return <Navigate to=".." replace />;
  }

  // Find the package matching this tier (using normalizeGrouping to handle naming conventions)
  const pkg = rootPackages.find((p: PackageDto) => {
    if (!p.grouping) return false;
    return normalizeGrouping(p.grouping) === tierLevel;
  });

  if (!pkg) {
    return <Navigate to=".." replace />;
  }

  return <TierDetail package={pkg} tierLevel={tierLevel as TierLevel} allPackages={rootPackages} />;
}

/**
 * Segment Tier Detail Page - /s/:slug/:tier
 */
export function SegmentTierDetail() {
  return (
    <FeatureErrorBoundary featureName="Tier Detail">
      <SegmentTierDetailContent />
    </FeatureErrorBoundary>
  );
}

/**
 * Root Tier Detail Page - /tiers/:tier
 */
export function RootTierDetail() {
  return (
    <FeatureErrorBoundary featureName="Tier Detail">
      <RootTierDetailContent />
    </FeatureErrorBoundary>
  );
}
