/**
 * Tenant Admin Add-On Routes
 * GET /addons, GET /addons/:id, POST /addons, PUT /addons/:id, DELETE /addons/:id
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { CreateAddOnDtoSchema, UpdateAddOnDtoSchema } from '@macon/contracts';
import type { AddOn } from '../lib/entities';
import { addonReadLimiter, addonWriteLimiter } from '../middleware/rateLimiter';
import { paginateArray } from '../lib/pagination';
import { getTenantId, requireAuth } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

/**
 * DTO mapper function to avoid code duplication
 * Maps AddOn entity to API response format
 */
const mapAddOnToDto = (addOn: AddOn) => ({
  id: addOn.id,
  tierId: addOn.tierId,
  title: addOn.title,
  description: addOn.description ?? null,
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});

export function registerAddonRoutes(router: Router, deps: TenantAdminDeps): void {
  const { catalogService } = deps;

  // ============================================================================
  // Add-On Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/addons
   * List all add-ons for authenticated tenant
   */
  router.get(
    '/addons',
    addonReadLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const skip = Number(req.query.skip) || 0;
        const take = Math.min(Number(req.query.take) || 50, 100);

        const addOns = await catalogService.getAllAddOns(tenantId);
        res.json(paginateArray(addOns.map(mapAddOnToDto), skip, take));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /v1/tenant-admin/addons/:id
   * Get single add-on by ID (verifies ownership)
   */
  router.get(
    '/addons/:id',
    addonReadLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const addOn = await catalogService.getAddOnById(tenantId, req.params.id);
        if (!addOn) {
          res.status(404).json({ error: 'Add-on not found' });
          return;
        }

        res.json(mapAddOnToDto(addOn));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/tenant-admin/addons
   * Create new add-on for authenticated tenant
   */
  router.post(
    '/addons',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const data = CreateAddOnDtoSchema.parse(req.body);

        // SECURITY: Validate tier ownership - ensure tierId belongs to tenant
        const pkg = await catalogService.getTierById(tenantId, data.tierId);
        if (!pkg) {
          res.status(404).json({
            error: 'Invalid tier: tier not found or does not belong to this tenant',
          });
          return;
        }

        const addOn = await catalogService.createAddOn(tenantId, data);
        res.status(201).json(mapAddOnToDto(addOn));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /v1/tenant-admin/addons/:id
   * Update add-on (verifies ownership)
   */
  router.put(
    '/addons/:id',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        const { id } = req.params;
        const data = UpdateAddOnDtoSchema.parse(req.body);

        // SECURITY: If updating tierId, validate it belongs to tenant
        if (data.tierId) {
          const pkg = await catalogService.getTierById(tenantId, data.tierId);
          if (!pkg) {
            res.status(404).json({
              error: 'Invalid tier: tier not found or does not belong to this tenant',
            });
            return;
          }
        }

        const addOn = await catalogService.updateAddOn(tenantId, id, data);
        res.json(mapAddOnToDto(addOn));
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /v1/tenant-admin/addons/:id
   * Delete add-on (verifies ownership)
   */
  router.delete(
    '/addons/:id',
    addonWriteLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        await catalogService.deleteAddOn(tenantId, req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );
}

// Re-export for the aggregator (requireAuth is used by preview routes)
export { requireAuth };
