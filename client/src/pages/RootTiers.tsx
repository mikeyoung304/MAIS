/**
 * RootTiers Page
 *
 * Displays the 3-tier selection when tenant has no segments.
 * Route: /tiers
 *
 * Customer flow:
 * 1. StorefrontHome detects no segments, redirects here
 * 2. This page shows 3 tier cards (Budget/Middle/Luxury)
 * 3. Customer clicks a tier to see TierDetailPage
 */

import { useMemo } from 'react';
import { Container } from '@/ui/Container';
import { TierSelector, TIER_LEVELS, type TierLevel } from '@/features/storefront';
import { PackageCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { FeatureErrorBoundary } from '@/components/errors';
import { usePackages } from '@/features/catalog/hooks';
import type { PackageDto } from '@macon/contracts';

function RootTiersContent() {
  const { data: packages, isLoading, error, refetch } = usePackages();

  // Loading state
  if (isLoading) {
    return (
      <Container className="py-12">
        <div className="text-center mb-12">
          <Skeleton className="h-12 w-2/3 mx-auto mb-4" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container className="py-12">
        <div className="text-center py-20 bg-neutral-50 rounded-xl border-2 border-neutral-200">
          <p className="text-2xl text-macon-navy-600 mb-3 font-semibold">
            Unable to load packages
          </p>
          <p className="text-lg text-neutral-600 mb-6">
            Please try again in a moment.
          </p>
          <button
            onClick={() => refetch()}
            className="px-6 py-3 bg-macon-orange text-white rounded-lg hover:bg-macon-orange/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </Container>
    );
  }

  // Filter to root packages (no segment) with valid tier groupings - memoized
  const rootPackages = useMemo(
    () =>
      (packages || []).filter(
        (p: PackageDto) =>
          !p.segmentId &&
          p.grouping &&
          TIER_LEVELS.includes(p.grouping.toLowerCase() as TierLevel)
      ),
    [packages]
  );

  return (
    <TierSelector
      packages={rootPackages}
      title="Choose Your Experience"
      subtitle="Select the tier that best fits your needs"
    />
  );
}

export function RootTiers() {
  return (
    <FeatureErrorBoundary featureName="Root Tiers">
      <RootTiersContent />
    </FeatureErrorBoundary>
  );
}
