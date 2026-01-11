/**
 * TenantLandingPage - Main landing page component
 *
 * Uses SectionRenderer for flexible section display.
 * Packages are displayed through SegmentPackagesSection which provides
 * a segment-first browsing experience.
 *
 * Layout:
 * 1. Pre-packages sections (hero, social proof, text, etc.)
 * 2. Segment-first packages section (shows segments → tiers within)
 * 3. Post-packages sections (about, gallery, testimonials, faq)
 * 4. Final CTA
 */

import { Button } from '@/components/ui/button';
import type { TenantStorefrontData } from '@/lib/tenant.client';
import { normalizeToPages } from '@/lib/tenant.client';
import { SectionRenderer } from './SectionRenderer';
import { SegmentPackagesSection } from './SegmentPackagesSection';
import type { Section, HeroSection, CTASection, LandingPageConfig } from '@macon/contracts';

interface TenantLandingPageProps {
  data: TenantStorefrontData;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
  /** Whether Build Mode is active (adds data attributes for section selection) */
  isEditMode?: boolean;
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
    // Find "About" section by ID - more robust than finding first text section
    // Default config creates this with id 'home-text-about'
    const aboutSection = homeSections.find((s) => s.id === 'home-text-about');

    // Pre-sections = hero + about (builds trust before showing packages)
    const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];
    if (aboutSection) {
      preSections.push(aboutSection);
    }

    // Post-sections = everything except hero, the about section (by ID), and cta
    // These appear after packages: testimonials, FAQ, contact, gallery, and other text sections
    const postSections = homeSections.filter(
      (s) => s.type !== 'hero' && s.id !== 'home-text-about' && s.type !== 'cta'
    );

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
  isEditMode = false,
}: TenantLandingPageProps) {
  const { tenant } = data;
  const landingConfig = tenant.branding?.landingPage;

  // Build sections for rendering
  const { preSections, postSections, finalCta } = buildHomeSections(landingConfig, tenant.name);

  return (
    <>
      {/* ===== PRE-PACKAGES SECTIONS (Hero, etc.) ===== */}
      <SectionRenderer
        sections={preSections}
        tenant={tenant}
        basePath={basePath}
        isEditMode={isEditMode}
        indexOffset={0}
      />

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

      {/* ===== SEGMENT-FIRST PACKAGES SECTION ===== */}
      {/* Shows segments as entry points, expands to reveal tiers when clicked */}
      <SegmentPackagesSection data={data} basePath={basePath} domainParam={domainParam} />

      {/* ===== POST-PACKAGES SECTIONS (About, Testimonials, Gallery, FAQ) ===== */}
      <SectionRenderer
        sections={postSections}
        tenant={tenant}
        basePath={basePath}
        isEditMode={isEditMode}
        indexOffset={preSections.length}
      />

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
    </>
  );
}
