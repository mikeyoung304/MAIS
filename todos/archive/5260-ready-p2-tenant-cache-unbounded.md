---
status: ready
priority: p2
issue_id: '5260'
tags: [code-review, performance, memory, pr-28]
source: PR #28 multi-agent review
---

# P2: Tenant Data Cache Missing Hard Cap

## Problem Statement

The `tenantDataCache` Map in base-orchestrator.ts has TTL-based cleanup but no hard cap. In high-tenant-count scenarios (>10K tenants), this could grow without bound between cleanup cycles.

**Why it matters:** Unbounded Maps are a memory leak vector. Defense-in-depth requires hard caps on all caches.

## Findings

**Location:** `server/src/agent/orchestrator/base-orchestrator.ts` (lines 324-333, 444-468, 1539-1546)

**Current implementation:**

```typescript
private readonly tenantDataCache = new Map<string, { data: TenantSessionData; timestamp: number }>();
private static readonly TENANT_DATA_CACHE_TTL_MS = 60_000; // 60s TTL

// Cleanup only happens every 100 calls AND only removes expired entries
```

**Gap:** No `MAX_TENANT_DATA_CACHE` constant or eviction when full.

**Worst case:** 10,000 tenants x 60 bytes/entry = 600KB (not critical but violates pattern)

## Proposed Solutions

### Option A: Add Hard Cap with LRU Eviction (Recommended)

**Pros:** Consistent with circuit breaker pattern, O(1) eviction
**Cons:** Adds ~10 lines of code
**Effort:** Small (15 min)

```typescript
// After line 248:
const MAX_TENANT_DATA_CACHE = 1000;

// In loadTenantData() after line 465:
if (this.tenantDataCache.size >= MAX_TENANT_DATA_CACHE && !this.tenantDataCache.has(tenantId)) {
  // Evict oldest entry (first key due to Map insertion order)
  const oldestKey = this.tenantDataCache.keys().next().value;
  if (oldestKey !== undefined) {
    this.tenantDataCache.delete(oldestKey);
  }
}
```

### Option B: Reduce TTL to Request Scope

**Pros:** Simpler, matches actual use case
**Cons:** More DB queries if same tenant makes multiple calls
**Effort:** Small (5 min)

```typescript
private static readonly TENANT_DATA_CACHE_TTL_MS = 1_000; // 1 second (request-scoped)
```

## Technical Details

**Affected files:**

- `server/src/agent/orchestrator/base-orchestrator.ts`

**Memory budget:** 1000 entries x 60 bytes = 60KB max

## Acceptance Criteria

- [ ] Hard cap constant defined (MAX_TENANT_DATA_CACHE = 1000)
- [ ] Eviction logic added before cache insertion
- [ ] Cleanup logs include tenant cache stats
- [ ] Unit test for eviction behavior

## Work Log

| Date       | Action                                      | Learnings                                      |
| ---------- | ------------------------------------------- | ---------------------------------------------- |
| 2026-01-22 | Identified during PR #28 performance review | All caches need hard caps for defense-in-depth |

## Resources

- PR #28: Agent system integrity fixes
- Performance review agent finding P2
- Architecture review agent finding P2-1
