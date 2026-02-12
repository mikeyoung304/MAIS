/**
 * Shared constants for tenant agent tools.
 *
 * Cloud Run rootDir constraint prevents importing from @macon/contracts or
 * server/src/shared/. These are manually synced copies -- see cross-references.
 *
 * @see packages/contracts/src/schemas/section-blueprint.schema.ts (canonical)
 * @see server/src/lib/block-type-mapper.ts (canonical SECTION_TYPES)
 */

/** MVP sections for the reveal animation. @see contracts MVP_REVEAL_SECTION_TYPES */
export const MVP_SECTION_TYPES: ReadonlySet<string> = new Set(['HERO', 'ABOUT', 'SERVICES']);

/** Valid page names for storefront operations */
export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

/**
 * Valid section types the agent can create/update.
 * Includes 'text' for legacy compatibility (maps to ABOUT on the backend).
 * @see server/src/lib/block-type-mapper.ts SECTION_TYPES (canonical)
 */
export const SECTION_TYPES = [
  'hero',
  'text', // Legacy alias for 'about'
  'about',
  'services',
  'pricing',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'gallery',
  'features',
  'custom',
] as const;

/** Total canonical sections. @see contracts SECTION_BLUEPRINT.length */
export const TOTAL_SECTIONS = 8;

/** Maximum segments per tenant */
export const MAX_SEGMENTS_PER_TENANT = 5;

/** Maximum tiers per segment */
export const MAX_TIERS_PER_SEGMENT = 5;
