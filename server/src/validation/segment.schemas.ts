/**
 * Zod validation schemas for segment endpoints
 * These schemas validate requests for segment-related operations
 */

import { z } from 'zod';

// Slug validation regex - lowercase alphanumeric and hyphens only
const slugRegex = /^[a-z0-9-]+$/;

/**
 * Schema for creating a new segment
 * All required fields must be provided
 */
export const createSegmentSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be 100 characters or less')
    .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  heroTitle: z
    .string()
    .min(1, 'Hero title is required')
    .max(200, 'Hero title must be 200 characters or less'),
  heroSubtitle: z.string().max(300, 'Hero subtitle must be 300 characters or less').optional(),
  heroImage: z.string().url('Hero image must be a valid URL').optional(),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  metaTitle: z
    .string()
    .max(60, 'Meta title must be 60 characters or less (SEO best practice)')
    .optional(),
  metaDescription: z
    .string()
    .max(160, 'Meta description must be 160 characters or less (SEO best practice)')
    .optional(),
  sortOrder: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .optional(),
  active: z.boolean().optional(),
});

/**
 * Schema for updating an existing segment
 * All fields are optional (partial update)
 */
export const updateSegmentSchema = createSegmentSchema.partial();

/**
 * Schema for validating segment ID in URL parameters
 */
export const segmentIdSchema = z.object({
  id: z.string().cuid('Invalid segment ID format'),
});

/**
 * Schema for validating segment slug in URL parameters
 */
export const segmentSlugSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

/**
 * Schema for query parameters when listing segments
 */
export const segmentQuerySchema = z.object({
  onlyActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// Type exports for TypeScript
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
export type SegmentIdParams = z.infer<typeof segmentIdSchema>;
export type SegmentSlugParams = z.infer<typeof segmentSlugSchema>;
export type SegmentQueryParams = z.infer<typeof segmentQuerySchema>;
