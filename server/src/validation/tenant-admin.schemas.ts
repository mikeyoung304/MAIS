/**
 * Zod validation schemas for tenant admin endpoints
 * These schemas validate requests for tenant-scoped admin operations
 */

import { z } from 'zod';

// Hex color validation regex
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

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
export type CreateBlackoutInput = z.infer<typeof createBlackoutSchema>;
export type BookingQueryParams = z.infer<typeof bookingQuerySchema>;
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
