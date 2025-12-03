/**
 * Caching utility helpers
 * Reduces duplication in service-level caching patterns
 */

import type { CacheServicePort } from './ports';

/**
 * Cache decorator options
 */
export interface CacheOptions {
  /** Cache TTL in seconds (default: 900 = 15 minutes) */
  ttl?: number;
  /** Cache key prefix (e.g., 'catalog', 'segments') */
  prefix: string;
  /** Cache key parts to join (e.g., [tenantId, 'packages']) */
  keyParts: string[];
}

/**
 * Generic cached operation wrapper
 * Handles get-or-fetch pattern with automatic caching
 *
 * @example
 * ```typescript
 * const packages = await cachedOperation(
 *   this.cache,
 *   {
 *     prefix: 'catalog',
 *     keyParts: [tenantId, 'all-packages'],
 *     ttl: 900
 *   },
 *   () => this.repository.getAllPackages(tenantId)
 * );
 * ```
 *
 * @param cache - Cache service instance
 * @param options - Cache options (prefix, key parts, TTL)
 * @param fetchFn - Function to fetch data on cache miss
 * @returns Cached or freshly fetched data
 */
export async function cachedOperation<T>(
  cache: CacheServicePort | undefined,
  options: CacheOptions,
  fetchFn: () => Promise<T>
): Promise<T> {
  const { prefix, keyParts, ttl = 900 } = options;

  // Build cache key
  const cacheKey = `${prefix}:${keyParts.join(':')}`;

  // Try cache first
  const cached = await cache?.get<T>(cacheKey);
  if (cached !== undefined && cached !== null) {
    return cached;
  }

  // Cache miss - fetch data
  const result = await fetchFn();

  // Cache the result
  await cache?.set(cacheKey, result, ttl);

  return result;
}

/**
 * Cache key builder for multi-tenant operations
 * Ensures tenantId is always included in cache keys
 *
 * @example
 * ```typescript
 * const key = buildCacheKey('catalog', tenantId, 'packages');
 * // Returns: "catalog:tenant_123:packages"
 * ```
 *
 * @param prefix - Cache key prefix (e.g., 'catalog', 'segments')
 * @param tenantId - Tenant ID for data isolation
 * @param parts - Additional key parts
 * @returns Formatted cache key
 */
export function buildCacheKey(prefix: string, tenantId: string, ...parts: string[]): string {
  return `${prefix}:${tenantId}:${parts.join(':')}`;
}

/**
 * Cache invalidation helper for tenant-scoped data
 * Invalidates multiple cache keys at once
 *
 * @example
 * ```typescript
 * await invalidateCacheKeys(this.cache, [
 *   buildCacheKey('catalog', tenantId, 'all-packages'),
 *   buildCacheKey('catalog', tenantId, 'package', slug)
 * ]);
 * ```
 *
 * @param cache - Cache service instance
 * @param keys - Array of cache keys to invalidate
 */
export async function invalidateCacheKeys(cache: CacheServicePort | undefined, keys: string[]): Promise<void> {
  if (!cache) return;

  // Invalidate all keys in parallel
  await Promise.all(keys.map(key => cache.del(key)));
}

/**
 * Cache invalidation pattern builder
 * Generates all cache keys that should be invalidated for a tenant operation
 *
 * PERFORMANCE: Only invalidates all-packages when no slug is provided.
 * When slug is provided, only invalidates that specific package cache.
 * This prevents thundering herd when updating single packages.
 *
 * @example
 * ```typescript
 * // Invalidate all packages (e.g., after creating new package)
 * const keys = getCatalogInvalidationKeys(tenantId);
 *
 * // Invalidate only specific package (e.g., after updating package)
 * const keys = getCatalogInvalidationKeys(tenantId, 'intimate-ceremony');
 * invalidateCacheKeys(this.cache, keys);
 * ```
 *
 * @param tenantId - Tenant ID
 * @param slug - Optional specific resource slug
 * @returns Array of cache keys to invalidate
 */
export function getCatalogInvalidationKeys(tenantId: string, slug?: string): string[] {
  // If slug provided, only invalidate that specific package (granular invalidation)
  if (slug) {
    return [buildCacheKey('catalog', tenantId, 'package', slug)];
  }

  // No slug - invalidate all packages (e.g., new package created)
  return [buildCacheKey('catalog', tenantId, 'all-packages')];
}

/**
 * Segment cache invalidation keys
 *
 * @param tenantId - Tenant ID
 * @param slug - Optional specific segment slug
 * @returns Array of cache keys to invalidate
 */
export function getSegmentInvalidationKeys(tenantId: string, slug?: string): string[] {
  const keys = [
    buildCacheKey('segments', tenantId, 'active'),
    buildCacheKey('segments', tenantId, 'all'),
  ];

  if (slug) {
    keys.push(
      buildCacheKey('segments', tenantId, 'slug', slug),
      buildCacheKey('segments', tenantId, 'slug', slug, 'with-relations')
    );
  }

  return keys;
}

/**
 * Segment-scoped catalog cache invalidation keys
 *
 * @param tenantId - Tenant ID
 * @param segmentId - Segment ID
 * @returns Array of cache keys to invalidate
 */
export function getSegmentCatalogInvalidationKeys(
  tenantId: string,
  segmentId: string
): string[] {
  return [
    buildCacheKey('catalog', tenantId, 'segment', segmentId, 'packages'),
    buildCacheKey('catalog', tenantId, 'segment', segmentId, 'packages-with-addons'),
    buildCacheKey('catalog', tenantId, 'segment', segmentId, 'addons'),
  ];
}

/**
 * Add-on cache invalidation keys
 *
 * @param tenantId - Tenant ID
 * @returns Array of cache keys to invalidate
 */
export function getAddOnInvalidationKeys(tenantId: string): string[] {
  return [buildCacheKey('catalog', tenantId, 'all-addons')];
}
