---
status: pending
priority: p3
issue_id: 5252
tags: [code-review, performance, pr-44, memory, opus-verified]
dependencies: []
---

# Three Separate LRU Caches Increase Memory Baseline

## Problem Statement

Three independent LRU caches exist across domain files: `bootstrapCache`, `greetedSessionsCache`, `variantGenerationRateLimit`. Combined max entries: 7000 (~560 KB baseline). Same total as before split, but worth evaluating unified cache strategy.

**Opus Verification (2026-02-10):** Downgraded P2 → P3. Corrected cache inventory: bootstrapCache (max 1000, TTL 30min, ~2MB), greetedSessionsCache (max 5000, TTL 1hr, ~250KB), variantGenerationRateLimit (max 1000, TTL 1min, ~50KB — this is a rate limiter, NOT a data cache). Total: ~2.3MB, not the originally estimated ~150MB. Todo description also had wrong max/TTL values; corrected above.

**Impact:** P3 NICE-TO-HAVE - Add memory footprint comments to caches.

## Findings

### Performance Review

**Cache inventory:**

1. **bootstrapCache** (`discovery.routes.ts`)
   - Max: 5000 entries
   - TTL: 5 minutes
   - Purpose: Cache tenant bootstrap context

2. **greetedSessionsCache** (`discovery.routes.ts`)
   - Max: 1000 entries
   - TTL: 24 hours
   - Purpose: Track which sessions have received greeting

3. **variantGenerationRateLimit** (`marketing.routes.ts`)
   - Max: 1000 entries
   - TTL: 1 hour
   - Purpose: Rate limit variant generation per tenant

**Memory estimate:**

- Bootstrap: ~5 KB per tenant × 5000 = 25 MB
- Greeted sessions: ~100 bytes × 1000 = 100 KB
- Rate limit: ~200 bytes × 1000 = 200 KB
- **Total data:** ~25.3 MB
- **LRU overhead:** 3 separate Map + linked list structures (~300 KB)

**Note:** This is the same total capacity as before the monolith split. The split didn't increase memory usage, but highlights an opportunity for consolidation.

### Code Simplicity Review

**Three different cache patterns:**

1. Bootstrap: `lru-cache` with `max` and `ttl`
2. Greeted sessions: `lru-cache` with `max` and `ttl`
3. Rate limit: Custom implementation with `Map` + timestamp expiry

**Why this matters:**

- Inconsistent eviction policies (LRU vs timestamp)
- Harder to monitor total cache memory usage
- Can't share cache infrastructure across domains

## Proposed Solutions

### Solution 1: Unified Cache Manager (RECOMMENDED for production scale)

**Pros:**

- Single LRU cache with shared memory pool
- Consistent eviction policy
- Easier monitoring and observability
- Can tune total memory budget in one place
  **Cons:**
- Requires architectural change
- Must namespace keys to avoid collisions
  **Effort:** Medium (2 hours)
  **Risk:** Low - cache is a performance optimization, not correctness-critical

**Implementation:**

```typescript
// server/src/shared/cache/unified-cache.ts
import LRU from 'lru-cache';

const unifiedCache = new LRU({
  max: 10000, // Shared pool
  ttl: 1000 * 60 * 60, // Default 1 hour
  updateAgeOnGet: true,
});

export function getCached<T>(namespace: string, key: string): T | undefined {
  return unifiedCache.get(`${namespace}:${key}`) as T | undefined;
}

export function setCached<T>(namespace: string, key: string, value: T, ttl?: number) {
  unifiedCache.set(`${namespace}:${key}`, value, { ttl });
}

// Usage in routes:
import { getCached, setCached } from '../../shared/cache/unified-cache';

const cached = getCached<BootstrapData>('bootstrap', tenantId);
if (!cached) {
  const data = await buildBootstrap(tenantId);
  setCached('bootstrap', tenantId, data, 5 * 60 * 1000);
}
```

### Solution 2: Document Memory Footprint (Current State with Visibility)

**Pros:**

- No code changes
- Makes memory usage transparent
  **Cons:**
- Doesn't reduce memory baseline
- Still three separate caches
  **Effort:** Trivial (10 minutes)
  **Risk:** Zero

**Implementation:**

```typescript
// Add comments to each cache:
// Memory footprint: ~25 MB (5000 × 5 KB per tenant)
const bootstrapCache = new LRU({ max: 5000, ttl: 5 * 60 * 1000 });

// Memory footprint: ~100 KB (1000 × 100 bytes per session)
const greetedSessionsCache = new LRU({ max: 1000, ttl: 24 * 60 * 60 * 1000 });

// Memory footprint: ~200 KB (1000 × 200 bytes per tenant)
const variantGenerationRateLimit = new Map();
```

### Solution 3: Eliminate Bootstrap Cache

**Pros:**

- Removes largest cache (25 MB)
- Bootstrap data rarely changes, could use database cache
  **Cons:**
- Increases database query load
- May increase latency for agent startup
  **Effort:** Small (30 minutes)
  **Risk:** Medium - could degrade agent performance

**Implementation:**

```typescript
// Replace bootstrap cache with Prisma query caching:
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  include: { sections: true, packages: true }, // Prisma caches this
  cacheStrategy: { ttl: 300 }, // 5-minute cache
});
```

## Recommended Action

**Start with Solution 2** (document memory footprint). This is the same total capacity as before the split—no regression. If memory usage becomes a production issue (>1 GB), then apply Solution 1 (unified cache manager).

**Future trigger:** If memory monitoring shows cache overhead exceeding 100 MB in production, revisit Solution 1.

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent-discovery.routes.ts` (2 caches)
- `server/src/routes/internal-agent-marketing.routes.ts` (1 cache)

**Memory baseline:** ~25.3 MB data + ~300 KB overhead = 25.6 MB total

**Production scale estimate:**

- 1000 tenants: ~25.6 MB (current)
- 10,000 tenants: Bootstrap cache evicts oldest, stays at 25 MB
- Memory won't grow unboundedly due to LRU eviction

**Related Patterns:**

- Cache-Aside Pattern
- Shared Resource Pool

## Acceptance Criteria

### For Solution 2 (Document):

- [ ] Memory footprint comments added to all 3 caches
- [ ] Document total baseline in aggregator or README
- [ ] No code changes

### For Solution 1 (Unified Cache):

- [ ] Unified cache manager created
- [ ] All 3 caches migrated to unified manager
- [ ] Keys namespaced to avoid collisions
- [ ] Memory monitoring added (total cache size metric)
- [ ] All endpoints still functional
- [ ] Tests pass

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Performance Review inventoried 3 caches: 7000 entries, ~25.6 MB
- Confirmed same total capacity as pre-split (no regression)
- Assessed consolidation effort: 2 hours for unified cache
- Decided: document first, optimize if production demands it

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent-discovery.routes.ts` (bootstrapCache, greetedSessionsCache)
  - `internal-agent-marketing.routes.ts` (variantGenerationRateLimit)
- **LRU Cache:** https://www.npmjs.com/package/lru-cache
- **Cache-Aside Pattern:** https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside
