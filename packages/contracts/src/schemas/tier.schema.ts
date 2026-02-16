/**
 * Tier Schema Definitions
 *
 * Zod schemas for the Tier model's Json fields and validation.
 * Tier is the bookable entity within a Segment, replacing the old Package model.
 * sortOrder (1, 2, 3) replaces the TierLevel enum (GOOD/BETTER/BEST)
 * for flexible pricing structures (duration-based, count-based, etc.).
 *
 * @see server/prisma/schema.prisma - Tier model
 * @see docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md
 */

import { z } from 'zod';

// Re-export scaling rules for co-location with tier schemas
export {
  ScalingComponentSchema,
  ScalingRulesSchema,
  type ScalingComponent,
  type ScalingRules,
} from './scaling-rules.schema';

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

// Type exports
export type TierFeature = z.infer<typeof TierFeatureSchema>;
export type TierFeatures = z.infer<typeof TierFeaturesSchema>;

/**
 * Default features for each sort position (1=entry, 2=mid, 3=premium)
 * Used when creating new segments during onboarding
 */
export const DEFAULT_TIER_FEATURES_BY_SORT: Record<number, TierFeatures> = {
  1: [
    { text: 'Basic service package', highlighted: false },
    { text: 'Email support', highlighted: false },
    { text: 'Standard timeline', highlighted: false },
  ],
  2: [
    { text: 'Enhanced service package', highlighted: true },
    { text: 'Priority email support', highlighted: false },
    { text: 'Expedited timeline', highlighted: false },
    { text: 'One revision included', highlighted: false },
  ],
  3: [
    { text: 'Premium service package', highlighted: true },
    { text: 'Dedicated support', highlighted: true },
    { text: 'Rush timeline available', highlighted: false },
    { text: 'Unlimited revisions', highlighted: false },
    { text: 'Priority booking', highlighted: false },
  ],
};

/**
 * Default tier names by sort position
 */
export const DEFAULT_TIER_NAMES_BY_SORT: Record<number, string> = {
  1: 'Essential',
  2: 'Professional',
  3: 'Premium',
};
