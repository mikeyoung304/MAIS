/**
 * API v1 contract definition using ts-rest
 */

import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  TierDtoSchema,
  AvailabilityDtoSchema,
  CreateCheckoutDtoSchema,
  CreateDateBookingDtoSchema,
  TenantSignupDtoSchema,
  TenantSignupResponseSchema,
  ForgotPasswordDtoSchema,
  ResetPasswordDtoSchema,
  EarlyAccessRequestDtoSchema,
  EarlyAccessResponseDtoSchema,
  BookingDtoSchema,
  PlatformBookingsResponseSchema,
  CreateAddOnDtoSchema,
  UpdateAddOnDtoSchema,
  AddOnDtoSchema,
  TenantBrandingDtoSchema,
  UpdateBrandingDtoSchema,
  LogoUploadResponseDtoSchema,
  BlackoutDtoSchema,
  CreateBlackoutDtoSchema,
  TenantDtoSchema,
  SegmentDtoSchema,
  CreateSegmentDtoSchema,
  UpdateSegmentDtoSchema,
  CreateTenantDtoSchema,
  CreateTenantResponseDtoSchema,
  UpdateTenantDtoSchema,
  TenantDetailDtoSchema,
  PlatformStatsSchema,
  StripeAccountStatusDtoSchema,
  // Scheduling DTOs
  ServiceDtoSchema,
  PublicServiceDtoSchema,
  CreateServiceDtoSchema,
  UpdateServiceDtoSchema,
  AvailabilityRuleDtoSchema,
  CreateAvailabilityRuleDtoSchema,
  UpdateAvailabilityRuleDtoSchema,
  TimeSlotDtoSchema,
  AvailableSlotsQuerySchema,
  CustomerDtoSchema,
  AppointmentDtoSchema,
  CreateAppointmentCheckoutDtoSchema,
  AppointmentCheckoutResponseDtoSchema,
  // Public tenant DTO (for storefront routing)
  TenantPublicDtoSchema,
  // Booking Management DTOs (MVP Gaps Phase 1)
  RescheduleBookingDtoSchema,
  CancelBookingDtoSchema,
  BookingManagementDtoSchema,
  PublicBookingDetailsDtoSchema,
  // Reminder DTOs (MVP Gaps Phase 2)
  ReminderStatusResponseSchema,
  ProcessRemindersResponseSchema,
  // Calendar DTOs (MVP Gaps Phase 3)
  CalendarStatusResponseSchema,
  CalendarConfigInputSchema,
  CalendarTestResponseSchema,
  // Deposit DTOs (MVP Gaps Phase 4)
  DepositSettingsDtoSchema,
  UpdateDepositSettingsDtoSchema,
  // Shared validation schemas
  SlugSchema,
  PaginatedQuerySchema,
  createPaginatedResponseSchema,
  // Error response schemas
  BadRequestErrorSchema,
  UnauthorizedErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  TooManyRequestsErrorSchema,
  UnprocessableEntityErrorSchema,
  InternalServerErrorSchema,
} from './dto';

const c = initContract();

export const Contracts = c.router({
  // Public endpoints
  getTiers: {
    method: 'GET',
    path: '/v1/tiers',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(TierDtoSchema),
      400: BadRequestErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all tiers',
  },

  getTierBySlug: {
    method: 'GET',
    path: '/v1/tiers/:slug',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: TierDtoSchema,
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get tier by slug',
  },

  getAvailability: {
    method: 'GET',
    path: '/v1/availability',
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    responses: {
      200: AvailabilityDtoSchema,
      400: BadRequestErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Check availability for a date',
  },

  getUnavailableDates: {
    method: 'GET',
    path: '/v1/availability/unavailable',
    query: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    responses: {
      200: z.object({
        dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      }),
      400: BadRequestErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all unavailable dates in a date range (batch query)',
  },

  createCheckout: {
    method: 'POST',
    path: '/v1/bookings/checkout',
    body: CreateCheckoutDtoSchema,
    responses: {
      200: z.object({
        checkoutUrl: z.string(),
      }),
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a checkout session',
  },

  getBookingById: {
    method: 'GET',
    path: '/v1/bookings/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: BookingDtoSchema,
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get booking by ID (public endpoint for confirmation)',
  },

  getTenantBranding: {
    method: 'GET',
    path: '/v1/tenant/branding',
    responses: {
      200: TenantBrandingDtoSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get tenant branding configuration for widget customization',
  },

  // Webhook endpoint (raw body)
  stripeWebhook: {
    method: 'POST',
    path: '/v1/webhooks/stripe',
    // z.any() justified: Stripe webhook requires raw body for signature verification — ts-rest doesn't support Buffer types
    body: z.any(),
    responses: {
      204: z.void(),
      400: BadRequestErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Handle Stripe webhook (raw body)',
  },

  // Tenant self-service signup
  tenantSignup: {
    method: 'POST',
    path: '/v1/auth/signup',
    body: TenantSignupDtoSchema,
    responses: {
      201: TenantSignupResponseSchema,
      400: BadRequestErrorSchema,
      409: ConflictErrorSchema, // Email already exists
      429: TooManyRequestsErrorSchema, // Rate limited
      500: InternalServerErrorSchema,
    },
    summary: 'Self-service tenant signup',
  },

  // Password reset - request reset link
  forgotPassword: {
    method: 'POST',
    path: '/v1/auth/forgot-password',
    body: ForgotPasswordDtoSchema,
    responses: {
      200: z.object({
        message: z.string(),
      }),
      400: BadRequestErrorSchema,
      429: TooManyRequestsErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Request password reset email',
  },

  // Password reset - set new password
  resetPassword: {
    method: 'POST',
    path: '/v1/auth/reset-password',
    body: ResetPasswordDtoSchema,
    responses: {
      200: z.object({
        message: z.string(),
      }),
      400: BadRequestErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Reset password with token',
  },

  // Early access request
  requestEarlyAccess: {
    method: 'POST',
    path: '/v1/auth/early-access',
    body: EarlyAccessRequestDtoSchema,
    responses: {
      200: EarlyAccessResponseDtoSchema,
      400: BadRequestErrorSchema,
      429: TooManyRequestsErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Request early access notification',
  },

  // ============================================================================
  // Public Tenant Lookup (for storefront routing)
  // ============================================================================

  /**
   * Get public tenant info by slug (for storefront routing)
   * Used by customer-facing storefronts to resolve tenant from URL
   * Returns ONLY safe public fields - never secrets, Stripe IDs, or PII
   */
  getTenantPublic: {
    method: 'GET',
    path: '/v1/public/tenants/:slug',
    pathParams: z.object({
      slug: SlugSchema,
    }),
    responses: {
      200: TenantPublicDtoSchema,
      404: NotFoundErrorSchema,
      429: TooManyRequestsErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get public tenant info by slug (for storefront routing)',
  },

  // ============================================================================
  // Tenant Admin Branding Endpoints
  // ============================================================================

  tenantAdminUploadLogo: {
    method: 'POST',
    path: '/v1/tenant-admin/logo',
    // z.any() justified: File upload requires multipart/form-data — ts-rest doesn't handle multipart parsing
    body: z.any(),
    responses: {
      200: LogoUploadResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Upload logo for tenant (requires tenant admin authentication)',
  },

  tenantAdminGetBranding: {
    method: 'GET',
    path: '/v1/tenant-admin/branding',
    responses: {
      200: TenantBrandingDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get tenant branding configuration (requires tenant admin authentication)',
  },

  tenantAdminUpdateBranding: {
    method: 'PUT',
    path: '/v1/tenant-admin/branding',
    body: UpdateBrandingDtoSchema,
    responses: {
      200: TenantBrandingDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update tenant branding (requires tenant admin authentication)',
  },

  // Tenant Admin Package/Draft Endpoints — DELETED in Phase 2 (Package→Tier migration)
  // Tier CRUD is handled by tenant-admin-tiers routes (already exist)
  // Draft system replaced by AI agent + SectionContent pattern

  // ============================================================================
  // Tenant Admin Blackout Endpoints
  // ============================================================================

  tenantAdminGetBlackouts: {
    method: 'GET',
    path: '/v1/tenant-admin/blackouts',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(BlackoutDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all blackout dates for tenant (requires tenant admin authentication)',
  },

  tenantAdminCreateBlackout: {
    method: 'POST',
    path: '/v1/tenant-admin/blackouts',
    body: CreateBlackoutDtoSchema,
    responses: {
      201: z.object({
        ok: z.literal(true),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create blackout date (requires tenant admin authentication)',
  },

  tenantAdminDeleteBlackout: {
    method: 'DELETE',
    path: '/v1/tenant-admin/blackouts/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete blackout date (requires tenant admin authentication)',
  },

  // ============================================================================
  // Tenant Admin Booking Endpoints
  // ============================================================================

  tenantAdminGetBookings: {
    method: 'GET',
    path: '/v1/tenant-admin/bookings',
    query: z
      .object({
        status: z
          .enum([
            'PENDING',
            'DEPOSIT_PAID',
            'PAID',
            'CONFIRMED',
            'CANCELED',
            'REFUNDED',
            'FULFILLED',
          ])
          .optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .merge(PaginatedQuerySchema)
      .optional(),
    responses: {
      200: createPaginatedResponseSchema(BookingDtoSchema),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary:
      'Get all bookings for tenant with optional filters (requires tenant admin authentication)',
  },

  platformGetAllTenants: {
    method: 'GET',
    path: '/v1/admin/tenants',
    query: z
      .object({
        includeTest: z.enum(['true', 'false']).optional().default('false'),
      })
      .merge(PaginatedQuerySchema)
      .optional(),
    responses: {
      200: createPaginatedResponseSchema(TenantDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all tenants (requires platform admin authentication)',
  },

  platformCreateTenant: {
    method: 'POST',
    path: '/v1/admin/tenants',
    body: CreateTenantDtoSchema,
    responses: {
      201: CreateTenantResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create new tenant (requires platform admin authentication)',
  },

  platformGetTenant: {
    method: 'GET',
    path: '/v1/admin/tenants/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: TenantDetailDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get tenant details (requires platform admin authentication)',
  },

  platformUpdateTenant: {
    method: 'PUT',
    path: '/v1/admin/tenants/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateTenantDtoSchema,
    responses: {
      200: TenantDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update tenant (requires platform admin authentication)',
  },

  platformDeleteTenant: {
    method: 'DELETE',
    path: '/v1/admin/tenants/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Deactivate tenant (requires platform admin authentication)',
  },

  platformGetStats: {
    method: 'GET',
    path: '/v1/admin/stats',
    query: z
      .object({
        includeTest: z.enum(['true', 'false']).optional().default('false'),
      })
      .optional(),
    responses: {
      200: PlatformStatsSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get platform-wide statistics (requires platform admin authentication)',
  },

  adminGetBookings: {
    method: 'GET',
    path: '/v1/admin/bookings',
    query: z
      .object({
        cursor: z.string().optional(), // Pagination cursor (booking ID)
      })
      .optional(),
    responses: {
      200: PlatformBookingsResponseSchema, // Updated: now returns paginated response with tenant info
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all bookings across all tenants (requires platform admin authentication)',
  },

  adminGetBlackouts: {
    method: 'GET',
    path: '/v1/admin/blackouts',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reason: z.string().optional(),
        })
      ),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all blackout dates (requires authentication)',
  },

  adminCreateBlackout: {
    method: 'POST',
    path: '/v1/admin/blackouts',
    body: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().optional(),
    }),
    responses: {
      201: z.object({
        ok: z.literal(true),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a blackout date (requires authentication)',
  },

  // Admin Package CRUD endpoints — DELETED in Phase 2 (Package→Tier migration)
  // Use tenant-admin tier endpoints instead

  // Admin AddOn CRUD endpoints
  adminCreateAddOn: {
    method: 'POST',
    path: '/v1/admin/tiers/:tierId/addons',
    pathParams: z.object({
      tierId: z.string(),
    }),
    body: CreateAddOnDtoSchema,
    responses: {
      201: AddOnDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a new add-on for a package (requires authentication)',
  },

  adminUpdateAddOn: {
    method: 'PUT',
    path: '/v1/admin/addons/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateAddOnDtoSchema,
    responses: {
      200: AddOnDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update an add-on (requires authentication)',
  },

  adminDeleteAddOn: {
    method: 'DELETE',
    path: '/v1/admin/addons/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete an add-on (requires authentication)',
  },

  // Tenant Admin Segment CRUD endpoints
  tenantAdminGetSegments: {
    method: 'GET',
    path: '/v1/tenant-admin/segments',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(SegmentDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all segments for tenant (requires tenant admin authentication)',
  },

  tenantAdminCreateSegment: {
    method: 'POST',
    path: '/v1/tenant-admin/segments',
    body: CreateSegmentDtoSchema,
    responses: {
      201: SegmentDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a new segment (requires tenant admin authentication)',
  },

  tenantAdminGetSegment: {
    method: 'GET',
    path: '/v1/tenant-admin/segments/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: SegmentDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment by ID (requires tenant admin authentication)',
  },

  tenantAdminUpdateSegment: {
    method: 'PUT',
    path: '/v1/tenant-admin/segments/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateSegmentDtoSchema,
    responses: {
      200: SegmentDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update a segment (requires tenant admin authentication)',
  },

  tenantAdminDeleteSegment: {
    method: 'DELETE',
    path: '/v1/tenant-admin/segments/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete a segment (requires tenant admin authentication)',
  },

  tenantAdminGetSegmentStats: {
    method: 'GET',
    path: '/v1/tenant-admin/segments/:id/stats',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: z.object({
        tierCount: z.number().int(),
        addOnCount: z.number().int(),
      }),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment statistics (requires tenant admin authentication)',
  },

  // ============================================================================
  // Tenant Admin Add-On CRUD Endpoints
  // ============================================================================

  /**
   * Get all add-ons for tenant
   * GET /v1/tenant-admin/addons
   */
  tenantAdminGetAddOns: {
    method: 'GET',
    path: '/v1/tenant-admin/addons',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(AddOnDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all add-ons for tenant (requires tenant admin authentication)',
  },

  /**
   * Get single add-on by ID
   * GET /v1/tenant-admin/addons/:id
   */
  tenantAdminGetAddOnById: {
    method: 'GET',
    path: '/v1/tenant-admin/addons/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: AddOnDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get single add-on by ID (requires tenant admin authentication)',
  },

  /**
   * Create a new add-on
   * POST /v1/tenant-admin/addons
   */
  tenantAdminCreateAddOn: {
    method: 'POST',
    path: '/v1/tenant-admin/addons',
    body: CreateAddOnDtoSchema,
    responses: {
      201: AddOnDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a new add-on (requires tenant admin authentication)',
  },

  /**
   * Update an add-on
   * PUT /v1/tenant-admin/addons/:id
   */
  tenantAdminUpdateAddOn: {
    method: 'PUT',
    path: '/v1/tenant-admin/addons/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateAddOnDtoSchema,
    responses: {
      200: AddOnDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update an add-on (requires tenant admin authentication)',
  },

  /**
   * Delete an add-on
   * DELETE /v1/tenant-admin/addons/:id
   */
  tenantAdminDeleteAddOn: {
    method: 'DELETE',
    path: '/v1/tenant-admin/addons/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete an add-on (requires tenant admin authentication)',
  },

  // =========================================================================
  // PUBLIC SEGMENT ENDPOINTS (for customer-facing storefront)
  // Requires X-Tenant-Key header for tenant context
  // =========================================================================

  /**
   * Get all active segments for the tenant
   * Used on home page to show segment selector
   */
  getSegments: {
    method: 'GET',
    path: '/v1/segments',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(SegmentDtoSchema),
      401: UnauthorizedErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all active segments (public, requires X-Tenant-Key)',
  },

  /**
   * Get segment metadata by slug
   * Used for segment landing page hero section
   */
  getSegmentBySlug: {
    method: 'GET',
    path: '/v1/segments/:slug',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: SegmentDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment by slug (public, requires X-Tenant-Key)',
  },

  /**
   * Get segment with tiers and add-ons
   * Used for segment landing page to display filtered tiers
   */
  getSegmentWithTiers: {
    method: 'GET',
    path: '/v1/segments/:slug/tiers',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: SegmentDtoSchema.extend({
        tiers: z.array(TierDtoSchema),
        addOns: z.array(AddOnDtoSchema),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment with tiers (public, requires X-Tenant-Key)',
  },

  // =========================================================================
  // TENANT ADMIN STRIPE CONNECT ENDPOINTS
  // =========================================================================

  /**
   * Create Stripe Connect account for authenticated tenant
   * POST /v1/tenant-admin/stripe/connect
   */
  tenantAdminCreateStripeAccount: {
    method: 'POST',
    path: '/v1/tenant-admin/stripe/connect',
    body: z.object({
      email: z.string().email(),
      businessName: z.string().min(2),
      country: z.string().length(2).default('US'),
    }),
    responses: {
      201: z.object({
        accountId: z.string(),
        message: z.string(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema, // Account already exists
      500: InternalServerErrorSchema,
    },
    summary: 'Create Stripe Connect account for tenant (requires tenant admin authentication)',
  },

  /**
   * Get Stripe Connect onboarding link for authenticated tenant
   * POST /v1/tenant-admin/stripe/onboard
   */
  tenantAdminGetStripeOnboardingLink: {
    method: 'POST',
    path: '/v1/tenant-admin/stripe/onboard',
    body: z.object({
      refreshUrl: z.string().url(),
      returnUrl: z.string().url(),
    }),
    responses: {
      200: z.object({
        url: z.string().url(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema, // No Stripe account exists
      500: InternalServerErrorSchema,
    },
    summary: 'Generate Stripe Connect onboarding link (requires tenant admin authentication)',
  },

  /**
   * Get Stripe Connect account status for authenticated tenant
   * GET /v1/tenant-admin/stripe/status
   */
  tenantAdminGetStripeStatus: {
    method: 'GET',
    path: '/v1/tenant-admin/stripe/status',
    responses: {
      200: StripeAccountStatusDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema, // No Stripe account exists
      500: InternalServerErrorSchema,
    },
    summary: 'Get Stripe Connect account status (requires tenant admin authentication)',
  },

  /**
   * Get Stripe Express dashboard login link for authenticated tenant
   * POST /v1/tenant-admin/stripe/dashboard
   */
  tenantAdminGetStripeDashboardLink: {
    method: 'POST',
    path: '/v1/tenant-admin/stripe/dashboard',
    body: z.undefined(),
    responses: {
      200: z.object({
        url: z.string().url(),
      }),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get Stripe Express dashboard login link (requires tenant admin authentication)',
  },

  // =========================================================================
  // PUBLIC SCHEDULING ENDPOINTS (Customer-facing)
  // Requires X-Tenant-Key header for tenant context
  // =========================================================================

  /**
   * Get all active services for a tenant
   * GET /v1/public/services
   */
  getServices: {
    method: 'GET',
    path: '/v1/public/services',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(PublicServiceDtoSchema),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all active services (public, requires X-Tenant-Key)',
  },

  /**
   * Get service details by slug
   * GET /v1/public/services/:slug
   */
  getServiceBySlug: {
    method: 'GET',
    path: '/v1/public/services/:slug',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: PublicServiceDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get service by slug (public, requires X-Tenant-Key)',
  },

  /**
   * Get available time slots for a service on a specific date
   * GET /v1/public/availability/slots?serviceId=xxx&date=2025-11-27
   */
  getAvailableSlots: {
    method: 'GET',
    path: '/v1/public/availability/slots',
    query: AvailableSlotsQuerySchema,
    responses: {
      200: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        serviceId: z.string(),
        timezone: z.string(),
        slots: z.array(TimeSlotDtoSchema),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get available time slots for a service on a date (public, requires X-Tenant-Key)',
  },

  /**
   * Create a checkout session for booking an appointment time slot
   * POST /v1/public/appointments/checkout
   *
   * Public endpoint for customers to book appointments.
   * Creates a Stripe checkout session and returns the checkout URL.
   * The slot will be reserved upon successful payment.
   */
  createAppointmentCheckout: {
    method: 'POST',
    path: '/v1/public/appointments/checkout',
    body: CreateAppointmentCheckoutDtoSchema,
    responses: {
      201: AppointmentCheckoutResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema, // Missing or invalid X-Tenant-Key
      404: NotFoundErrorSchema, // Service not found
      409: ConflictErrorSchema, // Time slot no longer available
      500: InternalServerErrorSchema,
    },
    summary: 'Create checkout session for appointment booking (public, requires X-Tenant-Key)',
  },

  /**
   * Create a checkout session for DATE booking type tiers
   * POST /v1/public/bookings/date
   *
   * Public endpoint for customers to book DATE tiers (e.g., weddings).
   * Creates a Stripe checkout session and returns the checkout URL.
   * Validates tier is DATE type, date is available, and deposit is valid.
   */
  createDateBooking: {
    method: 'POST',
    path: '/v1/public/bookings/date',
    body: CreateDateBookingDtoSchema,
    responses: {
      200: z.object({
        checkoutUrl: z.string().url(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema, // Missing or invalid X-Tenant-Key
      404: NotFoundErrorSchema, // Tier not found
      409: ConflictErrorSchema, // Date already booked
      500: InternalServerErrorSchema,
    },
    summary: 'Create checkout session for DATE booking (public, requires X-Tenant-Key)',
  },

  // =========================================================================
  // TENANT ADMIN SCHEDULING ENDPOINTS
  // Requires tenant admin authentication
  // =========================================================================

  /**
   * Get all services for authenticated tenant
   * GET /v1/tenant-admin/services
   */
  tenantAdminGetServices: {
    method: 'GET',
    path: '/v1/tenant-admin/services',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(ServiceDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all services for tenant (requires tenant admin authentication)',
  },

  /**
   * Create a new service
   * POST /v1/tenant-admin/services
   */
  tenantAdminCreateService: {
    method: 'POST',
    path: '/v1/tenant-admin/services',
    body: CreateServiceDtoSchema,
    responses: {
      201: ServiceDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create new service (requires tenant admin authentication)',
  },

  /**
   * Update a service
   * PUT /v1/tenant-admin/services/:id
   */
  tenantAdminUpdateService: {
    method: 'PUT',
    path: '/v1/tenant-admin/services/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateServiceDtoSchema,
    responses: {
      200: ServiceDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update service (requires tenant admin authentication)',
  },

  /**
   * Delete a service
   * DELETE /v1/tenant-admin/services/:id
   */
  tenantAdminDeleteService: {
    method: 'DELETE',
    path: '/v1/tenant-admin/services/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete service (requires tenant admin authentication)',
  },

  /**
   * Get all availability rules for authenticated tenant
   * GET /v1/tenant-admin/availability-rules
   */
  tenantAdminGetAvailabilityRules: {
    method: 'GET',
    path: '/v1/tenant-admin/availability-rules',
    query: z
      .object({
        serviceId: z.string().optional(), // Filter by service
      })
      .merge(PaginatedQuerySchema)
      .optional(),
    responses: {
      200: createPaginatedResponseSchema(AvailabilityRuleDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all availability rules for tenant (requires tenant admin authentication)',
  },

  /**
   * Create a new availability rule
   * POST /v1/tenant-admin/availability-rules
   */
  tenantAdminCreateAvailabilityRule: {
    method: 'POST',
    path: '/v1/tenant-admin/availability-rules',
    body: CreateAvailabilityRuleDtoSchema,
    responses: {
      201: AvailabilityRuleDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create availability rule (requires tenant admin authentication)',
  },

  /**
   * Update an availability rule
   * PUT /v1/tenant-admin/availability-rules/:id
   */
  tenantAdminUpdateAvailabilityRule: {
    method: 'PUT',
    path: '/v1/tenant-admin/availability-rules/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdateAvailabilityRuleDtoSchema,
    responses: {
      200: AvailabilityRuleDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update availability rule (requires tenant admin authentication)',
  },

  /**
   * Delete an availability rule
   * DELETE /v1/tenant-admin/availability-rules/:id
   */
  tenantAdminDeleteAvailabilityRule: {
    method: 'DELETE',
    path: '/v1/tenant-admin/availability-rules/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete availability rule (requires tenant admin authentication)',
  },

  /**
   * Get all time-slot appointments for authenticated tenant
   * GET /v1/tenant-admin/appointments
   *
   * P1 #276 FIX: Pagination enforced to prevent unbounded queries
   * Default limit: 50, Max limit: 500
   */
  tenantAdminGetAppointments: {
    method: 'GET',
    path: '/v1/tenant-admin/appointments',
    query: z
      .object({
        status: z
          .enum([
            'PENDING',
            'DEPOSIT_PAID',
            'PAID',
            'CONFIRMED',
            'CANCELED',
            'REFUNDED',
            'FULFILLED',
          ])
          .optional(),
        serviceId: z.string().optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        limit: z.coerce.number().int().min(1).max(500).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .optional(),
    responses: {
      200: z.array(AppointmentDtoSchema),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary:
      'Get all appointments (time-slot bookings) for tenant with optional filters and pagination (requires tenant admin authentication)',
  },

  /**
   * Get all customers for authenticated tenant
   * GET /v1/tenant-admin/customers
   */
  tenantAdminGetCustomers: {
    method: 'GET',
    path: '/v1/tenant-admin/customers',
    query: PaginatedQuerySchema,
    responses: {
      200: createPaginatedResponseSchema(CustomerDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all customers for tenant (requires tenant admin authentication)',
  },

  // ============================================================================
  // Public Booking Management Endpoints (MVP Gaps Phase 1)
  // Unauthenticated - uses JWT token in query param for access
  // ============================================================================

  /**
   * Get booking details for management page
   * GET /v1/public/bookings/manage
   * Query param: token (JWT with booking access)
   */
  publicGetBookingDetails: {
    method: 'GET',
    path: '/v1/public/bookings/manage',
    query: z.object({
      token: z.string().min(1, 'Token is required'),
    }),
    responses: {
      200: PublicBookingDetailsDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema, // Invalid/expired token
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get booking details for customer self-service (requires valid JWT token)',
  },

  /**
   * Reschedule a booking to a new date
   * POST /v1/public/bookings/reschedule
   * Query param: token (JWT with reschedule permission)
   */
  publicRescheduleBooking: {
    method: 'POST',
    path: '/v1/public/bookings/reschedule',
    query: z.object({
      token: z.string().min(1, 'Token is required'),
    }),
    body: RescheduleBookingDtoSchema,
    responses: {
      200: BookingManagementDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema, // Invalid/expired token
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema, // Date already booked
      422: UnprocessableEntityErrorSchema, // Cannot reschedule (already cancelled, etc.)
      500: InternalServerErrorSchema,
    },
    summary: 'Reschedule booking to a new date (requires valid JWT token)',
  },

  /**
   * Cancel a booking
   * POST /v1/public/bookings/cancel
   * Query param: token (JWT with cancel permission)
   */
  publicCancelBooking: {
    method: 'POST',
    path: '/v1/public/bookings/cancel',
    query: z.object({
      token: z.string().min(1, 'Token is required'),
    }),
    body: CancelBookingDtoSchema,
    responses: {
      200: BookingManagementDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema, // Invalid/expired token
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema, // Cannot cancel (already cancelled, etc.)
      500: InternalServerErrorSchema,
    },
    summary: 'Cancel a booking (requires valid JWT token)',
  },

  // ============================================================================
  // Tenant Admin Reminder Endpoints (MVP Gaps Phase 2)
  // Lazy reminder evaluation - no cron jobs, processed on dashboard load
  // ============================================================================

  /**
   * Get reminder status for dashboard display
   * GET /v1/tenant-admin/reminders/status
   *
   * Returns pending count for badge display and preview of upcoming reminders.
   * Used to show tenant admins how many reminder emails need to be sent.
   */
  tenantAdminGetReminderStatus: {
    method: 'GET',
    path: '/v1/tenant-admin/reminders/status',
    responses: {
      200: ReminderStatusResponseSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get reminder status for dashboard (requires tenant admin authentication)',
  },

  /**
   * Trigger lazy reminder processing
   * POST /v1/tenant-admin/reminders/process
   *
   * Processes pending reminders inline when tenant admin loads dashboard.
   * Optional query param: limit (default 10, max 100)
   *
   * Returns count of successfully processed and failed reminders.
   */
  tenantAdminProcessReminders: {
    method: 'POST',
    path: '/v1/tenant-admin/reminders/process',
    query: z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .optional(),
    body: z.undefined(),
    responses: {
      200: ProcessRemindersResponseSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Process pending reminders (requires tenant admin authentication)',
  },

  // ============================================================================
  // Tenant Admin Calendar Endpoints (MVP Gaps Phase 3)
  // Per-tenant Google Calendar integration configuration
  // ============================================================================

  /**
   * Get calendar configuration status
   * GET /v1/tenant-admin/calendar/status
   *
   * Returns whether calendar is configured and the calendar ID if so.
   */
  tenantAdminGetCalendarStatus: {
    method: 'GET',
    path: '/v1/tenant-admin/calendar/status',
    responses: {
      200: CalendarStatusResponseSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get calendar configuration status',
  },

  /**
   * Save calendar configuration
   * POST /v1/tenant-admin/calendar/config
   *
   * Stores encrypted Google Calendar service account credentials.
   */
  tenantAdminSaveCalendarConfig: {
    method: 'POST',
    path: '/v1/tenant-admin/calendar/config',
    body: CalendarConfigInputSchema,
    responses: {
      200: z.object({ success: z.boolean(), calendarId: z.string() }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Save calendar configuration',
  },

  /**
   * Test calendar connection
   * POST /v1/tenant-admin/calendar/test
   *
   * Tests connection to Google Calendar using stored credentials.
   */
  tenantAdminTestCalendar: {
    method: 'POST',
    path: '/v1/tenant-admin/calendar/test',
    body: z.undefined(),
    responses: {
      200: CalendarTestResponseSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Test calendar connection',
  },

  /**
   * Delete calendar configuration
   * DELETE /v1/tenant-admin/calendar/config
   *
   * Removes stored calendar credentials.
   */
  tenantAdminDeleteCalendarConfig: {
    method: 'DELETE',
    path: '/v1/tenant-admin/calendar/config',
    body: z.undefined(),
    responses: {
      204: z.undefined(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete calendar configuration',
  },

  // ============================================================================
  // Tenant Admin Deposit Settings Endpoints (MVP Gaps Phase 4)
  // Configure deposit requirements for bookings
  // ============================================================================

  /**
   * Get deposit settings
   * GET /v1/tenant-admin/settings/deposits
   */
  tenantAdminGetDepositSettings: {
    method: 'GET',
    path: '/v1/tenant-admin/settings/deposits',
    responses: {
      200: DepositSettingsDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get deposit settings',
  },

  /**
   * Update deposit settings
   * PUT /v1/tenant-admin/settings/deposits
   */
  tenantAdminUpdateDepositSettings: {
    method: 'PUT',
    path: '/v1/tenant-admin/settings/deposits',
    body: UpdateDepositSettingsDtoSchema,
    responses: {
      200: DepositSettingsDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update deposit settings',
  },
});
