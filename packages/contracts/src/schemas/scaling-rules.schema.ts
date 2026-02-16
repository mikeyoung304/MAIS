/**
 * Scaling Rules Schema — Per-Person Pricing
 *
 * Defines the structure for per-person scaling pricing on Tier models.
 * Stored as JSON in the Tier.scalingRules column, validated by Zod at runtime.
 *
 * Each ScalingComponent represents a chargeable line item that scales with guest count:
 * - `includedGuests`: guests covered by the base price (no additional charge)
 * - `perPersonCents`: cost per additional guest beyond the included count
 * - `maxGuests`: optional cap for this specific component
 *
 * @example
 * // Private chef dinner: base covers 2, $110/person for 3-10 guests
 * {
 *   components: [{
 *     name: "Private Chef Dinner",
 *     includedGuests: 2,
 *     perPersonCents: 11000,
 *     maxGuests: 10,
 *   }]
 * }
 *
 * @see server/prisma/schema.prisma - Tier.scalingRules field
 */

import { z } from 'zod';

/**
 * A single scaling component — one chargeable line item that scales with guest count.
 */
export const ScalingComponentSchema = z.object({
  name: z.string().min(1, 'Component name is required').max(100),
  includedGuests: z.number().int().min(0, 'Included guests must be >= 0'),
  perPersonCents: z.number().int().min(0, 'Per-person cost must be >= 0'),
  maxGuests: z.number().int().min(1).optional(),
});

/**
 * Complete scaling rules for a tier — array of pricing components.
 * Limited to 10 components to prevent UI/calculation complexity.
 */
export const ScalingRulesSchema = z.object({
  components: z
    .array(ScalingComponentSchema)
    .min(1, 'At least one scaling component is required')
    .max(10, 'Maximum 10 scaling components per tier'),
});

export type ScalingComponent = z.infer<typeof ScalingComponentSchema>;
export type ScalingRules = z.infer<typeof ScalingRulesSchema>;
