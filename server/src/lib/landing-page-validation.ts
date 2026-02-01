/**
 * Landing Page Validation Utilities
 *
 * Provides dual-schema validation for landing page configurations:
 * - validateDraft(): Lenient validation for work-in-progress drafts
 * - validateForPublish(): Strict validation for publishing
 * - getIncompleteSections(): Returns list of incomplete sections
 *
 * WHY DUAL SCHEMAS?
 * The root cause of the P1 preview bug was using strict validation on drafts.
 * When a user adds an empty pricing section, strict validation (.min(1) on tiers)
 * fails, causing silent fallback to published content.
 *
 * Solution:
 * - Drafts use LENIENT validation (empty arrays OK)
 * - Publishing uses STRICT validation (requires content)
 * - getIncompleteSections() tells the agent what's missing
 *
 * @see docs/plans/2026-02-01-feat-realtime-storefront-preview-plan.md
 */

import { z } from 'zod';
import {
  LenientLandingPageConfigSchema,
  LandingPageConfigSchema,
  type LenientLandingPageConfig,
  type LandingPageConfig,
} from '@macon/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Generic validation result that preserves schema-specific types
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Information about an incomplete section that blocks publishing
 */
export interface IncompleteSection {
  /** Page containing the incomplete section (e.g., 'home', 'about') */
  pageKey: string;
  /** Zero-based index of the section on the page */
  sectionIndex: number;
  /** Type of section (e.g., 'pricing', 'features') */
  sectionType: string;
  /** Section ID if present */
  sectionId?: string;
  /** Human-readable explanation of what's missing */
  reason: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate draft config with lenient rules
 *
 * Use this when READING drafts for preview. Allows empty arrays
 * so incomplete sections don't cause validation failure.
 *
 * @param config - Raw config from database (untrusted)
 * @returns Validation result with typed data if valid
 *
 * @example
 * ```typescript
 * const result = validateDraft(tenant.landingPageConfigDraft);
 * if (result.valid) {
 *   // result.data is typed as LenientLandingPageConfig
 *   return { hasDraft: true, config: result.data };
 * }
 * ```
 */
export function validateDraft(config: unknown): ValidationResult<LenientLandingPageConfig> {
  const result = LenientLandingPageConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Validate config for publishing with strict rules
 *
 * Use this before PUBLISHING. Requires all sections to be complete
 * (e.g., pricing must have at least one tier).
 *
 * @param config - Config to validate for publishing
 * @returns Validation result with typed data if valid
 *
 * @example
 * ```typescript
 * const result = validateForPublish(draft);
 * if (!result.valid) {
 *   const incomplete = getIncompleteSections(draft);
 *   return { error: `Cannot publish: ${incomplete.map(s => s.reason).join(', ')}` };
 * }
 * ```
 */
export function validateForPublish(config: unknown): ValidationResult<LandingPageConfig> {
  const result = LandingPageConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Get list of incomplete sections that would block publishing
 *
 * Analyzes a draft config and returns human-readable descriptions
 * of what's missing. Use this to:
 * 1. Show placeholder UI in preview
 * 2. Give helpful error messages when publish fails
 * 3. Guide the AI agent on what to complete
 *
 * @param config - Draft config to analyze (should pass lenient validation)
 * @returns Array of incomplete sections with reasons
 *
 * @example
 * ```typescript
 * const incomplete = getIncompleteSections(draft);
 * // [{ pageKey: 'home', sectionType: 'pricing', reason: 'Pricing section needs at least one tier' }]
 * ```
 */
export function getIncompleteSections(config: unknown): IncompleteSection[] {
  const incomplete: IncompleteSection[] = [];

  // Type guard - handle null/undefined/non-object
  if (!config || typeof config !== 'object') {
    return incomplete;
  }

  // Type assertion after guard
  const typedConfig = config as LenientLandingPageConfig;

  // Guard against undefined pages (defensive)
  if (!typedConfig.pages) {
    return incomplete;
  }

  // Check each page
  for (const [pageKey, page] of Object.entries(typedConfig.pages)) {
    if (!page?.sections || !Array.isArray(page.sections)) {
      continue;
    }

    page.sections.forEach((section, index) => {
      // Type guard for section
      if (!section || typeof section !== 'object' || !('type' in section)) {
        return;
      }

      const sectionWithType = section as { type: string; id?: string; [key: string]: unknown };

      switch (sectionWithType.type) {
        case 'pricing': {
          const pricingSection = sectionWithType as { tiers?: unknown[] };
          if (!pricingSection.tiers || pricingSection.tiers.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'pricing',
              sectionId: sectionWithType.id,
              reason: 'Pricing section needs at least one tier',
            });
          }
          break;
        }
        case 'features': {
          const featuresSection = sectionWithType as { features?: unknown[] };
          if (!featuresSection.features || featuresSection.features.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'features',
              sectionId: sectionWithType.id,
              reason: 'Features section needs at least one feature',
            });
          }
          break;
        }
        case 'testimonials': {
          const testimonialsSection = sectionWithType as { items?: unknown[] };
          if (!testimonialsSection.items || testimonialsSection.items.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'testimonials',
              sectionId: sectionWithType.id,
              reason: 'Testimonials section needs at least one testimonial',
            });
          }
          break;
        }
        case 'faq': {
          const faqSection = sectionWithType as { items?: unknown[] };
          if (!faqSection.items || faqSection.items.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'faq',
              sectionId: sectionWithType.id,
              reason: 'FAQ section needs at least one question',
            });
          }
          break;
        }
        // Other section types (hero, text, contact, cta, gallery) don't have
        // required array content, so they're always "complete"
      }
    });
  }

  return incomplete;
}
