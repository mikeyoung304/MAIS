# P1 RESOLVED: TanStack Query staleTime Blocks Immediate Refetch

**Priority:** P1 - CRITICAL (Blocking paintbrush feature)
**Status:** Resolved
**Source:** Performance Review (multi-agent parallel review)
**Date:** 2026-01-11

## Problem

The `useDraftConfig` hook has a 30-second `staleTime`, which means:

1. Even when `invalidateQueries()` is called after tool execution
2. TanStack Query considers data "fresh" and doesn't refetch
3. User sees stale preview for up to 30 seconds

Additionally, `invalidateQueries()` doesn't force a refetch by default.

## Root Cause

```typescript
// apps/web/src/hooks/useDraftConfig.ts (lines 127-131)

staleTime: 30_000, // 30 seconds - too long for real-time updates
gcTime: 5 * 60_000,
refetchOnWindowFocus: false,
```

And:

```typescript
// apps/web/src/hooks/useDraftConfig.ts (lines 272-278)

export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
    // Missing: refetchType: 'active'
  }
};
```

## Fix Applied

1. Changed `staleTime: 30_000` to `staleTime: 0`
2. Added `refetchType: 'active'` to `invalidateQueries()` call

## Verification

1. Speak to agent: "Change my tagline to 'Test'"
2. Preview updates within 1-2 seconds (not 30)
3. Check network tab - should see GET request to `/api/tenant-admin/landing-page/draft`

## Trade-offs

- Setting `staleTime: 0` means more network requests
- But for a real-time editor, immediate feedback is critical
- Can optimize later with optimistic updates if needed

## Related

- TanStack Query invalidation docs
- docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md
