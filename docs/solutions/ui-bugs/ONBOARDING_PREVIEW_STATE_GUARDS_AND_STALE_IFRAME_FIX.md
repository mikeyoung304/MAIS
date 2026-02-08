---
title: Onboarding Preview State Guards and Stale Iframe Fix
category: ui-bugs
severity: P1
date_solved: 2026-02-06
related_pitfalls: [26, 87, 88]
related_commits: [61826b3b]
tags: [zustand, onboarding, coming-soon, iframe, cache-invalidation, preview]
---

# Onboarding Preview State Guards and Stale Iframe Fix

## Symptoms

Two related UX bugs during agent onboarding:

### Bug 1: Premature Preview Switch

The right-side display switches from the "Coming Soon" animation to a raw placeholder website ("Welcome to My Business") while the agent is still in the DISCOVERY/SERVICES phase gathering business info. The reveal should only happen after the agent has enough facts to build a first draft.

### Bug 2: Agent Says "Updated" But Preview Shows Stale Content

Agent says "I updated your About section — check the right side!" but the preview iframe still shows placeholder content. The tool call succeeds (backend confirms write), but the iframe never receives fresh data.

## Root Cause

### Bug 1: No State Guard on `coming_soon`

The `coming_soon` view state is set during onboarding initialization (`tenant/layout.tsx`). The intended state machine is:

```
coming_soon → (revealSite()) → revealing → preview
```

But three Zustand actions could bypass this and directly switch to `preview` or `dashboard`:

- `showPreview()` — called by `generatedMarketing` heuristic in AgentPanel
- `showDashboard()` — called by dashboard action handlers
- `highlightSection()` — called when `update_section` returns `SCROLL_TO_SECTION`

Any agent tool result that matched the `modifiedStorefront` or `generatedMarketing` heuristics would call `showPreview()`, immediately overriding `coming_soon`. The agent running market research (returning tool results with "marketing" in the name) was the specific trigger.

### Bug 2: Fire-and-Forget Cache Invalidation

The `modifiedStorefront` block in `AgentPanel.tsx` had this flow:

```typescript
// OLD (broken)
queryClient.invalidateQueries({
  // Fire-and-forget!
  queryKey: getDraftConfigQueryKey(),
  refetchType: 'active',
});
// refreshPreview() was NEVER called — iframe kept stale data
```

Two problems:

1. `invalidateQueries` is async but was not awaited — the refetch hadn't completed
2. `refreshPreview()` was never called — even after refetch, nothing pushed fresh data to the iframe via PostMessage

The data flow requires all three steps in sequence:

1. **Invalidate** TanStack Query cache (marks data stale)
2. **Wait** for refetch to complete (fresh data in cache)
3. **Push** fresh data to iframe via `refreshPreview()` (increments `previewRefreshKey` → triggers PostMessage)

## Solution

### Fix 1: Coming Soon State Guards

Added early-return guards to all three actions in `agent-ui-store.ts`:

```typescript
// In showPreview()
showPreview: (page = 'home', agentSessionId = null) =>
  set((state) => {
    if (!state.tenantId) return;
    // Guard: only revealSite() can transition away from coming_soon
    if (state.view.status === 'coming_soon') return;
    // ... rest of action
  }),

// In showDashboard()
showDashboard: (agentSessionId = null) =>
  set((state) => {
    if (!state.tenantId) return;
    if (state.view.status === 'coming_soon') return;
    // ... rest of action
  }),

// In highlightSection()
highlightSection: (sectionId: string) =>
  set((state) => {
    // ...
    if (state.view.status === 'coming_soon') return;
    // ... rest of action
  }),
```

`revealSite()` remains the ONLY action that can transition from `coming_soon` → `revealing`. This enforces the state machine invariant.

### Fix 2: Await Invalidation + Explicit Refresh

```typescript
// NEW (fixed)
if (modifiedStorefront) {
  // Wait for backend transaction to commit (Pitfall #26)
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Await refetch — fresh data must be in cache before we push to iframe
  await queryClient.invalidateQueries({
    queryKey: getDraftConfigQueryKey(),
    refetchType: 'active',
  });
  // Push fresh draft data to preview iframe via PostMessage
  agentUIActions.refreshPreview();
}
```

The same pattern was applied to the `generatedMarketing` block for consistency.

## Why This Was Hard to Catch

1. **Bug 1** only manifested during onboarding — outside onboarding, `coming_soon` is never set, so the guards are no-ops
2. **Bug 2** appeared to work in some cases because React Query's background refetch would eventually update the cache, and the next user interaction would trigger a re-render showing fresh content — making it seem like the update "just took a moment"
3. The `modifiedStorefront` heuristic checks tool names with `.includes()` — any tool with "section" or "storefront" in its name triggers it, making the bug surface unpredictably

## Prevention

### State Machine Transitions

When adding new Zustand actions that change `view.status`:

1. Check if `coming_soon` state exists and whether your action should be blocked
2. The pattern: `if (state.view.status === 'coming_soon') return;`
3. Only `revealSite()` transitions from `coming_soon` — this is an invariant

### Cache Invalidation → Iframe Refresh

When invalidating draft data that should appear in the preview iframe:

```typescript
// Always use this 3-step pattern:
await new Promise((resolve) => setTimeout(resolve, 100));  // 1. Wait for DB
await queryClient.invalidateQueries({ ... });               // 2. Await refetch
agentUIActions.refreshPreview();                             // 3. Push to iframe
```

### Detection Checklist

```bash
# Find fire-and-forget invalidations (missing await)
grep -n "invalidateQueries" apps/web/src/components/agent/AgentPanel.tsx | grep -v await

# Find actions that change view.status without coming_soon guard
grep -A5 "view.status\|view =" apps/web/src/stores/agent-ui-store.ts | grep -v coming_soon

# Verify refreshPreview is called after every invalidation in AgentPanel
grep -c "invalidateQueries" apps/web/src/components/agent/AgentPanel.tsx
grep -c "refreshPreview" apps/web/src/components/agent/AgentPanel.tsx
# These counts should match (every invalidation should have a corresponding refresh)
```

## Cross-References

- `IFRAME_PREVIEW_REFRESH_STALE_CONTENT.md` — Refresh key mechanism details
- `CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md` — 100ms delay pattern (Pitfall #26)
- `POSTMESSAGE_QUICK_REFERENCE.md` — PostMessage sender/handler verification
- `ZUSTAND_SELECTOR_NEW_OBJECT_PREVENTION.md` — Related Zustand patterns (Pitfall #87)
- `AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md` — First draft workflow context
- Pitfall #88 — Dead PostMessage handlers
