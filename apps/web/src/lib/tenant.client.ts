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
 * **Enhancement (2026-01-12):** Now merges existing page-based configs with
 * defaults to fill gaps. Legacy tenants with partial `pages` configs get
 * missing sections (About, Contact, etc.) from DEFAULT_PAGES_CONFIG.
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
  // Start with defaults (deep clone to avoid mutation)
  // Using structuredClone for better performance than JSON.parse/stringify
  const pages = structuredClone(DEFAULT_PAGES_CONFIG);

  if (!config) return pages;

  // If already has pages config, merge with defaults to fill gaps
  if (config.pages) {
    return mergeWithDefaults(config.pages, pages);
  }

  // Convert legacy hero to home page hero section
  if (config.hero) {
    const heroSection: Section = {
      id: 'home-hero-main',
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
        id: 'about-text-main',
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
        id: 'gallery-gallery-main',
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
        id: 'testimonials-testimonials-main',
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
        id: 'faq-faq-main',
        type: 'faq',
        headline: config.faq.headline || 'FAQ',
        items: config.faq.items,
      },
    ];
    pages.faq.enabled = config.sections?.faq !== false;
  }

  // Ensure section IDs are present for all home sections after legacy conversion
  pages.home.sections = ensureSectionIds('home', pages.home.sections);

  return pages;
}

/**
 * Merge existing page config with defaults to fill gaps.
 * Preserves existing customizations while adding missing default sections.
 *
 * Strategy:
 * - Existing pages override defaults entirely (page-level)
 * - For home page, merge sections by ID to add missing ones
 * - Ensure all sections have proper IDs
 */
function mergeWithDefaults(existing: PagesConfig, defaults: PagesConfig): PagesConfig {
  const merged = { ...defaults };

  // Copy over existing pages, but merge home specially
  for (const [pageName, existingPage] of Object.entries(existing) as [
    PageName,
    typeof existing.home,
  ][]) {
    if (pageName === 'home') {
      // Merge home sections: keep existing, add missing defaults by type/ID
      merged.home = {
        ...existingPage,
        sections: mergeSections('home', existingPage.sections, defaults.home.sections),
      };
    } else {
      // For other pages, just use existing if it exists
      merged[pageName] = existingPage || defaults[pageName];
    }
  }

  return merged;
}

/**
 * Merge sections: keep existing, add missing defaults.
 * Uses section ID and type to identify matches.
 */
function mergeSections(pageName: PageName, existing: Section[], defaults: Section[]): Section[] {
  // Ensure all existing sections have IDs
  const existingWithIds = ensureSectionIds(pageName, existing);

  // Build lookup of existing section IDs and types
  const existingIds = new Set(existingWithIds.map((s) => s.id).filter((id): id is string => !!id));
  const existingTypes = new Set(existingWithIds.map((s) => s.type));

  // Add missing default sections (by type, to avoid adding duplicate types)
  const missingDefaults = defaults.filter((d) => {
    // Don't add if we already have this exact ID
    if (d.id && existingIds.has(d.id)) return false;
    // Don't add if we already have a section of this type (e.g., don't add default hero if custom hero exists)
    if (existingTypes.has(d.type)) return false;
    return true;
  });

  // Ensure missing defaults also have proper IDs
  const missingWithIds = ensureSectionIds(pageName, missingDefaults, existingIds);

  return [...existingWithIds, ...missingWithIds];
}

/**
 * Ensure all sections have proper IDs.
 * Generates IDs in format: {page}-{type}-{qualifier}
 *
 * @param pageName - The page these sections belong to
 * @param sections - Sections to process
 * @param existingIds - Optional set of IDs already in use (for uniqueness)
 */
function ensureSectionIds(
  pageName: PageName,
  sections: Section[],
  existingIds: Set<string> = new Set()
): Section[] {
  const usedIds = new Set(existingIds);

  return sections.map((section) => {
    // If section has a valid ID, keep it
    if (section.id && !usedIds.has(section.id)) {
      usedIds.add(section.id);
      return section;
    }

    // Generate a new ID
    const newId = generateSectionIdLocal(pageName, section.type, usedIds);
    usedIds.add(newId);

    return { ...section, id: newId };
  });
}

/**
 * Generate a unique section ID.
 * Format: {page}-{type}-{qualifier}
 * Qualifier is 'main' for first of type, then '2', '3', etc.
 */
function generateSectionIdLocal(
  pageName: PageName,
  sectionType: string,
  existingIds: Set<string>
): string {
  const baseId = `${pageName}-${sectionType}-main`;

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // Find next available number
  let counter = 2;
  while (existingIds.has(`${pageName}-${sectionType}-${counter}`)) {
    counter++;
  }

  return `${pageName}-${sectionType}-${counter}`;
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
// Section Content Conversion (Phase 5.2)
// ============================================================================
// These functions convert between the new SectionContent table format
// and the legacy LandingPageConfig format for backward compatibility.
// See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md

/**
 * Block type to section type mapping (client-side version)
 * Matches server/src/lib/block-type-mapper.ts
 */
const BLOCK_TO_SECTION_MAP: Record<string, string> = {
  HERO: 'hero',
  ABOUT: 'text', // Use 'text' for backward compat with existing components
  GALLERY: 'gallery',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  CONTACT: 'contact',
  CTA: 'cta',
  PRICING: 'pricing',
  SERVICES: 'services',
  FEATURES: 'features',
  CUSTOM: 'custom',
};

/**
 * Section content DTO from the new /sections API
 * Simplified type for client-side use (full type in @macon/contracts)
 */
export interface SectionContentDtoClient {
  id: string;
  blockType: string;
  pageName: string;
  content: Record<string, unknown>;
  order: number;
}

/**
 * Known section types that have corresponding React components.
 * Unknown types (SERVICES, CUSTOM) are filtered out to prevent SectionRenderer crashes.
 */
const KNOWN_SECTION_TYPES = new Set([
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
]);

/**
 * Transform SectionContent field names to Landing Page Section field names.
 *
 * The SectionContent schema (database) uses different field names than the
 * Section type system (contracts/components). This function bridges the gap.
 *
 * Idempotent: if content already uses Landing Page field names, the guards
 * (`!('headline' in transformed)`) prevent double-mapping.
 *
 * @see docs/plans/2026-02-05-feat-onboarding-ecosystem-rebuild-plan.md (Schema Field Name Cross-Reference)
 */
export function transformContentForSection(
  sectionType: string,
  content: Record<string, unknown>
): Record<string, unknown> {
  const transformed = { ...content };

  // --- Universal field renames (7 of 11 block types need title → headline) ---
  // HERO and CTA already use 'headline' in SectionContent schema, so this is safe
  if ('title' in transformed && !('headline' in transformed)) {
    transformed.headline = transformed.title;
    delete transformed.title;
  }
  if ('subtitle' in transformed && !('subheadline' in transformed)) {
    transformed.subheadline = transformed.subtitle;
    delete transformed.subtitle;
  }

  // --- ABOUT-specific: body → content (TextSection uses 'content' not 'body') ---
  if (sectionType === 'text' && 'body' in transformed && !('content' in transformed)) {
    transformed.content = transformed.body;
    delete transformed.body;
  }

  // --- FEATURES-specific: items → features ---
  if (sectionType === 'features' && 'items' in transformed && !('features' in transformed)) {
    transformed.features = transformed.items;
    delete transformed.items;
  }
  // Ensure features array is never null/undefined (prevents .map() crash)
  if (sectionType === 'features') {
    transformed.features = transformed.features ?? [];
  }

  // --- GALLERY-specific: items → images ---
  if (sectionType === 'gallery' && 'items' in transformed && !('images' in transformed)) {
    transformed.images = transformed.items;
    delete transformed.items;
  }
  // Ensure images array is never null/undefined (prevents .map() crash)
  if (sectionType === 'gallery') {
    transformed.images = transformed.images ?? [];
  }

  // --- CTA-specific: buttonText → ctaText, buttonLink → ctaLink ---
  if (sectionType === 'cta') {
    if ('buttonText' in transformed && !('ctaText' in transformed)) {
      transformed.ctaText = transformed.buttonText;
      delete transformed.buttonText;
    }
    if ('buttonLink' in transformed && !('ctaLink' in transformed)) {
      transformed.ctaLink = transformed.buttonLink;
      delete transformed.buttonLink;
    }
  }

  // --- TESTIMONIALS-specific: item-level field renames ---
  if (sectionType === 'testimonials' && Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
      const mapped = { ...item };
      if (mapped.name && !mapped.authorName) {
        mapped.authorName = mapped.name;
        delete mapped.name;
      }
      if (mapped.role && !mapped.authorRole) {
        mapped.authorRole = mapped.role;
        delete mapped.role;
      }
      if (mapped.image && !mapped.authorPhotoUrl) {
        mapped.authorPhotoUrl = mapped.image;
        delete mapped.image;
      }
      return mapped;
    });
  }

  // NOTE: FAQ uses 'items' in BOTH schemas — no transform needed

  // Ensure items array is never null/undefined for FAQ and testimonials (prevents .map() crash)
  if (
    (sectionType === 'faq' || sectionType === 'testimonials') &&
    !Array.isArray(transformed.items)
  ) {
    transformed.items = transformed.items ?? [];
  }

  // Ensure tiers array is never null/undefined for pricing (prevents .map() crash)
  if (sectionType === 'pricing') {
    transformed.tiers = transformed.tiers ?? [];
  }

  return transformed;
}

/**
 * Convert SectionContentDto array to LandingPageConfig format.
 *
 * This enables backward compatibility with existing components
 * (TenantLandingPage, SectionRenderer) that expect LandingPageConfig.
 *
 * Phase 5.2: Used by page.tsx to convert sections fetched from the new
 * /sections API into the format expected by TenantLandingPageClient.
 *
 * @param sections - Array of SectionContentDto from the sections API
 * @returns LandingPageConfig object compatible with existing components
 *
 * @example
 * const sections = await getPublishedSections(slug);
 * const landingConfig = sectionsToLandingConfig(sections);
 * // landingConfig.pages.home.sections contains the converted sections
 */
export function sectionsToLandingConfig(sections: SectionContentDtoClient[]): LandingPageConfig {
  // Start with a deep clone of DEFAULT_PAGES_CONFIG to ensure all pages exist
  const pages: PagesConfig = JSON.parse(JSON.stringify(DEFAULT_PAGES_CONFIG));

  // Group sections by page
  const pageMap = new Map<string, Section[]>();

  for (const section of sections) {
    const sectionType = BLOCK_TO_SECTION_MAP[section.blockType] || section.blockType.toLowerCase();

    // Skip unknown section types that have no React component (SERVICES, CUSTOM)
    if (!KNOWN_SECTION_TYPES.has(sectionType)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[sectionsToLandingConfig] Skipping unknown section type: ${sectionType} (blockType: ${section.blockType})`
        );
      }
      continue;
    }

    const content = section.content || {};

    // Transform SectionContent field names to Landing Page Section field names
    const transformedContent = transformContentForSection(sectionType, content);

    // Build section object matching Section type from contracts
    // Note: 'visible' is not part of Section type, it's used in SectionContent.content
    const legacySection = {
      id: section.id,
      type: sectionType as Section['type'],
      ...transformedContent,
    } as Section;

    const existing = pageMap.get(section.pageName) || [];
    existing.push(legacySection);
    pageMap.set(section.pageName, existing);
  }

  // Update pages with actual sections from database
  for (const [pageName, pageSections] of pageMap) {
    // Sort by order (preserve database ordering)
    const sortedSections = [...pageSections].sort((a, b) => {
      // Find original section to get order
      const aSection = sections.find((s) => s.id === a.id);
      const bSection = sections.find((s) => s.id === b.id);
      return (aSection?.order ?? 0) - (bSection?.order ?? 0);
    });

    // Update existing page with sections (home must stay enabled: true)
    if (pageName === 'home') {
      pages.home = { enabled: true as const, sections: sortedSections };
    } else if (pageName in pages) {
      pages[pageName as Exclude<PageName, 'home'>] = {
        enabled: true,
        sections: sortedSections,
      };
    }
  }

  // Return LandingPageConfig with pages structure
  // Components use normalizeToPages() which handles this format
  return { pages };
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
  const url = `${getClientApiUrl()}/v1/availability/unavailable?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

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
  const url = `${getClientApiUrl()}/v1/public/bookings/date`;

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
