---
status: ready
priority: p2
issue_id: '820'
tags: [code-review, real-time-preview, tanstack-query, consistency]
dependencies: []
---

# Inconsistent refetchType in Cache Invalidation Calls

## Problem Statement

The codebase has THREE different invalidation patterns with inconsistent `refetchType` usage. Some invalidations force immediate refetch (`refetchType: 'active'`) while others use the default behavior, which may NOT trigger refetch if the query is inactive.

**Impact:** Publish and discard operations may not immediately refresh the preview if the query happens to be inactive at that moment.

## Findings

### Three Invalidation Patterns

| Location                               | Code         | refetchType       | Behavior        |
| -------------------------------------- | ------------ | ----------------- | --------------- |
| publishMutation.onSuccess              | Line 167-168 | ❌ None (default) | May not refetch |
| discardMutation.onSuccess              | Line 193-194 | ❌ None (default) | May not refetch |
| AgentPanel.handleConciergeToolComplete | Line 252-255 | ✅ `'active'`     | Forces refetch  |
| invalidateDraftConfig export           | Line 291-295 | ✅ `'active'`     | Forces refetch  |

### Code Comparison

**Internal mutations (inconsistent):**

```typescript
// useDraftConfig.ts:167-168
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
  // Missing: refetchType: 'active'
};
```

**External invalidation (correct):**

```typescript
// useDraftConfig.ts:291-295
queryClientRef.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active', // Forces refetch even if inactive
});
```

### TanStack Query Behavior

Without `refetchType: 'active'`:

- If query is active (component mounted): Refetches
- If query is inactive (component unmounted/suspended): Does NOT refetch

With `refetchType: 'active'`:

- Always triggers refetch for active queries
- Guarantees fresh data on next component mount

## Proposed Solutions

### Solution 1: Add refetchType to All Invalidation Calls (Recommended)

**Pros:** Consistent behavior. Simple fix.
**Cons:** Slight increase in network requests (negligible).
**Effort:** Small (15 min)
**Risk:** Low

```typescript
// publishMutation.onSuccess
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active',
});

// discardMutation.onSuccess
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active',
});
```

### Solution 2: Create Wrapper Function for All Invalidations

**Pros:** Enforces consistency. Single point of change.
**Cons:** Requires updating all call sites.
**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// In useDraftConfig.ts
const invalidateDraftConfigQuery = (qc: QueryClient) => {
  qc.invalidateQueries({
    queryKey: DRAFT_CONFIG_QUERY_KEY,
    refetchType: 'active',
  });
};
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `apps/web/src/hooks/useDraftConfig.ts` (lines 167-168, 193-194)

### All Invalidation Locations to Update

```typescript
// Line 167-168: publishMutation.onSuccess
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active', // ADD
});

// Line 193-194: discardMutation.onSuccess
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active', // ADD
});

// Line 203-204: invalidate callback (already correct via hook)
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active', // ADD for consistency
});
```

### Acceptance Criteria

- [ ] All `invalidateQueries` calls for draft-config use `refetchType: 'active'`
- [ ] Publish operation immediately refreshes preview
- [ ] Discard operation immediately refreshes preview
- [ ] No regression in existing functionality

## Work Log

| Date       | Action                              | Learnings                                                   |
| ---------- | ----------------------------------- | ----------------------------------------------------------- |
| 2026-02-02 | Created via multi-agent code review | TanStack Query default behavior is "smart" but inconsistent |

## Resources

- TanStack Query docs: [invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#invalidatequeries)
- Related: CLAUDE.md Pitfall #29 (staleTime blocking real-time)
