/**
 * Tenant Admin Section Content Routes
 * GET /sections/draft, POST /sections/publish, POST /sections/discard
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { logger } from '../lib/core/logger';
import { blockTypeToSectionType } from '../lib/block-type-mapper';
import { draftAutosaveLimiter } from '../middleware/rateLimiter';
import { getTenantId } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

export function registerSectionRoutes(router: Router, deps: TenantAdminDeps): void {
  const { sectionContentService } = deps;

  // ============================================================================
  // Section Content Draft Endpoints (Phase 5.2 Migration)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/sections/draft
   * Get all sections (drafts take priority) for Build Mode preview
   *
   * Returns sections in a format compatible with the frontend preview:
   * - Includes both draft and published sections
   * - Draft sections take priority over published
   * - Includes hasDraft flag and metadata
   *
   * This endpoint replaces the legacy /v1/tenant-admin/landing-page/draft
   * by returning section-level data from the SectionContent table.
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  router.get(
    '/sections/draft',
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        if (!sectionContentService) {
          res.status(503).json({ error: 'Section content service not available' });
          return;
        }

        // Get all sections (drafts + published, drafts take priority in preview)
        const sections = await sectionContentService.getPreviewSections(tenantId);
        const hasDraft = await sectionContentService.hasDraft(tenantId);

        // Find most recent update timestamp
        let draftUpdatedAt: string | null = null;
        for (const section of sections) {
          if (section.isDraft) {
            const updatedAt = section.updatedAt.toISOString();
            if (!draftUpdatedAt || updatedAt > draftUpdatedAt) {
              draftUpdatedAt = updatedAt;
            }
          }
        }

        // Serialize dates and add type field for frontend compatibility
        const serializedSections = sections.map((s) => ({
          id: s.id,
          tenantId: s.tenantId,
          segmentId: s.segmentId,
          blockType: s.blockType,
          type: blockTypeToSectionType(s.blockType), // Frontend-friendly lowercase type
          pageName: s.pageName,
          content: s.content,
          order: s.order,
          isDraft: s.isDraft,
          publishedAt: s.publishedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }));

        logger.info(
          { tenantId, sectionCount: sections.length, hasDraft },
          'Draft sections served for tenant admin'
        );

        res.status(200).json({
          success: true,
          hasDraft,
          draftUpdatedAt,
          sections: serializedSections,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/tenant-admin/sections/publish
   * Publish all draft sections to make them live
   *
   * This is a T3 operation requiring confirmation.
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  router.post(
    '/sections/publish',
    draftAutosaveLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        if (!sectionContentService) {
          res.status(503).json({ error: 'Section content service not available' });
          return;
        }

        // T3 confirmation pattern - require explicit confirmation
        const { confirmed } = req.body || {};

        const result = await sectionContentService.publishAll(tenantId, confirmed === true);

        if (result.requiresConfirmation) {
          res.status(200).json({
            success: false,
            requiresConfirmation: true,
            message: result.message,
          });
          return;
        }

        logger.info(
          { tenantId, publishedCount: result.publishedCount },
          'All sections published via tenant admin'
        );

        res.status(200).json({
          success: true,
          publishedAt: result.publishedAt,
          publishedCount: result.publishedCount,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/tenant-admin/sections/discard
   * Discard all draft changes and revert to published state
   *
   * This is a T3 operation requiring confirmation.
   *
   * SECURITY: Tenant isolation enforced via res.locals.tenantAuth
   */
  router.post(
    '/sections/discard',
    draftAutosaveLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        if (!sectionContentService) {
          res.status(503).json({ error: 'Section content service not available' });
          return;
        }

        // T3 confirmation pattern - require explicit confirmation
        const { confirmed } = req.body || {};

        const result = await sectionContentService.discardAll(tenantId, confirmed === true);

        if (result.requiresConfirmation) {
          res.status(200).json({
            success: false,
            requiresConfirmation: true,
            message: result.message,
          });
          return;
        }

        logger.info(
          { tenantId, discardedCount: result.discardedCount },
          'All draft sections discarded via tenant admin'
        );

        res.status(200).json({
          success: true,
          discardedCount: result.discardedCount,
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
