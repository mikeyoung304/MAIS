/**
 * Admin routes for tenant management
 * Protected with admin authentication middleware
 *
 * Endpoints:
 * - GET    /api/v1/admin/tenants       - List all tenants
 * - POST   /api/v1/admin/tenants       - Create new tenant (atomic, includes segment + packages)
 * - GET    /api/v1/admin/tenants/:id   - Get tenant details
 * - PUT    /api/v1/admin/tenants/:id   - Update tenant
 * - DELETE /api/v1/admin/tenants/:id   - Deactivate tenant
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaTenantRepository } from '../../adapters/prisma/tenant.repository';
import type { TenantProvisioningService } from '../../services/tenant-provisioning.service';
import { ValidationError, NotFoundError } from '../../lib/errors';

/**
 * Options for admin tenants routes
 */
export interface AdminTenantsRoutesOptions {
  prisma: PrismaClient;
  provisioningService: TenantProvisioningService;
}

/**
 * Create admin tenants router with shared services from DI container
 * @param options - Services and dependencies from DI container (#634)
 */
export function createAdminTenantsRoutes(options: AdminTenantsRoutesOptions): Router {
  const { prisma, provisioningService } = options;
  const router = Router();
  const tenantRepo = new PrismaTenantRepository(prisma);

  /**
   * GET /api/v1/admin/tenants
   * List all tenants with stats
   * Query params:
   * - includeTest: 'true' | 'false' (optional, default: 'false')
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeTestTenants = req.query.includeTest === 'true';
      const tenants = await tenantRepo.listWithStats(includeTestTenants);

      res.json({
        tenants: tenants.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          email: t.email,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          stripeConnected: t.stripeOnboarded,
          packageCount: t.stats.packages,
          // Additional fields for detail view
          apiKeyPublic: t.apiKeyPublic,
          commissionPercent: t.commissionPercent,
          isActive: t.isActive,
          bookingCount: t.stats.bookings,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/admin/tenants
   * Create new tenant with API keys, default segment, and default packages
   *
   * This is an ATOMIC operation - either all data is created or none.
   * Prevents orphaned tenants without segments/packages.
   *
   * Body:
   * - slug: string (required, URL-safe identifier)
   * - name: string (required, display name)
   * - commission: number (optional, default 10.0)
   *
   * Returns:
   * - tenant: Created tenant object
   * - secretKey: SECRET API KEY (shown ONCE, never stored in plaintext)
   * - segment: Default "General" segment
   * - packages: Default packages (Basic/Standard/Premium)
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug, name, commission = 10.0 } = req.body;

      // Validation
      if (!slug || !name) {
        throw new ValidationError('slug and name are required');
      }

      if (typeof commission !== 'number' || commission < 0 || commission > 100) {
        throw new ValidationError('commission must be a number between 0 and 100');
      }

      // Check if slug already exists
      const existing = await tenantRepo.findBySlug(slug);
      if (existing) {
        throw new ValidationError(`Tenant with slug "${slug}" already exists`);
      }

      // Create fully provisioned tenant (atomic: tenant + segment + tiers)
      const result = await provisioningService.createFullyProvisioned({
        slug,
        name,
        commissionPercent: commission,
      });

      res.status(201).json({
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          apiKeyPublic: result.tenant.apiKeyPublic,
          commissionPercent: Number(result.tenant.commissionPercent),
          isActive: result.tenant.isActive,
          createdAt: result.tenant.createdAt.toISOString(),
        },
        secretKey: result.secretKey, // ⚠️ Shown ONCE, never stored in plaintext
        segment: {
          id: result.segment.id,
          slug: result.segment.slug,
          name: result.segment.name,
        },
        tiers: result.tiers.map((tier) => ({
          id: tier.id,
          slug: tier.slug,
          name: tier.name,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/admin/tenants/:id
   * Get tenant details with full stats
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const tenant = await tenantRepo.findByIdWithStats(id);

      if (!tenant) {
        throw new NotFoundError(`Tenant not found: ${id}`);
      }

      res.json({
        tenant: {
          ...tenant,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/v1/admin/tenants/:id
   * Update tenant settings
   *
   * Body (all optional):
   * - name: string
   * - commission: number
   * - branding: object
   * - isActive: boolean
   */
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, commission, branding, isActive } = req.body;

      // Validate commission if provided
      if (commission !== undefined) {
        if (typeof commission !== 'number' || commission < 0 || commission > 100) {
          throw new ValidationError('commission must be a number between 0 and 100');
        }
      }

      const tenant = await tenantRepo.update(id, {
        name,
        commissionPercent: commission,
        branding,
        isActive,
      });

      res.json({
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          apiKeyPublic: tenant.apiKeyPublic,
          commissionPercent: Number(tenant.commissionPercent),
          branding: tenant.branding,
          isActive: tenant.isActive,
          updatedAt: tenant.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/v1/admin/tenants/:id
   * Deactivate tenant (soft delete)
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await tenantRepo.deactivate(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
