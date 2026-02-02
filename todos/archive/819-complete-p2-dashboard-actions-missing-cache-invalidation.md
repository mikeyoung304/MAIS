---
status: ready
priority: p2
issue_id: '819'
tags: [code-review, real-time-preview, cache-invalidation, architecture]
dependencies: ['818']
---

# Dashboard Actions Path Missing Cache Invalidation

## Problem Statement

The agent response processing has TWO parallel paths that should work together but don't:

1. **Tool completion path** (`onToolComplete`): Invalidates cache if tool name matches heuristics
2. **Dashboard actions path** (`onDashboardActions`): Controls UI state but does NOT invalidate cache

When backend returns a `dashboardAction` of type `SHOW_PREVIEW` or `REFRESH_PREVIEW`, the UI shows the preview but with **stale data** because the cache wasn't invalidated.

## Findings

### The Gap

**File:** `apps/web/src/components/agent/AgentPanel.tsx:198-231`

```typescript
const handleDashboardActions = useCallback((actions: DashboardAction[]) => {
  for (const action of actions) {
    switch (action.type) {
      case 'SHOW_PREVIEW':
        agentUIActions.showPreview('home');
        agentUIActions.refreshPreview();
        // MISSING: queryClient.invalidateQueries()
        break;
      case 'REFRESH':
      case 'REFRESH_PREVIEW':
        agentUIActions.refreshPreview();
        // MISSING: queryClient.invalidateQueries()
        break;
    }
  }
}, []);
```

### What refreshPreview Does (NOT Enough)

```typescript
// stores/agent-ui-store.ts
refreshPreview: () => {
  set((state) => ({ previewRefreshKey: state.previewRefreshKey + 1 }));
}

// PreviewPanel.tsx - sends CURRENT (stale) config to iframe
if (previewRefreshKey > prevRefreshKeyRef.current) {
  iframeRef.current.contentWindow.postMessage({
    type: 'BUILD_MODE_CONFIG_UPDATE',
    data: { config: draftConfig }, // This is STALE
  }, ...);
}
```

### Dual Path Problem

| Path               | Trigger                     | Cache Invalidated? | Result     |
| ------------------ | --------------------------- | ------------------ | ---------- |
| onToolComplete     | Tool name matches patterns  | ✅ Yes             | Fresh data |
| onDashboardActions | dashboardAction in response | ❌ No              | Stale data |

If backend returns ONLY `dashboardActions` (no tool calls), preview shows stale data.

## Proposed Solutions

### Solution 1: Add Invalidation to Dashboard Action Handlers (Recommended)

**Pros:** Targeted fix. Maintains separation of concerns.
**Cons:** Duplicates invalidation logic.
**Effort:** Small (30 min)
**Risk:** Low

```typescript
const handleDashboardActions = useCallback(
  (actions: DashboardAction[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'SHOW_PREVIEW':
          // Invalidate FIRST, then show preview
          queryClient.invalidateQueries({
            queryKey: getDraftConfigQueryKey(),
            refetchType: 'active',
          });
          agentUIActions.showPreview('home');
          break;
        case 'REFRESH':
        case 'REFRESH_PREVIEW':
          queryClient.invalidateQueries({
            queryKey: getDraftConfigQueryKey(),
            refetchType: 'active',
          });
          agentUIActions.refreshPreview();
          break;
      }
    }
  },
  [queryClient]
);
```

### Solution 2: Unify Both Paths in Single Handler

**Pros:** Single source of truth. No duplicate logic.
**Cons:** Larger refactor. May change callback signatures.
**Effort:** Medium (2 hours)
**Risk:** Medium

### Solution 3: Backend Always Returns Tool Calls for Storefront Changes

**Pros:** Frontend logic simplified. Backend is source of truth.
**Cons:** Requires backend changes. May not cover all cases.
**Effort:** Medium (2 hours)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 198-231)
- Need to add `queryClient` to dependency array

### Acceptance Criteria

- [ ] SHOW_PREVIEW action triggers cache invalidation
- [ ] REFRESH_PREVIEW action triggers cache invalidation
- [ ] Preview shows fresh data regardless of which path triggered it
- [ ] No regression in tool completion flow

## Work Log

| Date       | Action                              | Learnings                                  |
| ---------- | ----------------------------------- | ------------------------------------------ |
| 2026-02-02 | Created via multi-agent code review | Dual path architecture creates sync issues |

## Resources

- Related: #818 (timing race - should apply delay here too)
- Agent panel architecture: `docs/architecture/BUILD_MODE_VISION.md`
