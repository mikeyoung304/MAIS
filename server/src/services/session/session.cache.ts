/**
 * Session Cache (LRU with TTL)
 *
 * In-memory cache for active chat sessions to reduce database load.
 * Uses battle-tested lru-cache package for LRU eviction with TTL-based expiration.
 *
 * Architecture:
 * - TTL: 5 minutes (context is refreshed via database anyway)
 * - Max entries: 2000 sessions (memory-safe)
 * - O(1) operations via lru-cache internals
 *
 * Security:
 * - Cache keys include tenantId to prevent cross-tenant access
 * - Cached data is encrypted (stored encrypted, not decrypted in cache)
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 2.2
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../../lib/core/logger';
import type { SessionWithMessages } from './session.schemas';

// =============================================================================
// TYPES
// =============================================================================

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
 * LRU cache for active sessions using lru-cache package
 *
 * Replaces custom 248-line implementation with battle-tested library.
 * Same interface, same behavior, fewer bugs.
 */
export class SessionCache {
  private cache: LRUCache<string, SessionWithMessages>;
  private config: SessionCacheConfig;

  constructor(config: Partial<SessionCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new LRUCache<string, SessionWithMessages>({
      max: this.config.maxEntries,
      ttl: this.config.ttlMs,
    });
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
    const session = this.cache.get(key);

    if (!session) {
      return null;
    }

    logger.debug({ sessionId, tenantId }, 'Session cache hit');
    return session;
  }

  /**
   * Set cached session
   *
   * Evicts oldest entry if at capacity before adding new entry.
   */
  set(sessionId: string, tenantId: string, session: SessionWithMessages): void {
    const key = this.getCacheKey(sessionId, tenantId);
    this.cache.set(key, session);
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

    // Convert to array to avoid iterator issues with TypeScript
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
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
   * Cleanup expired entries
   * Note: lru-cache handles TTL expiration automatically on access,
   * but this method can be called to proactively purge expired entries.
   */
  cleanup(): number {
    const sizeBefore = this.cache.size;
    this.cache.purgeStale();
    const evicted = sizeBefore - this.cache.size;

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
