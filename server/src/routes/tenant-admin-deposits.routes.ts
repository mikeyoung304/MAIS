/**
 * Tenant Admin Deposit Settings Routes (MVP Gaps Phase 4)
 *
 * Provides endpoints for configuring deposit settings.
 * Allows tenants to require deposits (percentage of total) at checkout,
 * with balance due X days before the event.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';

/**
 * Validation schema for deposit settings update
 */
const UpdateDepositSettingsSchema = z.object({
  depositPercent: z.number().min(0).max(100).nullable().optional(),
  balanceDueDays: z.number().int().min(1).max(90).optional(),
});

/**
 * Create tenant admin deposit settings routes
 *
 * @param tenantRepo - PrismaTenantRepository from DI container
 */
export function createTenantAdminDepositRoutes(tenantRepo: PrismaTenantRepository): Router {
  const router = Router();

  /**
   * GET /v1/tenant-admin/settings/deposits
   * Get current deposit settings for tenant
   *
   * Returns:
   * - depositPercent: Deposit percentage (null = full payment required)
   * - balanceDueDays: Days before event balance is due
   */
  router.get('/settings/deposits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Fetch tenant deposit settings
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const depositPercent = tenant.depositPercent ? Number(tenant.depositPercent) : null;
      const balanceDueDays = tenant.balanceDueDays || 30;

      logger.debug({ tenantId, depositPercent, balanceDueDays }, 'Deposit settings retrieved');

      res.status(200).json({
        depositPercent,
        balanceDueDays,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting deposit settings');
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/settings/deposits
   * Update deposit settings for tenant
   *
   * Body:
   * - depositPercent: Deposit percentage (0-100, null = full payment required)
   * - balanceDueDays: Days before event balance is due (1-90)
   *
   * Returns updated deposit settings
   */
  router.put('/settings/deposits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const validation = UpdateDepositSettingsSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.error.errors,
        });
        return;
      }

      const { depositPercent, balanceDueDays } = validation.data;

      // Update tenant deposit settings
      const updateData: any = {};
      if (depositPercent !== undefined) {
        updateData.depositPercent = depositPercent;
      }
      if (balanceDueDays !== undefined) {
        updateData.balanceDueDays = balanceDueDays;
      }

      await tenantRepo.update(tenantId, updateData);

      // Fetch updated settings
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const updatedDepositPercent = tenant.depositPercent ? Number(tenant.depositPercent) : null;
      const updatedBalanceDueDays = tenant.balanceDueDays || 30;

      logger.info(
        { tenantId, depositPercent: updatedDepositPercent, balanceDueDays: updatedBalanceDueDays },
        'Deposit settings updated'
      );

      res.status(200).json({
        depositPercent: updatedDepositPercent,
        balanceDueDays: updatedBalanceDueDays,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating deposit settings');
      next(error);
    }
  });

  return router;
}
