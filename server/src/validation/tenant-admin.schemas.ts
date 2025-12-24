/**
 * Zod validation schemas for tenant admin endpoints
 * These schemas validate requests for tenant-scoped admin operations
 */

import { z } from 'zod';

// Hex color validation regex
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * Maximum price in cents: $999,999.99
 * Aligned with Stripe's maximum charge amount
 * @see https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
 */
const MAX_PRICE_CENTS = 99999999;

// Package Management Schemas
export const createPackageSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priceCents: z
    .number()
    .int()
    .min(0, 'Price must be non-negative')
    .max(MAX_PRICE_CENTS, 'Price exceeds maximum allowed value ($999,999.99)'),
  photoUrl: z.string().url().optional(),
  // Tier/segment organization fields (added for security validation)
  segmentId: z.string().min(1).nullable().optional(),
  grouping: z
    .string()
    .min(1)
    .max(100, 'Grouping must be 100 characters or less')
    .nullable()
    .optional(),
  groupingOrder: z
    .number()
    .int()
    .min(0)
    .max(1000, 'Display order must be between 0 and 1000')
    .nullable()
    .optional(),
});

export const updatePackageSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priceCents: z
    .number()
    .int()
    .min(0)
    .max(MAX_PRICE_CENTS, 'Price exceeds maximum allowed value ($999,999.99)')
    .optional(),
  photoUrl: z.string().url().optional(),
  // Tier/segment organization fields (added for security validation)
  segmentId: z.string().min(1).nullable().optional(),
  grouping: z
    .string()
    .min(1)
    .max(100, 'Grouping must be 100 characters or less')
    .nullable()
    .optional(),
  groupingOrder: z
    .number()
    .int()
    .min(0)
    .max(1000, 'Display order must be between 0 and 1000')
    .nullable()
    .optional(),
});

// Blackout Management Schemas
export const createBlackoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().optional(),
});

export const blackoutIdSchema = z.object({
  id: z.string().min(1, 'Blackout ID is required'),
});

// Booking Query Schemas
export const bookingQuerySchema = z.object({
  status: z.enum(['PAID', 'REFUNDED', 'CANCELED']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// Branding Update Schema
export const updateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'Primary color must be a valid hex color (e.g., #FF5733)')
    .optional(),
  secondaryColor: z
    .string()
    .regex(hexColorRegex, 'Secondary color must be a valid hex color (e.g., #3498DB)')
    .optional(),
  accentColor: z
    .string()
    .regex(hexColorRegex, 'Accent color must be a valid hex color (e.g., #38B2AC)')
    .optional(),
  backgroundColor: z
    .string()
    .regex(hexColorRegex, 'Background color must be a valid hex color (e.g., #FFFFFF)')
    .optional(),
  fontFamily: z.string().min(1).optional(),
  logo: z.string().url().optional(),
});

// Type exports
export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateBlackoutInput = z.infer<typeof createBlackoutSchema>;
export type BookingQueryParams = z.infer<typeof bookingQuerySchema>;
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
