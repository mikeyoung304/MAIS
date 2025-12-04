/**
 * SegmentTiers Page
 *
 * Displays the 3-tier selection for a specific segment.
 * Route: /s/:slug
 *
 * Customer flow:
 * 1. Customer selects a segment from StorefrontHome
 * 2. This page shows 3 tier cards (Budget/Middle/Luxury)
 * 3. Customer clicks a tier to see TierDetailPage
 */

import { useParams, Navigate } from 'react-router-dom';
import { Container } from '@/ui/Container';
import { TierSelector } from '@/features/storefront/TierSelector';
import { PackageCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { FeatureErrorBoundary } from '@/components/errors';
import { useSegmentWithPackages } from '@/features/catalog/hooks';

function SegmentTiersContent() {
  const { slug } = useParams<{ slug: string }>();
  const { data: segment, isLoading, error } = useSegmentWithPackages(slug || '');

  // Redirect if no slug provided - use relative ".." to go up one level
  if (!slug) {
    return <Navigate to=".." replace />;
  }

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

  // Error state or segment not found - use relative ".." to go up one level
  if (error || !segment) {
    return <Navigate to=".." replace />;
  }

  const packages = segment.packages || [];

  return (
    <TierSelector
      packages={packages}
      segmentSlug={slug}
      title={segment.heroTitle || 'Choose Your Experience'}
      subtitle={
        segment.heroSubtitle || segment.description || 'Select the tier that best fits your needs'
      }
      backLink=".."
      backLinkText="Back to all options"
    />
  );
}

export function SegmentTiers() {
  return (
    <FeatureErrorBoundary featureName="Segment Tiers">
      <SegmentTiersContent />
    </FeatureErrorBoundary>
  );
}
