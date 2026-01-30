/**
 * Tier Schema Definitions
 *
 * Zod schemas for the Tier model's Json fields.
 * Used for validation in services and agent tools.
 *
 * @see server/prisma/schema.prisma - Tier model
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { z } from 'zod';

/**
 * Individual feature within a pricing tier
 *
 * @example
 * { text: "Unlimited bookings", highlighted: true, icon: "check-circle" }
 */
export const TierFeatureSchema = z.object({
  text: z
    .string()
    .min(1, 'Feature text is required')
    .max(200, 'Feature text must be 200 characters or less'),
  highlighted: z.boolean().default(false),
  icon: z.string().optional(), // Lucide icon name (e.g., "check", "star", "zap")
});

/**
 * Array of features for a tier
 * Limited to 15 features to prevent UI overflow
 */
export const TierFeaturesSchema = z
  .array(TierFeatureSchema)
  .max(15, 'Maximum 15 features per tier');

/**
 * Tier level enum matching Prisma schema
 */
export const TierLevelSchema = z.enum(['GOOD', 'BETTER', 'BEST']);

// Type exports
export type TierFeature = z.infer<typeof TierFeatureSchema>;
export type TierFeatures = z.infer<typeof TierFeaturesSchema>;
export type TierLevel = z.infer<typeof TierLevelSchema>;

/**
 * Default features for each tier level
 * Used when creating new segments
 */
export const DEFAULT_TIER_FEATURES: Record<TierLevel, TierFeatures> = {
  GOOD: [
    { text: 'Basic service package', highlighted: false },
    { text: 'Email support', highlighted: false },
    { text: 'Standard timeline', highlighted: false },
  ],
  BETTER: [
    { text: 'Enhanced service package', highlighted: true },
    { text: 'Priority email support', highlighted: false },
    { text: 'Expedited timeline', highlighted: false },
    { text: 'One revision included', highlighted: false },
  ],
  BEST: [
    { text: 'Premium service package', highlighted: true },
    { text: 'Dedicated support', highlighted: true },
    { text: 'Rush timeline available', highlighted: false },
    { text: 'Unlimited revisions', highlighted: false },
    { text: 'Priority booking', highlighted: false },
  ],
};

/**
 * Default tier names for each level
 */
export const DEFAULT_TIER_NAMES: Record<TierLevel, string> = {
  GOOD: 'Essential',
  BETTER: 'Professional',
  BEST: 'Premium',
};
