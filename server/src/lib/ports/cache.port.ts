/**
 * Cache Service Port — Key-value caching with TTL support
 */

/**
 * Default cache TTL in seconds (1 hour)
 * Applied when no explicit TTL is provided to prevent indefinite caching
 */
export const DEFAULT_CACHE_TTL_SECONDS = 3600;

/**
 * Cache Service Port
 *
 * Provides key-value caching with TTL support.
 * Implementations: Redis (production), In-Memory (development/fallback)
 *
 * CRITICAL: All cache keys MUST include tenantId to prevent cross-tenant data leakage
 * Example: `catalog:${tenantId}:tiers` NOT `catalog:tiers`
 *
 * TTL BEHAVIOR:
 * - All cache entries MUST have a TTL to prevent stale data
 * - Default TTL: 1 hour (3600 seconds) when not specified
 * - Recommended TTLs:
 *   - Catalog/tiers: 15 minutes (900s)
 *   - Availability: 5 minutes (300s)
 *   - User sessions: 1 hour (3600s)
 *   - Static content: 24 hours (86400s)
 */
export interface CacheServicePort {
  /**
   * Get value by key
   * Returns null if key doesn't exist or is expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value with TTL (time-to-live in seconds)
   * @param key - Cache key (must include tenantId for multi-tenant safety)
   * @param value - Value to cache (will be JSON serialized)
   * @param ttlSeconds - TTL in seconds (defaults to DEFAULT_CACHE_TTL_SECONDS = 3600)
   */
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;

  /**
   * Delete single key
   */
  del(key: string): Promise<void>;

  /**
   * Delete all keys matching pattern (e.g., "catalog:tenant_123:*")
   * Uses SCAN for Redis (production-safe), regex for in-memory
   * If no pattern provided, flushes all keys
   */
  flush(pattern?: string): Promise<void>;

  /**
   * Check if cache is available (health check)
   * Returns false if cache is down or unreachable
   */
  isConnected(): Promise<boolean>;

  /**
   * Get cache statistics for monitoring
   * Returns cache hit/miss rates and key count
   */
  getStats?(): Promise<{
    hits: number;
    misses: number;
    keys: number;
    totalRequests: number;
    hitRate: string;
  }>;
}
