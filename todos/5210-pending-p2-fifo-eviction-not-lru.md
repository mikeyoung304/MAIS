---
status: pending
priority: p2
issue_id: '5210'
tags: [code-review, session-bootstrap, performance, cache]
dependencies: []
---

# Bootstrap Cache Uses FIFO Eviction Instead of LRU

## Problem Statement

When the bootstrap cache reaches max size (1000), it evicts the oldest entry by insertion order (FIFO), not the least recently used (LRU). Frequently accessed tenants could be evicted while stale entries remain.

**Why it matters:** Suboptimal cache hit rates, potential performance degradation for active tenants.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:368-374`

**Current Code:**

```typescript
if (bootstrapCache.size >= BOOTSTRAP_CACHE_MAX_SIZE) {
  const oldestKey = bootstrapCache.keys().next().value;
  if (oldestKey) {
    bootstrapCache.delete(oldestKey);
  }
}
```

Map iteration order reflects insertion order, not access order.

**Reviewers:** Performance Oracle (P2), Security Sentinel (P3), Data Integrity Guardian (P3)

## Proposed Solutions

### Option A: Accept FIFO with Documentation

**Pros:** No changes needed, 30-min TTL provides natural expiration
**Cons:** Suboptimal cache efficiency
**Effort:** Small
**Risk:** Low

Document trade-off: "FIFO eviction is acceptable given TTL-based expiration handles staleness."

### Option B: Use lru-cache Package (Recommended)

**Pros:** Proper LRU semantics, battle-tested
**Cons:** New dependency
**Effort:** Small
**Risk:** Low

```typescript
import LRU from 'lru-cache';
const bootstrapCache = new LRU<string, CachedBootstrap>({
  max: 1000,
  ttl: 30 * 60 * 1000, // 30 minutes
});
```

### Option C: Manual LRU with Access Timestamps

**Pros:** No new dependency
**Cons:** More complex, potential bugs
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`
- package.json (if adding lru-cache)

## Acceptance Criteria

- [ ] Cache uses LRU eviction OR FIFO behavior is documented and accepted
- [ ] Cache metrics added for monitoring (nice-to-have)

## Work Log

| Date       | Action                         | Learnings                                |
| ---------- | ------------------------------ | ---------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Multiple reviewers noted FIFO limitation |

## Resources

- PR: feature/session-bootstrap-onboarding
- Reviews: Performance Oracle, Security Sentinel, Data Integrity Guardian
- lru-cache: https://www.npmjs.com/package/lru-cache
