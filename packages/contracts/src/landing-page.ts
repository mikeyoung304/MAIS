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
  type: z.literal('gallery'),
  headline: z.string().max(60).default('Our Work'),
  images: z.array(z.object({
    url: SafeImageUrlSchema,
    alt: z.string().max(200),
  })).max(50).default([]),
  instagramHandle: z.string().max(30).optional(),
});

export type GallerySection = z.infer<typeof GallerySectionSchema>;

/**
 * Testimonials section - customer reviews with ratings
 */
export const TestimonialsSectionSchema = z.object({
  type: z.literal('testimonials'),
  headline: z.string().max(60).default('What Clients Say'),
  items: z.array(z.object({
    quote: z.string().min(10).max(300),
    authorName: z.string().min(1).max(100),
    authorRole: z.string().max(50).optional(),
    authorPhotoUrl: SafeImageUrlOptionalSchema,
    rating: z.number().int().min(1).max(5).default(5),
  })).max(12).default([]),
});

export type TestimonialsSection = z.infer<typeof TestimonialsSectionSchema>;

/**
 * FAQ section - questions and answers
 */
export const FAQSectionSchema = z.object({
  type: z.literal('faq'),
  headline: z.string().max(60).default('FAQ'),
  items: z.array(z.object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(1000),
  })).max(20).default([]),
});

export type FAQSection = z.infer<typeof FAQSectionSchema>;

/**
 * Contact section - contact information display
 */
export const ContactSectionSchema = z.object({
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
  ctaHref: z.union([
    SafeUrlSchema, // Absolute URLs must be http/https
    z.string().regex(/^\/[a-zA-Z0-9\-_.~/?#[\]@!$&'()*+,;=%]*$/, 'Relative URLs must start with / and contain valid path characters'),
  ]).optional(),
  isPopular: z.boolean().optional(),
  variant: z.enum(['standard', 'enterprise']).optional(),
});

export type PricingTier = z.infer<typeof PricingTierSchema>;

/**
 * Pricing section - tier-based pricing cards
 */
export const PricingSectionSchema = z.object({
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

/**
 * Page names for iteration and type safety
 */
export const PAGE_NAMES = ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'] as const;
export type PageName = typeof PAGE_NAMES[number];

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
 * All 7 pages enabled by default with sensible placeholder content
 */
export const DEFAULT_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      {
        type: 'hero',
        headline: 'Welcome to Our Studio',
        subheadline: 'Professional services tailored to your needs',
        ctaText: 'View Packages',
      },
      {
        type: 'cta',
        headline: 'Ready to get started?',
        subheadline: 'Book your session today',
        ctaText: 'View Packages',
      },
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        type: 'text',
        headline: 'About Us',
        content: 'We are passionate professionals dedicated to delivering exceptional service. Our team brings years of experience and a commitment to quality that shows in every project we undertake.',
        imagePosition: 'left',
      },
    ],
  },
  services: {
    enabled: true,
    sections: [], // Services page pulls from packages, not sections
  },
  faq: {
    enabled: true,
    sections: [
      {
        type: 'faq',
        headline: 'Frequently Asked Questions',
        items: [
          { question: 'How do I book?', answer: 'Browse our services and complete the booking form. You will receive a confirmation email with all the details.' },
          { question: 'What is your cancellation policy?', answer: 'Cancel up to 48 hours before your appointment for a full refund. Cancellations within 48 hours may be subject to a fee.' },
          { question: 'Do you offer custom packages?', answer: 'Yes! Contact us to discuss your specific needs and we will create a customized package just for you.' },
        ],
      },
    ],
  },
  contact: {
    enabled: true,
    sections: [
      {
        type: 'contact',
        headline: 'Get in Touch',
      },
    ],
  },
  gallery: {
    enabled: true,
    sections: [
      {
        type: 'gallery',
        headline: 'Our Work',
        images: [],
      },
    ],
  },
  testimonials: {
    enabled: true,
    sections: [
      {
        type: 'testimonials',
        headline: 'What Clients Say',
        items: [
          { quote: 'Wonderful experience from start to finish!', authorName: 'Happy Client', rating: 5 },
        ],
      },
    ],
  },
};

/**
 * Complete default landing page configuration for new tenants
 */
export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  pages: DEFAULT_PAGES_CONFIG,
};
