/**
 * Segment Landing Page
 *
 * Displays a segment with hero section and filtered packages.
 * Part of the segmented customer journey feature.
 */

import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/ui/Container';
import { PackageCard } from '@/features/catalog/PackageCard';
import { PackageCardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSegmentWithPackages } from '@/features/catalog/hooks';
import { FeatureErrorBoundary } from '@/components/errors';

/**
 * Hero section with segment title, subtitle, and optional background image
 */
function SegmentHero({
  title,
  subtitle,
  image,
}: {
  title: string;
  subtitle: string | null;
  image: string | null;
}) {
  return (
    <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      {image ? (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-macon-navy via-macon-navy/90 to-macon-teal/80" />
      )}

      {/* Content */}
      <Container className="relative z-10 text-center py-16">
        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  );
}

function SegmentLandingContent() {
  const { slug } = useParams<{ slug: string }>();
  const { data: segment, isLoading, error } = useSegmentWithPackages(slug || '');

  // Redirect if no slug provided
  if (!slug) {
    return <Navigate to="/packages" replace />;
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        {/* Loading hero placeholder */}
        <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-macon-navy via-macon-navy/90 to-macon-teal/80 animate-pulse" />
          <Container className="relative z-10 text-center py-16">
            <div className="h-12 w-2/3 mx-auto bg-white/20 rounded-lg animate-pulse mb-4" />
            <div className="h-6 w-1/2 mx-auto bg-white/10 rounded-lg animate-pulse" />
          </Container>
        </section>

        {/* Loading package grid */}
        <Container className="py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </>
    );
  }

  // Error state or segment not found
  if (error || !segment) {
    return (
      <Container className="py-12">
        <div className="text-center py-20">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-macon-navy mb-6">
            Not Found
          </h1>
          <p className="text-xl text-neutral-600 mb-8">This experience is no longer available.</p>
          <Link to="/packages">
            <Button size="lg" className="min-h-[44px]">
              <ArrowLeft className="w-5 h-5 mr-2" />
              View All
            </Button>
          </Link>
        </div>
      </Container>
    );
  }

  const packages = segment.packages || [];

  return (
    <>
      {/* Hero Section */}
      <SegmentHero
        title={segment.heroTitle}
        subtitle={segment.heroSubtitle}
        image={segment.heroImage}
      />

      {/* Back to segments link */}
      <Container className="pt-8">
        <Link
          to="/"
          className="inline-flex items-center text-macon-navy hover:text-macon-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Back to all segments</span>
        </Link>
      </Container>

      {/* Description (if present) */}
      {segment.description && (
        <Container className="py-8">
          <p className="text-lg text-neutral-700 max-w-4xl leading-relaxed">
            {segment.description}
          </p>
        </Container>
      )}

      {/* Package Grid */}
      <Container className="py-8 pb-16">
        {packages.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-xl border-2 border-neutral-200">
            <p className="text-2xl text-macon-navy-600 mb-3 font-semibold">Coming soon</p>
            <p className="text-lg text-neutral-600 mb-8">New options launching shortly.</p>
            <Link to="/packages">
              <Button variant="outline" size="lg" className="min-h-[44px]">
                View All
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-lg text-neutral-600 mb-6">
              {packages.length} {packages.length === 1 ? 'package' : 'packages'} available
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} package={pkg} />
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  );
}

export function SegmentLanding() {
  return (
    <FeatureErrorBoundary featureName="Segment Landing">
      <SegmentLandingContent />
    </FeatureErrorBoundary>
  );
}
