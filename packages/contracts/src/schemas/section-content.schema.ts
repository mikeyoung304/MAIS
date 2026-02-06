/**
 * Section Content Schema Definitions
 *
 * Zod schemas for the SectionContent model's Json fields.
 * Implements discriminated union pattern for type-safe content handling.
 *
 * @see server/prisma/schema.prisma - SectionContent model, BlockType enum
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { z } from 'zod';

// ============================================
// Base Schema
// ============================================

/**
 * Base schema that all block content extends
 */
const BaseBlockSchema = z.object({
  visible: z.boolean().default(true),
  customClasses: z.string().optional(),
});

// ============================================
// Block-Specific Content Schemas
// ============================================

/**
 * Hero section content
 */
export const HeroContentSchema = BaseBlockSchema.extend({
  headline: z.string().max(100, 'Headline must be 100 characters or less'),
  subheadline: z.string().max(200, 'Subheadline must be 200 characters or less').optional(),
  ctaText: z.string().max(40, 'CTA text must be 40 characters or less').optional(),
  ctaLink: z.string().url('CTA link must be a valid URL').optional(),
  backgroundImage: z.string().url('Background image must be a valid URL').optional(),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
});

/**
 * About section content
 */
export const AboutContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100, 'Title must be 100 characters or less'),
  body: z.string().max(2000, 'Body must be 2000 characters or less'),
  image: z.string().url('Image must be a valid URL').optional(),
  imagePosition: z.enum(['left', 'right']).default('right'),
});

/**
 * Services section content
 * Note: Actual services are rendered from Tier model, this just holds display settings
 */
export const ServicesContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Our Services'),
  subtitle: z.string().max(200).optional(),
  layout: z.enum(['grid', 'list', 'cards']).default('cards'),
  showPricing: z.boolean().default(true),
});

/**
 * Pricing section content
 * Note: Actual pricing comes from Tier model, this holds display settings
 */
export const PricingContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Pricing'),
  subtitle: z.string().max(200).optional(),
  showComparison: z.boolean().default(true),
  highlightedTier: z.enum(['GOOD', 'BETTER', 'BEST']).optional(),
});

/**
 * Individual testimonial item for section content
 * Named differently from landing-page.ts to avoid export collision
 */
export const SectionTestimonialItemSchema = z.object({
  id: z.string().min(1), // CUID
  name: z.string().max(100, 'Name must be 100 characters or less'),
  role: z.string().max(100, 'Role must be 100 characters or less').optional(),
  quote: z.string().max(500, 'Quote must be 500 characters or less'),
  image: z.string().url('Image must be a valid URL').optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

/**
 * Testimonials section content
 */
export const TestimonialsContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('What Clients Say'),
  items: z.array(SectionTestimonialItemSchema).max(20, 'Maximum 20 testimonials'),
  layout: z.enum(['grid', 'carousel', 'masonry']).default('grid'),
});

/**
 * Individual FAQ item for section content
 * Named differently from landing-page.ts to avoid export collision
 */
export const SectionFaqItemSchema = z.object({
  id: z.string().min(1), // CUID
  question: z.string().max(200, 'Question must be 200 characters or less'),
  answer: z.string().max(1000, 'Answer must be 1000 characters or less'),
});

/**
 * FAQ section content
 */
export const FaqContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Frequently Asked Questions'),
  items: z.array(SectionFaqItemSchema).max(30, 'Maximum 30 FAQs'),
});

/**
 * Contact section content
 */
export const ContactContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Get in Touch'),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(20, 'Phone must be 20 characters or less').optional(),
  showForm: z.boolean().default(true),
  formFields: z
    .array(z.enum(['name', 'email', 'phone', 'message', 'date', 'service']))
    .default(['name', 'email', 'message']),
});

/**
 * CTA (Call to Action) section content
 */
export const CtaContentSchema = BaseBlockSchema.extend({
  headline: z.string().max(100, 'Headline must be 100 characters or less'),
  subheadline: z.string().max(200, 'Subheadline must be 200 characters or less').optional(),
  buttonText: z.string().max(40, 'Button text must be 40 characters or less'),
  buttonLink: z.string().url('Button link must be a valid URL').optional(),
  style: z.enum(['primary', 'secondary', 'outline']).default('primary'),
});

/**
 * Individual gallery item
 */
export const GalleryItemSchema = z.object({
  id: z.string().min(1), // CUID
  url: z.string().url('Image URL must be valid'),
  alt: z.string().max(200, 'Alt text must be 200 characters or less'),
  caption: z.string().max(300, 'Caption must be 300 characters or less').optional(),
});

/**
 * Gallery section content
 */
export const GalleryContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Portfolio'),
  items: z.array(GalleryItemSchema).max(50, 'Maximum 50 gallery items'),
  columns: z.number().int().min(2).max(4).default(3),
});

/**
 * Individual feature item for section content
 * Named differently from landing-page.ts to avoid export collision
 */
export const SectionFeatureItemSchema = z.object({
  id: z.string().min(1), // CUID
  title: z.string().max(100, 'Title must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less'),
  icon: z.string().max(50, 'Icon name must be 50 characters or less').optional(),
  image: z.string().url('Image must be a valid URL').optional(),
});

/**
 * Features section content
 */
export const FeaturesContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Why Choose Us'),
  subtitle: z.string().max(200).optional(),
  items: z.array(SectionFeatureItemSchema).max(12, 'Maximum 12 feature items'),
  layout: z.enum(['grid', 'list', 'cards']).default('grid'),
  columns: z.number().int().min(2).max(4).default(3),
});

/**
 * Custom section content - flexible schema for custom blocks
 */
export const CustomContentSchema = BaseBlockSchema.extend({
  // Custom content is validated loosely - actual content varies by implementation
}).passthrough();

// ============================================
// Block Type Enum
// ============================================

/**
 * Block type enum matching Prisma schema
 */
export const BlockTypeSchema = z.enum([
  'HERO',
  'ABOUT',
  'SERVICES',
  'PRICING',
  'TESTIMONIALS',
  'FAQ',
  'CONTACT',
  'CTA',
  'GALLERY',
  'FEATURES',
  'CUSTOM',
]);

// ============================================
// Discriminated Union
// ============================================

/**
 * Discriminated union for type-safe content handling
 * Use this when you need to validate content based on blockType
 */
export const SectionContentSchema = z.discriminatedUnion('blockType', [
  z.object({ blockType: z.literal('HERO'), content: HeroContentSchema }),
  z.object({ blockType: z.literal('ABOUT'), content: AboutContentSchema }),
  z.object({ blockType: z.literal('SERVICES'), content: ServicesContentSchema }),
  z.object({ blockType: z.literal('PRICING'), content: PricingContentSchema }),
  z.object({
    blockType: z.literal('TESTIMONIALS'),
    content: TestimonialsContentSchema,
  }),
  z.object({ blockType: z.literal('FAQ'), content: FaqContentSchema }),
  z.object({ blockType: z.literal('CONTACT'), content: ContactContentSchema }),
  z.object({ blockType: z.literal('CTA'), content: CtaContentSchema }),
  z.object({ blockType: z.literal('GALLERY'), content: GalleryContentSchema }),
  z.object({ blockType: z.literal('FEATURES'), content: FeaturesContentSchema }),
  z.object({ blockType: z.literal('CUSTOM'), content: CustomContentSchema }),
]);

// ============================================
// Type Exports
// ============================================

export type BlockType = z.infer<typeof BlockTypeSchema>;
export type HeroContent = z.infer<typeof HeroContentSchema>;
export type AboutContent = z.infer<typeof AboutContentSchema>;
export type ServicesContent = z.infer<typeof ServicesContentSchema>;
export type PricingContent = z.infer<typeof PricingContentSchema>;
export type SectionTestimonialItem = z.infer<typeof SectionTestimonialItemSchema>;
export type TestimonialsContent = z.infer<typeof TestimonialsContentSchema>;
export type SectionFaqItem = z.infer<typeof SectionFaqItemSchema>;
export type FaqContent = z.infer<typeof FaqContentSchema>;
export type ContactContent = z.infer<typeof ContactContentSchema>;
export type CtaContent = z.infer<typeof CtaContentSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type GalleryContent = z.infer<typeof GalleryContentSchema>;
export type SectionFeatureItem = z.infer<typeof SectionFeatureItemSchema>;
export type FeaturesContent = z.infer<typeof FeaturesContentSchema>;
export type CustomContent = z.infer<typeof CustomContentSchema>;
export type SectionContent = z.infer<typeof SectionContentSchema>;

// ============================================
// Content Type Map (for runtime lookup)
// ============================================

/**
 * Map of block types to their content schemas
 * Useful for programmatic validation
 */
export const BLOCK_CONTENT_SCHEMAS = {
  HERO: HeroContentSchema,
  ABOUT: AboutContentSchema,
  SERVICES: ServicesContentSchema,
  PRICING: PricingContentSchema,
  TESTIMONIALS: TestimonialsContentSchema,
  FAQ: FaqContentSchema,
  CONTACT: ContactContentSchema,
  CTA: CtaContentSchema,
  GALLERY: GalleryContentSchema,
  FEATURES: FeaturesContentSchema,
  CUSTOM: CustomContentSchema,
} as const;

/**
 * Validate content for a specific block type
 */
export function validateBlockContent<T extends BlockType>(
  blockType: T,
  content: unknown
): z.SafeParseReturnType<unknown, z.infer<(typeof BLOCK_CONTENT_SCHEMAS)[T]>> {
  const schema = BLOCK_CONTENT_SCHEMAS[blockType];
  return schema.safeParse(content);
}

// ============================================
// API Response Schemas (Phase 4)
// ============================================

/**
 * Section summary for page structure responses
 * Matches SectionContentService.SectionSummary
 */
export const SectionSummarySchema = z.object({
  sectionId: z.string().min(1),
  blockType: BlockTypeSchema,
  sectionType: z.string().min(1), // Lowercase frontend name (hero, about, etc.)
  pageName: z.string().min(1),
  order: z.number().int().min(0),
  headline: z.string().optional(),
  isPlaceholder: z.boolean(),
  isDraft: z.boolean(),
  isPublished: z.boolean(),
  hasUnpublishedChanges: z.boolean(),
});

/**
 * Page with its sections
 */
export const PageWithSectionsSchema = z.object({
  name: z.string().min(1),
  sections: z.array(SectionSummarySchema),
});

/**
 * Response from GET /sections/structure
 */
export const PageStructureResponseSchema = z.object({
  success: z.boolean(),
  hasDraft: z.boolean(),
  pages: z.array(PageWithSectionsSchema),
});

/**
 * Full section entity for API responses
 * Includes all fields from SectionContentEntity
 */
export const SectionContentDtoSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  segmentId: z.string().nullable(),
  blockType: BlockTypeSchema,
  pageName: z.string(),
  content: z.unknown(), // JSON content varies by blockType
  order: z.number().int(),
  isDraft: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  versions: z.unknown(), // JSON array of version history
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Response from GET /sections (published or preview)
 */
export const SectionsListResponseSchema = z.object({
  success: z.boolean(),
  sections: z.array(SectionContentDtoSchema),
});

/**
 * Response from GET /sections/:id
 */
export const SectionContentResponseSchema = z.object({
  success: z.boolean(),
  sectionId: z.string(),
  blockType: BlockTypeSchema,
  sectionType: z.string(),
  pageName: z.string(),
  content: z.unknown(),
  isDraft: z.boolean(),
  isPublished: z.boolean(),
  hasUnpublishedChanges: z.boolean(),
  canUndo: z.boolean(),
  undoSteps: z.number().int().min(0),
  publishedAt: z.string().datetime().nullable(),
  lastModified: z.string().datetime(),
});

/**
 * Dashboard action for agent-frontend communication
 *
 * Action types:
 * - NAVIGATE: Navigate to a section in the dashboard
 * - SCROLL_TO_SECTION: Scroll the preview to a specific section
 * - SHOW_PREVIEW: Show the storefront preview
 * - REFRESH: Refresh the current view
 * - SHOW_VARIANT_WIDGET: Show the tone variant selection widget (Guided Refinement)
 * - SHOW_PUBLISH_READY: Show the publish-ready state (Guided Refinement)
 * - HIGHLIGHT_NEXT_SECTION: Highlight the next section to refine (Guided Refinement)
 */
export const DashboardActionSchema = z.object({
  type: z.enum([
    'NAVIGATE',
    'SCROLL_TO_SECTION',
    'SHOW_PREVIEW',
    'REFRESH',
    // Onboarding reveal (first draft complete)
    'REVEAL_SITE',
    // Guided Refinement actions (Phase 5.1)
    'SHOW_VARIANT_WIDGET',
    'SHOW_PUBLISH_READY',
    'HIGHLIGHT_NEXT_SECTION',
  ]),
  sectionId: z.string().optional(),
  section: z.string().optional(),
  // Guided Refinement: variant options for SHOW_VARIANT_WIDGET
  variants: z.array(z.enum(['professional', 'premium', 'friendly'])).optional(),
});

/**
 * Base storefront result matching service layer
 */
export const StorefrontResultSchema = z.object({
  success: z.boolean(),
  hasDraft: z.boolean(),
  visibility: z.enum(['draft', 'live']),
  message: z.string(),
  dashboardAction: DashboardActionSchema.optional(),
});

/**
 * Response from publish/discard operations
 */
export const PublishSectionResponseSchema = StorefrontResultSchema.extend({
  requiresConfirmation: z.boolean().optional(),
  sectionId: z.string().optional(),
  blockType: BlockTypeSchema.optional(),
  publishedAt: z.string().datetime().optional(),
});

export const PublishAllResponseSchema = StorefrontResultSchema.extend({
  requiresConfirmation: z.boolean().optional(),
  publishedCount: z.number().int().optional(),
  publishedAt: z.string().datetime().optional(),
});

export const DiscardAllResponseSchema = StorefrontResultSchema.extend({
  requiresConfirmation: z.boolean().optional(),
  discardedCount: z.number().int().optional(),
});

// ============================================
// API Response Type Exports
// ============================================

export type SectionSummary = z.infer<typeof SectionSummarySchema>;
export type PageWithSections = z.infer<typeof PageWithSectionsSchema>;
export type PageStructureResponse = z.infer<typeof PageStructureResponseSchema>;
export type SectionContentDto = z.infer<typeof SectionContentDtoSchema>;
export type SectionsListResponse = z.infer<typeof SectionsListResponseSchema>;
export type SectionContentResponse = z.infer<typeof SectionContentResponseSchema>;
export type DashboardAction = z.infer<typeof DashboardActionSchema>;
export type StorefrontResult = z.infer<typeof StorefrontResultSchema>;
export type PublishSectionResponse = z.infer<typeof PublishSectionResponseSchema>;
export type PublishAllResponse = z.infer<typeof PublishAllResponseSchema>;
export type DiscardAllResponse = z.infer<typeof DiscardAllResponseSchema>;
