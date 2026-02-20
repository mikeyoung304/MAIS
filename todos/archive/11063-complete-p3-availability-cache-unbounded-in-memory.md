---
status: pending
priority: p3
issue_id: '11063'
tags: [performance, caching, memory]
dependencies: []
---

# 11063: Availability Cache Is Unbounded and In-Memory with No TTL

## Problem Statement

The availability cache has no size limit and no TTL (time-to-live). Under load with
many tenants or date ranges, the cache will grow without bound, leading to memory
pressure and eventual OOM crashes. Stale availability data could also persist
indefinitely since there is no expiry mechanism.

## Findings

The in-memory cache stores availability data keyed by tenant + date range. With:

- No maximum entry count → unbounded growth
- No TTL → stale data never expires
- No LRU eviction → oldest entries never removed

In production with hundreds of tenants each querying multiple date ranges, this
becomes a memory leak.

## Proposed Solution

### Option A — Add LRU + TTL to existing in-memory cache (Recommended for now)

Use `lru-cache` (already a common Node.js dependency):

```typescript
import { LRUCache } from 'lru-cache';

const availabilityCache = new LRUCache<string, AvailabilityResult>({
  max: 1000, // max 1000 entries
  ttl: 1000 * 60 * 5, // 5 minute TTL
});
```

**Effort:** Small
**Risk:** Low

### Option B — Move to Redis (future-proof, multi-instance safe)

Use the existing Redis/KeyValue infrastructure with TTL:

```typescript
await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 min TTL
```

**Effort:** Medium
**Risk:** Low (pattern already established in codebase)

## Recommended Action

Option A now, Option B when moving to multi-instance deployment.

## Acceptance Criteria

- [ ] Cache has maximum entry count (1000 or configurable)
- [ ] Cache entries expire after 5-10 minutes (TTL)
- [ ] LRU eviction removes least-recently-used entries when max is reached
- [ ] Cache miss after TTL forces fresh DB/calendar query
- [ ] Unit test verifies TTL expiry behavior

## Effort

Small

## Work Log

- 2026-02-20: Performance finding from integration review. Unbounded caches are a class of memory leak.
