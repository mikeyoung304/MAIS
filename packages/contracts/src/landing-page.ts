/**
 * Storefront Section & Page Configuration
 *
 * Defines the structure for tenant storefront page configuration.
 * Uses a page-level toggle system where tenants can enable/disable entire pages.
 * Each page contains flexible sections that can be customized with content.
 *
 * Architecture:
 * - 7 page types: home, about, services, faq, contact, gallery, testimonials
 * - 12 section types: hero, text, about, gallery, testimonials, faq, contact, cta, pricing, services, features, custom
 * - Home page is always enabled
 * - Dynamic navigation updates based on enabled pages
 *
 * Data flow: SectionContent table → sectionsToPages() → PagesConfig → components
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
  'about',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'services',
  'features',
  'custom',
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
    /^(home|about|services|faq|contact|gallery|testimonials)-(hero|text|about|gallery|testimonials|faq|contact|cta|pricing|services|features|custom)-(main|[a-z]+|[0-9]+)$/,
    'Section ID must be {page}-{type}-{qualifier} format (e.g., home-hero-main, about-text-2)'
  )
  .refine((id) => !RESERVED_PATTERNS.some((pattern) => id.includes(pattern)), {
    message: 'Section ID contains reserved JavaScript pattern',
  });

export type SectionId = z.infer<typeof SectionIdSchema>;

/**
 * Type guard to check if a section has a valid stable ID.
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
 * Used for all image URLs in storefront configuration
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
// Section Schemas (Page-Based System)
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
 * About section - content block with optional image (canonical name for 'text')
 * Same shape as TextSection but with type: 'about'.
 * 'text' is the legacy alias; 'about' is canonical per block-type-mapper.ts.
 */
export const AboutSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('about'),
  headline: z.string().max(60).optional(),
  content: z.string().min(1).max(2000),
  imageUrl: SafeImageUrlOptionalSchema,
  imagePosition: z.enum(['left', 'right']).default('left'),
});

export type AboutSection = z.infer<typeof AboutSectionSchema>;

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
 * Services section - same shape as features, canonical name for service listings.
 * Renders with FeaturesSection component. Separate type for semantic clarity.
 */
export const ServicesSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('services'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  features: z.array(FeatureItemSchema).min(1).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type ServicesSection = z.infer<typeof ServicesSectionSchema>;

/**
 * Custom section - flexible catch-all for non-standard content
 */
export const CustomSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('custom'),
  headline: z.string().max(60).optional(),
  content: z.string().max(5000).optional(),
});

export type CustomSection = z.infer<typeof CustomSectionSchema>;

/**
 * Discriminated union of all section types
 * Used for flexible page composition
 */
export const SectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  TextSectionSchema,
  AboutSectionSchema,
  GallerySectionSchema,
  TestimonialsSectionSchema,
  FAQSectionSchema,
  ContactSectionSchema,
  CTASectionSchema,
  PricingSectionSchema,
  FeaturesSectionSchema,
  ServicesSectionSchema,
  CustomSectionSchema,
]);

export type Section = z.infer<typeof SectionSchema>;

// ============================================================================
// Page Configuration Schema
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

// ============================================================================
// Default Configuration for New Tenants
// ============================================================================

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
 * Lenient Services Section (for drafts)
 *
 * Identical to ServicesSectionSchema but allows empty features array.
 */
export const LenientServicesSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('services'),
  headline: z.string().max(60),
  subheadline: z.string().max(150).optional(),
  features: z.array(FeatureItemSchema).max(12).default([]), // No .min(1)
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export type LenientServicesSection = z.infer<typeof LenientServicesSectionSchema>;

/**
 * Lenient Section Schema (discriminated union for drafts)
 *
 * Uses lenient versions for pricing/features/services, standard for others.
 * All other sections already allow empty arrays.
 */
export const LenientSectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  TextSectionSchema,
  AboutSectionSchema,
  GallerySectionSchema,
  TestimonialsSectionSchema,
  FAQSectionSchema,
  ContactSectionSchema,
  CTASectionSchema,
  LenientPricingSectionSchema, // Lenient: allows empty tiers
  LenientFeaturesSectionSchema, // Lenient: allows empty features
  LenientServicesSectionSchema, // Lenient: allows empty features
  CustomSectionSchema,
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
 * Strict Pages Config Schema (for publishing)
 *
 * Alias to PagesConfigSchema. Requires complete sections.
 */
export const StrictPagesConfigSchema = PagesConfigSchema;
export type StrictPagesConfig = PagesConfig;
