import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPageClient } from '@/components/tenant';
import {
  getTenantStorefrontData,
  getTenantStorefrontDataWithPreview,
  TenantNotFoundError,
  TenantApiError,
  normalizeToPages,
  sectionsToLandingConfig,
  type TenantStorefrontData,
} from '@/lib/tenant';
import {
  getPublishedSections,
  getPreviewSections,
  SectionsNotFoundError,
} from '@/lib/sections-api';
import type {
  TenantPublicDto,
  ContactSection,
  LandingPageConfig,
  SectionContentDto,
} from '@macon/contracts';
import { logger } from '@/lib/logger';

interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; token?: string; edit?: string }>;
}

/**
 * Tenant public landing page
 *
 * This page displays the tenant's storefront with:
 * - Hero section with transformation headline
 * - Service tier cards (packages)
 * - Testimonials
 * - FAQ section
 * - Contact/booking CTAs
 *
 * SSR with ISR (Incremental Static Regeneration):
 * - Initial request renders on server
 * - Cached for 60 seconds
 * - Revalidated on tenant config changes via webhook
 *
 * **Phase 4 Migration (2026-02-02):**
 * Section content is now stored in the `SectionContent` table.
 * This page fetches sections from the new `/sections` API alongside the
 * existing tenant data. Currently logs section count for monitoring;
 * full component migration to sections-based rendering is a follow-up.
 *
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md
 */

/**
 * Generate SEO metadata for the tenant page.
 *
 * **Phase 5.2 (2026-02-02):** Now fetches sections from new SectionContent table
 * and uses them as primary source for metadata. Falls back to legacy landingPageConfig.
 */
export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    // Fetch both storefront data and sections in parallel
    const [data, sections] = await Promise.all([
      getTenantStorefrontData(slug),
      getPublishedSections(slug).catch(() => [] as SectionContentDto[]),
    ]);
    const { tenant } = data;

    // Phase 5.2: Prefer sections data over legacy config
    const heroFromSections = sections.length > 0 ? getHeroFromSections(sections) : null;
    const heroFromConfig = getHeroContent(tenant.branding?.landingPage);

    // Use sections hero first, fall back to legacy config
    const metaDescription =
      heroFromSections?.subheadline ||
      heroFromConfig?.subheadline ||
      `Book services with ${tenant.name}`;

    return {
      title: tenant.name,
      description: metaDescription,
      openGraph: {
        title: tenant.name,
        description: metaDescription,
        // TODO: Add og:image from tenant branding when available
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    // Return minimal metadata for error cases
    // notFound() will be called in the page component
    return {
      title: 'Business Not Found',
      description: 'The requested business could not be found.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

/**
 * Extract hero section content from landing page config.
 * Handles both page-based and legacy config formats consistently.
 */
function getHeroContent(config: LandingPageConfig | undefined): {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
} | null {
  if (!config) return null;

  // Try page-based config first (preferred)
  const pages = normalizeToPages(config);
  const heroSection = pages.home.sections.find((s) => s.type === 'hero');

  // Type narrowing for hero section
  if (heroSection && heroSection.type === 'hero') {
    return {
      headline: heroSection.headline,
      subheadline: heroSection.subheadline,
      ctaText: heroSection.ctaText,
      backgroundImageUrl: heroSection.backgroundImageUrl,
    };
  }

  // Fallback to legacy hero if present
  if (config.hero) {
    return {
      headline: config.hero.headline,
      subheadline: config.hero.subheadline,
      ctaText: config.hero.ctaText,
      backgroundImageUrl: config.hero.backgroundImageUrl,
    };
  }

  return null;
}

/**
 * Inject sections from SectionContent table into TenantStorefrontData.
 *
 * Phase 5.2: This bridges the gap between the new SectionContent table
 * and the existing TenantLandingPage component which expects LandingPageConfig.
 *
 * Strategy:
 * - If sections exist (new format), convert to LandingPageConfig
 * - Otherwise, keep existing branding.landingPage (fallback for legacy tenants)
 *
 * @param data - Original storefront data from getTenantStorefrontData
 * @param sections - Sections from getPublishedSections/getPreviewSections
 * @returns Enhanced data with sections injected into branding.landingPage
 */
function injectSectionsIntoData(
  data: TenantStorefrontData,
  sections: SectionContentDto[]
): TenantStorefrontData {
  // If no sections from new API, return data as-is (uses legacy landingPageConfig)
  if (!sections || sections.length === 0) {
    return data;
  }

  // Convert sections to LandingPageConfig format
  // Cast SectionContentDto to client DTO (compatible subset)
  const landingConfig = sectionsToLandingConfig(
    sections.map((s) => ({
      id: s.id,
      blockType: s.blockType,
      pageName: s.pageName,
      content: s.content as Record<string, unknown>,
      order: s.order,
    }))
  );

  // Inject into data, replacing legacy landingPage config
  return {
    ...data,
    tenant: {
      ...data.tenant,
      branding: {
        ...data.tenant.branding,
        landingPage: landingConfig,
      },
    },
  };
}

/**
 * Extract hero content from sections array.
 * Used for SEO metadata generation with new section format.
 */
function getHeroFromSections(sections: SectionContentDto[]): {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
} | null {
  const heroSection = sections.find((s) => s.blockType === 'HERO');
  if (!heroSection) return null;

  const content = heroSection.content as Record<string, unknown>;
  return {
    headline: content.headline as string | undefined,
    subheadline: content.subheadline as string | undefined,
    ctaText: content.ctaText as string | undefined,
    backgroundImageUrl: content.backgroundImage as string | undefined,
  };
}

/**
 * Extract contact info from sections array.
 * Used for Schema.org structured data with new section format.
 */
function getContactFromSections(sections: SectionContentDto[]): ContactSection | null {
  const contactSection = sections.find((s) => s.blockType === 'CONTACT');
  if (!contactSection) return null;

  const content = contactSection.content as Record<string, unknown>;
  return {
    type: 'contact',
    headline: (content.title as string) || 'Get in Touch',
    email: content.email as string | undefined,
    phone: content.phone as string | undefined,
  };
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { preview, token } = await searchParams;

  // Determine if this is a preview request
  // Preview mode requires both preview=draft and a valid token
  const isPreviewMode = preview === 'draft' && !!token;

  try {
    // Fetch data based on mode
    // Preview mode: Use token to fetch draft content from preview endpoint
    // Normal mode: Use cached ISR-friendly endpoint
    //
    // Phase 4: Also fetch sections from the new API (parallel with legacy fetch)
    // This demonstrates the sections API works; full migration is follow-up
    const [data, sections] = await Promise.all([
      isPreviewMode
        ? getTenantStorefrontDataWithPreview(slug, token)
        : getTenantStorefrontData(slug),
      // Sections API - gracefully handle if not yet populated
      (isPreviewMode && token ? getPreviewSections(slug, token) : getPublishedSections(slug)).catch(
        (err) => {
          // Log but don't fail - sections may not exist for all tenants yet
          if (!(err instanceof SectionsNotFoundError)) {
            logger.warn('Failed to fetch sections', { slug, error: err.message });
          }
          return [];
        }
      ),
    ]);

    // Phase 5.2: Use sections as primary source for landing page content
    // Convert sections to LandingPageConfig format for backward compatibility
    // with existing TenantLandingPage component
    const enhancedData = injectSectionsIntoData(data, sections);

    if (sections.length > 0) {
      logger.info('[Phase 5.2] Rendering from SectionContent table', {
        slug,
        sectionCount: sections.length,
        isPreviewMode,
      });
    }

    const localBusinessSchema = generateLocalBusinessSchema(enhancedData.tenant, slug, sections);

    return (
      <>
        {/* Schema.org LocalBusiness structured data for SEO */}
        {/* Only include for non-preview pages to prevent SEO indexing of drafts */}
        {!isPreviewMode && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessSchema) }}
          />
        )}
        <TenantLandingPageClient data={enhancedData} basePath={`/t/${slug}`} />
      </>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }

    // Handle expired/invalid preview tokens gracefully
    // Fall back to published content instead of showing error
    if (error instanceof TenantApiError && error.statusCode === 401 && isPreviewMode) {
      // Token invalid/expired - fall back to normal published content
      // This prevents jarring error pages when token expires during preview
      const [fallbackData, fallbackSections] = await Promise.all([
        getTenantStorefrontData(slug),
        getPublishedSections(slug).catch(() => [] as SectionContentDto[]),
      ]);
      const enhancedFallbackData = injectSectionsIntoData(fallbackData, fallbackSections);
      const localBusinessSchema = generateLocalBusinessSchema(
        enhancedFallbackData.tenant,
        slug,
        fallbackSections
      );
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessSchema) }}
          />
          <TenantLandingPageClient data={enhancedFallbackData} basePath={`/t/${slug}`} />
        </>
      );
    }

    // For other errors, log and show a generic error
    // In production, you might want to show a proper error page
    throw error;
  }
}

// ISR: Revalidate every 60 seconds for non-preview requests
// Preview requests automatically become dynamic because:
// 1. They access searchParams (Next.js opts out of static generation)
// 2. The preview endpoint sets Cache-Control: no-store
// 3. Only normal requests benefit from ISR caching
export const revalidate = 60;

/**
 * Extract contact information from landing page config.
 * Handles both legacy and new page-based config formats.
 */
function getContactInfo(config: LandingPageConfig | undefined): ContactSection | null {
  if (!config) return null;

  // Try new page-based config first
  if (config.pages?.contact?.sections) {
    const contactSection = config.pages.contact.sections.find(
      (s): s is ContactSection => s.type === 'contact'
    );
    if (contactSection) return contactSection;
  }

  // Normalize legacy config and check
  const pages = normalizeToPages(config);
  const contactSections = pages.contact?.sections || [];
  const contactSection = contactSections.find((s): s is ContactSection => s.type === 'contact');

  return contactSection || null;
}

/**
 * Safely serialize data for JSON-LD script injection.
 *
 * JSON-LD content injected via dangerouslySetInnerHTML is an XSS vector
 * if tenant data contains unescaped characters like "</script>".
 * This function escapes dangerous characters using Unicode escape sequences,
 * which are valid JSON but prevent script tag injection.
 *
 * @example
 * // Input with malicious content:
 * safeJsonLd({ name: '</script><script>alert(1)</script>' })
 * // Output: '{"name":"\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"}'
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */
function safeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c') // Escape < to prevent </script>
    .replace(/>/g, '\\u003e') // Escape > for completeness
    .replace(/&/g, '\\u0026'); // Escape & for HTML entity safety
}

/**
 * Generate Schema.org LocalBusiness JSON-LD structured data.
 *
 * This markup helps search engines understand the business information
 * and can improve search result appearance with rich snippets.
 *
 * Phase 5.2: Now accepts optional sections array for primary data extraction.
 * Falls back to legacy landingConfig if sections not provided.
 *
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
function generateLocalBusinessSchema(
  tenant: TenantPublicDto,
  slug: string,
  sections: SectionContentDto[] = []
): Record<string, unknown> {
  // Phase 5.2: Prefer sections data over legacy config
  const heroFromSections = sections.length > 0 ? getHeroFromSections(sections) : null;
  const contactFromSections = sections.length > 0 ? getContactFromSections(sections) : null;

  // Fallback to legacy config if no sections
  const landingConfig = tenant.branding?.landingPage;
  const contact = contactFromSections || getContactInfo(landingConfig);
  const heroSubheadline = heroFromSections?.subheadline || landingConfig?.hero?.subheadline;

  // Build the canonical URL - prefer custom domain if available
  const url = `https://gethandled.ai/t/${slug}`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: tenant.name,
    url,
  };

  // Add description from hero subheadline
  if (heroSubheadline) {
    schema.description = heroSubheadline;
  }

  // Add contact details if available
  if (contact?.email) {
    schema.email = contact.email;
  }

  if (contact?.phone) {
    schema.telephone = contact.phone;
  }

  // Add address if available
  if (contact?.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: contact.address,
    };
  }

  // Add logo if available
  if (tenant.branding?.logoUrl) {
    schema.logo = tenant.branding.logoUrl;
  }

  // Add opening hours if available
  if (contact?.hours) {
    schema.openingHours = contact.hours;
  }

  return schema;
}
