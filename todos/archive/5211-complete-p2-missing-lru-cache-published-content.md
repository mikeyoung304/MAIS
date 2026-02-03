---
status: ready
priority: p2
issue_id: '5211'
tags: [code-review, performance, caching, section-content-migration]
dependencies: []
---

# P2: Missing LRU Cache for Published Content

## Problem Statement

Published section content is fetched from database on every storefront page load. Since published content rarely changes, this creates unnecessary database load.

**Why it matters:** Storefront pages are public-facing and high-traffic. Every visitor triggers 8+ section queries. Caching would reduce database load by 99%+ for repeat visitors.

## Findings

**Source:** Performance Oracle Agent Review

**Location:** `server/src/services/section-content.service.ts`

**Evidence:**

```typescript
// Current: Database query on every call
async getPublishedSections(tenantId: string) {
  return this.repository.findAllForTenant(tenantId, { publishedOnly: true });
}

// Better: Check cache first
async getPublishedSections(tenantId: string) {
  const cached = this.cache.get(`published:${tenantId}`);
  if (cached) return cached;

  const sections = await this.repository.findAllForTenant(tenantId, { publishedOnly: true });
  this.cache.set(`published:${tenantId}`, sections, { ttl: 300_000 }); // 5 min
  return sections;
}
```

**Impact:**

- 1000 visitors/day × 8 queries = 8000 unnecessary queries
- Database connection pool pressure
- Higher latency for end users (~50ms vs ~5ms cached)

## Proposed Solutions

### Option A: In-memory LRU cache (Recommended)

**Approach:** Use lru-cache package (already installed) for tenant-scoped caching

```typescript
import { LRUCache } from 'lru-cache';

private cache = new LRUCache<string, SectionContent[]>({
  max: 1000,          // Max 1000 tenants
  ttl: 300_000,       // 5 minute TTL
});

// Invalidate on publish
async publishAll(tenantId: string) {
  await this.repository.publishAll(tenantId);
  this.cache.delete(`published:${tenantId}`);
}
```

**Pros:** Near-zero latency, no infrastructure needed, lru-cache already installed
**Cons:** Not shared across server instances (acceptable for single-server)
**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Redis cache

**Approach:** External cache for multi-instance deployments

**Pros:** Shared across instances
**Cons:** Requires Redis infrastructure, added latency
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Option A: In-memory LRU cache** - Add lru-cache (already installed) for published sections with 5-minute TTL and 1000-tenant max. Invalidate on publishAll/publishSection.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Performance quality improvement for high-traffic storefronts

## Technical Details

**Affected Files:**

- `server/src/services/section-content.service.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Published sections cached with 5-minute TTL
- [ ] Cache invalidated on publishAll()
- [ ] Cache key includes tenantId (multi-tenant isolation)
- [ ] Cache has max size limit (prevent memory exhaustion)
- [ ] Unit tests verify cache hit/miss behavior

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-02-02 | Created from code review | Identified by performance-oracle agent |

## Resources

- PR: `feat/section-content-migration`
- lru-cache: https://github.com/isaacs/node-lru-cache
