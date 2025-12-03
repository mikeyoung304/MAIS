/**
 * Catalog domain service
 */

import type {
  CatalogRepository,
  CreatePackageInput,
  UpdatePackageInput,
  CreateAddOnInput,
  UpdateAddOnInput,
  CacheServicePort,
} from '../lib/ports';
import type { Package, AddOn } from '../lib/entities';
import { NotFoundError, ValidationError } from '../lib/errors';
import {
  cachedOperation,
  buildCacheKey,
  invalidateCacheKeys,
  getCatalogInvalidationKeys,
  getSegmentCatalogInvalidationKeys,
  getAddOnInvalidationKeys,
} from '../lib/cache-helpers';
import { validatePrice, validateRequiredFields } from '../lib/validation';
import type { AuditService } from './audit.service';

export interface PackageWithAddOns extends Package {
  addOns: AddOn[];
}

/**
 * Optional audit context for tracking who made changes
 * TODO: Replace with proper auth context from middleware in Sprint 3
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
    private readonly auditService?: AuditService
  ) {}

  /**
   * Retrieves all wedding packages with their add-ons for a tenant
   *
   * MULTI-TENANT: Filters packages by tenantId for data isolation
   * Uses optimized single-query method to avoid N+1 problem (91% query reduction).
   * Implements application-level caching with 15-minute TTL for performance.
   * Cache keys include tenantId to prevent cross-tenant cache leaks.
   * Critical for catalog page performance.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of packages with nested add-ons
   *
   * @example
   * ```typescript
   * const packages = await catalogService.getAllPackages('tenant_123');
   * // Returns: [{ id: 'pkg1', title: 'Intimate', addOns: [...] }, ...]
   * ```
   */
  async getAllPackages(tenantId: string): Promise<PackageWithAddOns[]> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'all-packages'],
        ttl: 900, // 15 minutes
      },
      () => this.repository.getAllPackagesWithAddOns(tenantId)
    );
  }

  /**
   * Retrieves a single package by slug with its add-ons for a tenant
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   * Uses application-level caching with 15-minute TTL.
   * Used for package detail pages and checkout flow.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param slug - Package URL slug (e.g., "intimate-ceremony")
   *
   * @returns Package with nested add-ons array
   *
   * @throws {NotFoundError} If package doesn't exist for this tenant
   *
   * @example
   * ```typescript
   * const pkg = await catalogService.getPackageBySlug('tenant_123', 'intimate-ceremony');
   * console.log(`${pkg.title}: $${pkg.priceCents / 100}`);
   * ```
   */
  async getPackageBySlug(tenantId: string, slug: string): Promise<PackageWithAddOns> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'package', slug],
        ttl: 900, // 15 minutes
      },
      async () => {
        const pkg = await this.repository.getPackageBySlug(tenantId, slug);
        if (!pkg) {
          throw new NotFoundError(`Package with slug "${slug}" not found`);
        }
        const addOns = await this.repository.getAddOnsByPackageId(tenantId, pkg.id);
        return { ...pkg, addOns };
      }
    );
  }

  /**
   * Retrieves a single package by ID for a tenant
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   * Used for tenant admin operations (photo upload, editing).
   * Returns package without add-ons for performance.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Package ID
   *
   * @returns Package or null if not found for this tenant
   *
   * @example
   * ```typescript
   * const pkg = await catalogService.getPackageById('tenant_123', 'pkg_abc');
   * if (!pkg) throw new Error('Not found');
   * console.log(`Found: ${pkg.title}`);
   * ```
   */
  async getPackageById(tenantId: string, id: string): Promise<Package | null> {
    return this.repository.getPackageById(tenantId, id);
  }

  /**
   * Retrieves all add-ons for a tenant
   *
   * MULTI-TENANT: Scoped to tenantId for data isolation
   * Used for tenant admin add-on management.
   * Implements application-level caching with 15-minute TTL.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of all add-ons for the tenant
   *
   * @example
   * ```typescript
   * const addOns = await catalogService.getAllAddOns('tenant_123');
   * // Returns: [{ id: 'addon1', title: 'Video Recording', priceCents: 50000, ... }, ...]
   * ```
   */
  async getAllAddOns(tenantId: string): Promise<AddOn[]> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'catalog',
        keyParts: [tenantId, 'all-addons'],
        ttl: 900, // 15 minutes
      },
      () => this.repository.getAllAddOns(tenantId)
    );
  }

  /**
   * Retrieves an add-on by ID for a tenant
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   * Used for tenant admin add-on management.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Add-on ID
   * @returns Add-on or null if not found for this tenant
   */
  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    return this.repository.getAddOnById(tenantId, id);
  }

  // Package CRUD operations
  // NOTE: These methods will need tenantId parameter and repository updates
  // after multi-tenant migration is applied

  async createPackage(
    tenantId: string,
    data: CreatePackageInput,
    auditCtx?: AuditContext
  ): Promise<Package> {
    // Validate required fields
    validateRequiredFields(data, ['slug', 'title', 'description'], 'Package');
    validatePrice(data.priceCents, 'priceCents');

    // Check slug uniqueness within tenant
    const existing = await this.repository.getPackageBySlug(tenantId, data.slug);
    if (existing) {
      throw new ValidationError(`Package with slug "${data.slug}" already exists`);
    }

    const result = await this.repository.createPackage(tenantId, data);

    // Audit log (Sprint 2.1 - legacy CRUD tracking during migration)
    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'create',
        entityType: 'Package',
        entityId: result.id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: null, // No previous state for creates
        afterSnapshot: result,
      });
    }

    // Invalidate catalog cache for this tenant
    await this.invalidateCatalogCache(tenantId);

    return result;
  }

  async updatePackage(
    tenantId: string,
    id: string,
    data: UpdatePackageInput,
    auditCtx?: AuditContext
  ): Promise<Package> {
    // Check if package exists
    const existing = await this.repository.getPackageById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Package with id "${id}" not found`);
    }

    // Validate price if provided
    if (data.priceCents !== undefined) {
      validatePrice(data.priceCents, 'priceCents');
    }

    // Check slug uniqueness if slug is being updated
    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await this.repository.getPackageBySlug(tenantId, data.slug);
      if (slugTaken) {
        throw new ValidationError(`Package with slug "${data.slug}" already exists`);
      }
    }

    const result = await this.repository.updatePackage(tenantId, id, data);

    // Audit log (Sprint 2.1 - legacy CRUD tracking during migration)
    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'update',
        entityType: 'Package',
        entityId: result.id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: existing,
        afterSnapshot: result,
      });
    }

    // Targeted cache invalidation
    // PERFORMANCE: Only invalidate specific package cache(s), not all-packages
    // Updating package details (price, title) doesn't affect the package list itself
    // Must invalidate all-packages ONLY when it might appear in cached list differently
    await this.invalidateCatalogCache(tenantId); // all-packages contains package summaries
    await this.invalidatePackageCache(tenantId, existing.slug);
    if (data.slug && data.slug !== existing.slug) {
      await this.invalidatePackageCache(tenantId, data.slug);
    }

    return result;
  }

  async deletePackage(
    tenantId: string,
    id: string,
    auditCtx?: AuditContext
  ): Promise<void> {
    // Check if package exists
    const existing = await this.repository.getPackageById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Package with id "${id}" not found`);
    }

    await this.repository.deletePackage(tenantId, id);

    // Audit log (Sprint 2.1 - legacy CRUD tracking during migration)
    if (this.auditService && auditCtx) {
      await this.auditService.trackLegacyChange({
        tenantId,
        changeType: 'package_crud',
        operation: 'delete',
        entityType: 'Package',
        entityId: id,
        userId: auditCtx.userId,
        email: auditCtx.email,
        role: auditCtx.role,
        beforeSnapshot: existing,
        afterSnapshot: null, // Entity no longer exists
      });
    }

    // Invalidate all-packages cache (package removed from list)
    await this.invalidateCatalogCache(tenantId);
    // Also invalidate the specific package cache
    await this.invalidatePackageCache(tenantId, existing.slug);
  }

  // AddOn CRUD operations

  async createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn> {
    // Validate required fields
    validateRequiredFields(data, ['packageId', 'title'], 'AddOn');
    validatePrice(data.priceCents, 'priceCents');

    // Verify package exists
    const pkg = await this.repository.getPackageById(tenantId, data.packageId);
    if (!pkg) {
      throw new NotFoundError(`Package with id "${data.packageId}" not found`);
    }

    const result = await this.repository.createAddOn(tenantId, data);

    // Targeted cache invalidation - only invalidate affected package and all-addons cache
    // Add-on creation doesn't affect all-packages list, just the specific package's add-ons
    await this.invalidatePackageCache(tenantId, pkg.slug);
    await this.invalidateAddOnsCache(tenantId);

    return result;
  }

  async updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn> {
    // Fetch existing add-on to know which package cache to invalidate
    const existing = await this.repository.getAddOnById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`AddOn with id "${id}" not found`);
    }

    // Validate price if provided
    if (data.priceCents !== undefined) {
      validatePrice(data.priceCents, 'priceCents');
    }

    // Verify package exists if packageId is being updated
    let newPackage;
    if (data.packageId) {
      newPackage = await this.repository.getPackageById(tenantId, data.packageId);
      if (!newPackage) {
        throw new NotFoundError(`Package with id "${data.packageId}" not found`);
      }
    }

    const result = await this.repository.updateAddOn(tenantId, id, data);

    // Targeted cache invalidation - only invalidate affected packages
    // No need to invalidate all-packages since add-on updates don't affect package list
    const oldPackage = await this.repository.getPackageById(tenantId, existing.packageId);
    if (oldPackage) {
      await this.invalidatePackageCache(tenantId, oldPackage.slug);
    }

    // If package changed, also invalidate new package cache
    if (newPackage && newPackage.id !== existing.packageId) {
      await this.invalidatePackageCache(tenantId, newPackage.slug);
    }

    // Also invalidate all-addons cache
    await this.invalidateAddOnsCache(tenantId);

    return result;
  }

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
    // Fetch add-on first to know which package cache to invalidate
    const existing = await this.repository.getAddOnById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`AddOn with id "${id}" not found`);
    }

    await this.repository.deleteAddOn(tenantId, id);

    // Targeted cache invalidation - only invalidate affected package and all-addons cache
    // No need to invalidate all-packages since add-on deletion doesn't affect package list
    const pkg = await this.repository.getPackageById(tenantId, existing.packageId);
    if (pkg) {
      await this.invalidatePackageCache(tenantId, pkg.slug);
    }
    await this.invalidateAddOnsCache(tenantId);
  }

  // ============================================================================
  // SEGMENT-SCOPED CATALOG METHODS (Phase A - Segment Implementation)
  // ============================================================================

  /**
   * Get packages for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   * Used for segment landing pages
   * Implements application-level caching with 15-minute TTL
   * Packages ordered by groupingOrder for proper display (e.g., Solo/Couple/Group)
   *
   * @param tenantId - Tenant ID for data isolation
   * @param segmentId - Segment ID to filter packages
   * @returns Array of packages ordered by groupingOrder then createdAt
   *
   * @example
   * ```typescript
   * const packages = await catalogService.getPackagesBySegment('tenant_123', 'wellness-retreat-id');
   * // Returns: [{ id: 'pkg1', title: 'Weekend Detox', grouping: 'Solo', ... }, ...]
   * ```
   */
  async getPackagesBySegment(tenantId: string, segmentId: string): Promise<Package[]> {
    // CRITICAL: Cache key includes tenantId AND segmentId
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:packages`;

    // Try cache first
    const cached = await this.cache?.get<Package[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from repository
    const packages = await this.repository.getPackagesBySegment(tenantId, segmentId);

    // Cache for 15 minutes (900 seconds)
    await this.cache?.set(cacheKey, packages, 900);

    return packages;
  }

  /**
   * Get packages with add-ons for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   * Returns packages with both segment-specific and global add-ons
   * Used for segment landing pages to display complete offering
   *
   * @param tenantId - Tenant ID for data isolation
   * @param segmentId - Segment ID to filter packages
   * @returns Array of packages with add-ons, ordered by grouping
   *
   * @example
   * ```typescript
   * const packages = await catalogService.getPackagesBySegmentWithAddOns('tenant_123', 'wellness-retreat-id');
   * // Returns: [
   * //   { id: 'pkg1', title: 'Weekend Detox', addOns: [
   * //     { title: 'Farm-Fresh Meals' },      // Global add-on (segmentId = null)
   * //     { title: 'Yoga Session' }            // Wellness-specific add-on
   * //   ]},
   * //   ...
   * // ]
   * ```
   */
  async getPackagesBySegmentWithAddOns(
    tenantId: string,
    segmentId: string
  ): Promise<PackageWithAddOns[]> {
    // CRITICAL: Cache key includes tenantId AND segmentId
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:packages-with-addons`;

    // Try cache first
    const cached = await this.cache?.get<PackageWithAddOns[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from repository
    const packages = await this.repository.getPackagesBySegmentWithAddOns(tenantId, segmentId);

    // Cache for 15 minutes (900 seconds)
    await this.cache?.set(cacheKey, packages, 900);

    return packages;
  }

  /**
   * Get add-ons available for a segment
   *
   * Returns both:
   * - Add-ons scoped to this specific segment (segmentId = specified)
   * - Global add-ons available to all segments (segmentId = null)
   *
   * Used for segment landing pages and package detail pages within a segment
   *
   * @param tenantId - Tenant ID for data isolation
   * @param segmentId - Segment ID to filter add-ons
   * @returns Array of add-ons ordered by createdAt
   *
   * @example
   * ```typescript
   * const addOns = await catalogService.getAddOnsForSegment('tenant_123', 'wellness-retreat-id');
   * // Returns: [
   * //   { title: 'Farm-Fresh Meals', priceCents: 15000 },  // Global
   * //   { title: 'Yoga Session', priceCents: 7500 }        // Wellness-specific
   * // ]
   * ```
   */
  async getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]> {
    // CRITICAL: Cache key includes tenantId AND segmentId
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:addons`;

    // Try cache first
    const cached = await this.cache?.get<AddOn[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from repository
    const addOns = await this.repository.getAddOnsForSegment(tenantId, segmentId);

    // Cache for 15 minutes (900 seconds)
    await this.cache?.set(cacheKey, addOns, 900);

    return addOns;
  }

  /**
   * Invalidate all catalog-related cache entries for a tenant
   * MULTI-TENANT: Only invalidates cache for the specified tenant
   *
   * NOTE: This does NOT invalidate segment-scoped caches. Use
   * invalidateSegmentCatalogCache() for segment-specific invalidation.
   *
   * @param tenantId - Tenant whose cache should be invalidated
   */
  private async invalidateCatalogCache(tenantId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getCatalogInvalidationKeys(tenantId));
  }

  /**
   * Invalidate specific package cache entry
   *
   * @param tenantId - Tenant ID
   * @param slug - Package slug
   */
  private async invalidatePackageCache(tenantId: string, slug: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getCatalogInvalidationKeys(tenantId, slug));
  }

  /**
   * Invalidate segment-scoped catalog cache entries
   *
   * Called when packages or add-ons are updated/deleted within a segment
   * Invalidates all segment-related caches for proper cache consistency
   *
   * @param tenantId - Tenant ID
   * @param segmentId - Segment ID whose cache should be invalidated
   *
   * @private
   */
  private async invalidateSegmentCatalogCache(tenantId: string, segmentId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getSegmentCatalogInvalidationKeys(tenantId, segmentId));
  }

  /**
   * Invalidate all-addons cache entry
   *
   * Called when add-ons are created, updated, or deleted
   *
   * @param tenantId - Tenant ID
   * @private
   */
  private async invalidateAddOnsCache(tenantId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getAddOnInvalidationKeys(tenantId));
  }
}
