/**
 * Executor Payload Schemas
 *
 * Zod schemas for validating proposal payloads before execution.
 * Prevents runtime errors and security issues from malformed/malicious payloads.
 *
 * Each schema matches the expected payload shape for its corresponding executor.
 * Schemas accept both old and new field names for backward compatibility.
 */

import { z } from 'zod';
import {
  SectionSchema,
  PAGE_NAMES,
  type PageName,
  type Section,
  type LandingPageConfig,
  type PagesConfig,
  type PageConfig,
  DEFAULT_PAGES_CONFIG,
} from '@macon/contracts';

// ============================================================================
// Shared Constants
// ============================================================================

/**
 * Maximum price in cents: $999,999.99 = 99999999 cents
 * Aligned with Stripe's maximum amount for most currencies
 */
const MAX_PRICE_CENTS = 99999999;

/**
 * Hex color validation regex
 */
const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format');

/**
 * ISO date string validation (YYYY-MM-DD)
 */
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

/**
 * Time string validation (HH:MM)
 */
const TimeStringSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be HH:MM format');

// ============================================================================
// Package Executor Schemas
// ============================================================================

/**
 * upsert_package executor payload
 * Accepts both 'title' (old) and 'name' (new) field names
 * Accepts both 'priceCents' (old) and 'basePrice' (new) field names
 */
export const UpsertPackagePayloadSchema = z
  .object({
    packageId: z.string().optional(),
    slug: z.string().min(1).max(100).optional(),
    // Support both field names
    title: z.string().min(1).max(200).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    // Support both price field names
    priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).optional(),
    basePrice: z.number().int().min(0).max(MAX_PRICE_CENTS).optional(),
    photoUrl: z.string().url().optional(),
    bookingType: z.enum(['DATE', 'TIMESLOT']).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.name || data.title, {
    message: 'Either name or title is required',
  })
  .refine((data) => data.basePrice !== undefined || data.priceCents !== undefined, {
    message: 'Either basePrice or priceCents is required',
  });

export type UpsertPackagePayload = z.infer<typeof UpsertPackagePayloadSchema>;

/**
 * delete_package executor payload
 */
export const DeletePackagePayloadSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
});

export type DeletePackagePayload = z.infer<typeof DeletePackagePayloadSchema>;

// ============================================================================
// Blackout Date Executor Schemas
// ============================================================================

/**
 * manage_blackout executor payload (legacy - create or delete single date)
 */
export const ManageBlackoutPayloadSchema = z.object({
  action: z.enum(['create', 'delete']),
  date: DateStringSchema,
  reason: z.string().max(500).optional(),
});

export type ManageBlackoutPayload = z.infer<typeof ManageBlackoutPayloadSchema>;

/**
 * add_blackout_date executor payload (batch create)
 */
export const AddBlackoutDatePayloadSchema = z.object({
  dates: z.array(DateStringSchema),
  newDates: z.array(DateStringSchema),
  reason: z.string().max(500).nullable(),
  isRange: z.boolean(),
  startDate: DateStringSchema,
  endDate: DateStringSchema,
});

export type AddBlackoutDatePayload = z.infer<typeof AddBlackoutDatePayloadSchema>;

/**
 * remove_blackout_date executor payload
 */
export const RemoveBlackoutDatePayloadSchema = z.object({
  blackoutId: z.string().min(1, 'Blackout ID is required'),
  date: DateStringSchema,
});

export type RemoveBlackoutDatePayload = z.infer<typeof RemoveBlackoutDatePayloadSchema>;

// ============================================================================
// Branding & Landing Page Executor Schemas
// ============================================================================

/**
 * update_branding executor payload
 */
export const UpdateBrandingPayloadSchema = z.object({
  primaryColor: HexColorSchema.optional(),
  secondaryColor: HexColorSchema.optional(),
  accentColor: HexColorSchema.optional(),
  backgroundColor: HexColorSchema.optional(),
  logoUrl: z.string().url().optional(),
});

export type UpdateBrandingPayload = z.infer<typeof UpdateBrandingPayloadSchema>;

/**
 * update_landing_page executor payload
 */
export const UpdateLandingPagePayloadSchema = z.object({
  hero: z.record(z.unknown()).optional(),
  about: z.record(z.unknown()).optional(),
  testimonials: z.record(z.unknown()).optional(),
  gallery: z.record(z.unknown()).optional(),
  faq: z.record(z.unknown()).optional(),
  sections: z.record(z.unknown()).optional(),
});

export type UpdateLandingPagePayload = z.infer<typeof UpdateLandingPagePayloadSchema>;

// ============================================================================
// Add-On Executor Schemas
// ============================================================================

/**
 * upsert_addon executor payload
 */
export const UpsertAddonPayloadSchema = z.object({
  addOnId: z.string().optional(),
  slug: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0).max(MAX_PRICE_CENTS),
  segmentId: z.string().optional(),
  active: z.boolean().optional(),
});

export type UpsertAddonPayload = z.infer<typeof UpsertAddonPayloadSchema>;

/**
 * delete_addon executor payload
 */
export const DeleteAddonPayloadSchema = z.object({
  addOnId: z.string().min(1, 'Add-on ID is required'),
});

export type DeleteAddonPayload = z.infer<typeof DeleteAddonPayloadSchema>;

// ============================================================================
// Booking Executor Schemas
// ============================================================================

/**
 * cancel_booking executor payload
 */
export const CancelBookingPayloadSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reason: z.string().max(500).optional(),
});

export type CancelBookingPayload = z.infer<typeof CancelBookingPayloadSchema>;

/**
 * create_booking executor payload
 */
export const CreateBookingPayloadSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  date: DateStringSchema,
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  totalPrice: z.number().int().min(0).max(MAX_PRICE_CENTS),
});

export type CreateBookingPayload = z.infer<typeof CreateBookingPayloadSchema>;

/**
 * update_booking executor payload
 */
export const UpdateBookingPayloadSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  newDate: DateStringSchema.optional(),
  newTime: TimeStringSchema.optional(),
  notes: z.string().max(1000).optional(),
  status: z
    .enum(['PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED'])
    .optional(),
  notifyCustomer: z.boolean().optional(),
});

export type UpdateBookingPayload = z.infer<typeof UpdateBookingPayloadSchema>;

/**
 * process_refund executor payload
 */
export const ProcessRefundPayloadSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  refundAmount: z.number().int().min(1).max(MAX_PRICE_CENTS),
  isFullRefund: z.boolean(),
  reason: z.string().min(1).max(500),
});

export type ProcessRefundPayload = z.infer<typeof ProcessRefundPayloadSchema>;

// ============================================================================
// Segment Executor Schemas
// ============================================================================

/**
 * upsert_segment executor payload
 */
export const UpsertSegmentPayloadSchema = z.object({
  segmentId: z.string().optional(),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  heroTitle: z.string().min(1).max(200),
  heroSubtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type UpsertSegmentPayload = z.infer<typeof UpsertSegmentPayloadSchema>;

/**
 * delete_segment executor payload
 */
export const DeleteSegmentPayloadSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID is required'),
});

export type DeleteSegmentPayload = z.infer<typeof DeleteSegmentPayloadSchema>;

// ============================================================================
// Tenant Settings Executor Schemas
// ============================================================================

/**
 * update_deposit_settings executor payload
 */
export const UpdateDepositSettingsPayloadSchema = z.object({
  depositPercent: z.number().min(0).max(100).nullable().optional(),
  balanceDueDays: z.number().int().min(1).max(90).optional(),
});

export type UpdateDepositSettingsPayload = z.infer<typeof UpdateDepositSettingsPayloadSchema>;

/**
 * start_trial executor payload
 */
export const StartTrialPayloadSchema = z.object({
  trialEndsAt: z.string().datetime({ message: 'Trial end date must be a valid ISO datetime' }),
});

export type StartTrialPayload = z.infer<typeof StartTrialPayloadSchema>;

/**
 * initiate_stripe_onboarding executor payload
 */
export const InitiateStripeOnboardingPayloadSchema = z.object({
  email: z.string().email(),
  businessName: z.string().max(100).nullable(),
  hasExistingAccount: z.boolean(),
});

export type InitiateStripeOnboardingPayload = z.infer<typeof InitiateStripeOnboardingPayloadSchema>;

// ============================================================================
// Storefront Build Mode Executor Schemas
// ============================================================================

/**
 * update_page_section executor payload
 * Updates or adds a section on a tenant's landing page draft
 */
export const UpdatePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  sectionIndex: z.number().int().min(-1), // -1 = append
  sectionData: SectionSchema,
});

export type UpdatePageSectionPayload = z.infer<typeof UpdatePageSectionPayloadSchema>;

/**
 * remove_page_section executor payload
 */
export const RemovePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  sectionIndex: z.number().int().min(0),
});

export type RemovePageSectionPayload = z.infer<typeof RemovePageSectionPayloadSchema>;

/**
 * reorder_page_sections executor payload
 */
export const ReorderPageSectionsPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

export type ReorderPageSectionsPayload = z.infer<typeof ReorderPageSectionsPayloadSchema>;

/**
 * toggle_page_enabled executor payload
 */
export const TogglePageEnabledPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  enabled: z.boolean(),
});

export type TogglePageEnabledPayload = z.infer<typeof TogglePageEnabledPayloadSchema>;

/**
 * update_storefront_branding executor payload
 */
export const UpdateStorefrontBrandingPayloadSchema = z.object({
  primaryColor: HexColorSchema.optional(),
  secondaryColor: HexColorSchema.optional(),
  accentColor: HexColorSchema.optional(),
  backgroundColor: HexColorSchema.optional(),
  fontFamily: z.string().max(100).optional(),
  logoUrl: z.string().url().max(2048).optional(),
});

export type UpdateStorefrontBrandingPayload = z.infer<typeof UpdateStorefrontBrandingPayloadSchema>;

/**
 * publish_draft executor payload
 */
export const PublishDraftPayloadSchema = z.object({
  // No payload needed - publishes current draft
});

export type PublishDraftPayload = z.infer<typeof PublishDraftPayloadSchema>;

/**
 * discard_draft executor payload
 */
export const DiscardDraftPayloadSchema = z.object({
  // No payload needed - discards current draft
});

export type DiscardDraftPayload = z.infer<typeof DiscardDraftPayloadSchema>;

// ============================================================================
// Customer Booking Executor Schemas
// ============================================================================

/**
 * create_customer_booking executor payload (T3 - customer-facing)
 */
export const CreateCustomerBookingPayloadSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  date: DateStringSchema,
  notes: z.string().max(1000).nullable(),
  totalPrice: z.number().int().min(0).max(MAX_PRICE_CENTS),
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
});

export type CreateCustomerBookingPayload = z.infer<typeof CreateCustomerBookingPayloadSchema>;

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Map of tool names to their payload schemas
 * Used by validateExecutorPayload() for dynamic validation
 */
export const executorSchemaRegistry: Record<string, z.ZodType<unknown>> = {
  // Package operations
  upsert_package: UpsertPackagePayloadSchema,
  delete_package: DeletePackagePayloadSchema,

  // Blackout operations
  manage_blackout: ManageBlackoutPayloadSchema,
  add_blackout_date: AddBlackoutDatePayloadSchema,
  remove_blackout_date: RemoveBlackoutDatePayloadSchema,

  // Branding operations
  update_branding: UpdateBrandingPayloadSchema,
  update_landing_page: UpdateLandingPagePayloadSchema,

  // Add-on operations
  upsert_addon: UpsertAddonPayloadSchema,
  delete_addon: DeleteAddonPayloadSchema,

  // Booking operations
  cancel_booking: CancelBookingPayloadSchema,
  create_booking: CreateBookingPayloadSchema,
  update_booking: UpdateBookingPayloadSchema,
  process_refund: ProcessRefundPayloadSchema,

  // Segment operations
  upsert_segment: UpsertSegmentPayloadSchema,
  delete_segment: DeleteSegmentPayloadSchema,

  // Tenant settings
  update_deposit_settings: UpdateDepositSettingsPayloadSchema,
  start_trial: StartTrialPayloadSchema,
  initiate_stripe_onboarding: InitiateStripeOnboardingPayloadSchema,

  // Customer-facing operations (T3)
  create_customer_booking: CreateCustomerBookingPayloadSchema,

  // Storefront Build Mode operations
  update_page_section: UpdatePageSectionPayloadSchema,
  remove_page_section: RemovePageSectionPayloadSchema,
  reorder_page_sections: ReorderPageSectionsPayloadSchema,
  toggle_page_enabled: TogglePageEnabledPayloadSchema,
  update_storefront_branding: UpdateStorefrontBrandingPayloadSchema,
  publish_draft: PublishDraftPayloadSchema,
  discard_draft: DiscardDraftPayloadSchema,
};

/**
 * Validate an executor payload against its schema
 *
 * @param toolName - Name of the tool/executor
 * @param payload - Raw payload from the database
 * @returns Parsed/validated payload
 * @throws Error with descriptive message if validation fails
 */
export function validateExecutorPayload(
  toolName: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const schema = executorSchemaRegistry[toolName];

  if (!schema) {
    // No schema registered - log warning but allow execution
    // This provides backward compatibility for executors without schemas
    return payload;
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Invalid payload for ${toolName}: ${errors}`);
  }

  return result.data as Record<string, unknown>;
}

/**
 * Check if a schema exists for a tool
 */
export function hasExecutorSchema(toolName: string): boolean {
  return toolName in executorSchemaRegistry;
}

// ============================================================================
// Re-exports for Landing Page Types (used by storefront tools/executors)
// ============================================================================

export {
  SectionSchema,
  PAGE_NAMES,
  DEFAULT_PAGES_CONFIG,
  type PageName,
  type Section,
  type LandingPageConfig,
  type PagesConfig,
  type PageConfig,
} from '@macon/contracts';
