/**
 * Landing Page Admin Contract
 * API contract for tenant admins to manage their landing page configuration
 */

import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { LandingPageConfigSchema } from '../landing-page';
import {
  BadRequestErrorSchema,
  UnauthorizedErrorSchema,
  NotFoundErrorSchema,
  InternalServerErrorSchema,
} from '../dto';

const c = initContract();

// ============================================================================
// Draft System Schemas
// ============================================================================

/**
 * Draft wrapper schema - stores draft alongside published config
 * Uses JSON field structure in Tenant.landingPageConfig
 */
export const LandingPageDraftResponseSchema = z.object({
  draft: LandingPageConfigSchema.nullable(),
  published: LandingPageConfigSchema.nullable(),
  draftUpdatedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
});

export type LandingPageDraftResponse = z.infer<typeof LandingPageDraftResponseSchema>;

/**
 * Save draft response
 */
export const SaveDraftResponseSchema = z.object({
  success: z.boolean(),
  draftUpdatedAt: z.string().datetime(),
});

export type SaveDraftResponse = z.infer<typeof SaveDraftResponseSchema>;

/**
 * Publish draft response
 */
export const PublishDraftResponseSchema = z.object({
  success: z.boolean(),
  publishedAt: z.string().datetime(),
});

export type PublishDraftResponse = z.infer<typeof PublishDraftResponseSchema>;

/**
 * Discard draft response
 */
export const DiscardDraftResponseSchema = z.object({
  success: z.boolean(),
});

export type DiscardDraftResponse = z.infer<typeof DiscardDraftResponseSchema>;

/**
 * Landing Page Admin Contract
 * Routes for tenant administrators to configure their landing pages
 */
export const landingPageAdminContract = c.router({
  /**
   * GET /v1/tenant-admin/landing-page
   * Fetch current landing page configuration for authenticated tenant
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  getLandingPage: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page',
    responses: {
      200: LandingPageConfigSchema.nullable(),
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get landing page configuration',
  },

  /**
   * PUT /v1/tenant-admin/landing-page
   * Update landing page configuration for authenticated tenant
   * Replaces entire configuration (full update)
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Input sanitization applied to all text fields (XSS prevention)
   * - Image URLs validated against SafeImageUrlSchema (protocol validation)
   */
  updateLandingPage: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page',
    body: LandingPageConfigSchema,
    responses: {
      200: LandingPageConfigSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Update landing page configuration',
  },

  /**
   * PATCH /v1/tenant-admin/landing-page/sections
   * Toggle individual section visibility on/off
   */
  toggleSection: {
    method: 'PATCH',
    path: '/v1/tenant-admin/landing-page/sections',
    body: z.object({
      section: z.enum([
        'hero',
        'socialProofBar',
        'segmentSelector',
        'about',
        'testimonials',
        'accommodation',
        'gallery',
        'faq',
        'finalCta',
      ]),
      enabled: z.boolean(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Toggle a section on/off',
  },

  // ============================================================================
  // Draft System Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/landing-page/draft
   * Get current draft and published landing page configuration
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  getDraft: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page/draft',
    responses: {
      200: LandingPageDraftResponseSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Get draft and published landing page configuration',
  },

  /**
   * PUT /v1/tenant-admin/landing-page/draft
   * Save draft landing page configuration (auto-save target)
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Input sanitization applied to all text fields (XSS prevention)
   * - Image URLs validated against SafeImageUrlSchema (protocol validation)
   */
  saveDraft: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page/draft',
    body: LandingPageConfigSchema,
    responses: {
      200: SaveDraftResponseSchema,
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Save draft landing page configuration',
  },

  /**
   * POST /v1/tenant-admin/landing-page/publish
   * Publish draft to live landing page
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - Atomic transaction ensures draft→published copy is all-or-nothing
   * - No partial failures possible
   */
  publishDraft: {
    method: 'POST',
    path: '/v1/tenant-admin/landing-page/publish',
    body: z.object({}), // Empty body - publishes current draft
    responses: {
      200: PublishDraftResponseSchema,
      400: BadRequestErrorSchema, // No draft to publish
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema, // Tenant not found
      500: InternalServerErrorSchema,
    },
    summary: 'Publish draft landing page to live',
  },

  /**
   * DELETE /v1/tenant-admin/landing-page/draft
   * Discard draft and revert to published configuration
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  discardDraft: {
    method: 'DELETE',
    path: '/v1/tenant-admin/landing-page/draft',
    body: z.undefined(),
    responses: {
      200: DiscardDraftResponseSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      500: InternalServerErrorSchema,
    },
    summary: 'Discard draft and revert to published configuration',
  },

  // ============================================================================
  // Image Upload Endpoint (TODO-235)
  // ============================================================================

  /**
   * POST /v1/tenant-admin/landing-page/images
   * Upload image for landing page sections (hero, about, gallery, etc.)
   *
   * Content-Type: multipart/form-data
   * Body: FormData with 'image' field
   *
   * SECURITY:
   * - Tenant isolation enforced via res.locals.tenantAuth
   * - File validation (MIME type, size, magic bytes)
   * - Tenant-scoped storage paths prevent cross-tenant access
   * - Rate limited (50 uploads/hour per tenant)
   *
   * @returns 200 - Upload successful with URL and filename
   * @returns 400 - No file uploaded or validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 413 - File too large (max 5MB)
   * @returns 429 - Rate limit exceeded
   * @returns 500 - Internal server error
   */
  uploadImage: {
    method: 'POST',
    path: '/v1/tenant-admin/landing-page/images',
    contentType: 'multipart/form-data',
    body: z.any(), // Multipart form data handled by multer middleware
    responses: {
      200: z.object({
        url: z.string().url(),
        filename: z.string(),
        size: z.number(),
        mimetype: z.string(),
      }),
      400: BadRequestErrorSchema,
      401: UnauthorizedErrorSchema,
      413: z.object({ error: z.string() }), // Payload too large
      429: z.object({ error: z.string() }), // Rate limit exceeded
      500: InternalServerErrorSchema,
    },
    summary: 'Upload image for landing page sections',
  },
});
