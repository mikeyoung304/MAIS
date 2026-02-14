/**
 * Tenant Admin Blackout Routes
 * GET /blackouts, POST /blackouts, DELETE /blackouts/:id
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { createBlackoutSchema } from '../validation/tenant-admin.schemas';
import type { TenantAdminDeps } from './tenant-admin-shared';

export function registerBlackoutRoutes(router: Router, deps: TenantAdminDeps): void {
  const { blackoutRepo } = deps;

  // ============================================================================
  // Blackout Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/blackouts
   * List all blackout dates for authenticated tenant
   */
  router.get('/blackouts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Need to fetch full records with IDs
      // Type assertion needed because BlackoutRepository interface doesn't expose prisma
      // but PrismaBlackoutRepository implementation has it
      const prismaClient = (blackoutRepo as unknown as { prisma: unknown }).prisma as {
        blackoutDate: {
          findMany: (args: {
            where: { tenantId: string };
            orderBy: { date: string };
            select: { id: boolean; date: boolean; reason: boolean };
          }) => Promise<Array<{ id: string; date: Date; reason: string | null }>>;
        };
      };
      const fullBlackouts = await prismaClient.blackoutDate.findMany({
        where: { tenantId },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          reason: true,
        },
      });

      const blackouts = fullBlackouts.map((b) => ({
        id: b.id,
        date: b.date.toISOString().split('T')[0],
        ...(b.reason && { reason: b.reason }),
      }));

      res.json(blackouts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/blackouts
   * Add blackout date for authenticated tenant
   */
  router.post('/blackouts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const data = createBlackoutSchema.parse(req.body);
      await blackoutRepo.addBlackout(tenantId, data.date, data.reason);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/blackouts/:id
   * Remove blackout date (verifies ownership)
   */
  router.delete('/blackouts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;

      // Verify blackout belongs to tenant
      const blackout = await blackoutRepo.findBlackoutById(tenantId, id);
      if (!blackout) {
        res.status(404).json({ error: 'Blackout date not found' });
        return;
      }

      await blackoutRepo.deleteBlackout(tenantId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
}
