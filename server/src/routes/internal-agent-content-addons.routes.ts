/**
 * Internal Agent Content AddOns Routes
 *
 * CRUD operations on service add-ons.
 *
 * Called by: tenant-agent's manage_addons tool
 */

import type { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { QueryLimits } from '../lib/core/query-limits';
import { handleError, TenantIdSchema, slugify } from './internal-agent-shared';
import type { MarketingRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

const ManageAddOnsSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  addOnId: z.string().min(1).optional(),
  segmentId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional(),
  priceCents: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerAddonRoutes(router: Router, deps: MarketingRoutesDeps): void {
  const { tenantRepo, prisma } = deps;

  // POST /manage-addons - CRUD on service add-ons
  router.post('/manage-addons', async (req: Request, res: Response) => {
    try {
      const params = ManageAddOnsSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-addons' },
        '[Agent] AddOn management request'
      );

      if (!prisma) {
        res.status(503).json({ error: 'Database not available' });
        return;
      }

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          // MULTI-TENANT: Filter by tenantId (pitfall #1)
          const where: { tenantId: string; segmentId?: string | null } = { tenantId };
          if (params.segmentId !== undefined) {
            where.segmentId = params.segmentId;
          }

          const addOns = await prisma.addOn.findMany({
            where,
            include: { segment: { select: { name: true } } },
            orderBy: { name: 'asc' },
            take: QueryLimits.CATALOG_MAX, // pitfall #13: bounded query
          });

          const formatted = addOns.map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
            description: a.description,
            priceInDollars: Math.round(a.price / 100),
            priceCents: a.price,
            segmentId: a.segmentId,
            segmentName: a.segment?.name ?? null,
            active: a.active,
          }));

          res.json({
            addOns: formatted,
            totalCount: formatted.length,
          });
          return;
        }

        case 'create': {
          if (!params.name || params.priceCents === undefined) {
            res.status(400).json({ error: 'create requires: name, priceCents' });
            return;
          }

          // If segment-scoped, verify segment belongs to tenant
          if (params.segmentId) {
            const segment = await prisma.segment.findFirst({
              where: { id: params.segmentId, tenantId },
            });
            if (!segment) {
              res.status(404).json({ error: 'Segment not found or access denied' });
              return;
            }
          }

          const slug = params.slug || slugify(params.name);

          const newAddOn = await prisma.addOn.create({
            data: {
              tenantId,
              name: params.name,
              slug,
              description: params.description ?? null,
              price: params.priceCents,
              segmentId: params.segmentId ?? null,
              active: params.active ?? true,
            },
            include: { segment: { select: { name: true } } },
          });

          const allAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info(
            { tenantId, addOnId: newAddOn.id, name: newAddOn.name },
            '[Agent] AddOn created'
          );

          res.json({
            addOn: {
              id: newAddOn.id,
              name: newAddOn.name,
              slug: newAddOn.slug,
              description: newAddOn.description,
              priceInDollars: Math.round(newAddOn.price / 100),
              priceCents: newAddOn.price,
              segmentId: newAddOn.segmentId,
              segmentName: newAddOn.segment?.name ?? null,
              active: newAddOn.active,
            },
            totalCount: allAddOns,
          });
          return;
        }

        case 'update': {
          if (!params.addOnId) {
            res.status(400).json({ error: 'addOnId is required for update' });
            return;
          }

          // SECURITY: Verify add-on belongs to tenant
          const existing = await prisma.addOn.findFirst({
            where: { id: params.addOnId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'AddOn not found or access denied' });
            return;
          }

          const updateData: Record<string, unknown> = {};
          if (params.name) {
            updateData.name = params.name;
            if (!params.slug) updateData.slug = slugify(params.name);
          }
          if (params.slug) updateData.slug = params.slug;
          if (params.description !== undefined) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.price = params.priceCents;
          if (params.segmentId !== undefined) updateData.segmentId = params.segmentId;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await prisma.addOn.update({
            where: { id: params.addOnId },
            data: updateData,
            include: { segment: { select: { name: true } } },
          });

          const allAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info(
            { tenantId, addOnId: updated.id, updates: Object.keys(updateData) },
            '[Agent] AddOn updated'
          );

          res.json({
            addOn: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              description: updated.description,
              priceInDollars: Math.round(updated.price / 100),
              priceCents: updated.price,
              segmentId: updated.segmentId,
              segmentName: updated.segment?.name ?? null,
              active: updated.active,
            },
            totalCount: allAddOns,
          });
          return;
        }

        case 'delete': {
          if (!params.addOnId) {
            res.status(400).json({ error: 'addOnId is required for delete' });
            return;
          }

          // SECURITY: Verify add-on belongs to tenant
          const existing = await prisma.addOn.findFirst({
            where: { id: params.addOnId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'AddOn not found or access denied' });
            return;
          }

          await prisma.addOn.delete({ where: { id: params.addOnId } });

          const remainingAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info({ tenantId, deletedAddOnId: params.addOnId }, '[Agent] AddOn deleted');

          res.json({
            deletedId: params.addOnId,
            totalCount: remainingAddOns,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-addons');
    }
  });
}
