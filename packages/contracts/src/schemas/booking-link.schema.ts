/**
 * Booking Link Agent Schemas
 *
 * Type-safe schemas for the Calendly-style booking links feature.
 * Enables natural language scheduling link creation via the business advisor agent.
 *
 * Architecture:
 * - Agent says "Create me a 15-min Zoom link" → shareable booking URL
 * - Trust tiers: T2 for create/update (soft confirm), T1 for read operations
 * - Reuses existing Service model with booking-specific extensions
 *
 * Key URLs generated:
 * - Default: https://gethandled.ai/t/{tenant-slug}/book/{service-slug}
 * - Custom domain: https://{custom-domain}/book/{service-slug}
 */

import { z } from 'zod';

// ============================================================================
// IANA Timezone Schema (#626 fix)
// ============================================================================

/**
 * Validates timezone string against IANA timezone database
 * Uses Intl.DateTimeFormat for validation without external dependencies
 */
export const IANATimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid IANA timezone identifier (e.g., "America/New_York", "Europe/London")' }
);

export type IANATimezone = z.infer<typeof IANATimezoneSchema>;

// ============================================================================
// Working Hours Schema
// ============================================================================

/**
 * Day of week (0 = Sunday, 6 = Saturday)
 */
export const DayOfWeekSchema = z.number().int().min(0).max(6);

/**
 * Time string in 24-hour format (e.g., "09:00", "17:30")
 */
export const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
  message: 'Time must be in HH:MM format (24-hour)',
});

/**
 * Single working hours entry for a day
 */
export const WorkingHoursEntrySchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  isActive: z.boolean().default(true),
});

export type WorkingHoursEntry = z.infer<typeof WorkingHoursEntrySchema>;

/**
 * Full working hours for a week
 */
export const WeeklyWorkingHoursSchema = z.array(WorkingHoursEntrySchema).min(1).max(7);

export type WeeklyWorkingHours = z.infer<typeof WeeklyWorkingHoursSchema>;

// ============================================================================
// Date Override Schema
// ============================================================================

/**
 * Date override for vacation, holidays, or special hours
 */
export const DateOverrideSchema = z.object({
  date: z.string().date(), // ISO date string (YYYY-MM-DD)
  available: z.boolean().default(false), // false = blocked
  startTime: TimeStringSchema.optional(), // Override hours (if available)
  endTime: TimeStringSchema.optional(),
  reason: z.string().max(200).optional(),
});

export type DateOverride = z.infer<typeof DateOverrideSchema>;

// ============================================================================
// Bookable Service (Scheduling Link) Schema
// ============================================================================

/**
 * Service configuration for booking links
 * Maps to extended Service model fields
 */
export const BookableServiceConfigSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(), // Auto-generated if not provided
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().positive().max(480), // Max 8 hours
  priceCents: z.number().int().nonnegative().default(0), // 0 = free
  bufferMinutes: z.number().int().nonnegative().max(120).default(0),
  minNoticeMinutes: z.number().int().nonnegative().default(120), // 2 hours default
  maxAdvanceDays: z.number().int().positive().max(365).default(60),
  maxPerDay: z.number().int().positive().optional(), // Optional daily limit
});

export type BookableServiceConfig = z.infer<typeof BookableServiceConfigSchema>;

/**
 * Full bookable service with generated URLs
 */
export const BookableServiceSchema = z.object({
  id: z.string().cuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  bufferMinutes: z.number().int().nonnegative(),
  minNoticeMinutes: z.number().int().nonnegative(),
  maxAdvanceDays: z.number().int().positive(),
  maxPerDay: z.number().int().positive().nullable(),
  active: z.boolean(),
  bookingUrl: z.string().url(),
  createdAt: z.string().datetime(),
});

export type BookableService = z.infer<typeof BookableServiceSchema>;

// ============================================================================
// Availability Time Slot Schema
// ============================================================================

/**
 * Available time slot for booking
 */
export const TimeSlotSchema = z.object({
  start: z.string().datetime(), // ISO datetime
  end: z.string().datetime(),
  clientTimezone: z.string(),
  providerTimezone: z.string(),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

// ============================================================================
// API Request/Response Schemas
// ============================================================================

/**
 * Query params for getting availability
 */
export const GetAvailabilityQuerySchema = z.object({
  serviceId: z.string().cuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  timezone: IANATimezoneSchema,
});

export type GetAvailabilityQuery = z.infer<typeof GetAvailabilityQuerySchema>;

/**
 * Invitee info for booking creation
 */
export const BookingInviteeSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  answers: z.record(z.string()).optional(), // Custom question answers
});

export type BookingInvitee = z.infer<typeof BookingInviteeSchema>;

/**
 * Create booking request
 */
export const CreateBookingFromLinkSchema = z.object({
  serviceId: z.string().cuid(),
  startTime: z.string().datetime(),
  timezone: IANATimezoneSchema,
  invitee: BookingInviteeSchema,
});

export type CreateBookingFromLink = z.infer<typeof CreateBookingFromLinkSchema>;

// ============================================================================
// Agent Tool Input Schemas
// ============================================================================

/**
 * Operation type for manage_bookable_service tool
 */
export const BookableServiceOperationSchema = z.enum(['create', 'update', 'delete']);

export type BookableServiceOperation = z.infer<typeof BookableServiceOperationSchema>;

/**
 * Input for manage_bookable_service tool
 */
export const ManageBookableServiceInputSchema = z.discriminatedUnion('operation', [
  // Create operation
  z.object({
    operation: z.literal('create'),
    name: z.string().min(2).max(100),
    durationMinutes: z.number().int().positive().max(480),
    priceCents: z.number().int().nonnegative().default(0),
    description: z.string().max(500).optional(),
    bufferMinutes: z.number().int().nonnegative().max(120).default(0),
    minNoticeMinutes: z.number().int().nonnegative().default(120),
    maxAdvanceDays: z.number().int().positive().max(365).default(60),
  }),
  // Update operation
  z.object({
    operation: z.literal('update'),
    serviceId: z.string().cuid(),
    name: z.string().min(2).max(100).optional(),
    durationMinutes: z.number().int().positive().max(480).optional(),
    priceCents: z.number().int().nonnegative().optional(),
    description: z.string().max(500).optional(),
    bufferMinutes: z.number().int().nonnegative().max(120).optional(),
    minNoticeMinutes: z.number().int().nonnegative().optional(),
    maxAdvanceDays: z.number().int().positive().max(365).optional(),
    active: z.boolean().optional(),
  }),
  // Delete operation
  z.object({
    operation: z.literal('delete'),
    serviceId: z.string().cuid(),
  }),
]);

export type ManageBookableServiceInput = z.infer<typeof ManageBookableServiceInputSchema>;

/**
 * Input for manage_working_hours tool
 */
export const ManageWorkingHoursInputSchema = z.object({
  workingHours: WeeklyWorkingHoursSchema,
  timezone: IANATimezoneSchema.optional(), // Update tenant timezone if provided
});

export type ManageWorkingHoursInput = z.infer<typeof ManageWorkingHoursInputSchema>;

/**
 * Operation type for manage_date_overrides tool
 */
export const DateOverrideOperationSchema = z.enum(['add', 'remove', 'clear_range']);

export type DateOverrideOperation = z.infer<typeof DateOverrideOperationSchema>;

/**
 * Input for manage_date_overrides tool
 */
export const ManageDateOverridesInputSchema = z.discriminatedUnion('operation', [
  // Add a date override (block or set special hours)
  z.object({
    operation: z.literal('add'),
    date: z.string().date(),
    available: z.boolean().default(false),
    startTime: TimeStringSchema.optional(),
    endTime: TimeStringSchema.optional(),
    reason: z.string().max(200).optional(),
  }),
  // Remove a specific date override
  z.object({
    operation: z.literal('remove'),
    date: z.string().date(),
  }),
  // Clear all overrides in a date range
  z.object({
    operation: z.literal('clear_range'),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
]);

export type ManageDateOverridesInput = z.infer<typeof ManageDateOverridesInputSchema>;

// ============================================================================
// Agent Tool Result Schemas
// ============================================================================

/**
 * Success result for manage_bookable_service (create/update)
 */
export const ManageBookableServiceSuccessSchema = z.object({
  success: z.literal(true),
  action: z.enum(['created', 'updated', 'deleted']),
  serviceId: z.string().cuid().optional(), // Present for create/update
  bookingUrl: z.string().url().optional(), // Present for create/update
  serviceName: z.string().optional(),
});

/**
 * Error result for manage_bookable_service
 */
export const ManageBookableServiceErrorSchema = z.union([
  z.object({
    success: z.literal(false),
    error: z.literal('SERVICE_EXISTS'),
    existingSlug: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('SERVICE_NOT_FOUND'),
    serviceId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('VALIDATION_ERROR'),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('HAS_UPCOMING_BOOKINGS'),
    bookingCount: z.number(),
  }),
]);

export const ManageBookableServiceResultSchema = z.union([
  ManageBookableServiceSuccessSchema,
  ManageBookableServiceErrorSchema,
]);

export type ManageBookableServiceResult = z.infer<typeof ManageBookableServiceResultSchema>;

/**
 * Result for list_bookable_services tool
 */
export const ListBookableServicesResultSchema = z.object({
  success: z.literal(true),
  services: z.array(BookableServiceSchema),
  tenantTimezone: z.string(),
});

export type ListBookableServicesResult = z.infer<typeof ListBookableServicesResultSchema>;

/**
 * Success result for manage_working_hours
 */
export const ManageWorkingHoursSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal('updated'),
  workingHours: WeeklyWorkingHoursSchema,
  timezone: z.string(),
});

export const ManageWorkingHoursResultSchema = z.union([
  ManageWorkingHoursSuccessSchema,
  z.object({
    success: z.literal(false),
    error: z.literal('VALIDATION_ERROR'),
    message: z.string(),
  }),
]);

export type ManageWorkingHoursResult = z.infer<typeof ManageWorkingHoursResultSchema>;

/**
 * Success result for manage_date_overrides
 */
export const ManageDateOverridesSuccessSchema = z.object({
  success: z.literal(true),
  action: z.enum(['added', 'removed', 'cleared']),
  affectedDates: z.array(z.string().date()),
});

export const ManageDateOverridesResultSchema = z.union([
  ManageDateOverridesSuccessSchema,
  z.object({
    success: z.literal(false),
    error: z.literal('VALIDATION_ERROR'),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('DATE_NOT_FOUND'),
    date: z.string(),
  }),
]);

export type ManageDateOverridesResult = z.infer<typeof ManageDateOverridesResultSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a URL-safe slug from a service name
 */
export function generateServiceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Build the booking URL for a service
 */
export function buildBookingUrl(
  tenantSlug: string,
  serviceSlug: string,
  customDomain?: string
): string {
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'https://gethandled.ai'}/t/${tenantSlug}`;
  return `${baseUrl}/book/${serviceSlug}`;
}

/**
 * Validate time range (start < end)
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);
  const startHour = startParts[0] ?? 0;
  const startMin = startParts[1] ?? 0;
  const endHour = endParts[0] ?? 0;
  const endMin = endParts[1] ?? 0;
  return startHour * 60 + startMin < endHour * 60 + endMin;
}

/**
 * Default working hours (Mon-Fri 9am-5pm)
 */
export const DEFAULT_WORKING_HOURS: WorkingHoursEntry[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }, // Monday
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true }, // Tuesday
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true }, // Wednesday
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true }, // Thursday
  { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true }, // Friday
  { dayOfWeek: 6, startTime: '09:00', endTime: '12:00', isActive: false }, // Saturday (off)
  { dayOfWeek: 0, startTime: '09:00', endTime: '12:00', isActive: false }, // Sunday (off)
];
