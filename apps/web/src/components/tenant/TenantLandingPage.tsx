/**
 * TenantLandingPage - Main landing page component
 *
 * Uses SectionRenderer for flexible section display.
 * Tiers are displayed through SegmentTiersSection which provides
 * a segment-first browsing experience.
 *
 * Layout:
 * 1. Pre-tier sections (hero, about/text)
 * 2. Segment-first tiers section (shows segments, expands to reveal tiers)
 * 3. Post-tier sections (testimonials, gallery, faq, contact, cta)
 */

import type { TenantStorefrontData } from '@/lib/tenant.client';
import { SectionRenderer } from './SectionRenderer';
import { SegmentTiersSection } from './SegmentTiersSection';
import type { Section, HeroSection, PagesConfig } from '@macon/contracts';

interface TenantLandingPageProps {
  data: TenantStorefrontData;
  /** Pages configuration from SectionContent */
  pages: PagesConfig;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
  /** Whether Build Mode is active (adds data attributes for section selection) */
  isEditMode?: boolean;
}

/**
 * Build sections for the home page from PagesConfig.
 *
 * Returns sections split into pre-tier and post-tier groups
 * so tiers can be rendered in between with special handling.
 *
 * Layout strategy:
 * - Pre-tier: hero + about/text sections (build trust first)
 * - Tiers: injected by TenantLandingPage (SegmentTiersSection)
 * - Post-tier: testimonials, gallery, FAQ, contact, CTA (social proof + closing CTA)
 */
function buildHomeSections(
  pages: PagesConfig,
  tenantName: string
): {
  preSections: Section[];
  postSections: Section[];
  servicesHeading: { title?: string; subtitle?: string } | null;
} {
  // Default hero if nothing configured
  const defaultHero: HeroSection = {
    id: 'home-hero-main',
    type: 'hero',
    headline: `Welcome to ${tenantName}`,
    subheadline: 'Book your session today.',
    ctaText: 'View Services',
  };

  const homeSections = pages.home.sections;

  // Find hero - first section of type 'hero'
  const heroSection = homeSections.find((s): s is HeroSection => s.type === 'hero');

  // Section types that go after tiers (social proof after seeing offerings)
  const postTierTypes = new Set([
    'testimonials',
    'gallery',
    'faq',
    'contact',
    'features',
    'pricing',
    'cta', // CTA renders through SectionRenderer after tiers
  ]);

  // Build pre-sections: hero + text sections (respecting config order)
  const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];

  // Add text/about sections that appear before tiers (typically About)
  const textSections = homeSections.filter((s) => s.type === 'text' || s.type === 'about');
  preSections.push(...textSections);

  // Extract services section heading metadata (not rendered as FeaturesSection)
  const servicesMeta = homeSections.find((s) => s.type === 'services');
  const servicesHeading = servicesMeta
    ? {
        title: (servicesMeta as { headline?: string }).headline,
        subtitle: (servicesMeta as { subheadline?: string }).subheadline,
      }
    : null;

  // Build post-sections: everything after tiers in config order
  const postSections = homeSections.filter((s) => postTierTypes.has(s.type));

  return { preSections, postSections, servicesHeading };
}

/**
 * Tenant Landing Page - Shared Component
 *
 * Used by both [slug] and _domain routes.
 * The basePath and domainParam props control link construction.
 */
export function TenantLandingPage({
  data,
  pages,
  basePath = '',
  domainParam = '',
  isEditMode = false,
}: TenantLandingPageProps) {
  const { tenant } = data;

  // Build sections for rendering
  const { preSections, postSections, servicesHeading } = buildHomeSections(pages, tenant.name);

  return (
    <>
      {/* ===== PRE-TIER SECTIONS (Hero, About) ===== */}
      <SectionRenderer
        sections={preSections}
        tenant={tenant}
        basePath={basePath}
        isEditMode={isEditMode}
        indexOffset={0}
      />

      {/* ===== SEGMENT-FIRST TIERS SECTION ===== */}
      <SegmentTiersSection
        data={data}
        basePath={basePath}
        domainParam={domainParam}
        servicesHeading={servicesHeading}
      />

      {/* ===== POST-TIER SECTIONS (Testimonials, Gallery, FAQ, CTA) ===== */}
      <SectionRenderer
        sections={postSections}
        tenant={tenant}
        basePath={basePath}
        isEditMode={isEditMode}
        indexOffset={preSections.length}
      />
    </>
  );
}
