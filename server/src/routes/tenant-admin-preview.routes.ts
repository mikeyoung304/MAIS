/**
 * Tenant Admin Preview Token Routes
 * POST /preview-token
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { logger } from '../lib/core/logger';
import { generatePreviewToken } from '../lib/preview-tokens';
import { draftAutosaveLimiter } from '../middleware/rateLimiter';
import { requireAuth } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

export function registerPreviewRoutes(router: Router, deps: TenantAdminDeps): void {
  const { tenantRepository } = deps;

  // ============================================================================
  // Preview Token Endpoint
  // ============================================================================

  /**
   * POST /v1/tenant-admin/preview-token
   * Generate a short-lived preview token for draft preview access
   *
   * The token is used to authenticate iframe requests to view draft content
   * without flashing the published content first.
   *
   * SECURITY:
   * - Requires authenticated tenant session
   * - Token is tenant-scoped (can only preview own tenant's draft)
   * - Token expires after 10 minutes
   * - ISR cache is bypassed for preview requests (no cache poisoning)
   *
   * @returns { token: string, expiresAt: string } - JWT token and expiry timestamp
   */
  router.post(
    '/preview-token',
    requireAuth, // Auth check BEFORE rate limiter (see issue #733)
    draftAutosaveLimiter,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        // Auth is guaranteed by requireAuth middleware - safe to assert non-null
        const tenantId = res.locals.tenantAuth!.tenantId;

        // Get tenant to include slug in token
        const tenant = await tenantRepository.findById(tenantId);
        if (!tenant) {
          res.status(404).json({ error: 'Tenant not found' });
          return;
        }

        // Generate preview token (10 minute expiry)
        const expiryMinutes = 10;
        const token = generatePreviewToken(tenantId, tenant.slug, expiryMinutes);

        // Calculate expiry timestamp
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

        logger.info({ tenantId, slug: tenant.slug }, 'Preview token generated');

        res.json({
          token,
          expiresAt,
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
