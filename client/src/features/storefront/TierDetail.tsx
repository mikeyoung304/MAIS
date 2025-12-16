/**
 * TierDetail Component
 *
 * Displays the full detail view for a selected tier.
 * Shows:
 * - Large hero photo
 * - Full description
 * - Price
 * - Prev/Next tier navigation
 * - Book Now CTA
 *
 * This is the "zoomed in" view customers see after selecting a tier.
 */

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PackageDto } from '@macon/contracts';
import { formatCurrency } from '@/lib/utils';
import { TIER_LEVELS, extractTiers, type TierLevel } from './utils';
import { useTenant, getTierDisplayNameWithFallback } from './hooks';

interface TierDetailProps {
  /** The package/tier to display */
  package: PackageDto;
  /** The current tier level */
  tierLevel: TierLevel;
  /** All packages for navigation (to find prev/next) */
  allPackages: PackageDto[];
  /** Optional segment slug for routing */
  segmentSlug?: string;
  /** Optional segment name for display */
  segmentName?: string;
}

export function TierDetail({
  package: pkg,
  tierLevel,
  allPackages,
  segmentSlug,
  segmentName,
}: TierDetailProps) {
  const navigate = useNavigate();
  const tenant = useTenant();

  // Get display name helper using tenant's custom names or defaults
  const getDisplayName = (level: TierLevel) =>
    getTierDisplayNameWithFallback(level, tenant?.tierDisplayNames);

  // Extract all tiers for navigation
  const tiers = useMemo(() => extractTiers(allPackages), [allPackages]);

  // Calculate prev/next tiers
  const navigation = useMemo(() => {
    const currentIndex = TIER_LEVELS.indexOf(tierLevel);
    const prevLevel = currentIndex > 0 ? TIER_LEVELS[currentIndex - 1] : null;
    const nextLevel = currentIndex < TIER_LEVELS.length - 1 ? TIER_LEVELS[currentIndex + 1] : null;

    return {
      prev: prevLevel && tiers[prevLevel] ? { level: prevLevel, pkg: tiers[prevLevel] } : null,
      next: nextLevel && tiers[nextLevel] ? { level: nextLevel, pkg: tiers[nextLevel] } : null,
    };
  }, [tierLevel, tiers]);

  // Build relative navigation links for tenant storefront compatibility
  // React Router relative paths go to parent *route*, not parent path segment
  // So we need to include the full path from the tenant layout root
  // In segment context: /s/:slug/:tier → build as s/segment/tier_X
  // In root context: /tiers/:tier → build as tiers/tier_X
  const buildTierLink = (level: TierLevel) =>
    segmentSlug ? `../s/${segmentSlug}/${level}` : `../tiers/${level}`;

  // Back link: Go back to the tier selector page
  // In segment context: go to /s/segment (tier selector)
  // In root context: go to /tiers (root tier selector)
  const backLink = segmentSlug ? `../s/${segmentSlug}` : '../tiers';

  // Booking link: Smart routing based on package bookingType
  // DATE packages: Go to date booking wizard with package slug
  // TIMESLOT packages: Go to appointment scheduling
  const bookingType = (pkg as PackageDto & { bookingType?: string }).bookingType || 'DATE';
  const bookingLink = bookingType === 'DATE'
    ? `../book/date/${pkg.slug}`
    : '../book';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section with Photo */}
      <section className="relative">
        {pkg.photoUrl ? (
          <div className="relative h-[40vh] md:h-[50vh] overflow-hidden">
            <img
              src={pkg.photoUrl}
              alt={pkg.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </div>
        ) : (
          <div className="h-[30vh] bg-gradient-to-br from-macon-navy via-macon-navy/90 to-macon-teal/80" />
        )}

        {/* Tier Badge Overlay */}
        <Container className="absolute bottom-0 left-0 right-0 pb-8">
          <Badge
            className={`
              ${tierLevel === 'tier_2' ? 'bg-macon-orange' : 'bg-macon-navy'}
              text-white border-0 text-lg px-4 py-1
            `}
          >
            {getDisplayName(tierLevel)} Tier
          </Badge>
        </Container>
      </section>

      {/* Content Section */}
      <Container className="py-8 md:py-12">
        {/* Back Link */}
        <Link
          to={backLink}
          className="inline-flex items-center text-macon-navy hover:text-macon-orange transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          <span>Back to {segmentName || 'all tiers'}</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-neutral-200 shadow-elevation-1">
              <CardContent className="p-8">
                {/* Title */}
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
                  {pkg.title}
                </h1>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl md:text-5xl font-heading font-bold text-macon-orange">
                    {formatCurrency(pkg.priceCents)}
                  </span>
                </div>

                {/* Description */}
                <div className="prose prose-lg max-w-none text-neutral-700">
                  <p className="whitespace-pre-wrap leading-relaxed">{pkg.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tier Navigation */}
            <Card className="bg-white border-neutral-200 shadow-elevation-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Previous Tier */}
                  <div className="flex-1">
                    {navigation.prev ? (
                      <Link
                        to={buildTierLink(navigation.prev.level)}
                        className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 hover:border-macon-orange/50 hover:bg-neutral-50 transition-all group"
                      >
                        <ArrowLeft className="w-5 h-5 text-neutral-400 group-hover:text-macon-orange transition-colors" />
                        <div>
                          <div className="text-sm text-neutral-500">Previous</div>
                          <div className="font-medium text-neutral-900">
                            {getDisplayName(navigation.prev.level)}
                          </div>
                          <div className="text-sm text-macon-orange">
                            {navigation.prev.pkg && formatCurrency(navigation.prev.pkg.priceCents)}
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="p-4 text-neutral-400 text-sm">No previous tier</div>
                    )}
                  </div>

                  {/* Next Tier */}
                  <div className="flex-1">
                    {navigation.next ? (
                      <Link
                        to={buildTierLink(navigation.next.level)}
                        className="flex items-center justify-end gap-3 p-4 rounded-lg border border-neutral-200 hover:border-macon-orange/50 hover:bg-neutral-50 transition-all group text-right"
                      >
                        <div>
                          <div className="text-sm text-neutral-500">Next</div>
                          <div className="font-medium text-neutral-900">
                            {getDisplayName(navigation.next.level)}
                          </div>
                          <div className="text-sm text-macon-orange">
                            {navigation.next.pkg && formatCurrency(navigation.next.pkg.priceCents)}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-macon-orange transition-colors" />
                      </Link>
                    ) : (
                      <div className="p-4 text-neutral-400 text-sm text-right">No next tier</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Booking CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <Card className="bg-white border-neutral-200 shadow-elevation-2">
                <CardContent className="p-6">
                  <h3 className="font-heading text-xl font-semibold text-neutral-900 mb-2">
                    Ready to book?
                  </h3>
                  <p className="text-neutral-600 mb-6">
                    Secure your spot with this {getDisplayName(tierLevel).toLowerCase()}{' '}
                    package.
                  </p>

                  <div className="space-y-3">
                    <Button
                      size="lg"
                      className="w-full bg-macon-orange hover:bg-macon-orange/90 text-white text-lg h-14"
                      onClick={() => navigate(bookingLink)}
                    >
                      Book Now - {formatCurrency(pkg.priceCents)}
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full text-lg h-12"
                      onClick={() => navigate(backLink)}
                    >
                      Compare All Tiers
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Tier Summary */}
              <Card className="bg-neutral-100 border-neutral-200">
                <CardContent className="p-4">
                  <h4 className="font-medium text-neutral-700 mb-3 text-sm">All Tiers</h4>
                  <div className="space-y-2">
                    {TIER_LEVELS.map((level) => {
                      const tierPkg = tiers[level];
                      if (!tierPkg) return null;

                      const isCurrent = level === tierLevel;

                      return (
                        <Link
                          key={level}
                          to={buildTierLink(level)}
                          className={`
                            flex items-center justify-between p-2 rounded-md transition-colors
                            ${
                              isCurrent
                                ? 'bg-macon-orange/10 border border-macon-orange/30'
                                : 'hover:bg-white'
                            }
                          `}
                        >
                          <span
                            className={`text-sm ${isCurrent ? 'font-medium text-macon-orange' : 'text-neutral-600'}`}
                          >
                            {getDisplayName(level)}
                          </span>
                          <span
                            className={`text-sm ${isCurrent ? 'font-medium text-macon-orange' : 'text-neutral-500'}`}
                          >
                            {formatCurrency(tierPkg.priceCents)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
