---
status: complete
priority: p2
issue_id: '029'
tags: [code-review, architecture, technical-debt, caching]
dependencies: []
---

# Legacy Cache Service Coexistence with CacheServicePort

## Problem Statement

The codebase maintains TWO parallel caching systems: `CacheService` (synchronous, NodeCache-based) and `CacheServicePort` interface (asynchronous, adapter pattern). Both are instantiated in DI container, creating split responsibility.

**Why this matters:** Developers must choose which cache to use, leading to confusion. Double memory usage and inconsistent invalidation patterns.

## Findings

### Code Evidence

**Location:** `server/src/di.ts:79-91`

```typescript
// Both created in DI container
const legacyCacheService = new CacheService(900); // NodeCache
let cacheAdapter: CacheServicePort; // Redis or In-Memory adapter

// Services use legacy cache
const catalogService = new CatalogService(adapters.catalogRepo, legacyCacheService, auditService);
const segmentService = new SegmentService(segmentRepo, legacyCacheService);
```

### Impact

- Two separate cache instances = double memory usage
- Invalidation patterns inconsistent
- Migration to async cache requires updating multiple services
- Cache statistics/monitoring split across two systems

## Proposed Solutions

### Option A: Migrate All Services to CacheServicePort (Recommended)

**Effort:** Medium | **Risk:** Low

1. Update service constructors to accept `CacheServicePort`
2. Update cache operations to use async pattern
3. Remove `CacheService` class entirely
4. Add linting rule to prevent legacy imports

**Pros:**

- Single source of truth
- Async-ready for Redis
- Cleaner DI container

**Cons:**

- Requires updating service signatures

## Acceptance Criteria

- [ ] All services use `CacheServicePort` interface
- [ ] `CacheService` class deleted
- [ ] No imports from `lib/cache.ts` (legacy)
- [ ] Cache invalidation works consistently
- [ ] Tests updated for async cache

## Work Log

| Date       | Action  | Notes                            |
| ---------- | ------- | -------------------------------- |
| 2025-11-27 | Created | Found during architecture review |

## Resources

- Architecture Strategist analysis
- TODO in di.ts line 80
