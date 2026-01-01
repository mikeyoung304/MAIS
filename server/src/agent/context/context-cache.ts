/**
 * Context Cache for Agent Sessions
 *
 * Provides in-memory caching of session context to reduce database load.
 * Uses LRU-like behavior with TTL-based expiration.
 *
 * Architecture:
 * - TTL: 5 minutes (context is refreshed via tools anyway)
 * - Max entries: 1000 tenants (memory-safe)
 * - Thread-safe: Uses atomic operations
 *
 * Why cache context?
 * - Session context is read on every message
 * - Data changes rarely within a conversation
 * - Tools provide fresh data when needed (refresh_context)
 */

import { logger } from '../../lib/core/logger';
import type { AgentSessionContext } from './context-builder';

/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  context: AgentSessionContext;
  cachedAt: number;
}

/**
 * Cache configuration
 */
export interface ContextCacheConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs: number;
  /** Maximum entries to keep (default: 1000) */
  maxEntries: number;
}

const DEFAULT_CONFIG: ContextCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
};

/**
 * In-memory context cache
 *
 * Exported for testability - use createContextCache() factory for custom instances.
 * For production code, import the singleton `contextCache` instead.
 */
export class ContextCache {
  private cache = new Map<string, CacheEntry>();
  private config: ContextCacheConfig;

  constructor(config: Partial<ContextCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key from tenantId
   * We cache per-tenant, not per-session, since context is tenant-specific
   */
  private getCacheKey(tenantId: string): string {
    return `ctx:${tenantId}`;
  }

  /**
   * Get cached context if valid
   *
   * PERFORMANCE: This uses Map insertion order as LRU.
   * On each access, the entry is deleted and re-inserted to move it to the "end"
   * (most recently used position). This enables O(1) eviction of the oldest entry.
   */
  get(tenantId: string): AgentSessionContext | null {
    const key = this.getCacheKey(tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.cachedAt;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      logger.debug({ tenantId, ageMs: age }, 'Context cache entry expired');
      return null;
    }

    // LRU: Move to end by delete + re-insert (Map preserves insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);

    logger.debug({ tenantId, ageMs: age }, 'Context cache hit');
    return entry.context;
  }

  /**
   * Set cached context
   */
  set(tenantId: string, context: AgentSessionContext): void {
    const key = this.getCacheKey(tenantId);

    // Evict old entries if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      context,
      cachedAt: Date.now(),
    });

    logger.debug({ tenantId }, 'Context cached');
  }

  /**
   * Invalidate cached context for a tenant
   * Call this when tenant data changes (e.g., after tool execution)
   */
  invalidate(tenantId: string): void {
    const key = this.getCacheKey(tenantId);
    if (this.cache.delete(key)) {
      logger.debug({ tenantId }, 'Context cache invalidated');
    }
  }

  /**
   * Clear all cached contexts
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ entriesCleared: size }, 'Context cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
    };
  }

  /**
   * Evict oldest entry (true LRU - O(1) operation)
   *
   * PERFORMANCE: Uses Map insertion order. The first key is always the
   * least recently used because get() moves accessed entries to the end.
   * This is O(1) instead of the previous O(n) scan.
   */
  private evictOldest(): void {
    // Map.keys().next() returns the first key (oldest/LRU) in O(1)
    const oldestKey = this.cache.keys().next().value;

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      logger.debug({ evictedKey: oldestKey }, 'Context cache evicted oldest entry');
    }
  }

  /**
   * Cleanup expired entries (call periodically if needed)
   */
  cleanup(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt > this.config.ttlMs) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.info({ evictedCount: evicted }, 'Context cache cleanup completed');
    }

    return evicted;
  }
}

/**
 * Factory function for creating context cache instances
 *
 * Use this for:
 * - Tests: Create isolated cache instances with custom config
 * - Dependency injection: Inject custom caches into services
 *
 * @example
 * // In tests - short TTL for fast expiration tests
 * const testCache = createContextCache({ ttlMs: 100 });
 *
 * // In tests - small size for eviction tests
 * const smallCache = createContextCache({ maxEntries: 3 });
 */
export function createContextCache(config?: Partial<ContextCacheConfig>): ContextCache {
  return new ContextCache(config);
}

/**
 * Default singleton context cache instance
 *
 * Use `defaultContextCache` for explicit naming (preferred in new code).
 * Use `contextCache` for backward compatibility with existing imports.
 *
 * For tests, use createContextCache() to create isolated instances.
 */
export const defaultContextCache = createContextCache();

/**
 * Backward-compatible alias for defaultContextCache
 * @deprecated Prefer `defaultContextCache` for new code
 */
export const contextCache = defaultContextCache;

/**
 * Update the session ID in a cached context
 * Context is per-tenant but sessions vary - update sessionId on retrieval
 */
export function withSessionId(
  context: AgentSessionContext,
  sessionId: string
): AgentSessionContext {
  return {
    ...context,
    sessionId,
  };
}
