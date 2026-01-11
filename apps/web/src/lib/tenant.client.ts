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

// ============================================================================
// CLIENT-SAFE API FUNCTIONS
// ============================================================================
// These functions are designed for use in 'use client' components.
// They use NEXT_PUBLIC_API_URL directly instead of importing from config.ts
// to avoid pulling server-only modules into the client bundle.

/**
 * Get the API URL for client-side calls
 * Uses NEXT_PUBLIC_API_URL which is available in both server and client contexts
 */
function getClientApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/**
 * Fetch unavailable dates for booking (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of unavailable date strings
 */
export async function getUnavailableDates(
  apiKeyPublic: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const url = `${getClientApiUrl()}/v1/availability/unavailable-dates?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    // Note: No 'next' options since this is client-safe
  });

  if (!response.ok) {
    // Return empty array on error - booking flow can still continue
    // and will validate date on submit
    return [];
  }

  const data = await response.json();
  return data.dates || [];
}

/**
 * Check availability for a specific date (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param date - Date in YYYY-MM-DD format
 * @returns Whether the date is available
 */
export async function checkDateAvailability(apiKeyPublic: string, date: string): Promise<boolean> {
  const url = `${getClientApiUrl()}/v1/availability?date=${encodeURIComponent(date)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store', // Always check fresh availability
  });

  if (!response.ok) {
    // Fail closed - if we can't verify, assume unavailable
    return false;
  }

  const data = await response.json();
  return data.available === true;
}

/**
 * Create a date booking and get checkout URL (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bookingData - Booking details
 * @returns Checkout URL or error
 */
export async function createDateBooking(
  apiKeyPublic: string,
  bookingData: {
    packageId: string;
    date: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
  }
): Promise<{ checkoutUrl: string } | { error: string; status: number }> {
  const url = `${getClientApiUrl()}/v1/bookings/date`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    body: JSON.stringify(bookingData),
    cache: 'no-store',
  });

  const data = await response.json();

  if (response.status === 409) {
    return { error: 'Date is already booked', status: 409 };
  }

  if (!response.ok) {
    return { error: data.error || 'Failed to create booking', status: response.status };
  }

  return { checkoutUrl: data.checkoutUrl };
}
