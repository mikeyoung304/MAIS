---
status: ready
priority: p1
issue_id: '818'
tags: [code-review, real-time-preview, race-condition, timing]
dependencies: ['817']
---

# Backend/Frontend Timing Race Condition in Preview Updates

## Problem Statement

When an agent tool modifies the storefront draft, the frontend immediately calls `invalidateQueries()` upon receiving the HTTP 200 response. However, the database transaction may not have committed yet, causing the subsequent refetch to return **stale data**.

**Impact:** Preview doesn't update after agent makes changes. Manual refresh works because humans add ~100ms delay.

## Findings

### The Race Condition

```
Timeline:
─────────────────────────────────────────────
t=0ms   Agent tool returns 200 response
t=1ms   Frontend fires invalidateQueries()
t=2ms   TanStack Query starts refetch
t=3ms   GET /draft hits database
t=10ms  Database transaction commits (agent write)
─────────────────────────────────────────────
Result: Refetch got data from BEFORE the write committed
```

### Evidence

1. **Manual "Refresh preview" button works** - proves data IS stored correctly
2. **Automatic invalidation fails** - fires within 0-10ms, before commit
3. Console shows failed fetch or stale data being rendered

### Location

**File:** `apps/web/src/components/agent/AgentPanel.tsx:248-255`

```typescript
if (modifiedStorefront) {
  // NO DELAY - fires immediately
  queryClient.invalidateQueries({
    queryKey: getDraftConfigQueryKey(),
    refetchType: 'active',
  });
}
```

### Related Pitfalls

- **Pitfall #30:** Race condition on cache invalidation (add 100ms delay)
- This exact scenario is documented but not implemented

## Proposed Solutions

### Solution 1: Add Delay Before Invalidation (Recommended)

**Pros:** Simple fix matching documented pattern. Proven to work (manual refresh).
**Cons:** Adds 100ms latency to preview updates.
**Effort:** Small (15 min)
**Risk:** Low

```typescript
if (modifiedStorefront) {
  // Wait for backend transaction to commit (Pitfall #30)
  await new Promise((resolve) => setTimeout(resolve, 100));
  queryClient.invalidateQueries({
    queryKey: getDraftConfigQueryKey(),
    refetchType: 'active',
  });
}
```

### Solution 2: Backend Returns Version, Frontend Polls Until Match

**Pros:** Guarantees data consistency. No arbitrary delay.
**Cons:** More complex. Requires backend changes.
**Effort:** Large (4 hours)
**Risk:** Medium

```typescript
// Backend returns: { success: true, version: 42 }
// Frontend polls: GET /draft until version >= 42
```

### Solution 3: WebSocket Push from Backend

**Pros:** Real-time updates without polling. No race condition.
**Cons:** Significant architecture change. Overkill for this issue.
**Effort:** Large (2 days)
**Risk:** High

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 235-277)
- `apps/web/src/hooks/useConciergeChat.ts` (calls onToolComplete)

### Both Tool Completion Handlers Need Fix

```typescript
// Line 248-255: Storefront modification handler
if (modifiedStorefront) {
  await new Promise(resolve => setTimeout(resolve, 100)); // ADD THIS
  queryClient.invalidateQueries({...});
}

// Line 266-273: Marketing content handler
if (generatedMarketing) {
  await new Promise(resolve => setTimeout(resolve, 100)); // ADD THIS
  agentUIActions.showPreview('home');
  queryClient.invalidateQueries({...});
}
```

### Acceptance Criteria

- [ ] Preview updates automatically after agent modifies storefront
- [ ] No console errors during the flow
- [ ] E2E test `build-mode.spec.ts` passes consistently
- [ ] Pattern added to CLAUDE.md as implementation example for Pitfall #30

## Work Log

| Date       | Action                              | Learnings                                           |
| ---------- | ----------------------------------- | --------------------------------------------------- |
| 2026-02-02 | Created via multi-agent code review | Manual refresh works = timing issue, not data issue |

## Resources

- CLAUDE.md Pitfall #30: Race condition on cache invalidation
- Related: #817 (error serialization - need visibility to confirm this fix works)
