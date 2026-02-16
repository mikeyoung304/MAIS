/**
 * Tenant Admin Trial Routes
 * GET /trial/status, POST /trial/start
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { logger } from '../lib/core/logger';
import { getTenantId } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

export function registerTrialRoutes(router: Router, deps: TenantAdminDeps): void {
  const { tenantRepository, catalogService } = deps;

  // ============================================================================
  // Trial & Subscription Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/trial/status
   * Get current trial/subscription status for authenticated tenant
   *
   * Returns:
   * - status: NONE | TRIALING | ACTIVE | EXPIRED
   * - daysRemaining: number | null (only for TRIALING)
   * - canStartTrial: boolean (has packages but no trial started)
   * - hasPackages: boolean
   */
  router.get('/trial/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if tenant has tiers
      const tiers = await catalogService.getAllTiers(tenantId);
      const hasPackages = tiers.length > 0;

      // Determine status and days remaining
      let status = tenant.subscriptionStatus || 'NONE';
      let daysRemaining: number | null = null;

      if (status === 'TRIALING' && tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Auto-expire if trial has ended
        if (daysRemaining === 0) {
          status = 'EXPIRED';
          // Note: We could update the DB here, but for now we just return the derived status
        }
      }

      const canStartTrial = hasPackages && status === 'NONE';

      res.json({
        status,
        daysRemaining,
        canStartTrial,
        hasPackages,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/trial/start
   * Start 14-day free trial for authenticated tenant
   *
   * Idempotent: Returns existing trial if already started
   * Requires: At least one package created
   */
  router.post('/trial/start', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Idempotent: If trial already started, return existing status
      if (tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        const daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        res.json({
          message: 'Trial already started',
          trialEndsAt: tenant.trialEndsAt.toISOString(),
          daysRemaining,
        });
        return;
      }

      // Check if tenant has at least one tier
      const tiers = await catalogService.getAllTiers(tenantId);
      if (tiers.length === 0) {
        res.status(400).json({
          error: 'Create at least one tier before starting your trial',
        });
        return;
      }

      // Start 14-day trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await tenantRepository.update(tenantId, {
        trialEndsAt,
        subscriptionStatus: 'TRIALING',
      });

      logger.info({ tenantId, trialEndsAt }, 'Trial started for tenant');

      res.json({
        message: 'Trial started successfully',
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining: 14,
      });
    } catch (error) {
      next(error);
    }
  });
}
