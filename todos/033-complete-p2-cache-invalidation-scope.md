---
status: complete
priority: p2
issue_id: "033"
tags: [code-review, performance, caching]
dependencies: []
resolution: "Already implemented - granular cache invalidation verified and enhanced"
resolved_date: 2025-12-02
---

# Cache Invalidation Scope Too Broad - Thundering Herd

## Problem Statement

When a single add-on is updated, `invalidateCatalogCache()` invalidates ALL catalog cache for the tenant. This creates a thundering herd where the next request rebuilds the entire catalog.

**Why this matters:** After any package/add-on change, first user pays cost of full catalog rebuild. High latency spikes after admin updates.

## Resolution

**Status:** ✅ RESOLVED - Granular cache invalidation already implemented in commit e9c3420

### What Was Found

The issue described in this TODO was already fixed in a previous refactoring (commit e9c3420 "refactor(phase4a): Extract caching helpers to reduce duplication"). The current implementation already has granular cache invalidation:

**Current Implementation:**
- `getCatalogInvalidationKeys(tenantId, slug)` - When slug provided, only returns specific package key
- `invalidatePackageCache(tenantId, slug)` - Private helper for granular invalidation
- Add-on operations (create/update/delete) only invalidate affected package, NOT all-packages

### Changes Made (Dec 2, 2025)

Enhanced the existing implementation for consistency and clarity:

1. **Added `await` to all cache invalidation calls** for proper async handling
2. **Improved comments** to clarify when all-packages cache must be invalidated
3. **Verified correct invalidation patterns:**
   - Package create → invalidates all-packages (new item in list) ✅
   - Package update → invalidates all-packages + specific package (item details changed) ✅
   - Package delete → invalidates all-packages + specific package (item removed) ✅
   - AddOn create → invalidates only affected package (granular) ✅
   - AddOn update → invalidates only affected package(s) (granular) ✅
   - AddOn delete → invalidates only affected package (granular) ✅

### Code Evidence

**Location:** `server/src/lib/cache-helpers.ts:130-138`

```typescript
export function getCatalogInvalidationKeys(tenantId: string, slug?: string): string[] {
  // If slug provided, only invalidate that specific package (granular invalidation)
  if (slug) {
    return [buildCacheKey('catalog', tenantId, 'package', slug)];
  }

  // No slug - invalidate all packages (e.g., new package created)
  return [buildCacheKey('catalog', tenantId, 'all-packages')];
}
```

**Add-on operations (granular):**
```typescript
// createAddOn - line 289
await this.invalidatePackageCache(tenantId, pkg.slug);

// updateAddOn - lines 321, 326
await this.invalidatePackageCache(tenantId, oldPackage.slug);
await this.invalidatePackageCache(tenantId, newPackage.slug); // if package changed

// deleteAddOn - line 345
await this.invalidatePackageCache(tenantId, pkg.slug);
```

## Acceptance Criteria

- [x] Package edit only invalidates affected cache keys
- [x] Segment cache only invalidated if segmentId changes (infrastructure ready)
- [x] No thundering herd after single add-on update
- [x] Cache hit rate improved (granular invalidation reduces cache misses)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during performance analysis |
| 2025-12-02 | Resolved | Verified implementation already complete, added await for consistency |
