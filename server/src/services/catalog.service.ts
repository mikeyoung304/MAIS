/**
 * Catalog domain service
 */

import type {
  CatalogRepository,
  CreateTierInput,
  UpdateTierInput,
  CreateAddOnInput,
  UpdateAddOnInput,
  CacheServicePort,
} from '../lib/ports';
import type { Tier, AddOn } from '../lib/entities';
import { NotFoundError, ValidationError } from '../lib/errors';
import {
  cachedOperation,
  invalidateCacheKeys,
  getCatalogInvalidationKeys,
  getSegmentCatalogInvalidationKeys,
  getAddOnInvalidationKeys,
} from '../lib/cache-helpers';
import { validatePrice, validateRequiredFields } from '../lib/validation';
import type { AuditService } from './audit.service';
import type { PrismaSegmentRepository } from '../adapters/prisma/segment.repository';
import type { PrismaClient } from '../generated/prisma/client';
import { resolveOrCreateGeneralSegment, validateSegmentOwnership } from '../lib/segment-utils';
import { logger } from '../lib/core/logger';

export interface TierWithAddOns extends Tier {
  addOns: AddOn[];
}

/**
 * Optional audit context for tracking who made changes
 */
export interface AuditContext {
  userId?: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly cache?: CacheServicePort,
    private readonly auditService?: AuditService,
    private readonly segmentRepo?: PrismaSegmentRepository,
    private readonly prisma?: PrismaClient
  ) {}

  /**
   * Retrieves all tiers with their add-ons for a tenant
   *
   * MULTI-TENANT: Filters tiers by tenantId for data isolation
   * Uses optimized single-query method to avoid N+1 problem.
   */
  async getAllTiers(tenantId: string): Promise<TierWithAddOns[]> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'all-tiers'],
        ttl: 900,
      },
      () => this.repository.getAllTiersWithAddOns(tenantId)
    );
  }

  /**
   * Count active tiers for a tenant.
   * Used as a prerequisite check (e.g., onboarding completion requires at least 1 tier).
   */
  async countTiers(tenantId: string): Promise<number> {
    if (!this.prisma) {
      throw new ValidationError('Prisma client not configured');
    }
    return this.prisma.tier.count({
      where: { tenantId, active: true },
    });
  }

  /**
   * Retrieves a single tier by slug with its add-ons
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   */
  async getTierBySlug(tenantId: string, slug: string): Promise<TierWithAddOns> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'tier', slug],
        ttl: 900,
      },
      async () => {
        const tier = await this.repository.getTierBySlugWithAddOns(tenantId, slug);
        if (!tier) {
          throw new NotFoundError(`Tier with slug "${slug}" not found`);
        }
        return tier;
      }
    );
  }

  /**
   * Retrieves a single tier by ID
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   */
  async getTierById(tenantId: string, id: string): Promise<Tier | null> {
    return this.repository.getTierById(tenantId, id);
  }

  /**
   * Retrieves all add-ons for a tenant
   *
   * MULTI-TENANT: Scoped to tenantId for data isolation
   */
  async getAllAddOns(tenantId: string): Promise<AddOn[]> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'all-addons'],
        ttl: 900,
      },
      () => this.repository.getAllAddOns(tenantId)
    );
  }

  /**
   * Retrieves an add-on by ID
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   */
  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    return this.repository.getAddOnById(tenantId, id);
  }

  // Tier CRUD operations

  async createTier(
    tenantId: string,
    data: CreateTierInput,
    auditCtx?: AuditContext
  ): Promise<Tier> {
    validateRequiredFields(data, ['slug', 'title', 'description'], 'Tier');
    validatePrice(data.priceCents, 'priceCents');

    // Check slug uniqueness within tenant
    const existing = await this.repository.getTierBySlug(tenantId, data.slug);
    if (existing) {
      throw new ValidationError(`Tier with slug "${data.slug}" already exists`);
    }

    // Segment validation & auto-assignment
    let resolvedSegmentId = data.segmentId;

    if (resolvedSegmentId) {
      if (this.prisma) {
        const segment = await validateSegmentOwnership(this.prisma, tenantId, resolvedSegmentId);
        if (!segment) {
          throw new ValidationError(
            'Segment not found or access denied. Use a valid segment ID for this tenant.'
          );
        }
        logger.debug(
          { tenantId, segmentId: resolvedSegmentId, segmentName: segment.name },
          'Tier linked to existing segment'
        );
      }
    } else {
      if (this.prisma) {
        const { segmentId, wasCreated } = await resolveOrCreateGeneralSegment(
          this.prisma,
          tenantId
        );
        resolvedSegmentId = segmentId;
        if (wasCreated) {
          logger.info(
            { tenantId, segmentId: resolvedSegmentId },
            'Created General segment and assigned tier'
          );
        } else if (segmentId) {
          logger.debug(
            { tenantId, segmentId: resolvedSegmentId },
            'Tier auto-assigned to General segment'
          );
        }
      } else {
        logger.warn({ tenantId }, 'No Prisma client available - tier created without segment');
      }
    }

    const result = await this.repository.createTier(tenantId, {
      ...data,
      segmentId: resolvedSegmentId ?? null,
    });

    // Audit log
    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'create',
        entityType: 'Tier',
        entityId: result.id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: null,
        afterSnapshot: result,
      });
    }

    await this.invalidateCatalogCache(tenantId);

    return result;
  }

  async updateTier(
    tenantId: string,
    id: string,
    data: UpdateTierInput,
    auditCtx?: AuditContext
  ): Promise<Tier> {
    const existing = await this.repository.getTierById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Tier with id "${id}" not found`);
    }

    if (data.priceCents !== undefined) {
      validatePrice(data.priceCents, 'priceCents');
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await this.repository.getTierBySlug(tenantId, data.slug);
      if (slugTaken) {
        throw new ValidationError(`Tier with slug "${data.slug}" already exists`);
      }
    }

    const result = await this.repository.updateTier(tenantId, id, data);

    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'update',
        entityType: 'Tier',
        entityId: result.id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: existing,
        afterSnapshot: result,
      });
    }

    await this.invalidateCatalogCache(tenantId);
    await this.invalidateTierCache(tenantId, existing.slug);
    if (data.slug && data.slug !== existing.slug) {
      await this.invalidateTierCache(tenantId, data.slug);
    }

    return result;
  }

  async deleteTier(tenantId: string, id: string, auditCtx?: AuditContext): Promise<void> {
    const existing = await this.repository.getTierById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Tier with id "${id}" not found`);
    }

    await this.repository.deleteTier(tenantId, id);

    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'delete',
        entityType: 'Tier',
        entityId: id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: existing,
        afterSnapshot: null,
      });
    }

    await this.invalidateCatalogCache(tenantId);
    await this.invalidateTierCache(tenantId, existing.slug);
  }

  // AddOn CRUD operations

  async createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn> {
    validateRequiredFields(data, ['tierId', 'title'], 'AddOn');
    validatePrice(data.priceCents, 'priceCents');

    // Verify tier exists
    const tier = await this.repository.getTierById(tenantId, data.tierId);
    if (!tier) {
      throw new NotFoundError(`Tier with id "${data.tierId}" not found`);
    }

    const result = await this.repository.createAddOn(tenantId, data);

    await this.invalidateTierCache(tenantId, tier.slug);
    await this.invalidateAddOnsCache(tenantId);

    return result;
  }

  async updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn> {
    const existing = await this.repository.getAddOnById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`AddOn with id "${id}" not found`);
    }

    if (data.priceCents !== undefined) {
      validatePrice(data.priceCents, 'priceCents');
    }

    // Verify tier exists if tierId is being updated
    let newTier;
    if (data.tierId) {
      newTier = await this.repository.getTierById(tenantId, data.tierId);
      if (!newTier) {
        throw new NotFoundError(`Tier with id "${data.tierId}" not found`);
      }
    }

    const result = await this.repository.updateAddOn(tenantId, id, data);

    // Targeted cache invalidation - only invalidate affected tiers
    const oldTier = await this.repository.getTierById(tenantId, existing.tierId);
    if (oldTier) {
      await this.invalidateTierCache(tenantId, oldTier.slug);
    }

    if (newTier && newTier.id !== existing.tierId) {
      await this.invalidateTierCache(tenantId, newTier.slug);
    }

    await this.invalidateAddOnsCache(tenantId);

    return result;
  }

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
    const existing = await this.repository.getAddOnById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`AddOn with id "${id}" not found`);
    }

    await this.repository.deleteAddOn(tenantId, id);

    const tier = await this.repository.getTierById(tenantId, existing.tierId);
    if (tier) {
      await this.invalidateTierCache(tenantId, tier.slug);
    }
    await this.invalidateAddOnsCache(tenantId);
  }

  // ============================================================================
  // SEGMENT-SCOPED CATALOG METHODS
  // ============================================================================

  async getTiersBySegment(tenantId: string, segmentId: string): Promise<Tier[]> {
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:tiers`;

    const cached = await this.cache?.get<Tier[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tiers = await this.repository.getTiersBySegment(tenantId, segmentId);

    await this.cache?.set(cacheKey, tiers, 900);

    return tiers;
  }

  async getTiersBySegmentWithAddOns(
    tenantId: string,
    segmentId: string
  ): Promise<TierWithAddOns[]> {
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:tiers-with-addons`;

    const cached = await this.cache?.get<TierWithAddOns[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tiers = await this.repository.getTiersBySegmentWithAddOns(tenantId, segmentId);

    await this.cache?.set(cacheKey, tiers, 900);

    return tiers;
  }

  async getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]> {
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:addons`;

    const cached = await this.cache?.get<AddOn[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const addOns = await this.repository.getAddOnsForSegment(tenantId, segmentId);

    await this.cache?.set(cacheKey, addOns, 900);

    return addOns;
  }

  // ============================================================================
  // Cache helpers
  // ============================================================================

  private async invalidateCatalogCache(tenantId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getCatalogInvalidationKeys(tenantId));
  }

  private async invalidateTierCache(tenantId: string, slug: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getCatalogInvalidationKeys(tenantId, slug));
  }

  private async invalidateSegmentCatalogCache(tenantId: string, segmentId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getSegmentCatalogInvalidationKeys(tenantId, segmentId));
  }

  private async invalidateAddOnsCache(tenantId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getAddOnInvalidationKeys(tenantId));
  }
}
