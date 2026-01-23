import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPageClient } from '@/components/tenant';
import {
  getTenantStorefrontData,
  getTenantStorefrontDataWithPreview,
  TenantNotFoundError,
  TenantApiError,
  normalizeToPages,
} from '@/lib/tenant';
import type { TenantPublicDto, ContactSection, LandingPageConfig } from '@macon/contracts';

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
 */

/**
 * Generate SEO metadata for the tenant page.
 *
 * **Enhanced (2026-01-12):** Now correctly extracts hero content from both
 * page-based configs (pages.home.sections[type=hero]) and legacy configs
 * (hero.subheadline). Uses normalizeToPages() for consistent extraction.
 */
export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getTenantStorefrontData(slug);
    const { tenant } = data;

    // Extract hero content using consistent normalization
    const heroContent = getHeroContent(tenant.branding?.landingPage);
    const metaDescription = heroContent?.subheadline || `Book services with ${tenant.name}`;

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
    const data = isPreviewMode
      ? await getTenantStorefrontDataWithPreview(slug, token)
      : await getTenantStorefrontData(slug);

    const localBusinessSchema = generateLocalBusinessSchema(data.tenant, slug);

    return (
      <>
        {/* Schema.org LocalBusiness structured data for SEO */}
        {/* Only include for non-preview pages to prevent SEO indexing of drafts */}
        {!isPreviewMode && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
          />
        )}
        <TenantLandingPageClient data={data} basePath={`/t/${slug}`} />
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
      const fallbackData = await getTenantStorefrontData(slug);
      const localBusinessSchema = generateLocalBusinessSchema(fallbackData.tenant, slug);
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
          />
          <TenantLandingPageClient data={fallbackData} basePath={`/t/${slug}`} />
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
 * Generate Schema.org LocalBusiness JSON-LD structured data.
 *
 * This markup helps search engines understand the business information
 * and can improve search result appearance with rich snippets.
 *
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
function generateLocalBusinessSchema(
  tenant: TenantPublicDto,
  slug: string
): Record<string, unknown> {
  const landingConfig = tenant.branding?.landingPage;
  const contact = getContactInfo(landingConfig);
  const heroSubheadline = landingConfig?.hero?.subheadline;

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
