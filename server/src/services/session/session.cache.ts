/**
 * Session Cache (LRU with TTL)
 *
 * In-memory cache for active chat sessions to reduce database load.
 * Uses LRU eviction with TTL-based expiration.
 *
 * Architecture:
 * - TTL: 5 minutes (context is refreshed via database anyway)
 * - Max entries: 2000 sessions (memory-safe)
 * - O(1) operations via Map insertion order
 *
 * Security:
 * - Cache keys include tenantId to prevent cross-tenant access
 * - Cached data is encrypted (stored encrypted, not decrypted in cache)
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 2.2
 * @see server/src/agent/context/context-cache.ts (pattern reference)
 */

import { logger } from '../../lib/core/logger';
import type { SessionWithMessages } from './session.schemas';

// =============================================================================
// TYPES
// =============================================================================

interface CacheEntry {
  session: SessionWithMessages;
  cachedAt: number;
}

export interface SessionCacheConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs: number;
  /** Maximum entries to keep (default: 2000) */
  maxEntries: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: SessionCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 2000,
};

// =============================================================================
// CACHE CLASS
// =============================================================================

/**
 * LRU cache for active sessions
 *
 * Following pattern from context-cache.ts:
 * - TTL-based expiration
 * - Max entry limit with LRU eviction
 * - O(1) cache operations via Map insertion order
 *
 * PERFORMANCE: Map.keys().next() returns the first (oldest) key in O(1).
 * Combined with delete + set to move accessed entries to end, this provides
 * true LRU behavior without linked list overhead.
 */
export class SessionCache {
  private cache = new Map<string, CacheEntry>();
  private config: SessionCacheConfig;

  constructor(config: Partial<SessionCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key from sessionId and tenantId
   * CRITICAL: Include tenantId to prevent cross-tenant cache access
   */
  private getCacheKey(sessionId: string, tenantId: string): string {
    return `session:${tenantId}:${sessionId}`;
  }

  /**
   * Get cached session if valid
   *
   * Returns null if:
   * - Session not in cache
   * - Session expired (TTL exceeded)
   */
  get(sessionId: string, tenantId: string): SessionWithMessages | null {
    const key = this.getCacheKey(sessionId, tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.cachedAt;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      logger.debug({ sessionId, tenantId, ageMs: age }, 'Session cache entry expired');
      return null;
    }

    // LRU: Move to end by delete + re-insert (Map preserves insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);

    logger.debug({ sessionId, tenantId, ageMs: age }, 'Session cache hit');
    return entry.session;
  }

  /**
   * Set cached session
   *
   * Evicts oldest entry if at capacity before adding new entry.
   */
  set(sessionId: string, tenantId: string, session: SessionWithMessages): void {
    const key = this.getCacheKey(sessionId, tenantId);

    // Evict oldest if at capacity and this is a new key
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      session,
      cachedAt: Date.now(),
    });

    logger.debug({ sessionId, tenantId }, 'Session cached');
  }

  /**
   * Invalidate cached session
   * Call this when session is modified (message appended, deleted, etc.)
   */
  invalidate(sessionId: string, tenantId: string): void {
    const key = this.getCacheKey(sessionId, tenantId);
    if (this.cache.delete(key)) {
      logger.debug({ sessionId, tenantId }, 'Session cache invalidated');
    }
  }

  /**
   * Invalidate all cached sessions for a tenant
   * Call this on tenant-level events (e.g., tenant deleted)
   */
  invalidateAllForTenant(tenantId: string): void {
    const prefix = `session:${tenantId}:`;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug({ tenantId, count }, 'Tenant sessions invalidated from cache');
    }
  }

  /**
   * Clear all cached sessions
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ entriesCleared: size }, 'Session cache cleared');
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
   * PERFORMANCE: Map.keys().next() returns the first key (oldest/LRU)
   * because we move accessed entries to the end via delete + set.
   */
  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      logger.debug({ evictedKey: oldestKey }, 'Session cache evicted oldest entry');
    }
  }

  /**
   * Cleanup expired entries
   * Call periodically to free memory from expired entries that weren't accessed
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
      logger.info({ evictedCount: evicted }, 'Session cache cleanup completed');
    }

    return evicted;
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

/**
 * Default singleton session cache instance
 * Use this for production code
 */
export const sessionCache = new SessionCache();

/**
 * Factory function for creating session cache instances
 *
 * Use this for:
 * - Tests: Create isolated cache instances with custom config
 * - Dependency injection: Inject custom caches into services
 *
 * @example
 * // In tests - short TTL for fast expiration tests
 * const testCache = createSessionCache({ ttlMs: 100 });
 *
 * // In tests - small size for eviction tests
 * const smallCache = createSessionCache({ maxEntries: 3 });
 */
export function createSessionCache(config?: Partial<SessionCacheConfig>): SessionCache {
  return new SessionCache(config);
}
