/**
 * Internal Agent Storefront Routes
 *
 * Tenant-agent endpoints for section CRUD, publish/discard, and branding.
 * 12 endpoints for managing storefront content via SectionContentService.
 *
 * MIGRATED: All endpoints use SectionContentService instead of legacy JSON columns.
 * See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
 *
 * Called by: tenant-agent (storefront editing tools)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../lib/core/logger';
import { NotFoundError } from '../lib/errors';
import { verifyInternalSecret, handleError, TenantIdSchema } from './internal-agent-shared';
import type { StorefrontRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;

const GetPageStructureSchema = TenantIdSchema.extend({
  pageName: z.enum(PAGE_NAMES).optional(),
  includeOnlyPlaceholders: z.boolean().optional(),
});

const GetSectionContentSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
});

const UpdateSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  content: z.string().optional(),
  ctaText: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  imageUrl: z.string().optional(),
});

const AddSectionSchema = TenantIdSchema.extend({
  pageName: z.enum(PAGE_NAMES),
  sectionType: z.enum(SECTION_TYPES),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  content: z.string().optional(),
  ctaText: z.string().optional(),
  position: z.number().optional(),
});

const RemoveSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
});

const ReorderSectionsSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  toPosition: z.number().min(0),
});

// TogglePageSchema DELETED - multi-page toggles not needed for single long-scroll pages
// See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md

const UpdateBrandingSchema = TenantIdSchema.extend({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().optional(),
});

// Section-level publish/discard schemas (Phase 3: Section Content Migration)
const PublishSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  confirmationReceived: z.boolean(),
});

const DiscardSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  confirmationReceived: z.boolean(),
});

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal agent storefront routes.
 *
 * Mounted at `/storefront` by the aggregator.
 * All paths below are relative (e.g., `/structure` becomes `/storefront/structure`).
 */
export function createInternalAgentStorefrontRoutes(deps: StorefrontRoutesDeps): Router {
  const router = Router();
  const { sectionContentService, tenantRepo, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // POST /structure - Get page structure with section IDs
  router.post('/structure', async (req: Request, res: Response) => {
    try {
      const { tenantId, pageName, includeOnlyPlaceholders } = GetPageStructureSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, pageName, endpoint: '/storefront/structure' },
        '[Agent] Getting page structure'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Get structure from SectionContentService
      const result = await sectionContentService.getPageStructure(tenantId, {
        pageName: pageName as
          | 'home'
          | 'about'
          | 'services'
          | 'faq'
          | 'contact'
          | 'gallery'
          | 'testimonials'
          | undefined,
      });

      // Transform to agent-friendly format
      let sections = result.pages.flatMap((page) =>
        page.sections.map((s) => ({
          id: s.sectionId,
          page: s.page,
          type: s.type,
          headline: s.headline || '',
          hasPlaceholder: s.isPlaceholder,
        }))
      );

      // Filter if requested
      if (includeOnlyPlaceholders) {
        sections = sections.filter((s) => s.hasPlaceholder);
      }

      res.json({
        sections,
        totalCount: sections.length,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
      });
    } catch (error) {
      handleError(res, error, '/storefront/structure');
    }
  });

  // POST /section - Get section content by ID
  router.post('/section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId } = GetSectionContentSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/section' },
        '[Agent] Getting section content'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.getSectionContent(tenantId, sectionId);
      if (!result) {
        res.status(404).json({ error: `Section '${sectionId}' not found` });
        return;
      }

      // Return in agent-friendly format matching legacy response shape
      res.json({
        section: result.section,
        page: result.page,
        index: result.index,
        hasDraft: result.isDraft,
      });
    } catch (error) {
      handleError(res, error, '/storefront/section');
    }
  });

  // POST /update-section - Update section content (saves to draft)
  router.post('/update-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, ...updates } = UpdateSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/update-section' },
        '[Agent] Updating section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const result = await sectionContentService.updateSection(tenantId, sectionId, updates);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
        note: result.message,
        dashboardAction: result.dashboardAction,
      });
    } catch (error) {
      handleError(res, error, '/storefront/update-section');
    }
  });

  // POST /add-section - Add a new section (saves to draft)
  router.post('/add-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, pageName, sectionType, position, ...content } = AddSectionSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, pageName, sectionType, endpoint: '/storefront/add-section' },
        '[Agent] Adding section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const result = await sectionContentService.addSection(
        tenantId,
        pageName,
        sectionType,
        Object.keys(content).length > 0 ? content : undefined,
        position
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId: result.sectionId,
        page: pageName,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft&page=${pageName}` : undefined,
        dashboardAction: result.dashboardAction,
      });
    } catch (error) {
      handleError(res, error, '/storefront/add-section');
    }
  });

  // POST /remove-section - Remove a section (saves to draft)
  router.post('/remove-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId } = RemoveSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/remove-section' },
        '[Agent] Removing section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.removeSection(tenantId, sectionId);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        removedSectionId: result.removedSectionId,
        hasDraft: result.hasDraft,
        note: result.message,
      });
    } catch (error) {
      handleError(res, error, '/storefront/remove-section');
    }
  });

  // POST /reorder-sections - Move a section (saves to draft)
  router.post('/reorder-sections', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, toPosition } = ReorderSectionsSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, toPosition, endpoint: '/storefront/reorder-sections' },
        '[Agent] Reordering sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.reorderSection(tenantId, sectionId, toPosition);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        newPosition: result.newPosition,
        hasDraft: result.hasDraft,
      });
    } catch (error) {
      handleError(res, error, '/storefront/reorder-sections');
    }
  });

  // POST /update-branding - Update branding (immediate, not draft)
  router.post('/update-branding', async (req: Request, res: Response) => {
    try {
      const { tenantId, ...branding } = UpdateBrandingSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/storefront/update-branding' },
        '[Agent] Updating branding'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Branding is stored in tenant.branding JSON column
      const currentBranding = (tenant.branding || {}) as Record<string, unknown>;
      const updatedBranding = { ...currentBranding };

      // Only update provided fields
      if (branding.primaryColor) updatedBranding.primaryColor = branding.primaryColor;
      if (branding.secondaryColor) updatedBranding.secondaryColor = branding.secondaryColor;
      if (branding.accentColor) updatedBranding.accentColor = branding.accentColor;
      if (branding.backgroundColor) updatedBranding.backgroundColor = branding.backgroundColor;
      if (branding.fontFamily) updatedBranding.fontFamily = branding.fontFamily;
      if (branding.logoUrl) updatedBranding.logoUrl = branding.logoUrl;

      await tenantRepo.update(tenantId, {
        branding: updatedBranding,
      });

      res.json({
        success: true,
        updated: Object.keys(branding).filter((k) => k !== 'tenantId'),
        note: 'Branding changes take effect immediately.',
      });
    } catch (error) {
      handleError(res, error, '/storefront/update-branding');
    }
  });

  // POST /preview - Get preview URL
  router.post('/preview', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const hasDraft = await sectionContentService.hasDraft(tenantId);

      res.json({
        hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : null,
        liveUrl: tenant.slug ? `/t/${tenant.slug}` : null,
      });
    } catch (error) {
      handleError(res, error, '/storefront/preview');
    }
  });

  // POST /publish - Publish all draft sections to live
  router.post('/publish', async (req: Request, res: Response) => {
    try {
      // T3 confirmation pattern: confirmationReceived must be explicitly true
      const { tenantId, confirmationReceived } = TenantIdSchema.extend({
        confirmationReceived: z.boolean().optional(),
      }).parse(req.body);

      logger.info(
        { tenantId, confirmationReceived, endpoint: '/storefront/publish' },
        '[Agent] Publishing all sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      // Delegate to SectionContentService which handles:
      // 1. T3 confirmation check
      // 2. Publishing all draft sections
      // 3. Returning hasDraft state for agent context
      const result = await sectionContentService.publishAll(tenantId, confirmationReceived);

      // If confirmation is required, return T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          message: result.message,
        });
        return;
      }

      // Get tenant slug for response
      const tenant = await tenantRepo.findById(tenantId);

      res.json({
        success: result.success,
        action: 'published',
        publishedAt: result.publishedAt,
        publishedCount: result.publishedCount,
        hasDraft: result.hasDraft,
        liveUrl: tenant?.slug ? `/t/${tenant.slug}` : null,
        note: result.message,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/storefront/publish');
    }
  });

  // POST /discard - Discard all draft sections
  router.post('/discard', async (req: Request, res: Response) => {
    try {
      // T3 confirmation pattern: confirmationReceived must be explicitly true
      const { tenantId, confirmationReceived } = TenantIdSchema.extend({
        confirmationReceived: z.boolean().optional(),
      }).parse(req.body);

      logger.info(
        { tenantId, confirmationReceived, endpoint: '/storefront/discard' },
        '[Agent] Discarding all draft sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      // Delegate to SectionContentService which handles:
      // 1. T3 confirmation check
      // 2. Discarding all draft sections
      // 3. Returning hasDraft state for agent context
      const result = await sectionContentService.discardAll(tenantId, confirmationReceived);

      // If confirmation is required, return T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          message: result.message,
        });
        return;
      }

      res.json({
        success: result.success,
        action: 'discarded',
        discardedCount: result.discardedCount,
        hasDraft: result.hasDraft,
        note: result.message,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/storefront/discard');
    }
  });

  // ===========================================================================
  // SECTION-LEVEL PUBLISH/DISCARD ENDPOINTS
  // Phase 3: Section Content Migration - enables per-section publishing
  // ===========================================================================

  // POST /publish-section - Publish a single section (T3)
  router.post('/publish-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, confirmationReceived } = PublishSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, confirmationReceived, endpoint: '/storefront/publish-section' },
        '[Agent] Publish section request'
      );

      // Require SectionContentService
      if (!sectionContentService) {
        res.status(503).json({
          error: 'Section content service not configured',
        });
        return;
      }

      // Call service - T3 confirmation is handled by the service
      const result = await sectionContentService.publishSection(
        tenantId,
        sectionId,
        confirmationReceived
      );

      // If confirmation is required, return early with T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          sectionId,
          message: result.message,
        });
        return;
      }

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/storefront/publish-section');
    }
  });

  // POST /discard-section - Discard changes to a single section (T3)
  router.post('/discard-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, confirmationReceived } = DiscardSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, confirmationReceived, endpoint: '/storefront/discard-section' },
        '[Agent] Discard section request'
      );

      // Require SectionContentService
      if (!sectionContentService) {
        res.status(503).json({
          error: 'Section content service not configured',
        });
        return;
      }

      // T3 confirmation check
      if (!confirmationReceived) {
        res.json({
          success: false,
          requiresConfirmation: true,
          sectionId,
          message:
            'Discard changes to this section? This will revert to the last published version.',
        });
        return;
      }

      // Get the section first to verify it exists and belongs to tenant
      const section = await sectionContentService.getSectionContent(tenantId, sectionId);
      if (!section) {
        res.status(404).json({ error: 'Section not found' });
        return;
      }

      // Remove the draft section - this effectively reverts to published
      await sectionContentService.removeSection(tenantId, sectionId);

      const hasDraft = await sectionContentService.hasDraft(tenantId);

      res.json({
        success: true,
        hasDraft,
        visibility: 'live' as const,
        message: 'Section changes discarded. Reverted to published version.',
        sectionId,
        dashboardAction: {
          type: 'REFRESH',
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/storefront/discard-section');
    }
  });

  return router;
}
