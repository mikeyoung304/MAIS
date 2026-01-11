---
status: pending
priority: p2
issue_id: 742
tags: [code-review, performance, race-condition, react-query, pr-27]
dependencies: []
---

# P2: Optimistic Update 50ms Failsafe May Be Insufficient

## Problem Statement

The optimistic update pattern uses a 50ms failsafe delay before invalidating the cache. Under high concurrency or slow networks, PostgreSQL's READ COMMITTED isolation may take longer than 50ms to propagate changes, causing the refetch to return stale data and overwrite the optimistic update.

**Impact:** Users may briefly see correct data, then see it revert to stale state, causing confusion.

## Findings

**Reviewers:** performance-oracle, julik-frontend-races-reviewer

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:323-325`

**Current Implementation:**

```typescript
// CRITICAL: 50ms failsafe for READ COMMITTED propagation
setTimeout(() => {
  invalidateDraftConfig();
}, 50);
```

**Evidence:**

- Advisory locks extend transaction duration (storefront-executors.ts uses 5000ms timeout)
- Lock contention test allows 3000ms for 3 operations (section-id-race-conditions.spec.ts:353)
- No rollback mechanism if mutation fails after optimistic update

## Proposed Solutions

### Solution A: Increase Failsafe to 100-150ms (Quick Fix)

- **Pros:** Simple, conservative
- **Cons:** Slightly longer delay before consistency
- **Effort:** Small (5 minutes)
- **Risk:** Low

```typescript
setTimeout(() => {
  invalidateDraftConfig();
}, 100); // Increased from 50ms
```

### Solution B: Use TanStack Query Mutation with Rollback (Recommended)

- **Pros:** Proper optimistic update with automatic rollback, handles failures gracefully
- **Cons:** More code, requires refactoring
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

```typescript
const mutation = useMutation({
  mutationFn: async (config) => config,
  onMutate: async (newConfig) => {
    await queryClient.cancelQueries({ queryKey: ['draft-config'] });
    const previousConfig = queryClient.getQueryData(['draft-config']);
    queryClient.setQueryData(['draft-config'], newConfig);
    return { previousConfig };
  },
  onError: (err, newConfig, context) => {
    queryClient.setQueryData(['draft-config'], context?.previousConfig);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['draft-config'] });
  },
});
```

### Solution C: Add Telemetry to Measure Real Propagation Times

- **Pros:** Data-driven decision
- **Cons:** Doesn't fix issue, just measures it
- **Effort:** Small
- **Risk:** None

## Recommended Action

Solution A immediately (increase to 100ms), then Solution B in follow-up PR.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 323-325, 501-503)

## Acceptance Criteria

- [ ] Failsafe delay increased to at least 100ms
- [ ] Consider implementing proper mutation pattern in follow-up
- [ ] Add telemetry for actual propagation times (optional)

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-01-11 | Created | From PR #27 multi-agent review |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- TanStack Query Optimistic Updates: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates
