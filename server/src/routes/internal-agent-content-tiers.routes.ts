/**
 * Internal Agent Content Tiers Routes
 *
 * CRUD operations on bookable pricing tiers.
 *
 * Called by: tenant-agent's manage_tiers tool
 */

import type { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { handleError, TenantIdSchema, slugify } from './internal-agent-shared';
import type { MarketingRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Constants
// =============================================================================

const MAX_TIERS_PER_SEGMENT = 5;

// =============================================================================
// Schemas
// =============================================================================

const ManageTiersSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  tierId: z.string().min(1).optional(),
  segmentId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional(),
  priceCents: z.number().min(100, 'Price must be at least $1 (100 cents)').optional(),
  features: z.array(z.unknown()).optional(),
  sortOrder: z.number().min(1).max(99).optional(),
  bookingType: z.enum(['DATE', 'TIMESLOT']).optional(),
  durationMinutes: z.number().min(1).optional(),
  active: z.boolean().optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerTierRoutes(router: Router, deps: MarketingRoutesDeps): void {
  const { tenantRepo, prisma } = deps;

  // POST /manage-tiers - CRUD on bookable pricing tiers
  router.post('/manage-tiers', async (req: Request, res: Response) => {
    try {
      const params = ManageTiersSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-tiers' },
        '[Agent] Tier management request'
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
          const where: { tenantId: string; segmentId?: string } = { tenantId };
          if (params.segmentId) where.segmentId = params.segmentId;

          const tiers = await prisma.tier.findMany({
            where,
            include: { segment: { select: { name: true } } },
            orderBy: [{ segmentId: 'asc' }, { sortOrder: 'asc' }],
            take: 100, // pitfall #13: bounded query
          });

          const formatted = tiers.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            segmentId: t.segmentId,
            segmentName: t.segment.name,
            sortOrder: t.sortOrder,
            priceInDollars: Math.round(t.priceCents / 100),
            priceCents: t.priceCents,
            features: t.features as unknown[],
            bookingType: t.bookingType,
            active: t.active,
          }));

          res.json({
            tiers: formatted,
            totalCount: formatted.length,
            segmentId: params.segmentId,
          });
          return;
        }

        case 'create': {
          if (!params.segmentId || !params.name || params.priceCents === undefined) {
            res.status(400).json({
              error: 'create requires: segmentId, name, priceCents',
            });
            return;
          }

          // SECURITY: Verify segment belongs to tenant
          const segment = await prisma.segment.findFirst({
            where: { id: params.segmentId, tenantId },
          });
          if (!segment) {
            res.status(404).json({ error: 'Segment not found or access denied' });
            return;
          }

          // Enforce max tiers per segment
          const existingTierCount = await prisma.tier.count({
            where: { segmentId: params.segmentId, tenantId },
          });
          if (existingTierCount >= MAX_TIERS_PER_SEGMENT) {
            res.status(400).json({
              error: `Maximum ${MAX_TIERS_PER_SEGMENT} tiers per segment. Delete one first.`,
            });
            return;
          }

          // Price sanity bounds
          if (params.priceCents < 100 || params.priceCents > 5000000) {
            res.status(400).json({
              error: 'Price must be between $1 and $50,000',
            });
            return;
          }

          // Auto-compute sortOrder
          const maxSortTier = await prisma.tier.findFirst({
            where: { segmentId: params.segmentId, tenantId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          });
          const nextSort = params.sortOrder ?? (maxSortTier ? maxSortTier.sortOrder + 1 : 1);

          const slug = params.slug || slugify(params.name);

          const newTier = await prisma.tier.create({
            data: {
              tenantId,
              segmentId: params.segmentId,
              name: params.name,
              slug,
              description: params.description ?? null,
              priceCents: params.priceCents,
              features: (params.features ?? []) as unknown as string,
              sortOrder: nextSort,
              bookingType: params.bookingType ?? 'DATE',
              durationMinutes: params.durationMinutes ?? null,
              active: params.active ?? true,
            },
            include: { segment: { select: { name: true } } },
          });

          const allTiers = await prisma.tier.count({
            where: { segmentId: params.segmentId, tenantId },
          });

          logger.info(
            { tenantId, tierId: newTier.id, name: newTier.name, segmentId: params.segmentId },
            '[Agent] Tier created'
          );

          res.json({
            tier: {
              id: newTier.id,
              name: newTier.name,
              slug: newTier.slug,
              segmentId: newTier.segmentId,
              segmentName: newTier.segment.name,
              sortOrder: newTier.sortOrder,
              priceInDollars: Math.round(newTier.priceCents / 100),
              priceCents: newTier.priceCents,
              features: newTier.features as unknown[],
              bookingType: newTier.bookingType,
              active: newTier.active,
            },
            totalCount: allTiers,
          });
          return;
        }

        case 'update': {
          if (!params.tierId) {
            res.status(400).json({ error: 'tierId is required for update' });
            return;
          }

          // SECURITY: Verify tier belongs to tenant (pitfall #1)
          const existing = await prisma.tier.findFirst({
            where: { id: params.tierId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'Tier not found or access denied' });
            return;
          }

          // Price sanity bounds if updating price
          if (params.priceCents !== undefined) {
            if (params.priceCents < 100 || params.priceCents > 5000000) {
              res.status(400).json({ error: 'Price must be between $1 and $50,000' });
              return;
            }
          }

          const updateData: Record<string, unknown> = {};
          if (params.name) {
            updateData.name = params.name;
            if (!params.slug) updateData.slug = slugify(params.name);
          }
          if (params.slug) updateData.slug = params.slug;
          if (params.description !== undefined) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.priceCents = params.priceCents;
          if (params.features !== undefined) updateData.features = params.features;
          if (params.sortOrder !== undefined) updateData.sortOrder = params.sortOrder;
          if (params.bookingType) updateData.bookingType = params.bookingType;
          if (params.durationMinutes !== undefined)
            updateData.durationMinutes = params.durationMinutes;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await prisma.tier.update({
            where: { id: params.tierId },
            data: updateData,
            include: { segment: { select: { name: true } } },
          });

          const allTiers = await prisma.tier.count({
            where: { segmentId: updated.segmentId, tenantId },
          });

          logger.info(
            { tenantId, tierId: updated.id, updates: Object.keys(updateData) },
            '[Agent] Tier updated'
          );

          res.json({
            tier: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              segmentId: updated.segmentId,
              segmentName: updated.segment.name,
              sortOrder: updated.sortOrder,
              priceInDollars: Math.round(updated.priceCents / 100),
              priceCents: updated.priceCents,
              features: updated.features as unknown[],
              bookingType: updated.bookingType,
              active: updated.active,
            },
            totalCount: allTiers,
          });
          return;
        }

        case 'delete': {
          if (!params.tierId) {
            res.status(400).json({ error: 'tierId is required for delete' });
            return;
          }

          // SECURITY: Verify tier belongs to tenant
          const existing = await prisma.tier.findFirst({
            where: { id: params.tierId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'Tier not found or access denied' });
            return;
          }

          // Check for active bookings before deleting (onDelete: Restrict)
          const bookingCount = await prisma.booking.count({
            where: { tierId: params.tierId },
          });
          if (bookingCount > 0) {
            res.status(409).json({
              error: `Cannot delete tier with ${bookingCount} active booking(s). Deactivate instead.`,
            });
            return;
          }

          await prisma.tier.delete({ where: { id: params.tierId } });

          const remainingTiers = await prisma.tier.count({
            where: { segmentId: existing.segmentId, tenantId },
          });

          logger.info({ tenantId, deletedTierId: params.tierId }, '[Agent] Tier deleted');

          res.json({
            deletedId: params.tierId,
            totalCount: remainingTiers,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-tiers');
    }
  });
}
