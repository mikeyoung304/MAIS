/**
 * API v1 contract definition using ts-rest
 */

import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  PackageDtoSchema,
  AvailabilityDtoSchema,
  CreateCheckoutDtoSchema,
  AdminLoginDtoSchema,
  TenantSignupDtoSchema,
  TenantSignupResponseSchema,
  ForgotPasswordDtoSchema,
  ResetPasswordDtoSchema,
  BookingDtoSchema,
  CreatePackageDtoSchema,
  UpdatePackageDtoSchema,
  PackageResponseDtoSchema,
  CreateAddOnDtoSchema,
  UpdateAddOnDtoSchema,
  AddOnDtoSchema,
  TenantBrandingDtoSchema,
  UpdateBrandingDtoSchema,
  LogoUploadResponseDtoSchema,
  BlackoutDtoSchema,
  CreateBlackoutDtoSchema,
  PackagePhotoDtoSchema,
  PackageWithPhotosDtoSchema,
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
  AppointmentDtoSchema,
  CreateAppointmentCheckoutDtoSchema,
  AppointmentCheckoutResponseDtoSchema,
  // Public tenant DTO (for storefront routing)
  TenantPublicDtoSchema,
  // Visual Editor Draft DTOs
  PackageWithDraftDtoSchema,
  UpdatePackageDraftDtoSchema,
  PublishDraftsDtoSchema,
  PublishDraftsResponseDtoSchema,
  DiscardDraftsDtoSchema,
  DiscardDraftsResponseDtoSchema,
  // Booking Management DTOs (MVP Gaps Phase 1)
  RescheduleBookingDtoSchema,
  CancelBookingDtoSchema,
  BookingManagementDtoSchema,
  PublicBookingDetailsDtoSchema,
  // Reminder DTOs (MVP Gaps Phase 2)
  ReminderStatusResponseSchema,
  ProcessRemindersResponseSchema,
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
  getPackages: {
    method: 'GET',
    path: '/v1/packages',
    responses: {
      200: z.array(PackageDtoSchema),
      400: BadRequestErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all packages',
  },

  getPackageBySlug: {
    method: 'GET',
    path: '/v1/packages/:slug',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: PackageDtoSchema,
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get package by slug',
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
    body: z.any(), // Raw body
    responses: {
      204: z.void(),
      400: BadRequestErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Handle Stripe webhook (raw body)',
  },

  // Tenant admin authentication endpoints
  tenantLogin: {
    method: 'POST',
    path: '/v1/tenant-auth/login',
    body: AdminLoginDtoSchema, // Same schema: email + password
    responses: {
      200: z.object({
        token: z.string(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Tenant admin login',
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
      slug: z.string()
        .min(1, 'Slug is required')
        .max(63, 'Slug must be 63 characters or less')
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format: must be lowercase alphanumeric with hyphens'),
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
    body: z.any(), // Multipart form data (file upload)
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

  // ============================================================================
  // Tenant Admin Package Endpoints
  // ============================================================================

  tenantAdminGetPackages: {
    method: 'GET',
    path: '/v1/tenant-admin/packages',
    responses: {
      200: z.array(PackageWithPhotosDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all packages for tenant (requires tenant admin authentication)',
  },

  tenantAdminCreatePackage: {
    method: 'POST',
    path: '/v1/tenant-admin/packages',
    body: CreatePackageDtoSchema,
    responses: {
      201: PackageResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create new package (requires tenant admin authentication)',
  },

  tenantAdminUpdatePackage: {
    method: 'PUT',
    path: '/v1/tenant-admin/packages/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdatePackageDtoSchema,
    responses: {
      200: PackageResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update package (requires tenant admin authentication)',
  },

  tenantAdminDeletePackage: {
    method: 'DELETE',
    path: '/v1/tenant-admin/packages/:id',
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
    summary: 'Delete package (requires tenant admin authentication)',
  },

  tenantAdminUploadPackagePhoto: {
    method: 'POST',
    path: '/v1/tenant-admin/packages/:id/photos',
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.any(), // Multipart form data (file upload)
    responses: {
      201: PackagePhotoDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Upload photo for package (requires tenant admin authentication)',
  },

  tenantAdminDeletePackagePhoto: {
    method: 'DELETE',
    path: '/v1/tenant-admin/packages/:id/photos/:filename',
    pathParams: z.object({
      id: z.string(),
      filename: z.string(),
    }),
    body: z.undefined(),
    responses: {
      204: z.void(),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Delete package photo (requires tenant admin authentication)',
  },

  // ============================================================================
  // Tenant Admin Visual Editor Draft Endpoints
  // ============================================================================

  /**
   * Get all packages with draft fields for visual editor
   * GET /v1/tenant-admin/packages/drafts
   */
  tenantAdminGetPackagesWithDrafts: {
    method: 'GET',
    path: '/v1/tenant-admin/packages/drafts',
    responses: {
      200: z.array(PackageWithDraftDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all packages with draft fields for visual editor (requires tenant admin authentication)',
  },

  /**
   * Update package draft (autosave target)
   * PATCH /v1/tenant-admin/packages/:id/draft
   */
  tenantAdminUpdatePackageDraft: {
    method: 'PATCH',
    path: '/v1/tenant-admin/packages/:id/draft',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdatePackageDraftDtoSchema,
    responses: {
      200: PackageWithDraftDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update package draft for autosave (requires tenant admin authentication)',
  },

  /**
   * Publish all package drafts
   * POST /v1/tenant-admin/packages/publish
   */
  tenantAdminPublishDrafts: {
    method: 'POST',
    path: '/v1/tenant-admin/packages/publish',
    body: PublishDraftsDtoSchema,
    responses: {
      200: PublishDraftsResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Publish all package drafts to live (requires tenant admin authentication)',
  },

  /**
   * Discard all package drafts
   * DELETE /v1/tenant-admin/packages/drafts
   */
  tenantAdminDiscardDrafts: {
    method: 'DELETE',
    path: '/v1/tenant-admin/packages/drafts',
    body: DiscardDraftsDtoSchema,
    responses: {
      200: DiscardDraftsResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Discard all package drafts (requires tenant admin authentication)',
  },

  // ============================================================================
  // Tenant Admin Blackout Endpoints
  // ============================================================================

  tenantAdminGetBlackouts: {
    method: 'GET',
    path: '/v1/tenant-admin/blackouts',
    responses: {
      200: z.array(BlackoutDtoSchema),
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
    query: z.object({
      status: z.enum(['PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED']).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional(),
    responses: {
      200: z.array(BookingDtoSchema),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all bookings for tenant with optional filters (requires tenant admin authentication)',
  },

  // Platform admin endpoints (authentication required - documented)
  adminLogin: {
    method: 'POST',
    path: '/v1/admin/login',
    body: AdminLoginDtoSchema,
    responses: {
      200: z.object({
        token: z.string(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Platform admin login',
  },

  platformGetAllTenants: {
    method: 'GET',
    path: '/v1/admin/tenants',
    responses: {
      200: z.array(TenantDtoSchema),
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
    responses: {
      200: z.array(BookingDtoSchema),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all bookings (requires authentication)',
  },

  adminGetBlackouts: {
    method: 'GET',
    path: '/v1/admin/blackouts',
    responses: {
      200: z.array(
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
      200: z.object({
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

  // Admin Package CRUD endpoints
  adminCreatePackage: {
    method: 'POST',
    path: '/v1/admin/packages',
    body: CreatePackageDtoSchema,
    responses: {
      200: PackageResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Create a new package (requires authentication)',
  },

  adminUpdatePackage: {
    method: 'PUT',
    path: '/v1/admin/packages/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    body: UpdatePackageDtoSchema,
    responses: {
      200: PackageResponseDtoSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      422: UnprocessableEntityErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update a package (requires authentication)',
  },

  adminDeletePackage: {
    method: 'DELETE',
    path: '/v1/admin/packages/:id',
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
    summary: 'Delete a package (requires authentication)',
  },

  // Admin AddOn CRUD endpoints
  adminCreateAddOn: {
    method: 'POST',
    path: '/v1/admin/packages/:packageId/addons',
    pathParams: z.object({
      packageId: z.string(),
    }),
    body: CreateAddOnDtoSchema,
    responses: {
      200: AddOnDtoSchema,
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
    responses: {
      200: z.array(SegmentDtoSchema),
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
      200: SegmentDtoSchema,
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
        packageCount: z.number().int(),
        addOnCount: z.number().int(),
      }),
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment statistics (requires tenant admin authentication)',
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
    responses: {
      200: z.array(SegmentDtoSchema),
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
   * Get segment with packages and add-ons
   * Used for segment landing page to display filtered packages
   */
  getSegmentWithPackages: {
    method: 'GET',
    path: '/v1/segments/:slug/packages',
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: SegmentDtoSchema.extend({
        packages: z.array(PackageDtoSchema),
        addOns: z.array(AddOnDtoSchema),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get segment with packages (public, requires X-Tenant-Key)',
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
    responses: {
      200: z.array(PublicServiceDtoSchema),
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
    responses: {
      200: z.array(ServiceDtoSchema),
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
    query: z.object({
      serviceId: z.string().optional(), // Filter by service
    }).optional(),
    responses: {
      200: z.array(AvailabilityRuleDtoSchema),
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
   */
  tenantAdminGetAppointments: {
    method: 'GET',
    path: '/v1/tenant-admin/appointments',
    query: z.object({
      status: z.enum(['PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED']).optional(),
      serviceId: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional(),
    responses: {
      200: z.array(AppointmentDtoSchema),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get all appointments (time-slot bookings) for tenant with optional filters (requires tenant admin authentication)',
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
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).optional(),
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
});
