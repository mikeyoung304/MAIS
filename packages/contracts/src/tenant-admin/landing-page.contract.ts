/**
 * Landing Page Admin Contract
 * API contract for tenant admins to manage their landing page configuration
 */

import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { LandingPageConfigSchema } from '../landing-page';

const c = initContract();

/**
 * Landing Page Admin Contract
 * Routes for tenant administrators to configure their landing pages
 */
export const landingPageAdminContract = c.router({
  /**
   * GET /v1/tenant-admin/landing-page
   * Fetch current landing page configuration for authenticated tenant
   */
  getLandingPage: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page',
    responses: {
      200: LandingPageConfigSchema.nullable(),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: 'Get landing page configuration',
  },

  /**
   * PUT /v1/tenant-admin/landing-page
   * Update landing page configuration for authenticated tenant
   * Replaces entire configuration (full update)
   */
  updateLandingPage: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page',
    body: LandingPageConfigSchema,
    responses: {
      200: LandingPageConfigSchema,
      400: z.object({ error: z.string(), details: z.array(z.any()).optional() }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
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
      400: z.object({ error: z.string(), details: z.array(z.any()).optional() }),
      401: z.object({ error: z.string() }),
      404: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: 'Toggle a section on/off',
  },
});
