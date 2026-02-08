'use client';

/**
 * SegmentPackagesSection - Segment-first service browsing
 *
 * Displays segments as clickable entry points. When a segment is selected,
 * expands to reveal the tiers/packages within that segment.
 *
 * UX Flow:
 * 1. Customer sees segment cards (e.g., "Corporate Wellness", "Elopements")
 * 2. Clicks a segment → animates to show tiers within that segment
 * 3. Can click "← All Services" or browser back to return to segment selection
 *
 * Design: Dark graphite theme with Electric Sage accents per BRAND_VOICE_GUIDE.md
 *
 * Accessibility: All animations respect prefers-reduced-motion via motion-safe: variants
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getSegmentStockPhoto } from '@/lib/constants/stock-photos';
import { formatPrice } from '@/lib/format';
import { TIER_ORDER } from '@/lib/packages';
import type { TenantStorefrontData, PackageData, SegmentData } from '@/lib/tenant.client';
import { SEED_PACKAGE_NAMES } from '@macon/contracts';

interface SegmentPackagesSectionProps {
  data: TenantStorefrontData;
  /** Base path for booking links */
  basePath?: string;
  /** Domain query parameter for custom domain routes */
  domainParam?: string;
}

interface SegmentCardProps {
  segment: SegmentData;
  packages: PackageData[];
  onSelect: () => void;
}

/**
 * Get the price range text for a segment's packages
 */
function getPriceRange(packages: PackageData[]): string {
  if (packages.length === 0) return '';
  const prices = packages.map((p) => p.priceCents).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];
  if (min === max) return formatPrice(min);
  return `From ${formatPrice(min)}`;
}

/**
 * Segment Card - Entry point for a service category
 */
function SegmentCard({ segment, packages, onSelect }: SegmentCardProps) {
  const priceRange = getPriceRange(packages);
  // Use heroImage if set, otherwise use stock photo based on keywords
  const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);

  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-surface-alt text-left motion-safe:transition-all motion-safe:duration-500 hover:border-sage/40 hover:shadow-2xl hover:shadow-sage/10 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2 focus:ring-offset-surface"
    >
      {/* Hero Image (from segment or stock photo) */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={imageUrl}
          alt={segment.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105"
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-alt via-surface-alt/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-2xl font-bold text-text-primary motion-safe:transition-colors motion-safe:duration-300 group-hover:text-sage">
          {segment.name}
        </h3>

        {segment.heroSubtitle && (
          <p className="mt-2 text-sm font-light italic text-text-muted">{segment.heroSubtitle}</p>
        )}

        {segment.description && (
          <p className="mt-3 line-clamp-2 text-sm text-text-muted">{segment.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-sm font-medium text-sage">{priceRange}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-text-muted motion-safe:transition-all motion-safe:duration-300 motion-safe:group-hover:translate-x-1 group-hover:text-sage">
            Explore
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}

interface TierCardProps {
  pkg: PackageData;
  tierLabel: string;
  bookHref: string;
  isPopular: boolean;
}

/**
 * Tier Card - Package within a segment
 */
function TierCard({ pkg, tierLabel, bookHref, isPopular }: TierCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-8 motion-safe:transition-all motion-safe:duration-300 ${
        isPopular
          ? 'border-2 border-sage bg-surface-alt shadow-xl shadow-sage/10'
          : 'border border-neutral-800 bg-surface-alt motion-safe:hover:-translate-y-1 hover:border-neutral-700 hover:shadow-xl'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-sage px-4 py-1 text-sm font-medium text-white shadow-lg">
          Most Popular
        </div>
      )}

      <h3 className="text-lg font-semibold text-text-primary">{tierLabel}</h3>

      <p className="mt-3 text-3xl font-bold text-text-primary">
        {formatPrice(pkg.priceCents)}
        <span className="text-base font-normal text-text-muted">/session</span>
      </p>

      {pkg.description && <p className="mt-4 flex-1 text-sm text-text-muted">{pkg.description}</p>}

      <Button asChild variant={isPopular ? 'sage' : 'outline'} className="mt-8 w-full">
        <Link href={bookHref}>Book {tierLabel}</Link>
      </Button>
    </div>
  );
}

interface TierGridSectionProps {
  segment: SegmentData;
  packages: PackageData[];
  tenant: TenantStorefrontData['tenant'];
  getBookHref: (slug: string) => string;
  /** Optional ref for the heading element (used for focus management) */
  headingRef?: React.RefObject<HTMLHeadingElement>;
  /** Whether to show extended segment info (subtitle with different styling, description) */
  showExtendedInfo?: boolean;
}

/**
 * Tier Grid Section - Renders segment header and tier cards grid
 * Extracted to DRY up single-segment and multi-segment expanded views
 */
function TierGridSection({
  segment,
  packages,
  tenant,
  getBookHref,
  headingRef,
  showExtendedInfo = false,
}: TierGridSectionProps) {
  const midIndex = Math.floor(packages.length / 2);

  const gridClasses =
    packages.length === 1
      ? 'mx-auto max-w-md md:grid-cols-1'
      : packages.length === 2
        ? 'mx-auto max-w-2xl md:grid-cols-2'
        : 'md:grid-cols-3';

  return (
    <>
      <div className="text-center">
        <h2
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={`font-serif text-3xl font-bold text-text-primary sm:text-4xl md:text-5xl${headingRef ? ' outline-none' : ''}`}
        >
          {segment.heroTitle || segment.name}
        </h2>
        {segment.heroSubtitle && (
          <p
            className={`mx-auto mt-4 max-w-2xl text-lg ${
              showExtendedInfo ? 'font-light italic text-sage' : 'text-text-muted'
            }`}
          >
            {segment.heroSubtitle}
          </p>
        )}
        {showExtendedInfo && segment.description && (
          <p className="mx-auto mt-6 max-w-3xl text-text-muted">{segment.description}</p>
        )}
      </div>

      <div className={`mt-16 grid gap-8 ${gridClasses}`}>
        {packages.map((pkg, index) => {
          const isPopular = packages.length > 2 && index === midIndex;
          const tierLabel =
            tenant.tierDisplayNames?.[
              pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames
            ] || pkg.title;

          return (
            <TierCard
              key={pkg.id}
              pkg={pkg}
              tierLabel={tierLabel}
              bookHref={getBookHref(pkg.slug)}
              isPopular={isPopular}
            />
          );
        })}
      </div>
    </>
  );
}

/**
 * Main Component - Segment-first service browsing
 */
export function SegmentPackagesSection({
  data,
  basePath = '',
  domainParam = '',
}: SegmentPackagesSectionProps) {
  const { tenant, packages, segments } = data;
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  // Live region announcement for screen readers (WCAG 4.1.3 Status Messages)
  const [announcement, setAnnouncement] = useState('');

  // Ref for focus management - move focus to heading when segment is selected
  const expandedHeadingRef = useRef<HTMLHeadingElement>(null);

  // Sync with URL hash for browser back/forward support
  useEffect(() => {
    /**
     * Parse a URL hash and extract segment slug with validation
     * - Length cap (200 chars) prevents performance issues with malicious URLs
     * - decodeURIComponent handles URL-encoded characters (e.g., %20 for spaces)
     * - try/catch handles malformed URI encoding gracefully
     */
    const parseSegmentFromHash = (hash: string): string | null => {
      // Length cap to prevent performance issues with extremely long hashes
      if (!hash.startsWith('segment-') || hash.length >= 200) {
        return null;
      }
      try {
        return decodeURIComponent(hash.replace('segment-', ''));
      } catch {
        // Invalid URI encoding (e.g., %ZZ), ignore silently
        return null;
      }
    };

    // Read initial hash on mount
    const hash = window.location.hash.slice(1); // Remove #
    const slug = parseSegmentFromHash(hash);
    if (slug) {
      const segment = segments.find((s) => s.slug === slug);
      if (segment) {
        setSelectedSegmentId(segment.id);
      }
    }

    // Listen for hash changes (browser back/forward)
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      const newSlug = parseSegmentFromHash(newHash);
      if (newSlug) {
        const segment = segments.find((s) => s.slug === newSlug);
        if (segment) {
          setSelectedSegmentId(segment.id);
        }
      } else if (newHash === 'packages' || newHash === '') {
        setSelectedSegmentId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [segments]);

  // Safety net: never show $0 seed packages to visitors.
  // Cross-ref: @macon/contracts SEED_PACKAGE_NAMES (canonical source: server/src/lib/tenant-defaults.ts:28-50)

  // Filter active packages, excluding seed defaults
  const activePackages = packages.filter(
    (p) =>
      (p.isActive ?? p.active) &&
      !(p.priceCents === 0 && (SEED_PACKAGE_NAMES as readonly string[]).includes(p.title))
  );

  // Group packages by segment (memoized to avoid recomputation on every render)
  const packagesBySegment = useMemo(() => {
    const map = new Map<string, PackageData[]>();
    segments.forEach((segment) => {
      const segmentPackages = activePackages
        .filter((p) => p.segmentId === segment.id)
        .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
      if (segmentPackages.length > 0) {
        map.set(segment.id, segmentPackages);
      }
    });
    return map;
  }, [segments, activePackages]);

  // Only show segments that have packages (memoized to avoid recomputation on every render)
  const segmentsWithPackages = useMemo(
    () =>
      segments.filter((s) => packagesBySegment.has(s.id)).sort((a, b) => a.sortOrder - b.sortOrder),
    [segments, packagesBySegment]
  );

  // Get booking link - must be before any conditional returns (React Rules of Hooks)
  const getBookHref = useCallback(
    (packageSlug: string) => {
      if (domainParam) {
        return `/t/${tenant.slug}/book/${packageSlug}`;
      }
      return `${basePath}/book/${packageSlug}`;
    },
    [basePath, domainParam, tenant.slug]
  );

  // Handle segment selection - update URL hash for browser history
  // Must be before any conditional returns (React Rules of Hooks)
  const handleSelectSegment = useCallback(
    (segmentId: string) => {
      const segment = segments.find((s) => s.id === segmentId);
      if (segment) {
        // Push to history so browser back works
        window.history.pushState(null, '', `#segment-${segment.slug}`);
        setSelectedSegmentId(segmentId);
        // Announce to screen readers (WCAG 4.1.3 Status Messages)
        setAnnouncement(`Viewing ${segment.name} packages`);
        // Move focus to expanded heading after React renders (WCAG 2.4.3 Focus Order)
        requestAnimationFrame(() => {
          expandedHeadingRef.current?.focus();
        });
      }
    },
    [segments]
  );

  // Handle back to segments - must be before any conditional returns (React Rules of Hooks)
  const handleBack = useCallback(() => {
    // Push to history so browser forward works
    window.history.pushState(null, '', '#packages');
    setSelectedSegmentId(null);
    // Announce to screen readers (WCAG 4.1.3 Status Messages)
    setAnnouncement('Returned to service categories');
  }, []);

  // Get selected segment and its packages (derived state, not a hook)
  const selectedSegment = selectedSegmentId
    ? segments.find((s) => s.id === selectedSegmentId)
    : null;
  const selectedPackages = selectedSegmentId ? packagesBySegment.get(selectedSegmentId) || [] : [];

  // Empty state - no segments have active packages
  // This must come AFTER all hooks are called (React Rules of Hooks)
  if (segmentsWithPackages.length === 0) {
    return (
      <section id="packages" className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
            Services coming soon
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-muted">
            We&apos;re preparing something special for you. Check back soon!
          </p>
        </div>
      </section>
    );
  }

  // If only one segment, skip segment selection and show tiers directly
  if (segmentsWithPackages.length === 1) {
    const segment = segmentsWithPackages[0];
    const segmentPackages = packagesBySegment.get(segment.id) || [];

    return (
      <section id="packages" className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <TierGridSection
            segment={segment}
            packages={segmentPackages}
            tenant={tenant}
            getBookHref={getBookHref}
          />
        </div>
      </section>
    );
  }

  // Multiple segments - show segment selection or expanded view
  return (
    <section id="packages" className="py-32 md:py-40">
      {/* Live region for screen reader announcements (WCAG 4.1.3 Status Messages) */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* Segment Selection View */}
        {!selectedSegment && (
          <>
            <div className="text-center">
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl md:text-5xl">
                What brings you here?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
                Choose the experience that fits your needs.
              </p>
            </div>

            <div
              className={`mt-16 grid gap-8 ${
                segmentsWithPackages.length === 2
                  ? 'mx-auto max-w-3xl md:grid-cols-2'
                  : 'md:grid-cols-3'
              }`}
            >
              {segmentsWithPackages.map((segment) => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  packages={packagesBySegment.get(segment.id) || []}
                  onSelect={() => handleSelectSegment(segment.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Expanded Segment View */}
        {selectedSegment && (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="group mb-8 flex items-center gap-2 text-sm font-medium text-text-muted motion-safe:transition-colors hover:text-sage"
            >
              <svg
                className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              All Services
            </button>

            <TierGridSection
              segment={selectedSegment}
              packages={selectedPackages}
              tenant={tenant}
              getBookHref={getBookHref}
              headingRef={expandedHeadingRef}
              showExtendedInfo
            />
          </div>
        )}
      </div>
    </section>
  );
}
