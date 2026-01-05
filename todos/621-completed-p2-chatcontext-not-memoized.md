---
status: completed
priority: p2
issue_id: '621'
tags: [code-review, performance, build-mode]
dependencies: []
completed_date: '2026-01-05'
---

# chatContext Object Not Memoized Causing Re-renders

## Problem Statement

The `chatContext` object is recreated on every render, causing unnecessary re-renders of the BuildModeChat component.

**What's broken:** New object reference on every render
**Why it matters:** Performance degradation in chat component

## Findings

### Source: Performance Review Agent

**File:** `apps/web/src/app/(protected)/tenant/build/page.tsx` (lines 183-188)

**Current Code:**

```typescript
const chatContext: BuildModeChatContext = {
  currentPage,
  sectionCount: draftConfig?.[currentPage]?.sections?.length ?? 0,
  hasDraft: isDirty,
  tenantSlug: slug || '',
};
```

**Impact:** `BuildModeChat` receives a new object reference on every parent render, potentially triggering unnecessary re-renders even when values haven't changed.

## Proposed Solutions

### Option A: Wrap in useMemo (Recommended)

**Description:** Memoize the context object

```typescript
const chatContext = useMemo(
  () => ({
    currentPage,
    sectionCount: draftConfig?.[currentPage]?.sections?.length ?? 0,
    hasDraft: isDirty,
    tenantSlug: slug || '',
  }),
  [currentPage, draftConfig, isDirty, slug]
);
```

- **Pros:** Simple fix, prevents unnecessary re-renders
- **Cons:** Minor - adds dependency array maintenance
- **Effort:** Small (5 minutes)
- **Risk:** None

## Recommended Action

Option A - Add useMemo wrapper

## Technical Details

**Affected Files:**

- `apps/web/src/app/(protected)/tenant/build/page.tsx`

## Acceptance Criteria

- [x] chatContext wrapped in useMemo
- [x] Dependencies array includes all used values
- [x] No lint warnings about missing deps

## Work Log

| Date       | Action                        | Learnings                                                                          |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| 2026-01-05 | Created from code review      | Pattern: Memoize object props passed to child components                           |
| 2026-01-05 | RESOLVED - Parallel agent fix | Wrapped chatContext in useMemo with deps [currentPage, draftConfig, isDirty, slug] |

## Resources

- React docs: useMemo for referential equality
