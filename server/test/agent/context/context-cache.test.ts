/**
 * Context Cache Tests
 *
 * Tests for the in-memory context cache that reduces database load
 * for agent session context retrieval.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ContextCache,
  withSessionId,
  type ContextCacheConfig,
} from '../../../src/agent/context/context-cache';
import type { AgentSessionContext } from '../../../src/agent/context/context-builder';

/**
 * Create a valid mock context for testing
 */
function createMockContext(overrides: Partial<AgentSessionContext> = {}): AgentSessionContext {
  return {
    tenantId: 'tenant-123',
    sessionId: 'session-456',
    businessName: 'Test Business',
    businessSlug: 'test-business',
    contextPrompt: '## Your Business Context\n\nYou are helping **Test Business**.',
    quickStats: {
      stripeConnected: true,
      packageCount: 3,
      upcomingBookings: 5,
      totalBookings: 100,
      revenueThisMonth: 50000,
    },
    ...overrides,
  };
}

describe('ContextCache', () => {
  let cache: ContextCache;

  beforeEach(() => {
    cache = new ContextCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get()', () => {
    it('should return null for missing entries', () => {
      const result = cache.get('non-existent-tenant');
      expect(result).toBeNull();
    });

    it('should return cached value for existing entry', () => {
      const context = createMockContext();
      cache.set('tenant-123', context);

      const result = cache.get('tenant-123');
      expect(result).toEqual(context);
    });

    it('should return null and delete expired entries', () => {
      const context = createMockContext();
      cache.set('tenant-123', context);

      // Verify it exists initially
      expect(cache.get('tenant-123')).toEqual(context);

      // Advance time past TTL (default 5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Should return null and delete the entry
      const result = cache.get('tenant-123');
      expect(result).toBeNull();

      // Verify entry was deleted (subsequent get should also return null)
      expect(cache.getStats().size).toBe(0);
    });

    it('should return cached value just before TTL expiration', () => {
      const context = createMockContext();
      cache.set('tenant-123', context);

      // Advance time to just before TTL
      vi.advanceTimersByTime(5 * 60 * 1000 - 100);

      const result = cache.get('tenant-123');
      expect(result).toEqual(context);
    });
  });

  describe('set()', () => {
    it('should store value in cache', () => {
      const context = createMockContext();
      cache.set('tenant-123', context);

      expect(cache.getStats().size).toBe(1);
      expect(cache.get('tenant-123')).toEqual(context);
    });

    it('should overwrite existing entry for same tenant', () => {
      const context1 = createMockContext({ businessName: 'Business 1' });
      const context2 = createMockContext({ businessName: 'Business 2' });

      cache.set('tenant-123', context1);
      cache.set('tenant-123', context2);

      expect(cache.getStats().size).toBe(1);
      expect(cache.get('tenant-123')?.businessName).toBe('Business 2');
    });

    it('should reset TTL when overwriting', () => {
      const context1 = createMockContext({ businessName: 'Business 1' });
      const context2 = createMockContext({ businessName: 'Business 2' });

      cache.set('tenant-123', context1);

      // Advance time close to TTL
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Overwrite entry
      cache.set('tenant-123', context2);

      // Advance time past original TTL but not new TTL
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Should still be valid because TTL was reset
      const result = cache.get('tenant-123');
      expect(result?.businessName).toBe('Business 2');
    });

    it('should store multiple tenants independently', () => {
      const context1 = createMockContext({ tenantId: 'tenant-1', businessName: 'Business 1' });
      const context2 = createMockContext({ tenantId: 'tenant-2', businessName: 'Business 2' });

      cache.set('tenant-1', context1);
      cache.set('tenant-2', context2);

      expect(cache.getStats().size).toBe(2);
      expect(cache.get('tenant-1')?.businessName).toBe('Business 1');
      expect(cache.get('tenant-2')?.businessName).toBe('Business 2');
    });
  });

  describe('invalidate()', () => {
    it('should remove existing entry', () => {
      const context = createMockContext();
      cache.set('tenant-123', context);

      expect(cache.get('tenant-123')).toEqual(context);

      cache.invalidate('tenant-123');

      expect(cache.get('tenant-123')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });

    it('should not throw for non-existent entry', () => {
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });

    it('should only remove specified tenant', () => {
      const context1 = createMockContext({ tenantId: 'tenant-1' });
      const context2 = createMockContext({ tenantId: 'tenant-2' });

      cache.set('tenant-1', context1);
      cache.set('tenant-2', context2);

      cache.invalidate('tenant-1');

      expect(cache.get('tenant-1')).toBeNull();
      expect(cache.get('tenant-2')).toEqual(context2);
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      cache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));
      cache.set('tenant-3', createMockContext({ tenantId: 'tenant-3' }));

      expect(cache.getStats().size).toBe(3);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('tenant-1')).toBeNull();
      expect(cache.get('tenant-2')).toBeNull();
      expect(cache.get('tenant-3')).toBeNull();
    });

    it('should not throw when clearing empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('cleanup()', () => {
    it('should remove expired entries', () => {
      cache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));

      // Advance time for tenant-1 to be near expiration
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Add tenant-2 (fresh)
      cache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));

      // Advance past tenant-1 TTL but not tenant-2
      vi.advanceTimersByTime(2 * 60 * 1000);

      const evicted = cache.cleanup();

      expect(evicted).toBe(1);
      expect(cache.get('tenant-1')).toBeNull();
      expect(cache.get('tenant-2')).not.toBeNull();
    });

    it('should return count of evicted entries', () => {
      cache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      cache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));
      cache.set('tenant-3', createMockContext({ tenantId: 'tenant-3' }));

      // Advance time past TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const evicted = cache.cleanup();
      expect(evicted).toBe(3);
      expect(cache.getStats().size).toBe(0);
    });

    it('should return 0 when no entries are expired', () => {
      cache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      cache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));

      const evicted = cache.cleanup();
      expect(evicted).toBe(0);
      expect(cache.getStats().size).toBe(2);
    });

    it('should return 0 for empty cache', () => {
      const evicted = cache.cleanup();
      expect(evicted).toBe(0);
    });
  });

  describe('LRU eviction at capacity', () => {
    it('should evict oldest entry when at capacity', () => {
      const smallCache = new ContextCache({ maxEntries: 3 });

      // Add entries with time gaps
      smallCache.set(
        'tenant-1',
        createMockContext({ tenantId: 'tenant-1', businessName: 'First' })
      );
      vi.advanceTimersByTime(1000);

      smallCache.set(
        'tenant-2',
        createMockContext({ tenantId: 'tenant-2', businessName: 'Second' })
      );
      vi.advanceTimersByTime(1000);

      smallCache.set(
        'tenant-3',
        createMockContext({ tenantId: 'tenant-3', businessName: 'Third' })
      );
      vi.advanceTimersByTime(1000);

      expect(smallCache.getStats().size).toBe(3);

      // Adding fourth entry should evict tenant-1 (oldest)
      smallCache.set(
        'tenant-4',
        createMockContext({ tenantId: 'tenant-4', businessName: 'Fourth' })
      );

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.get('tenant-1')).toBeNull(); // Evicted
      expect(smallCache.get('tenant-2')).not.toBeNull();
      expect(smallCache.get('tenant-3')).not.toBeNull();
      expect(smallCache.get('tenant-4')).not.toBeNull();
    });

    it('should not evict when updating existing entry at capacity', () => {
      const smallCache = new ContextCache({ maxEntries: 3 });

      smallCache.set(
        'tenant-1',
        createMockContext({ tenantId: 'tenant-1', businessName: 'First' })
      );
      smallCache.set(
        'tenant-2',
        createMockContext({ tenantId: 'tenant-2', businessName: 'Second' })
      );
      smallCache.set(
        'tenant-3',
        createMockContext({ tenantId: 'tenant-3', businessName: 'Third' })
      );

      // Update existing entry - should not trigger eviction
      smallCache.set(
        'tenant-2',
        createMockContext({ tenantId: 'tenant-2', businessName: 'Updated' })
      );

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.get('tenant-1')).not.toBeNull();
      expect(smallCache.get('tenant-2')?.businessName).toBe('Updated');
      expect(smallCache.get('tenant-3')).not.toBeNull();
    });

    it('should evict multiple entries when necessary', () => {
      const tinyCache = new ContextCache({ maxEntries: 2 });

      tinyCache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      vi.advanceTimersByTime(1000);
      tinyCache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));

      expect(tinyCache.getStats().size).toBe(2);

      // Adding new entries one at a time
      vi.advanceTimersByTime(1000);
      tinyCache.set('tenant-3', createMockContext({ tenantId: 'tenant-3' }));

      expect(tinyCache.getStats().size).toBe(2);
      expect(tinyCache.get('tenant-1')).toBeNull(); // Evicted

      vi.advanceTimersByTime(1000);
      tinyCache.set('tenant-4', createMockContext({ tenantId: 'tenant-4' }));

      expect(tinyCache.getStats().size).toBe(2);
      expect(tinyCache.get('tenant-2')).toBeNull(); // Evicted
    });
  });

  describe('custom configuration', () => {
    it('should respect custom TTL', () => {
      const customCache = new ContextCache({ ttlMs: 1000 }); // 1 second TTL
      const context = createMockContext();

      customCache.set('tenant-123', context);

      // Should be valid before 1 second
      vi.advanceTimersByTime(900);
      expect(customCache.get('tenant-123')).toEqual(context);

      // Should be expired after 1 second
      vi.advanceTimersByTime(200);
      expect(customCache.get('tenant-123')).toBeNull();
    });

    it('should respect custom maxEntries', () => {
      const customCache = new ContextCache({ maxEntries: 2 });

      customCache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      customCache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));
      vi.advanceTimersByTime(1000);
      customCache.set('tenant-3', createMockContext({ tenantId: 'tenant-3' }));

      expect(customCache.getStats().size).toBe(2);
      expect(customCache.getStats().maxEntries).toBe(2);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig = new ContextCache({ ttlMs: 2000 });
      const stats = partialConfig.getStats();

      expect(stats.ttlMs).toBe(2000);
      expect(stats.maxEntries).toBe(1000); // Default
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      cache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      cache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxEntries).toBe(1000);
      expect(stats.ttlMs).toBe(5 * 60 * 1000);
    });

    it('should reflect size changes', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('tenant-1', createMockContext());
      expect(cache.getStats().size).toBe(1);

      cache.invalidate('tenant-1');
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('withSessionId()', () => {
    it('should update sessionId in context', () => {
      const context = createMockContext({ sessionId: 'old-session' });
      const updated = withSessionId(context, 'new-session');

      expect(updated.sessionId).toBe('new-session');
    });

    it('should not modify original context (immutability)', () => {
      const context = createMockContext({ sessionId: 'original-session' });
      const updated = withSessionId(context, 'new-session');

      expect(context.sessionId).toBe('original-session');
      expect(updated.sessionId).toBe('new-session');
    });

    it('should preserve all other context fields', () => {
      const context = createMockContext({
        tenantId: 'tenant-xyz',
        businessName: 'My Business',
        businessSlug: 'my-business',
      });

      const updated = withSessionId(context, 'new-session');

      expect(updated.tenantId).toBe('tenant-xyz');
      expect(updated.businessName).toBe('My Business');
      expect(updated.businessSlug).toBe('my-business');
      expect(updated.quickStats).toEqual(context.quickStats);
      expect(updated.contextPrompt).toBe(context.contextPrompt);
    });
  });

  describe('true LRU behavior (get updates position)', () => {
    it('should evict least recently accessed entry, not oldest', () => {
      const smallCache = new ContextCache({ maxEntries: 3 });

      // Add entries in order: 1, 2, 3
      smallCache.set(
        'tenant-1',
        createMockContext({ tenantId: 'tenant-1', businessName: 'First' })
      );
      vi.advanceTimersByTime(1000);

      smallCache.set(
        'tenant-2',
        createMockContext({ tenantId: 'tenant-2', businessName: 'Second' })
      );
      vi.advanceTimersByTime(1000);

      smallCache.set(
        'tenant-3',
        createMockContext({ tenantId: 'tenant-3', businessName: 'Third' })
      );
      vi.advanceTimersByTime(1000);

      // Access tenant-1 to make it "most recently used"
      expect(smallCache.get('tenant-1')).not.toBeNull();

      // Add tenant-4 - should evict tenant-2 (LRU), NOT tenant-1 (oldest by insertion)
      smallCache.set(
        'tenant-4',
        createMockContext({ tenantId: 'tenant-4', businessName: 'Fourth' })
      );

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.get('tenant-1')).not.toBeNull(); // Kept - was accessed
      expect(smallCache.get('tenant-2')).toBeNull(); // Evicted - LRU
      expect(smallCache.get('tenant-3')).not.toBeNull();
      expect(smallCache.get('tenant-4')).not.toBeNull();
    });

    it('should correctly track access order across multiple accesses', () => {
      const smallCache = new ContextCache({ maxEntries: 3 });

      // Add entries
      smallCache.set('A', createMockContext({ tenantId: 'A' }));
      vi.advanceTimersByTime(100);
      smallCache.set('B', createMockContext({ tenantId: 'B' }));
      vi.advanceTimersByTime(100);
      smallCache.set('C', createMockContext({ tenantId: 'C' }));

      // Access pattern: A, C (B becomes LRU)
      smallCache.get('A');
      smallCache.get('C');

      // Add D - should evict B
      smallCache.set('D', createMockContext({ tenantId: 'D' }));

      expect(smallCache.get('A')).not.toBeNull();
      expect(smallCache.get('B')).toBeNull(); // Evicted
      expect(smallCache.get('C')).not.toBeNull();
      expect(smallCache.get('D')).not.toBeNull();
    });

    it('should maintain O(1) eviction performance', () => {
      // This test verifies the implementation doesn't iterate over all entries
      const largeCache = new ContextCache({ maxEntries: 100 });

      // Fill cache
      for (let i = 0; i < 100; i++) {
        largeCache.set(`tenant-${i}`, createMockContext({ tenantId: `tenant-${i}` }));
      }

      // Access some entries to change LRU order
      largeCache.get('tenant-0');
      largeCache.get('tenant-50');

      const startTime = Date.now();

      // Add one more entry, triggering eviction
      largeCache.set('tenant-new', createMockContext({ tenantId: 'tenant-new' }));

      const elapsedMs = Date.now() - startTime;

      // O(1) eviction should be very fast (under 10ms even with overhead)
      expect(elapsedMs).toBeLessThan(10);
      expect(largeCache.getStats().size).toBe(100);

      // tenant-1 should be evicted (LRU after we accessed tenant-0)
      expect(largeCache.get('tenant-1')).toBeNull();
      // tenant-0 should exist (was accessed)
      expect(largeCache.get('tenant-0')).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string tenantId', () => {
      const context = createMockContext({ tenantId: '' });
      cache.set('', context);

      expect(cache.get('')).toEqual(context);
      expect(cache.getStats().size).toBe(1);
    });

    it('should handle special characters in tenantId', () => {
      const context = createMockContext({ tenantId: 'tenant:123:abc' });
      cache.set('tenant:123:abc', context);

      expect(cache.get('tenant:123:abc')).toEqual(context);
    });

    it('should handle capacity of 1', () => {
      const singleEntryCache = new ContextCache({ maxEntries: 1 });

      singleEntryCache.set('tenant-1', createMockContext({ tenantId: 'tenant-1' }));
      expect(singleEntryCache.get('tenant-1')).not.toBeNull();

      vi.advanceTimersByTime(1000);
      singleEntryCache.set('tenant-2', createMockContext({ tenantId: 'tenant-2' }));

      expect(singleEntryCache.getStats().size).toBe(1);
      expect(singleEntryCache.get('tenant-1')).toBeNull();
      expect(singleEntryCache.get('tenant-2')).not.toBeNull();
    });

    it('should handle very short TTL', () => {
      const shortTtlCache = new ContextCache({ ttlMs: 1 });
      const context = createMockContext();

      shortTtlCache.set('tenant-123', context);

      vi.advanceTimersByTime(2);

      expect(shortTtlCache.get('tenant-123')).toBeNull();
    });

    it('should handle context with minimal data', () => {
      const minimalContext: AgentSessionContext = {
        tenantId: 't',
        sessionId: 's',
        businessName: '',
        businessSlug: '',
        contextPrompt: '',
        quickStats: {
          stripeConnected: false,
          packageCount: 0,
          upcomingBookings: 0,
          totalBookings: 0,
          revenueThisMonth: 0,
        },
      };

      cache.set('t', minimalContext);
      expect(cache.get('t')).toEqual(minimalContext);
    });
  });
});
