/**
 * Landing Page Configuration Types and Schemas
 *
 * Defines the structure for tenant landing page configuration.
 * Uses a page-level toggle system where tenants can enable/disable entire pages.
 * Each page contains flexible sections that can be customized with content.
 *
 * Architecture:
 * - 7 page types: home, about, services, faq, contact, gallery, testimonials
 * - 7 section types: hero, text, gallery, testimonials, faq, contact, cta
 * - Home page is always enabled
 * - Dynamic navigation updates based on enabled pages
 */

import { z } from 'zod';

// ============================================================================
// Section ID Schema (Stable Section Identifiers)
// ============================================================================

/**
 * Reserved JavaScript patterns that could cause prototype pollution.
 * Section IDs containing these patterns are rejected.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html
 */
const RESERVED_PATTERNS = ['__proto__', 'constructor', 'prototype'] as const;

/**
 * Page names for iteration and type safety.
 * Used in section ID validation regex.
 */
export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;
export type PageName = (typeof PAGE_NAMES)[number];

/**
 * Section type names for iteration and type safety.
 * Used in section ID validation regex.
 */
export const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;
export type SectionTypeName = (typeof SECTION_TYPES)[number];

/**
 * Section ID Schema - Strict validation for human-readable IDs
 *
 * Format: {page}-{type}-{qualifier}
 * - page: One of PAGE_NAMES (home, about, services, etc.)
 * - type: One of SECTION_TYPES (hero, text, gallery, etc.)
 * - qualifier: 'main' for primary section, or a number (2, 3, etc.) for additional sections
 *
 * Examples:
 * - home-hero-main (primary hero on home page)
 * - about-text-2 (second text section on about page)
 * - faq-faq-main (FAQ section on FAQ page)
 *
 * Security:
 * - Max 50 characters to prevent DoS
 * - Strict regex prevents injection
 * - Reserved pattern validation blocks prototype pollution
 */
export const SectionIdSchema = z
  .string()
  .max(50, 'Section ID must not exceed 50 characters')
  .regex(
    /^(home|about|services|faq|contact|gallery|testimonials)-(hero|text|gallery|testimonials|faq|contact|cta|pricing|features)-(main|[a-z]+|[0-9]+)$/,
    'Section ID must be {page}-{type}-{qualifier} format (e.g., home-hero-main, about-text-2)'
  )
  .refine((id) => !RESERVED_PATTERNS.some((pattern) => id.includes(pattern)), {
    message: 'Section ID contains reserved JavaScript pattern',
  });

export type SectionId = z.infer<typeof SectionIdSchema>;

/**
 * Type guard to check if a section has a valid stable ID.
 * Use during migration period when IDs are optional.
 *
 * @param section - Any section object
 * @returns true if section has a valid id field that passes SectionIdSchema
 */
export function isSectionWithId<T extends { id?: string }>(
  section: T
): section is T & { id: SectionId } {
  return (
    'id' in section &&
    typeof section.id === 'string' &&
    SectionIdSchema.safeParse(section.id).success
  );
}

/**
 * Generate a unique section ID for a new section.
 *
 * Uses monotonic counter strategy - never reuses IDs even after deletion.
 * This prevents confusion when referencing sections by ID.
 *
 * Algorithm:
 * 1. Try {page}-{type}-main if not taken
 * 2. Otherwise, find highest existing number suffix
 * 3. Return {page}-{type}-{max+1}
 *
 * @param pageName - Target page (must be valid PageName)
 * @param sectionType - Section type (must be valid SectionTypeName)
 * @param existingIds - Set of all existing section IDs for uniqueness check
 * @returns New unique section ID
 */
export function generateSectionId(
  pageName: PageName,
  sectionType: SectionTypeName,
  existingIds: Set<string>
): SectionId {
  const baseId = `${pageName}-${sectionType}-main`;

  // Try main variant first
  if (!existingIds.has(baseId)) {
    return baseId as SectionId;
  }

  // Find highest existing number suffix (monotonic - never reuse)
  let maxCounter = 1;
  const counterPattern = new RegExp(`^${pageName}-${sectionType}-(\\d+)$`);

  for (const id of existingIds) {
    const match = id.match(counterPattern);
    if (match && match[1]) {
      maxCounter = Math.max(maxCounter, parseInt(match[1], 10));
    }
  }

  return `${pageName}-${sectionType}-${maxCounter + 1}` as SectionId;
}

// ============================================================================
// Safe URL Schemas (XSS Prevention)
// ============================================================================

/**
 * Allowed protocols for URLs - blocks javascript:, data:, vbscript:, etc.
 * SECURITY: Prevents XSS via malicious URI schemes
 */
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

/**
 * Safe URL schema that rejects dangerous protocols and limits length.
 *
 * SECURITY NOTES:
 * - URL() constructor normalizes protocol to lowercase automatically
 * - Mixed-case attacks (JaVaScRiPt:) are handled correctly
 * - Max length prevents DoS via extremely long URLs
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */
export const SafeUrlSchema = z
  .string()
  .max(2048, 'URL must not exceed 2048 characters') // RFC 7230 recommended limit
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ALLOWED_PROTOCOLS.includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must use https or http protocol' }
  );

/**
 * Safe image URL schema - validates protocol and optionally image extension
 * Used for all image URLs in landing page configuration
 */
export const SafeImageUrlSchema = SafeUrlSchema;

/**
 * Optional safe URL - for optional URL fields
 */
export const SafeUrlOptionalSchema = SafeUrlSchema.optional();

/**
 * Optional safe image URL - for optional image fields
 */
export const SafeImageUrlOptionalSchema = SafeImageUrlSchema.optional();

/**
 * Instagram handle schema - validates format to prevent URL injection.
 * @see https://help.instagram.com/370452623149242 (Instagram username rules)
 */
export const InstagramHandleSchema = z
  .string()
  .max(31) // 30 chars + optional @ prefix
  .regex(
    /^@?[a-zA-Z0-9._]{1,30}$/,
    'Instagram handle must contain only letters, numbers, periods, and underscores'
  )
  .transform((val) => val.replace('@', '')); // Normalize by removing @ prefix

// ============================================================================
// Social Proof Icon Types
// ============================================================================

export const SocialProofIconSchema = z.enum([
  'star',
  'calendar',
  'users',
  'award',
  'heart',
  'check',
]);
export type SocialProofIcon = z.infer<typeof SocialProofIconSchema>;

// ============================================================================
// Hero Section Schema
// ============================================================================

export const HeroSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(500).optional(),
  ctaText: z.string().min(1).max(50),
  backgroundImageUrl: SafeImageUrlOptionalSchema,
});

export type HeroSectionConfig = z.infer<typeof HeroSectionConfigSchema>;

// ============================================================================
// Social Proof Bar Schema
// ============================================================================

export const SocialProofItemSchema = z.object({
  icon: SocialProofIconSchema,
  text: z.string().min(1).max(100),
});

export type SocialProofItem = z.infer<typeof SocialProofItemSchema>;

export const SocialProofBarConfigSchema = z.object({
  items: z.array(SocialProofItemSchema).min(1).max(6),
});

export type SocialProofBarConfig = z.infer<typeof SocialProofBarConfigSchema>;

// ============================================================================
// About Section Schema
// ============================================================================

export const AboutSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  content: z.string().min(1).max(5000), // Markdown supported
  imageUrl: SafeImageUrlOptionalSchema,
  imagePosition: z.enum(['left', 'right']).default('right'),
});

export type AboutSectionConfig = z.infer<typeof AboutSectionConfigSchema>;

// ============================================================================
// Testimonials Section Schema
// ============================================================================

export const TestimonialItemSchema = z.object({
  quote: z.string().min(1).max(1000),
  author: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  imageUrl: SafeImageUrlOptionalSchema,
  rating: z.number().int().min(1).max(5),
});

export type TestimonialItem = z.infer<typeof TestimonialItemSchema>;

export const TestimonialsSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  items: z.array(TestimonialItemSchema).min(1).max(10),
});

export type TestimonialsSectionConfig = z.infer<typeof TestimonialsSectionConfigSchema>;

// ============================================================================
// Accommodation Section Schema
// ============================================================================

export const AccommodationSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  imageUrl: SafeImageUrlOptionalSchema,
  ctaText: z.string().min(1).max(50),
  ctaUrl: SafeUrlSchema, // Airbnb or other booking link - must be safe URL
  highlights: z.array(z.string().max(100)).max(8),
});

export type AccommodationSectionConfig = z.infer<typeof AccommodationSectionConfigSchema>;

// ============================================================================
// Gallery Section Schema
// ============================================================================

export const GalleryImageSchema = z.object({
  url: SafeImageUrlSchema,
  alt: z.string().max(200).optional(),
});

export type GalleryImage = z.infer<typeof GalleryImageSchema>;

export const GallerySectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  images: z.array(GalleryImageSchema).min(1).max(20),
  instagramHandle: InstagramHandleSchema.optional(),
});

export type GallerySectionConfig = z.infer<typeof GallerySectionConfigSchema>;

// ============================================================================
// FAQ Section Schema
// ============================================================================

export const FaqItemSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000), // Markdown supported
});

export type FaqItem = z.infer<typeof FaqItemSchema>;

export const FaqSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  items: z.array(FaqItemSchema).min(1).max(20),
});

export type FaqSectionConfig = z.infer<typeof FaqSectionConfigSchema>;

// ============================================================================
// Final CTA Section Schema
// ============================================================================

export const FinalCtaSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(500).optional(),
  ctaText: z.string().min(1).max(50),
});

export type FinalCtaSectionConfig = z.infer<typeof FinalCtaSectionConfigSchema>;

// ============================================================================
// Flexible Section Schema (New Page-Based System)
// ============================================================================

/**
 * Hero section - main banner with headline, subheadline, and CTA
 */
export const HeroSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('hero'),
  headline: z.string().min(1).max(60),
  subheadline: z.string().max(150).optional(),
  ctaText: z.string().max(30).default('View Packages'),
  backgroundImageUrl: SafeImageUrlOptionalSchema,
});

export type HeroSection = z.infer<typeof HeroSectionSchema>;

/**
 * Text section - content block with optional image
 */
export const TextSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('text'),
  headline: z.string().max(60).optional(),
  content: z.string().min(1).max(2000),
  imageUrl: SafeImageUrlOptionalSchema,
  imagePosition: z.enum(['left', 'right']).default('left'),
});

export type TextSection = z.infer<typeof TextSectionSchema>;

/**
 * Gallery section - image showcase with optional Instagram link
 */
export const GallerySectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('gallery'),
  headline: z.string().max(60).default('Our Work'),
  images: z
    .array(
      z.object({
        url: SafeImageUrlSchema,
        alt: z.string().max(200),
      })
    )
    .max(50)
    .default([]),
  instagramHandle: z.string().max(30).optional(),
});

export type GallerySection = z.infer<typeof GallerySectionSchema>;

/**
 * Testimonials section - customer reviews with ratings
 */
export const TestimonialsSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('testimonials'),
  headline: z.string().max(60).default('What Clients Say'),
  items: z
    .array(
      z.object({
        quote: z.string().min(10).max(300),
        authorName: z.string().min(1).max(100),
        authorRole: z.string().max(50).optional(),
        authorPhotoUrl: SafeImageUrlOptionalSchema,
        rating: z.number().int().min(1).max(5).default(5),
      })
    )
    .max(12)
    .default([]),
});

export type TestimonialsSection = z.infer<typeof TestimonialsSectionSchema>;

/**
 * FAQ section - questions and answers
 */
export const FAQSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('faq'),
  headline: z.string().max(60).default('FAQ'),
  items: z
    .array(
      z.object({
        question: z.string().min(1).max(200),
        answer: z.string().min(1).max(1000),
      })
    )
    .max(20)
    .default([]),
});

export type FAQSection = z.infer<typeof FAQSectionSchema>;

/**
 * Contact section - contact information display
 */
export const ContactSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('contact'),
  headline: z.string().max(60).default('Get in Touch'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  hours: z.string().max(500).optional(),
});

export type ContactSection = z.infer<typeof ContactSectionSchema>;

/**
 * CTA section - call-to-action block
 */
export const CTASectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('cta'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  ctaText: z.string().max(30).default('Get Started'),
});

export type CTASection = z.infer<typeof CTASectionSchema>;

/**
 * Pricing tier - individual pricing card
 */
export const PricingTierSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.union([z.string(), z.number()]),
  priceSubtext: z.string().max(30).optional(),
  description: z.string().max(200).optional(),
  features: z.array(z.string().max(100)).max(10),
  ctaText: z.string().max(30).optional(),
  ctaHref: z
    .union([
      SafeUrlSchema, // Absolute URLs must be http/https
      z
        .string()
        .regex(
          /^\/[a-zA-Z0-9\-_.~/?#[\]@!$&'()*+,;=%]*$/,
          'Relative URLs must start with / and contain valid path characters'
        ),
    ])
    .optional(),
  isPopular: z.boolean().optional(),
  variant: z.enum(['standard', 'enterprise']).optional(),
});

export type PricingTier = z.infer<typeof PricingTierSchema>;

/**
 * Pricing section - tier-based pricing cards
 */
export const PricingSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('pricing'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  tiers: z.array(PricingTierSchema).min(1).max(5),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type PricingSection = z.infer<typeof PricingSectionSchema>;

/**
 * Feature item - icon + title + description
 */
export const FeatureItemSchema = z.object({
  icon: z.string().min(1).max(30),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
});

export type FeatureItem = z.infer<typeof FeatureItemSchema>;

/**
 * Features section - icon + text feature grid
 */
export const FeaturesSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('features'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  features: z.array(FeatureItemSchema).min(1).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type FeaturesSection = z.infer<typeof FeaturesSectionSchema>;

/**
 * Discriminated union of all section types
 * Used for flexible page composition
 */
export const SectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  TextSectionSchema,
  GallerySectionSchema,
  TestimonialsSectionSchema,
  FAQSectionSchema,
  ContactSectionSchema,
  CTASectionSchema,
  PricingSectionSchema,
  FeaturesSectionSchema,
]);

export type Section = z.infer<typeof SectionSchema>;

// ============================================================================
// Page Configuration Schema (New Page-Based System)
// ============================================================================

/**
 * Page configuration - controls page visibility and content sections
 */
export const PageConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sections: z.array(SectionSchema).default([]),
});

export type PageConfig = z.infer<typeof PageConfigSchema>;

/**
 * All pages configuration
 * Home page is always enabled (literal true constraint)
 */
export const PagesConfigSchema = z.object({
  home: PageConfigSchema.extend({ enabled: z.literal(true) }),
  about: PageConfigSchema,
  services: PageConfigSchema,
  faq: PageConfigSchema,
  contact: PageConfigSchema,
  gallery: PageConfigSchema,
  testimonials: PageConfigSchema,
});

export type PagesConfig = z.infer<typeof PagesConfigSchema>;

// NOTE: PAGE_NAMES and PageName are defined at the top of this file
// in the Section ID Schema section

// ============================================================================
// Section Visibility Toggles (Legacy - for backward compatibility)
// ============================================================================

export const LandingPageSectionsSchema = z.object({
  hero: z.boolean().default(false),
  socialProofBar: z.boolean().default(false),
  segmentSelector: z.boolean().default(true), // Always shown by default
  about: z.boolean().default(false),
  testimonials: z.boolean().default(false),
  accommodation: z.boolean().default(false),
  gallery: z.boolean().default(false),
  faq: z.boolean().default(false),
  finalCta: z.boolean().default(false),
});

export type LandingPageSections = z.infer<typeof LandingPageSectionsSchema>;

// ============================================================================
// Complete Landing Page Configuration
// ============================================================================

/**
 * Landing Page Configuration Schema
 *
 * Supports both legacy section-based configuration AND new page-based configuration.
 * The `pages` field is the new system; legacy fields are kept for backward compatibility.
 *
 * Migration path:
 * 1. New tenants get `pages` field populated with defaults
 * 2. Existing tenants continue using legacy fields
 * 3. Migration script converts legacy → pages format
 * 4. After migration, legacy fields can be deprecated
 */
export const LandingPageConfigSchema = z.object({
  // New page-based configuration (preferred)
  pages: PagesConfigSchema.optional(),

  // Legacy section-based configuration (for backward compatibility)
  sections: LandingPageSectionsSchema.optional(),
  hero: HeroSectionConfigSchema.optional(),
  socialProofBar: SocialProofBarConfigSchema.optional(),
  about: AboutSectionConfigSchema.optional(),
  testimonials: TestimonialsSectionConfigSchema.optional(),
  accommodation: AccommodationSectionConfigSchema.optional(),
  gallery: GallerySectionConfigSchema.optional(),
  faq: FaqSectionConfigSchema.optional(),
  finalCta: FinalCtaSectionConfigSchema.optional(),
});

export type LandingPageConfig = z.infer<typeof LandingPageConfigSchema>;

// ============================================================================
// API DTOs
// ============================================================================

/**
 * Response DTO for GET /v1/tenant-admin/landing
 */
export const LandingPageConfigResponseSchema = LandingPageConfigSchema;
export type LandingPageConfigResponse = z.infer<typeof LandingPageConfigResponseSchema>;

/**
 * Request DTO for PUT /v1/tenant-admin/landing
 * Partial update - only provided fields are updated
 */
export const UpdateLandingPageConfigSchema = z.object({
  pages: PagesConfigSchema.optional(),
  sections: LandingPageSectionsSchema.partial().optional(),
  hero: HeroSectionConfigSchema.optional(),
  socialProofBar: SocialProofBarConfigSchema.optional(),
  about: AboutSectionConfigSchema.optional(),
  testimonials: TestimonialsSectionConfigSchema.optional(),
  accommodation: AccommodationSectionConfigSchema.optional(),
  gallery: GallerySectionConfigSchema.optional(),
  faq: FaqSectionConfigSchema.optional(),
  finalCta: FinalCtaSectionConfigSchema.optional(),
});

export type UpdateLandingPageConfig = z.infer<typeof UpdateLandingPageConfigSchema>;

// ============================================================================
// Default Configuration for New Tenants
// ============================================================================

/**
 * Legacy section visibility defaults
 * @deprecated Use DEFAULT_LANDING_PAGE_CONFIG.pages instead
 */
export const DEFAULT_LANDING_PAGE_SECTIONS: LandingPageSections = {
  hero: false,
  socialProofBar: false,
  segmentSelector: true,
  about: false,
  testimonials: false,
  accommodation: false,
  gallery: false,
  faq: false,
  finalCta: false,
};

/**
 * Default page configuration for new tenants
 *
 * SINGLE-PAGE SCROLL EXPERIENCE
 * All key sections are on the home page for one continuous scroll.
 * Order: Hero → About → (Packages auto-injected) → Testimonials → FAQ → Contact → CTA
 *
 * Features:
 * - All sections have stable IDs following {page}-{type}-{qualifier} pattern
 * - Placeholder content uses [Bracket Format] for AI discoverability
 * - Educational placeholders teach tenants what each section is for
 * - AI can identify unfilled fields and guide users through setup
 * - Section IDs enable reliable updates without fragile array indices
 *
 * Multi-page navigation is disabled by default - tenants can enable individual
 * pages later if they prefer separate pages for content.
 */
export const DEFAULT_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      // ===== HERO: First impression, transformation headline =====
      {
        id: 'home-hero-main',
        type: 'hero',
        headline: '[Your Transformation Headline]',
        subheadline:
          '[Who you help and the outcome they get. Example: "Helping busy professionals find calm."]',
        ctaText: '[Book Your Session]',
      },
      // ===== ABOUT: Build trust and connection =====
      {
        id: 'home-text-about',
        type: 'text',
        headline: '[About You - Meet Your Guide]',
        content:
          '[Tell your story here. Who are you? Why do you do this work? Who do you serve best? What makes your approach different? Keep it personal - clients book people, not businesses. 2-3 paragraphs works well.]',
        imagePosition: 'right',
      },
      // NOTE: Packages/services are auto-injected here by TenantLandingPage
      // ===== TESTIMONIALS: Social proof from past clients =====
      {
        id: 'home-testimonials-main',
        type: 'testimonials',
        headline: '[What Clients Say]',
        items: [
          {
            quote:
              '[Paste a real client testimonial here. Great testimonials mention the specific transformation or result.]',
            authorName: '[Client Name]',
            authorRole: '[Their context, e.g., Wedding Client 2024]',
            rating: 5,
          },
          {
            quote: '[Another testimonial. Tip: Ask clients for permission to share their words!]',
            authorName: '[Client Name]',
            authorRole: '[Optional context]',
            rating: 5,
          },
        ],
      },
      // ===== FAQ: Address common questions and objections =====
      {
        id: 'home-faq-main',
        type: 'faq',
        headline: '[Common Questions]',
        items: [
          {
            question:
              '[Most common question - e.g., "How long is a typical session?", "What should I wear?"]',
            answer:
              '[Your answer. Be specific and helpful. This builds trust and reduces back-and-forth.]',
          },
          {
            question: '[Second most common question - often about pricing or process]',
            answer: '[Your answer]',
          },
          {
            question:
              '[Address an objection - e.g., "What if I\'m not photogenic?", "Is this right for beginners?"]',
            answer:
              '[Reassure them! This is your chance to overcome hesitation before they even ask.]',
          },
        ],
      },
      // ===== CONTACT: How to reach you =====
      {
        id: 'home-contact-main',
        type: 'contact',
        headline: '[Get In Touch]',
        // NOTE: email/phone left undefined (not placeholders) because:
        // 1. sanitizeObject() strips invalid emails/phones to empty strings
        // 2. Tests expect DEFAULT_PAGES_CONFIG to survive saveDraft() round-trip
        // 3. Empty fields in UI are self-evident, unlike text fields
        address: '[Your location - city/region is fine if you serve a local area]',
        hours: '[Your availability - e.g., "Weekdays 9am-5pm, Weekends by appointment"]',
      },
      // ===== FINAL CTA: Last push to action =====
      {
        id: 'home-cta-main',
        type: 'cta',
        headline: '[Ready to Begin?]',
        subheadline: '[Book your complimentary consultation today.]',
        ctaText: '[Schedule a Call]',
      },
    ],
  },
  // Multi-page navigation disabled by default for single-scroll experience
  // Tenants can enable these later if they prefer separate pages
  about: {
    enabled: false,
    sections: [],
  },
  services: {
    enabled: false, // Services are shown on home page via SegmentPackagesSection
    sections: [],
  },
  faq: {
    enabled: false,
    sections: [],
  },
  contact: {
    enabled: false,
    sections: [],
  },
  gallery: {
    enabled: false,
    sections: [
      {
        id: 'gallery-gallery-main',
        type: 'gallery',
        headline: '[Recent Work]',
        images: [], // Add images when ready
        instagramHandle: '[your_instagram_handle]',
      },
    ],
  },
  testimonials: {
    enabled: false,
    sections: [],
  },
};

/**
 * Complete default landing page configuration for new tenants
 */
export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  pages: DEFAULT_PAGES_CONFIG,
};

// ============================================================================
// LENIENT SCHEMAS (for drafts - allow empty arrays)
// ============================================================================
//
// These schemas are identical to the strict versions EXCEPT:
// - .min(1) constraints are removed from array fields
// - Empty arrays are valid (drafts can be incomplete)
//
// ONLY sections with .min(1) constraints need lenient versions:
// - PricingSectionSchema: tiers.min(1) → allows empty tiers
// - FeaturesSectionSchema: features.min(1) → allows empty features
//
// Other sections (TestimonialsSection, FAQSection) already use .default([])
// without .min(1), so they don't need lenient versions.
// ============================================================================

/**
 * Lenient Pricing Section (for drafts)
 *
 * Identical to PricingSectionSchema but allows empty tiers array.
 * Use for draft validation where incomplete content is expected.
 */
export const LenientPricingSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('pricing'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  tiers: z.array(PricingTierSchema).max(5).default([]), // No .min(1)
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type LenientPricingSection = z.infer<typeof LenientPricingSectionSchema>;

/**
 * Lenient Features Section (for drafts)
 *
 * Identical to FeaturesSectionSchema but allows empty features array.
 * Use for draft validation where incomplete content is expected.
 */
export const LenientFeaturesSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('features'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  features: z.array(FeatureItemSchema).max(12).default([]), // No .min(1)
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type LenientFeaturesSection = z.infer<typeof LenientFeaturesSectionSchema>;

/**
 * Lenient Section Schema (discriminated union for drafts)
 *
 * Uses lenient versions for pricing/features, standard for others.
 * All other sections already allow empty arrays.
 */
export const LenientSectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  TextSectionSchema,
  GallerySectionSchema,
  TestimonialsSectionSchema,
  FAQSectionSchema,
  ContactSectionSchema,
  CTASectionSchema,
  LenientPricingSectionSchema, // Lenient: allows empty tiers
  LenientFeaturesSectionSchema, // Lenient: allows empty features
]);

export type LenientSection = z.infer<typeof LenientSectionSchema>;

/**
 * Lenient Page Config Schema (for drafts)
 *
 * Uses lenient section schema for draft validation.
 */
export const LenientPageConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sections: z.array(LenientSectionSchema).default([]),
});

export type LenientPageConfig = z.infer<typeof LenientPageConfigSchema>;

/**
 * Lenient Pages Config Schema (for drafts)
 *
 * All pages use lenient section validation.
 */
export const LenientPagesConfigSchema = z.object({
  home: LenientPageConfigSchema.extend({ enabled: z.literal(true) }),
  about: LenientPageConfigSchema,
  services: LenientPageConfigSchema,
  faq: LenientPageConfigSchema,
  contact: LenientPageConfigSchema,
  gallery: LenientPageConfigSchema,
  testimonials: LenientPageConfigSchema,
});

export type LenientPagesConfig = z.infer<typeof LenientPagesConfigSchema>;

/**
 * Lenient Landing Page Config Schema (for drafts)
 *
 * Top-level schema using lenient section validation.
 * Drafts can have incomplete sections (empty arrays).
 *
 * @example
 * // This passes lenient validation but fails strict:
 * { pages: { home: { enabled: true, sections: [{ type: 'pricing', headline: 'Plans', tiers: [] }] } } }
 */
export const LenientLandingPageConfigSchema = z.object({
  // New page-based configuration (preferred)
  pages: LenientPagesConfigSchema.optional(),

  // Legacy section-based configuration (for backward compatibility)
  sections: LandingPageSectionsSchema.optional(),
  hero: HeroSectionConfigSchema.optional(),
  socialProofBar: SocialProofBarConfigSchema.optional(),
  about: AboutSectionConfigSchema.optional(),
  testimonials: TestimonialsSectionConfigSchema.optional(),
  accommodation: AccommodationSectionConfigSchema.optional(),
  gallery: GallerySectionConfigSchema.optional(),
  faq: FaqSectionConfigSchema.optional(),
  finalCta: FinalCtaSectionConfigSchema.optional(),
});

export type LenientLandingPageConfig = z.infer<typeof LenientLandingPageConfigSchema>;

// ============================================================================
// STRICT SCHEMA ALIASES (for explicit publish-time validation)
// ============================================================================
//
// These are aliases to existing schemas, renamed for clarity when used
// alongside lenient versions. No functional difference from originals.
// ============================================================================

/**
 * Strict Section Schema (for publishing)
 *
 * Alias to SectionSchema. Use for explicit "this is publish validation" code.
 * Requires non-empty arrays for pricing/features sections.
 */
export const StrictSectionSchema = SectionSchema;
export type StrictSection = Section;

/**
 * Strict Landing Page Config Schema (for publishing)
 *
 * Alias to LandingPageConfigSchema. Requires complete sections.
 */
export const StrictLandingPageConfigSchema = LandingPageConfigSchema;
export type StrictLandingPageConfig = LandingPageConfig;
