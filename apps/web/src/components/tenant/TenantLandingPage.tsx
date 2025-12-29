/**
 * TenantLandingPage - Main landing page component
 *
 * Uses SectionRenderer for flexible section display.
 * Packages (tier cards) are handled separately as they require special
 * rendering logic (sorting, "Most Popular" badge, booking links).
 *
 * Layout:
 * 1. Pre-packages sections (hero, social proof, text, etc.)
 * 2. Segment picker (if multiple segments)
 * 3. Packages/tier cards
 * 4. Post-packages sections (about, gallery, testimonials, faq)
 * 5. Final CTA
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TenantStorefrontData } from '@/lib/tenant';
import { normalizeToPages } from '@/lib/tenant';
import { formatPrice } from '@/lib/format';
import { TIER_ORDER } from '@/lib/packages';
import { SectionRenderer } from './SectionRenderer';
import type { Section, HeroSection, CTASection, LandingPageConfig } from '@macon/contracts';

interface TenantLandingPageProps {
  data: TenantStorefrontData;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

/**
 * Build sections for the home page from landing config.
 *
 * This handles both:
 * - New page-based config (pages.home.sections)
 * - Legacy config (hero, about, testimonials, gallery, faq)
 *
 * Returns sections split into pre-packages and post-packages groups
 * so packages can be rendered in between with special handling.
 */
function buildHomeSections(
  landingConfig: LandingPageConfig | undefined,
  tenantName: string
): { preSections: Section[]; postSections: Section[]; finalCta: CTASection | null } {
  // Default hero if nothing configured
  const defaultHero: HeroSection = {
    type: 'hero',
    headline: `Welcome to ${tenantName}`,
    subheadline: 'Book your session today.',
    ctaText: 'View Packages',
  };

  // If we have new page-based config, use it directly
  if (landingConfig?.pages?.home?.sections) {
    const homeSections = landingConfig.pages.home.sections;

    // Find hero (usually first) and CTA (usually last)
    const heroSection = homeSections.find((s): s is HeroSection => s.type === 'hero');
    const ctaSection = homeSections.find((s): s is CTASection => s.type === 'cta');

    // Pre-sections = hero only (packages come next)
    const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];

    // Post-sections = everything except hero and cta
    const postSections = homeSections.filter((s) => s.type !== 'hero' && s.type !== 'cta');

    return { preSections, postSections, finalCta: ctaSection || null };
  }

  // Legacy config handling
  const pages = normalizeToPages(landingConfig);
  const preSections: Section[] = [];
  const postSections: Section[] = [];

  // Hero from legacy config or normalized
  if (landingConfig?.hero) {
    preSections.push({
      type: 'hero',
      headline: landingConfig.hero.headline,
      subheadline: landingConfig.hero.subheadline,
      ctaText: landingConfig.hero.ctaText,
      backgroundImageUrl: landingConfig.hero.backgroundImageUrl,
    });
  } else if (pages.home.sections.length > 0) {
    const heroSection = pages.home.sections.find((s): s is HeroSection => s.type === 'hero');
    if (heroSection) preSections.push(heroSection);
    else preSections.push(defaultHero);
  } else {
    preSections.push(defaultHero);
  }

  // Post-packages sections from legacy config
  const legacySections = landingConfig?.sections;

  // About section
  if (legacySections?.about && landingConfig?.about?.content) {
    postSections.push({
      type: 'text',
      headline: landingConfig.about.headline,
      content: landingConfig.about.content,
      imageUrl: landingConfig.about.imageUrl,
      imagePosition: landingConfig.about.imagePosition || 'left',
    });
  }

  // Testimonials section
  if (legacySections?.testimonials && landingConfig?.testimonials?.items?.length) {
    postSections.push({
      type: 'testimonials',
      headline: landingConfig.testimonials.headline,
      items: landingConfig.testimonials.items.map((item) => ({
        quote: item.quote,
        authorName: item.author,
        authorRole: item.role,
        authorPhotoUrl: item.imageUrl,
        rating: item.rating || 5,
      })),
    });
  }

  // Gallery section
  if (legacySections?.gallery && landingConfig?.gallery?.images?.length) {
    postSections.push({
      type: 'gallery',
      headline: landingConfig.gallery.headline,
      images: landingConfig.gallery.images.map((img) => ({
        url: img.url,
        alt: img.alt || '',
      })),
      instagramHandle: landingConfig.gallery.instagramHandle,
    });
  }

  // FAQ section
  if (legacySections?.faq && landingConfig?.faq?.items?.length) {
    postSections.push({
      type: 'faq',
      headline: landingConfig.faq.headline,
      items: landingConfig.faq.items,
    });
  }

  // Final CTA
  let finalCta: CTASection | null = null;
  if ((legacySections?.finalCta && landingConfig?.finalCta) || !legacySections) {
    finalCta = {
      type: 'cta',
      headline: landingConfig?.finalCta?.headline || 'Ready to book?',
      subheadline: landingConfig?.finalCta?.subheadline,
      ctaText: landingConfig?.finalCta?.ctaText || 'Get Started Today',
    };
  }

  return { preSections, postSections, finalCta };
}

/**
 * Tenant Landing Page - Shared Component
 *
 * Used by both [slug] and _domain routes.
 * The basePath and domainParam props control link construction.
 *
 * Note: Footer is now in the shared layout (layout.tsx)
 */
export function TenantLandingPage({
  data,
  basePath = '',
  domainParam = '',
}: TenantLandingPageProps) {
  const { tenant, packages, segments } = data;
  const landingConfig = tenant.branding?.landingPage;

  // Build sections for rendering
  const { preSections, postSections, finalCta } = buildHomeSections(landingConfig, tenant.name);

  // Sort packages by tier for display
  // Check isActive (new) or active (legacy) for filtering
  const sortedPackages = [...packages]
    .filter((p) => p.isActive ?? p.active)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));

  // Get unique tiers for emphasis (middle tier is popular)
  const midIndex = Math.floor(sortedPackages.length / 2);

  // Build book link based on route type
  // For domain routes, booking still uses /t/[slug] paths
  const getBookLink = (packageSlug: string) => {
    if (domainParam) {
      // Domain routes redirect to slug-based booking for full context
      return `/t/${tenant.slug}/book/${packageSlug}`;
    }
    return `${basePath}/book/${packageSlug}`;
  };

  return (
    <div id="main-content">
      {/* ===== PRE-PACKAGES SECTIONS (Hero, etc.) ===== */}
      <SectionRenderer sections={preSections} tenant={tenant} basePath={basePath} />

      {/* ===== SOCIAL PROOF BAR ===== */}
      {landingConfig?.sections?.socialProofBar && landingConfig?.socialProofBar && (
        <section className="border-y border-neutral-100 bg-surface-alt py-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-6 md:gap-16">
            {landingConfig.socialProofBar.items.map((item, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-text-primary">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== SEGMENT PICKER ===== */}
      {segments.length > 1 && (
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-wrap justify-center gap-4">
              {segments.map((segment) => (
                <Button key={segment.id} variant="outline" size="lg">
                  {segment.name}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== TIER CARDS (PACKAGES) ===== */}
      {/* Special rendering - not a generic section due to booking links & tier logic */}
      {sortedPackages.length > 0 && (
        <section id="packages" className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                Choose your package.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-text-muted">
                Select the perfect option for your needs.
              </p>
            </div>

            <div
              className={`mt-16 grid gap-8 ${
                sortedPackages.length === 1
                  ? 'md:grid-cols-1 max-w-md mx-auto'
                  : sortedPackages.length === 2
                    ? 'md:grid-cols-2 max-w-2xl mx-auto'
                    : 'md:grid-cols-3'
              }`}
            >
              {sortedPackages.map((pkg, index) => {
                const isPopular = sortedPackages.length > 2 && index === midIndex;
                const tierLabel =
                  tenant.tierDisplayNames?.[
                    pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames
                  ] || pkg.title;

                return (
                  <div
                    key={pkg.id}
                    className={`relative rounded-3xl p-8 transition-all duration-300 ${
                      isPopular
                        ? 'border-2 border-sage bg-white shadow-xl'
                        : 'border border-neutral-100 bg-white shadow-lg hover:-translate-y-1 hover:shadow-xl'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-sage px-4 py-1 text-sm font-medium text-white">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-text-primary">{tierLabel}</h3>
                    <p className="mt-2 text-3xl font-bold text-text-primary">
                      {formatPrice(pkg.priceCents)}
                      <span className="text-base font-normal text-text-muted">/session</span>
                    </p>
                    {pkg.description && (
                      <p className="mt-4 text-sm text-text-muted">{pkg.description}</p>
                    )}
                    <Button
                      asChild
                      variant={isPopular ? 'sage' : 'outline'}
                      className="mt-8 w-full"
                    >
                      <Link href={getBookLink(pkg.slug)}>Book {tierLabel}</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== POST-PACKAGES SECTIONS (About, Testimonials, Gallery, FAQ) ===== */}
      <SectionRenderer sections={postSections} tenant={tenant} basePath={basePath} />

      {/* ===== FINAL CTA ===== */}
      {finalCta && (
        <section className="bg-sage py-32 md:py-40">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">
              {finalCta.headline}
            </h2>
            {finalCta.subheadline && (
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">{finalCta.subheadline}</p>
            )}
            <div className="mt-10">
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-white bg-white text-sage hover:bg-white/90"
              >
                <a href="#packages">{finalCta.ctaText}</a>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
