/**
 * Landing Page Configuration Types and Schemas
 *
 * Defines the structure for tenant landing page configuration.
 * All sections are optional and can be toggled on/off via tenant admin dashboard.
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
export const SafeUrlSchema = z.string()
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
export const InstagramHandleSchema = z.string()
  .max(31) // 30 chars + optional @ prefix
  .regex(
    /^@?[a-zA-Z0-9._]{1,30}$/,
    'Instagram handle must contain only letters, numbers, periods, and underscores'
  )
  .transform((val) => val.replace('@', '')); // Normalize by removing @ prefix

// ============================================================================
// Social Proof Icon Types
// ============================================================================

export const SocialProofIconSchema = z.enum(['star', 'calendar', 'users', 'award', 'heart', 'check']);
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
// Section Visibility Toggles
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

export const LandingPageConfigSchema = z.object({
  sections: LandingPageSectionsSchema,
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
