/**
 * Tenant Client-Safe Utilities
 *
 * This file contains only client-safe exports from the tenant module.
 * Use this in client components ('use client') to avoid importing
 * server-only code that uses API_URL or React's cache().
 *
 * For server components and API routes, import from '@/lib/tenant' instead.
 */

import type {
  LandingPageConfig,
  PageName,
  PagesConfig,
  Section,
  SegmentDto,
  TenantPublicDto,
} from '@macon/contracts';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

// Re-export types that are safe for client use
export type { TenantPublicDto, LandingPageConfig, PageName, PagesConfig, Section };

/**
 * Check if a page is enabled in the tenant's landing page configuration
 *
 * Returns true if:
 * - No pages config exists (legacy mode - all pages available)
 * - Page is explicitly enabled (or enabled is not set, defaults to true)
 *
 * Returns false only if pages config exists AND page.enabled === false
 *
 * @param config - Landing page configuration (may be undefined)
 * @param pageName - Name of the page to check
 * @returns Whether the page should be accessible
 *
 * @example
 * const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
 * if (!isPageEnabled(config, 'about')) {
 *   notFound();
 * }
 */
export function isPageEnabled(
  config: LandingPageConfig | undefined | null,
  pageName: Exclude<PageName, 'home'>
): boolean {
  // Legacy mode: no pages config means all pages are available
  if (!config?.pages) {
    return true;
  }
  // Check if page is explicitly enabled (defaults to true if not set)
  return config.pages[pageName]?.enabled !== false;
}

/**
 * Normalize legacy landing page config to the new pages format.
 * Handles both legacy section-based and new page-based configs.
 *
 * This function provides a centralized conversion from legacy LandingPageConfig
 * (with separate hero, about, gallery, testimonials, faq properties) to the
 * new PagesConfig format (with pages containing sections).
 *
 * @param config - Landing page configuration (may be undefined/null)
 * @returns Normalized PagesConfig with all pages populated
 *
 * @example
 * const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
 * const pages = normalizeToPages(config);
 * const galleryData = pages.gallery.sections[0] as GallerySection | undefined;
 */
export function normalizeToPages(config: LandingPageConfig | null | undefined): PagesConfig {
  // If already has pages config, return it
  if (config?.pages) {
    return config.pages;
  }

  // Start with defaults (deep clone to avoid mutation)
  // Using structuredClone for better performance than JSON.parse/stringify
  const pages = structuredClone(DEFAULT_PAGES_CONFIG);

  if (!config) return pages;

  // Convert legacy hero to home page hero section
  if (config.hero) {
    const heroSection: Section = {
      type: 'hero',
      headline: config.hero.headline || 'Welcome',
      subheadline: config.hero.subheadline,
      ctaText: config.hero.ctaText || 'View Packages',
      backgroundImageUrl: config.hero.backgroundImageUrl,
    };
    pages.home.sections = [heroSection];
  }

  // Convert legacy about
  if (config.about?.content) {
    pages.about.sections = [
      {
        type: 'text',
        headline: config.about.headline || 'About Us',
        content: config.about.content,
        imageUrl: config.about.imageUrl,
        imagePosition: 'left',
      },
    ];
    pages.about.enabled = config.sections?.about !== false;
  }

  // Convert legacy gallery
  if (config.gallery?.images?.length) {
    pages.gallery.sections = [
      {
        type: 'gallery',
        headline: config.gallery.headline || 'Our Work',
        images: config.gallery.images.map((img) => ({
          url: img.url,
          alt: img.alt || '',
        })),
        instagramHandle: config.gallery.instagramHandle,
      },
    ];
    pages.gallery.enabled = config.sections?.gallery !== false;
  }

  // Convert legacy testimonials
  if (config.testimonials?.items?.length) {
    pages.testimonials.sections = [
      {
        type: 'testimonials',
        headline: config.testimonials.headline || 'What Clients Say',
        items: config.testimonials.items.map((item) => ({
          quote: item.quote,
          authorName: item.author,
          authorRole: item.role,
          authorPhotoUrl: item.imageUrl,
          rating: item.rating || 5,
        })),
      },
    ];
    pages.testimonials.enabled = config.sections?.testimonials !== false;
  }

  // Convert legacy FAQ
  if (config.faq?.items?.length) {
    pages.faq.sections = [
      {
        type: 'faq',
        headline: config.faq.headline || 'FAQ',
        items: config.faq.items,
      },
    ];
    pages.faq.enabled = config.sections?.faq !== false;
  }

  return pages;
}

/**
 * Custom error for tenant not found
 */
export class TenantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Tenant not found: ${identifier}`);
    this.name = 'TenantNotFoundError';
  }
}

/**
 * Custom error for API failures
 */
export class TenantApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'TenantApiError';
  }
}

/**
 * Custom error for invalid domain format
 */
export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

/**
 * Domain validation pattern
 *
 * Matches valid domain names with:
 * - Alphanumeric first character
 * - Alphanumeric characters and hyphens in labels
 * - TLD of 2+ characters
 * - Supports subdomains
 */
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

/**
 * Validate and sanitize domain parameter
 *
 * Validates domain format for security and returns sanitized value.
 * Use this before calling getTenantByDomain to provide clear error messages.
 *
 * @param domain - Domain string to validate
 * @returns Sanitized domain string (lowercase, trimmed)
 * @throws InvalidDomainError if domain is invalid
 *
 * @example
 * const domain = validateDomain(searchParams.domain);
 * const tenant = await getTenantByDomain(domain);
 */
export function validateDomain(domain: string | undefined): string {
  if (!domain || typeof domain !== 'string') {
    throw new InvalidDomainError('Domain parameter is required');
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length === 0) {
    throw new InvalidDomainError('Domain cannot be empty');
  }

  if (sanitized.length > 253) {
    throw new InvalidDomainError('Domain too long (max 253 characters)');
  }

  if (!DOMAIN_PATTERN.test(sanitized)) {
    throw new InvalidDomainError('Invalid domain format');
  }

  return sanitized;
}

/**
 * Type for package data
 * Note: Backend returns `isActive`, frontend uses `active` as alias
 */
export interface PackageData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
  active?: boolean; // Legacy field
  isActive?: boolean; // New field from backend
  segmentId: string | null;
  bookingType?: 'DATE' | 'APPOINTMENT';
  photoUrl?: string | null;
  addOns?: Array<{
    id: string;
    title: string;
    description: string | null;
    priceCents: number;
  }>;
}

/**
 * Segment data as returned by the API
 * Includes hero information for storefront display
 *
 * Aliased from @macon/contracts SegmentDto for backward compatibility
 */
export type SegmentData = SegmentDto;

/**
 * Type for the complete tenant storefront data
 * Combines tenant info, packages, and segments
 */
export interface TenantStorefrontData {
  tenant: TenantPublicDto;
  packages: PackageData[];
  segments: SegmentData[];
}
