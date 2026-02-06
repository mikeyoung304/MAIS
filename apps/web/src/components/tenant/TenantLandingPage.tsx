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
 * **Enhanced (2026-01-12):** Now uses normalizeToPages() for all configs,
 * ensuring consistent behavior between preview and live. Section order is
 * determined by config, not hard-coded ID lookups.
 *
 * Returns sections split into pre-packages and post-packages groups
 * so packages can be rendered in between with special handling.
 *
 * Layout strategy:
 * - Pre-packages: hero + about/text sections (build trust first)
 * - Packages: injected by TenantLandingPage (SegmentPackagesSection)
 * - Post-packages: testimonials, gallery, FAQ, contact (social proof after seeing offerings)
 * - Final CTA: call-to-action at the bottom
 */
function buildHomeSections(
  landingConfig: LandingPageConfig | undefined,
  tenantName: string
): { preSections: Section[]; postSections: Section[]; finalCta: CTASection | null } {
  // Default hero if nothing configured
  const defaultHero: HeroSection = {
    id: 'home-hero-main',
    type: 'hero',
    headline: `Welcome to ${tenantName}`,
    subheadline: 'Book your session today.',
    ctaText: 'View Packages',
  };

  // Always normalize through normalizeToPages() for consistent behavior
  // This handles: legacy configs, partial page-based configs, and merging with defaults
  const pages = normalizeToPages(landingConfig);
  const homeSections = pages.home.sections;

  // Find CTA section (usually rendered separately at the bottom)
  const ctaSection = homeSections.find((s): s is CTASection => s.type === 'cta');

  // Find hero - first section of type 'hero'
  const heroSection = homeSections.find((s): s is HeroSection => s.type === 'hero');

  // Section types that go after packages (social proof after seeing offerings)
  const postPackageTypes = new Set([
    'testimonials',
    'gallery',
    'faq',
    'contact',
    'features',
    'pricing',
  ]);

  // Build pre-sections: hero + text sections (respecting config order)
  const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];

  // Add text sections that appear before packages (typically About)
  const textSections = homeSections.filter((s) => s.type === 'text');
  preSections.push(...textSections);

  // Build post-sections: everything else except hero, text, and CTA
  // These render after packages in config order
  const postSections = homeSections.filter((s) => postPackageTypes.has(s.type));

  return { preSections, postSections, finalCta: ctaSection || null };
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
            {(landingConfig.socialProofBar?.items ?? []).map((item, i) => (
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
