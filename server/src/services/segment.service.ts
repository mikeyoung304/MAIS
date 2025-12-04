/**
 * Segment domain service
 * Handles business logic for tenant segments (e.g., "Wellness Retreat", "Micro-Wedding")
 */

import type { Segment, Package, AddOn, PackageAddOn } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../lib/errors';
import type { CacheServicePort, StorageProvider } from '../lib/ports';
import {
  cachedOperation,
  buildCacheKey,
  invalidateCacheKeys,
  getSegmentInvalidationKeys,
} from '../lib/cache-helpers';
import type {
  PrismaSegmentRepository,
  CreateSegmentInput,
  UpdateSegmentInput,
} from '../adapters/prisma/segment.repository';
import { logger } from '../lib/core/logger';

export interface PackageWithAddOns extends Package {
  addOns?: {
    addOn: AddOn;
  }[];
}

export interface SegmentWithRelations extends Segment {
  packages?: PackageWithAddOns[];
  addOns?: AddOn[];
}

/**
 * Segment service for business logic
 * Manages tenant segments with caching and validation
 */
export class SegmentService {
  constructor(
    private readonly repository: PrismaSegmentRepository,
    private readonly cache?: CacheServicePort,
    private readonly storageProvider?: StorageProvider
  ) {}

  /**
   * Get all segments for a tenant
   *
   * MULTI-TENANT: Filters segments by tenantId for data isolation
   * Uses application-level caching with 15-minute TTL
   * Ordered by sortOrder for consistent navigation display
   *
   * @param tenantId - Tenant ID for data isolation
   * @param onlyActive - Filter to only active segments (default: true)
   * @returns Array of segments ordered by sortOrder
   */
  async getSegments(tenantId: string, onlyActive = true): Promise<Segment[]> {
    return cachedOperation(
      this.cache,
      {
        prefix: 'segments',
        keyParts: [tenantId, onlyActive ? 'active' : 'all'],
        ttl: 900, // 15 minutes
      },
      () => this.repository.findByTenant(tenantId, onlyActive)
    );
  }

  /**
   * Get single segment by ID with tenant isolation
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   * Used for tenant admin operations
   *
   * @param tenantId - Tenant ID for data isolation (CRITICAL: prevents cross-tenant access)
   * @param id - Segment ID
   * @returns Segment
   * @throws {NotFoundError} If segment doesn't exist or access denied
   */
  async getSegmentById(tenantId: string, id: string): Promise<Segment> {
    // CRITICAL: Cache key includes tenantId
    const cacheKey = `segments:${tenantId}:id:${id}`;

    const cached = await this.cache?.get<Segment>(cacheKey);
    if (cached) {
      return cached;
    }

    const segment = await this.repository.findById(tenantId, id);

    if (!segment) {
      throw new NotFoundError(`Segment not found or access denied: ${id}`);
    }

    // Cache for 15 minutes
    await this.cache?.set(cacheKey, segment, 900);

    return segment;
  }

  /**
   * Get single segment by slug
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant access
   * Uses application-level caching
   * Used for segment landing pages
   *
   * @param tenantId - Tenant ID for data isolation
   * @param slug - Segment URL slug (e.g., "wellness-retreat")
   * @returns Segment
   * @throws {NotFoundError} If segment doesn't exist for this tenant
   */
  async getSegmentBySlug(tenantId: string, slug: string): Promise<Segment> {
    // CRITICAL: Cache key includes tenantId
    const cacheKey = `segments:${tenantId}:slug:${slug}`;

    // Try cache first
    const cached = await this.cache?.get<Segment>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from repository
    const segment = await this.repository.findBySlug(tenantId, slug);

    if (!segment) {
      throw new NotFoundError(`Segment not found: ${slug}`);
    }

    // Cache for 15 minutes
    await this.cache?.set(cacheKey, segment, 900);

    return segment;
  }

  /**
   * Get segment with packages and add-ons
   *
   * Used for public segment landing pages
   * Returns packages grouped by optional `grouping` field
   *
   * @param tenantId - Tenant ID for data isolation
   * @param slug - Segment URL slug
   * @returns Segment with packages and add-ons
   * @throws {NotFoundError} If segment doesn't exist
   */
  async getSegmentWithRelations(tenantId: string, slug: string): Promise<SegmentWithRelations> {
    const cacheKey = `segments:${tenantId}:slug:${slug}:with-relations`;

    const cached = await this.cache?.get<SegmentWithRelations>(cacheKey);
    if (cached) {
      return cached;
    }

    const segment = await this.repository.findBySlugWithRelations(tenantId, slug);

    if (!segment) {
      throw new NotFoundError(`Segment not found: ${slug}`);
    }

    // Cache for 15 minutes
    await this.cache?.set(cacheKey, segment, 900);

    return segment;
  }

  /**
   * Create new segment
   *
   * Validates slug uniqueness and required fields
   * Invalidates tenant segment cache
   *
   * @param data - Segment creation data
   * @returns Created segment
   * @throws {ValidationError} If validation fails
   */
  async createSegment(data: CreateSegmentInput): Promise<Segment> {
    // Validate required fields
    if (!data.slug || !data.name || !data.heroTitle) {
      throw new ValidationError('Missing required fields: slug, name, heroTitle');
    }

    // Validate slug format (URL-safe)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(data.slug)) {
      throw new ValidationError('Slug must be lowercase alphanumeric with hyphens only');
    }

    // Check slug uniqueness
    const isAvailable = await this.repository.isSlugAvailable(data.tenantId, data.slug);
    if (!isAvailable) {
      throw new ValidationError(`Slug already exists: ${data.slug}`);
    }

    // Create segment
    const segment = await this.repository.create(data);

    // Invalidate cache
    this.invalidateSegmentCache(data.tenantId);

    return segment;
  }

  /**
   * Update segment with tenant isolation
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant modification
   * Validates slug uniqueness if slug is being changed
   * Invalidates related cache
   *
   * @param tenantId - Tenant ID for data isolation (CRITICAL: prevents cross-tenant modification)
   * @param id - Segment ID
   * @param data - Partial segment update data
   * @returns Updated segment
   * @throws {NotFoundError} If segment doesn't exist or access denied
   * @throws {ValidationError} If validation fails
   */
  async updateSegment(tenantId: string, id: string, data: UpdateSegmentInput): Promise<Segment> {
    // Verify segment exists and belongs to tenant
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Segment not found or access denied: ${id}`);
    }

    // Validate slug if being updated
    if (data.slug && data.slug !== existing.slug) {
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(data.slug)) {
        throw new ValidationError('Slug must be lowercase alphanumeric with hyphens only');
      }

      const isAvailable = await this.repository.isSlugAvailable(tenantId, data.slug, id);
      if (!isAvailable) {
        throw new ValidationError(`Slug already exists: ${data.slug}`);
      }
    }

    // Update segment
    const updated = await this.repository.update(tenantId, id, data);

    // Invalidate cache
    this.invalidateSegmentCache(tenantId, existing.slug);
    if (data.slug && data.slug !== existing.slug) {
      this.invalidateSegmentCache(tenantId, data.slug);
    }

    return updated;
  }

  /**
   * Delete segment with tenant isolation
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant deletion
   * Note: Packages will have segmentId set to null (onDelete: SetNull)
   * Invalidates cache
   *
   * @param tenantId - Tenant ID for data isolation (CRITICAL: prevents cross-tenant deletion)
   * @param id - Segment ID
   * @throws {NotFoundError} If segment doesn't exist or access denied
   */
  async deleteSegment(tenantId: string, id: string): Promise<void> {
    // Verify segment exists and belongs to tenant
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Segment not found or access denied: ${id}`);
    }

    // Clean up heroImage BEFORE deleting segment from database
    // This prevents orphaned files in storage
    if (existing.heroImage && this.storageProvider) {
      try {
        await this.storageProvider.deleteSegmentImage(existing.heroImage, tenantId);
      } catch (err) {
        // Don't block segment deletion if cleanup fails
        logger.warn(
          { err, heroImage: existing.heroImage, segmentId: id },
          'Failed to delete segment image - continuing with segment deletion'
        );
      }
    }

    // Delete segment
    await this.repository.delete(tenantId, id);

    // Invalidate cache
    this.invalidateSegmentCache(tenantId, existing.slug);

    logger.info({ tenantId, segmentId: id }, 'Segment deleted with image cleanup');
  }

  /**
   * Get segment statistics with tenant isolation
   *
   * MULTI-TENANT: Scoped to tenantId to prevent cross-tenant data access
   *
   * @param tenantId - Tenant ID for data isolation (CRITICAL: prevents cross-tenant access)
   * @param id - Segment ID
   * @returns Package and add-on counts
   * @throws {NotFoundError} If segment doesn't exist or access denied
   */
  async getSegmentStats(
    tenantId: string,
    id: string
  ): Promise<{
    packageCount: number;
    addOnCount: number;
  }> {
    // CRITICAL: Cache key includes tenantId
    const cacheKey = `segments:${tenantId}:${id}:stats`;

    const cached = await this.cache?.get<{ packageCount: number; addOnCount: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await this.repository.getStats(tenantId, id);

    // Cache for 5 minutes (shorter TTL for frequently changing data)
    await this.cache?.set(cacheKey, stats, 300);

    return stats;
  }

  /**
   * Invalidate segment cache for a tenant
   *
   * Called after create/update/delete operations
   *
   * @param tenantId - Tenant ID
   * @param slug - Optional specific segment slug to invalidate
   */
  private async invalidateSegmentCache(tenantId: string, slug?: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getSegmentInvalidationKeys(tenantId, slug));
  }
}
