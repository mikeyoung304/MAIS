/**
 * DTO schemas using zod
 */

import { z } from 'zod';
import { LandingPageConfigSchema } from './landing-page';

// ============================================================================
// Error Response Schemas
// ============================================================================

/**
 * Standard error response schema for all API endpoints
 * Matches the format from error-handler middleware
 */
export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  statusCode: z.number().int(),
  error: z.string(), // Error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
  message: z.string(),
  requestId: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    )
    .optional(), // Field-level validation errors
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Convenience schemas for common HTTP error status codes
 */
export const BadRequestErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(400),
});

export const UnauthorizedErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(401),
});

export const ForbiddenErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(403),
});

export const NotFoundErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(404),
});

export const ConflictErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(409),
});

export const TooManyRequestsErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(429),
});

export const UnprocessableEntityErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(422),
});

export const InternalServerErrorSchema = ErrorResponseSchema.extend({
  statusCode: z.literal(500),
});

// Add-on DTO
export const AddOnDtoSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priceCents: z.number().int(),
  photoUrl: z.string().url().optional(),
});

export type AddOnDto = z.infer<typeof AddOnDtoSchema>;

// Booking Type enum - matches Prisma BookingType enum
export const BookingTypeSchema = z.enum(['DATE', 'TIMESLOT']);
export type BookingType = z.infer<typeof BookingTypeSchema>;

// Package DTO
export const PackageDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  photoUrl: z.string().url().optional(),
  addOns: z.array(AddOnDtoSchema),
  // Additional fields from database schema
  segmentId: z.string().nullable().optional(),
  grouping: z.string().nullable().optional(),
  groupingOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().default(true),
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        filename: z.string(),
        size: z.number(),
        order: z.number().int(),
      })
    )
    .default([]),
  // Booking configuration - determines which booking flow to use
  bookingType: BookingTypeSchema.default('DATE'),
});

export type PackageDto = z.infer<typeof PackageDtoSchema>;

// Availability DTO
export const AvailabilityDtoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  available: z.boolean(),
  reason: z.enum(['booked', 'blackout', 'calendar']).optional(),
});

export type AvailabilityDto = z.infer<typeof AvailabilityDtoSchema>;

// Batch Availability DTO (for date range queries)
export const BatchAvailabilityDtoSchema = z.object({
  unavailableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export type BatchAvailabilityDto = z.infer<typeof BatchAvailabilityDtoSchema>;

// Booking DTO
export const BookingDtoSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  coupleName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  addOnIds: z.array(z.string()),
  totalCents: z.number().int(),
  status: z.enum([
    'PENDING',
    'DEPOSIT_PAID',
    'PAID',
    'CONFIRMED',
    'CANCELED',
    'REFUNDED',
    'FULFILLED',
  ]),
  createdAt: z.string().datetime(), // ISO datetime
});

export type BookingDto = z.infer<typeof BookingDtoSchema>;

// Create Checkout DTO (request body)
export const CreateCheckoutDtoSchema = z.object({
  packageId: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  coupleName: z.string(),
  email: z.string().email(),
  addOnIds: z.array(z.string()).max(20, 'Maximum 20 add-ons allowed').optional(),
});

export type CreateCheckoutDto = z.infer<typeof CreateCheckoutDtoSchema>;

// Create Date Booking DTO (for DATE booking type packages)
export const CreateDateBookingDtoSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      (val) => {
        const date = new Date(val + 'T00:00:00Z');
        return !isNaN(date.getTime());
      },
      { message: 'Invalid calendar date' }
    )
    .refine(
      (val) => {
        const date = new Date(val + 'T00:00:00Z');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return date >= now;
      },
      { message: 'Date must be in the future' }
    ),
  customerName: z.string().min(1, 'Customer name is required').max(100),
  customerEmail: z.string().email('Valid email is required'),
  customerPhone: z.string().optional(),
  notes: z.string().max(500).optional(),
  addOnIds: z.array(z.string()).max(20, 'Maximum 20 add-ons allowed').optional(),
});

export type CreateDateBookingDto = z.infer<typeof CreateDateBookingDtoSchema>;

// Admin Login DTO (request body)
export const AdminLoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type AdminLoginDto = z.infer<typeof AdminLoginDtoSchema>;

// Tenant Signup DTO (request body)
export const TenantSignupDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
});

export type TenantSignupDto = z.infer<typeof TenantSignupDtoSchema>;

// Tenant Signup Response
export const TenantSignupResponseSchema = z.object({
  token: z.string(),
  tenantId: z.string(),
  slug: z.string(),
  email: z.string().email(),
  apiKeyPublic: z.string(),
  secretKey: z.string(), // Shown once, never stored in plaintext
});

export type TenantSignupResponse = z.infer<typeof TenantSignupResponseSchema>;

// Password Reset Request DTO
export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

// Early Access Request DTO
export const EarlyAccessRequestDtoSchema = z.object({
  email: z.string().email().max(254, 'Email must be 254 characters or less'),
});

export type EarlyAccessRequestDto = z.infer<typeof EarlyAccessRequestDtoSchema>;

// Early Access Response DTO
export const EarlyAccessResponseDtoSchema = z.object({
  message: z.string(),
});

export type EarlyAccessResponseDto = z.infer<typeof EarlyAccessResponseDtoSchema>;

// Password Reset DTO
export const ResetPasswordDtoSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;

// Admin Package CRUD DTOs
export const CreatePackageDtoSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().min(0),
  photoUrl: z.string().url().optional(),
  // Tier/segment organization fields
  segmentId: z.string().nullable().optional(),
  grouping: z.string().nullable().optional(),
  groupingOrder: z.number().int().nullable().optional(),
});

export type CreatePackageDto = z.infer<typeof CreatePackageDtoSchema>;

export const UpdatePackageDtoSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  photoUrl: z.string().url().optional(),
  // Tier/segment organization fields
  segmentId: z.string().nullable().optional(),
  grouping: z.string().nullable().optional(),
  groupingOrder: z.number().int().nullable().optional(),
});

export type UpdatePackageDto = z.infer<typeof UpdatePackageDtoSchema>;

export const PackageResponseDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  photoUrl: z.string().url().optional(),
});

export type PackageResponseDto = z.infer<typeof PackageResponseDtoSchema>;

/**
 * Maximum price in cents: $999,999.99
 * Aligned with Stripe's maximum charge amount
 * TODO-198 FIX: Add upper bound to prevent integer overflow
 */
const MAX_PRICE_CENTS = 99999999;

// Admin AddOn CRUD DTOs
export const CreateAddOnDtoSchema = z.object({
  packageId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priceCents: z
    .number()
    .int()
    .min(0)
    .max(MAX_PRICE_CENTS, { message: 'Price exceeds maximum allowed value ($999,999.99)' }),
  photoUrl: z.string().url().optional(),
});

export type CreateAddOnDto = z.infer<typeof CreateAddOnDtoSchema>;

export const UpdateAddOnDtoSchema = z.object({
  packageId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z
    .number()
    .int()
    .min(0)
    .max(MAX_PRICE_CENTS, { message: 'Price exceeds maximum allowed value ($999,999.99)' })
    .optional(),
  photoUrl: z.string().url().optional(),
});

export type UpdateAddOnDto = z.infer<typeof UpdateAddOnDtoSchema>;

// Tenant Branding DTO
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});

export type TenantBrandingDto = z.infer<typeof TenantBrandingDtoSchema>;

// Update Tenant Branding DTO (for tenant admin)
export const UpdateBrandingDtoSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontFamily: z.string().optional(),
});

export type UpdateBrandingDto = z.infer<typeof UpdateBrandingDtoSchema>;

// Logo Upload Response DTO
export const LogoUploadResponseDtoSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number(),
  mimetype: z.string(),
});

export type LogoUploadResponseDto = z.infer<typeof LogoUploadResponseDtoSchema>;

// Blackout Date DTOs
export const BlackoutDtoSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export type BlackoutDto = z.infer<typeof BlackoutDtoSchema>;

export const CreateBlackoutDtoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export type CreateBlackoutDto = z.infer<typeof CreateBlackoutDtoSchema>;

// Package Photo DTOs
export const PackagePhotoDtoSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number(),
  order: z.number().int(),
});

export type PackagePhotoDto = z.infer<typeof PackagePhotoDtoSchema>;

// Package with Photos DTO (for tenant admin)
export const PackageWithPhotosDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  photoUrl: z.string().url().optional(),
  photos: z.array(PackagePhotoDtoSchema).optional(),
});

export type PackageWithPhotosDto = z.infer<typeof PackageWithPhotosDtoSchema>;

// ============================================================================
// Visual Editor Draft DTOs
// ============================================================================

// Package with Draft fields (for visual editor)
export const PackageWithDraftDtoSchema = PackageDtoSchema.extend({
  draftTitle: z.string().nullable(),
  draftDescription: z.string().nullable(),
  draftPriceCents: z.number().int().nullable(),
  draftPhotos: z.array(PackagePhotoDtoSchema).nullable(),
  hasDraft: z.boolean(),
  draftUpdatedAt: z.string().datetime().nullable(),
});

export type PackageWithDraftDto = z.infer<typeof PackageWithDraftDtoSchema>;

// Update Package Draft DTO (for autosave)
export const UpdatePackageDraftDtoSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).optional(),
  photos: z.array(PackagePhotoDtoSchema).optional(),
});

export type UpdatePackageDraftDto = z.infer<typeof UpdatePackageDraftDtoSchema>;

// Publish Drafts DTO
export const PublishDraftsDtoSchema = z.object({
  packageIds: z.array(z.string()).optional(), // Empty = publish all
});

export type PublishDraftsDto = z.infer<typeof PublishDraftsDtoSchema>;

// Publish Drafts Response DTO
export const PublishDraftsResponseDtoSchema = z.object({
  published: z.number().int(),
  packages: z.array(PackageDtoSchema),
});

export type PublishDraftsResponseDto = z.infer<typeof PublishDraftsResponseDtoSchema>;

// Discard Drafts DTO
export const DiscardDraftsDtoSchema = z.object({
  packageIds: z.array(z.string()).optional(), // Empty = discard all
});

export type DiscardDraftsDto = z.infer<typeof DiscardDraftsDtoSchema>;

// Discard Drafts Response DTO
export const DiscardDraftsResponseDtoSchema = z.object({
  discarded: z.number().int(),
});

export type DiscardDraftsResponseDto = z.infer<typeof DiscardDraftsResponseDtoSchema>;

// Stripe Connect DTOs
export const StripeConnectDtoSchema = z.object({
  accountId: z.string(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
});

export type StripeConnectDto = z.infer<typeof StripeConnectDtoSchema>;

export const StripeOnboardingLinkDtoSchema = z.object({
  url: z.string().url(),
  expiresAt: z.number(),
});

export type StripeOnboardingLinkDto = z.infer<typeof StripeOnboardingLinkDtoSchema>;

export const StripeAccountStatusDtoSchema = z.object({
  accountId: z.string(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  requirements: z.object({
    currentlyDue: z.array(z.string()),
    eventuallyDue: z.array(z.string()),
    pastDue: z.array(z.string()),
  }),
});

export type StripeAccountStatusDto = z.infer<typeof StripeAccountStatusDtoSchema>;

// Tenant DTO (for platform admin)
export const TenantDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  commissionPercent: z.number(),
  stripeAccountId: z.string().nullable(),
  stripeOnboarded: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
  // Stats
  packageCount: z.number().optional(),
  bookingCount: z.number().optional(),
});

export type TenantDto = z.infer<typeof TenantDtoSchema>;

// Segment DTOs
export const SegmentDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  slug: z.string(),
  name: z.string(),
  heroTitle: z.string(),
  heroSubtitle: z.string().nullable(),
  heroImage: z.string().nullable(),
  description: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
});

export type SegmentDto = z.infer<typeof SegmentDtoSchema>;

export const CreateSegmentDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric + hyphens only'),
  name: z.string().min(1).max(100),
  heroTitle: z.string().min(1).max(200),
  heroSubtitle: z.string().max(300).optional(),
  heroImage: z.string().url().or(z.literal('')).optional(),
  description: z.string().max(2000).optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export type CreateSegmentDto = z.infer<typeof CreateSegmentDtoSchema>;

export const UpdateSegmentDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric + hyphens only')
    .optional(),
  name: z.string().min(1).max(100).optional(),
  heroTitle: z.string().min(1).max(200).optional(),
  heroSubtitle: z.string().max(300).optional(),
  heroImage: z.string().url().or(z.literal('')).optional(),
  description: z.string().max(2000).optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type UpdateSegmentDto = z.infer<typeof UpdateSegmentDtoSchema>;

// Platform Admin - Tenant Management DTOs

export const CreateTenantDtoSchema = z.object({
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(2, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format').optional(),
  commissionPercent: z
    .number()
    .min(0, 'Commission must be at least 0%')
    .max(100, 'Commission cannot exceed 100%')
    .default(10.0),
});

export type CreateTenantDto = z.infer<typeof CreateTenantDtoSchema>;

export const CreateTenantResponseDtoSchema = z.object({
  tenant: TenantDtoSchema,
  secretKey: z.string(), // API secret key - shown ONCE, never stored in plaintext
});

export type CreateTenantResponseDto = z.infer<typeof CreateTenantResponseDtoSchema>;

export const UpdateTenantDtoSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  branding: z.record(z.string(), z.any()).optional(), // JSON object
  isActive: z.boolean().optional(),
  stripeAccountId: z.string().optional(),
  stripeOnboarded: z.boolean().optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantDtoSchema>;

export const TenantDetailDtoSchema = TenantDtoSchema.extend({
  stats: z.object({
    bookings: z.number().int(),
    packages: z.number().int(),
    addOns: z.number().int(),
    segments: z.number().int(),
    blackoutDates: z.number().int(),
  }),
});

export type TenantDetailDto = z.infer<typeof TenantDetailDtoSchema>;

export const PlatformStatsSchema = z.object({
  // Tenant metrics
  totalTenants: z.number().int(),
  activeTenants: z.number().int(),

  // Segment metrics
  totalSegments: z.number().int(),
  activeSegments: z.number().int(),

  // Booking metrics
  totalBookings: z.number().int(),
  confirmedBookings: z.number().int(),
  pendingBookings: z.number().int(),

  // Revenue metrics (in cents)
  totalRevenue: z.number().int(),
  platformCommission: z.number().int(),
  tenantRevenue: z.number().int(),

  // Time-based metrics (optional)
  revenueThisMonth: z.number().int().optional(),
  bookingsThisMonth: z.number().int().optional(),
});

export type PlatformStats = z.infer<typeof PlatformStatsSchema>;

// ============================================================================
// Scheduling DTOs
// ============================================================================

// Service DTOs
export const ServiceDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0).default(0),
  priceCents: z.number().int().min(0),
  timezone: z.string().default('America/New_York'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  segmentId: z.string().nullable(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
});

export type ServiceDto = z.infer<typeof ServiceDtoSchema>;

/**
 * Public Service DTO (excludes tenantId for security)
 * Used by public scheduling endpoints where tenant context comes from X-Tenant-Key header
 */
export const PublicServiceDtoSchema = ServiceDtoSchema.omit({ tenantId: true });

export type PublicServiceDto = z.infer<typeof PublicServiceDtoSchema>;

export const CreateServiceDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric + hyphens only'),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().positive().min(5).max(480), // 5 min to 8 hours
  bufferMinutes: z.number().int().min(0).max(240).default(0), // 0 to 4 hours
  priceCents: z.number().int().min(0),
  timezone: z.string().default('America/New_York'),
  sortOrder: z.number().int().default(0),
  segmentId: z.string().nullable().optional(),
});

export type CreateServiceDto = z.infer<typeof CreateServiceDtoSchema>;

export const UpdateServiceDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric + hyphens only')
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().positive().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(240).optional(),
  priceCents: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  segmentId: z.string().nullable().optional(),
});

export type UpdateServiceDto = z.infer<typeof UpdateServiceDtoSchema>;

// Availability Rule DTOs
export const AvailabilityRuleDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  serviceId: z.string().nullable(), // NULL = applies to all services
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM'), // "09:00"
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM'), // "17:00"
  effectiveFrom: z.string(), // ISO date string
  effectiveTo: z.string().nullable(), // NULL = indefinite
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
});

export type AvailabilityRuleDto = z.infer<typeof AvailabilityRuleDtoSchema>;

export const CreateAvailabilityRuleDtoSchema = z.object({
  serviceId: z.string().nullable().optional(), // NULL = default availability for all services
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM (e.g., 09:00)'),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM (e.g., 17:00)'),
  effectiveFrom: z.string().datetime().optional(), // ISO datetime, defaults to now
  effectiveTo: z.string().datetime().nullable().optional(), // NULL = indefinite
});

export type CreateAvailabilityRuleDto = z.infer<typeof CreateAvailabilityRuleDtoSchema>;

export const UpdateAvailabilityRuleDtoSchema = z.object({
  serviceId: z.string().nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM (e.g., 09:00)')
    .optional(),
  endTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format: HH:MM (e.g., 17:00)')
    .optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

export type UpdateAvailabilityRuleDto = z.infer<typeof UpdateAvailabilityRuleDtoSchema>;

// Time Slot DTOs
export const TimeSlotDtoSchema = z.object({
  startTime: z.string().datetime(), // ISO datetime (UTC)
  endTime: z.string().datetime(), // ISO datetime (UTC)
  available: z.boolean(),
});

export type TimeSlotDto = z.infer<typeof TimeSlotDtoSchema>;

// Available Slots Query Schema
export const AvailableSlotsQuerySchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  timezone: z.string().optional(), // Optional client timezone (e.g., "America/New_York")
});

export type AvailableSlotsQuery = z.infer<typeof AvailableSlotsQuerySchema>;

// Customer DTO
export const CustomerDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CustomerDto = z.infer<typeof CustomerDtoSchema>;

// Appointment DTO (time-slot booking)
export const AppointmentDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  serviceId: z.string(),
  packageId: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Date component
  startTime: z.string().datetime(), // Full UTC datetime
  endTime: z.string().datetime(), // Full UTC datetime
  clientTimezone: z.string().nullable(),
  status: z.enum([
    'PENDING',
    'DEPOSIT_PAID',
    'PAID',
    'CONFIRMED',
    'CANCELED',
    'REFUNDED',
    'FULFILLED',
  ]),
  totalPrice: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});

export type AppointmentDto = z.infer<typeof AppointmentDtoSchema>;

// Create Appointment Checkout DTO (for public booking flow)
export const CreateAppointmentCheckoutDtoSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().datetime({ message: 'Start time must be a valid ISO datetime' }),
  endTime: z.string().datetime({ message: 'End time must be a valid ISO datetime' }),
  customerName: z
    .string()
    .min(1, 'Customer name is required')
    .max(100, 'Name must be 100 characters or less'),
  customerEmail: z.string().email('Valid email is required'),
  customerPhone: z.string().optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

export type CreateAppointmentCheckoutDto = z.infer<typeof CreateAppointmentCheckoutDtoSchema>;

// Appointment Checkout Response DTO
export const AppointmentCheckoutResponseDtoSchema = z.object({
  checkoutUrl: z.string().url('Checkout URL must be a valid URL'),
  sessionId: z.string(),
});

export type AppointmentCheckoutResponseDto = z.infer<typeof AppointmentCheckoutResponseDtoSchema>;

// ============================================================================
// Public Tenant DTOs (for storefront routing)
// ============================================================================

/**
 * Hex color validation regex - matches #000000 through #FFFFFF (case insensitive)
 */
const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format');

/**
 * Allowed font families for tenant branding
 * SECURITY: Allowlist prevents CSS injection via fontFamily field
 */
export const ALLOWED_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans Pro',
  'Nunito',
  'Raleway',
  'Work Sans',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
] as const;

/**
 * Tier display names - tenant customization for tier labels
 * Structure: {"tier_1": "The Grounding Reset", "tier_2": "The Team Recharge", "tier_3": "The Executive Reset"}
 * If not provided, defaults to Essential/Popular/Premium
 */
export const TierDisplayNamesSchema = z.object({
  tier_1: z.string().max(50).optional(),
  tier_2: z.string().max(50).optional(),
  tier_3: z.string().max(50).optional(),
});

export type TierDisplayNames = z.infer<typeof TierDisplayNamesSchema>;

/**
 * Public tenant info for storefront routing
 * SECURITY: Only safe public fields - never expose secrets, Stripe IDs, or PII
 */
export const TenantPublicDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  apiKeyPublic: z.string(), // Needed to set X-Tenant-Key for subsequent API calls
  branding: z
    .object({
      primaryColor: HexColorSchema.optional(),
      secondaryColor: HexColorSchema.optional(),
      accentColor: HexColorSchema.optional(),
      backgroundColor: HexColorSchema.optional(),
      fontFamily: z.enum(ALLOWED_FONT_FAMILIES).optional(),
      logoUrl: z.string().url().optional(),
      // Landing page configuration - composed from landing-page.ts (DRY)
      // SECURITY: LandingPageConfigSchema uses SafeUrlSchema for XSS prevention
      landingPage: LandingPageConfigSchema.optional(),
    })
    .optional(),
  // Tier display names - tenant customization for tier labels
  tierDisplayNames: TierDisplayNamesSchema.optional(),
});

export type TenantPublicDto = z.infer<typeof TenantPublicDtoSchema>;

// ============================================================================
// Booking Management DTOs (MVP Gaps Phase 1)
// ============================================================================

/**
 * Request body for reschedule endpoint
 */
export const RescheduleBookingDtoSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export type RescheduleBookingDto = z.infer<typeof RescheduleBookingDtoSchema>;

/**
 * Request body for cancel endpoint
 */
export const CancelBookingDtoSchema = z.object({
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export type CancelBookingDto = z.infer<typeof CancelBookingDtoSchema>;

/**
 * Extended booking DTO with management fields
 * Used for public booking management responses
 */
export const BookingManagementDtoSchema = BookingDtoSchema.extend({
  cancelledBy: z.enum(['CUSTOMER', 'TENANT', 'ADMIN', 'SYSTEM']).optional(),
  cancellationReason: z.string().optional(),
  refundStatus: z
    .enum(['NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'])
    .optional(),
  refundAmount: z.number().int().optional(),
  refundedAt: z.string().datetime().optional(),
});

export type BookingManagementDto = z.infer<typeof BookingManagementDtoSchema>;

/**
 * Response for public booking lookup with management URLs
 * Used by customer-facing manage booking page
 */
export const PublicBookingDetailsDtoSchema = z.object({
  booking: BookingManagementDtoSchema,
  canReschedule: z.boolean(),
  canCancel: z.boolean(),
  packageTitle: z.string(),
  addOnTitles: z.array(z.string()),
});

export type PublicBookingDetailsDto = z.infer<typeof PublicBookingDetailsDtoSchema>;

// ============================================================================
// Reminder DTOs (MVP Gaps Phase 2)
// ============================================================================

/**
 * Upcoming reminder preview item
 * Used in dashboard to show which reminders are pending
 */
export const UpcomingReminderDtoSchema = z.object({
  bookingId: z.string(),
  coupleName: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reminderDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  daysUntilEvent: z.number().int(),
});

export type UpcomingReminderDto = z.infer<typeof UpcomingReminderDtoSchema>;

/**
 * Reminder status response (for dashboard badge)
 * Shows how many pending reminders exist and preview of upcoming ones
 */
export const ReminderStatusResponseSchema = z.object({
  pendingCount: z.number().int().min(0),
  upcomingReminders: z.array(UpcomingReminderDtoSchema),
});

export type ReminderStatusResponse = z.infer<typeof ReminderStatusResponseSchema>;

/**
 * Process reminders response
 * Shows how many reminders were successfully processed vs failed
 */
export const ProcessRemindersResponseSchema = z.object({
  processed: z.number().int().min(0),
  failed: z.number().int().min(0),
});

export type ProcessRemindersResponse = z.infer<typeof ProcessRemindersResponseSchema>;

// ============================================================================
// Deposit Settings DTOs (MVP Gaps Phase 4)
// ============================================================================

/**
 * Deposit settings for tenant
 * Controls deposit amount and balance due timeline
 */
export const DepositSettingsDtoSchema = z.object({
  depositPercent: z.number().min(0).max(100).nullable(), // null = full payment required
  balanceDueDays: z.number().int().min(1).max(90),
});

export type DepositSettingsDto = z.infer<typeof DepositSettingsDtoSchema>;

/**
 * Update deposit settings request
 */
export const UpdateDepositSettingsDtoSchema = z.object({
  depositPercent: z.number().min(0).max(100).nullable().optional(),
  balanceDueDays: z.number().int().min(1).max(90).optional(),
});

export type UpdateDepositSettingsDto = z.infer<typeof UpdateDepositSettingsDtoSchema>;

/**
 * Balance payment response (after creating Stripe checkout)
 */
export const BalancePaymentResponseSchema = z.object({
  checkoutUrl: z.string().url(),
  balanceAmountCents: z.number().int().min(0),
});

export type BalancePaymentResponse = z.infer<typeof BalancePaymentResponseSchema>;

// ============================================================================
// Calendar Configuration DTOs (MVP Gaps Phase 3)
// ============================================================================

/**
 * Calendar status response
 * Shows whether tenant has configured their own calendar
 */
export const CalendarStatusResponseSchema = z.object({
  configured: z.boolean(),
  calendarId: z.string().nullable(), // Masked for security (e.g., "test@gro...e.com")
});

export type CalendarStatusResponse = z.infer<typeof CalendarStatusResponseSchema>;

/**
 * Calendar configuration input
 * Tenant provides their Google Calendar ID and service account JSON
 */
export const CalendarConfigInputSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  serviceAccountJson: z.string().min(1, 'Service account JSON is required'),
});

export type CalendarConfigInput = z.infer<typeof CalendarConfigInputSchema>;

/**
 * Calendar test response
 * Shows whether connection test succeeded
 */
export const CalendarTestResponseSchema = z.object({
  success: z.boolean(),
  calendarId: z.string().optional(), // Masked calendar ID
  calendarName: z.string().optional(), // Calendar display name
  error: z.string().optional(), // Error message if test failed
});

export type CalendarTestResponse = z.infer<typeof CalendarTestResponseSchema>;
