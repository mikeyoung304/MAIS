import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { TenantStorefrontData } from '@/lib/tenant';
import { formatPrice } from '@/lib/format';
import { TIER_ORDER } from '@/lib/packages';

interface TenantLandingPageProps {
  data: TenantStorefrontData;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

/**
 * Render star icons based on rating
 */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1 text-macon-orange">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < rating ? 'opacity-100' : 'opacity-30'}>
          &#9733;
        </span>
      ))}
    </div>
  );
}

/**
 * Tenant Landing Page - Shared Component
 *
 * Used by both [slug] and _domain routes.
 * The basePath and domainParam props control link construction.
 *
 * Sections (shown based on landing page config):
 * 1. Hero Section
 * 2. Social Proof Bar (optional)
 * 3. Segment Picker (if multiple segments)
 * 4. Tier Cards (packages)
 * 5. About Section (optional)
 * 6. Testimonials (optional)
 * 7. Gallery (optional)
 * 8. FAQ Section (optional)
 * 9. Final CTA
 *
 * Note: Footer is now in the shared layout (layout.tsx)
 */
export function TenantLandingPage({ data, basePath = '', domainParam = '' }: TenantLandingPageProps) {
  const { tenant, packages, segments } = data;
  const landingConfig = tenant.branding?.landingPage;
  const sections = landingConfig?.sections;

  // Default hero content if not configured
  const heroConfig = landingConfig?.hero || {
    headline: `Welcome to ${tenant.name}`,
    subheadline: 'Book your session today.',
    ctaText: 'View Packages',
  };

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
      {/* ===== HERO SECTION ===== */}
      <section
        className="relative py-32 md:py-40"
        style={
          heroConfig.backgroundImageUrl
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${heroConfig.backgroundImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1
            className={`font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl ${
              heroConfig.backgroundImageUrl ? 'text-white' : 'text-text-primary'
            }`}
          >
            {heroConfig.headline}
          </h1>
          {heroConfig.subheadline && (
            <p
              className={`mx-auto mt-6 max-w-2xl text-lg md:text-xl ${
                heroConfig.backgroundImageUrl ? 'text-white/90' : 'text-text-muted'
              }`}
            >
              {heroConfig.subheadline}
            </p>
          )}
          <div className="mt-10">
            <Button asChild variant="sage" size="xl">
              <a href="#packages">
                {heroConfig.ctaText}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF BAR ===== */}
      {sections?.socialProofBar && landingConfig?.socialProofBar && (
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
                  tenant.tierDisplayNames?.[pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames] ||
                  pkg.title;

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
                      <Link href={getBookLink(pkg.slug)}>
                        Book {tierLabel}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ABOUT SECTION ===== */}
      {sections?.about && landingConfig?.about && (
        <section className="bg-surface-alt py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div
              className={`grid gap-12 md:grid-cols-2 md:items-center ${
                landingConfig.about.imagePosition === 'left' ? '' : 'md:[&>*:first-child]:order-2'
              }`}
            >
              {landingConfig.about.imageUrl && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                  <Image
                    src={landingConfig.about.imageUrl}
                    alt={`About ${tenant.name}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              )}
              <div>
                <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                  {landingConfig.about.headline}
                </h2>
                <div className="mt-6 prose prose-neutral">
                  <p className="text-text-muted">{landingConfig.about.content}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== TESTIMONIALS ===== */}
      {sections?.testimonials && landingConfig?.testimonials && (
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                {landingConfig.testimonials.headline}
              </h2>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2">
              {landingConfig.testimonials.items.map((testimonial, i) => (
                <div key={i} className="rounded-3xl bg-white p-8 shadow-lg border border-neutral-100">
                  <StarRating rating={testimonial.rating} />
                  <p className="mt-4 text-text-muted">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-3">
                    {testimonial.imageUrl && (
                      <div className="relative h-10 w-10 flex-shrink-0">
                        <Image
                          src={testimonial.imageUrl}
                          alt={`${testimonial.author} testimonial photo`}
                          fill
                          className="rounded-full object-cover"
                          sizes="40px"
                        />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-text-primary">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-text-muted">{testimonial.role}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== GALLERY ===== */}
      {sections?.gallery && landingConfig?.gallery && (
        <section className="bg-surface-alt py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                {landingConfig.gallery.headline}
              </h2>
            </div>

            <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {landingConfig.gallery.images.map((image, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-2xl group">
                  <Image
                    src={image.url}
                    alt={image.alt || `Gallery image ${i + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              ))}
            </div>

            {landingConfig.gallery.instagramHandle && (
              <div className="mt-8 text-center">
                <a
                  href={`https://instagram.com/${landingConfig.gallery.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage hover:underline"
                >
                  Follow @{landingConfig.gallery.instagramHandle} on Instagram
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== FAQ SECTION ===== */}
      {sections?.faq && landingConfig?.faq && (
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-3xl px-6">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                {landingConfig.faq.headline}
              </h2>
            </div>

            <div className="mt-16 space-y-6">
              {landingConfig.faq.items.map((faq, i) => (
                <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-6">
                  <h3 className="font-semibold text-text-primary">{faq.question}</h3>
                  <p className="mt-2 text-text-muted">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== FINAL CTA ===== */}
      {(sections?.finalCta && landingConfig?.finalCta) || !sections ? (
        <section className="bg-sage py-32 md:py-40">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">
              {landingConfig?.finalCta?.headline || 'Ready to book?'}
            </h2>
            {landingConfig?.finalCta?.subheadline && (
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
                {landingConfig.finalCta.subheadline}
              </p>
            )}
            <div className="mt-10">
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-white bg-white text-sage hover:bg-white/90"
              >
                <a href="#packages">
                  {landingConfig?.finalCta?.ctaText || 'Get Started Today'}
                </a>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
