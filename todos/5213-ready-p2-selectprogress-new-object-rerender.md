---
status: ready
priority: p2
issue_id: '5213'
tags: [code-review, performance, zustand, guided-refinement]
dependencies: []
---

# P2: selectProgress Creates New Object on Every Call

## Problem Statement

The `selectProgress` selector in `refinement-store.ts` creates a new object on every call. With Zustand's `subscribeWithSelector` middleware performing shallow comparison, this causes unnecessary re-renders because `{} !== {}`.

**Why it matters:** Every state change to ANY field in the refinement store triggers a re-render of SectionWidget, even if progress hasn't changed.

## Findings

**Source:** Performance Oracle Review

**Location:** `apps/web/src/stores/refinement-store.ts:420-425`

**Evidence:**

```typescript
export const selectProgress = (state: RefinementState) => ({
  completed: state.completedSections.length,
  total: state.totalSections,
  percentage:
    state.totalSections > 0 ? (state.completedSections.length / state.totalSections) * 100 : 0,
});
```

**Impact:** SectionWidget (line 91) uses this selector. Any store update triggers re-render even if progress unchanged.

## Proposed Solutions

### Option A: Use zustand/shallow (Recommended)

**Approach:** Use shallow comparison in the component

```typescript
import { useShallow } from 'zustand/shallow';

// In SectionWidget.tsx
const progress = useRefinementStore(
  useShallow((state) => ({
    completed: state.completedSections.length,
    total: state.totalSections,
  }))
);
// Calculate percentage in component
const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
```

**Pros:** Zustand's recommended pattern, minimal changes
**Cons:** Calculation in component instead of selector
**Effort:** Small (15 minutes)
**Risk:** Very Low

### Option B: Split Into Primitive Selectors

**Approach:** Return primitives instead of objects

```typescript
export const selectCompletedCount = (state: RefinementState) => state.completedSections.length;
export const selectTotalSections = (state: RefinementState) => state.totalSections;

// In component
const completed = useRefinementStore(selectCompletedCount);
const total = useRefinementStore(selectTotalSections);
const percentage = total > 0 ? (completed / total) * 100 : 0;
```

**Pros:** No object creation, maximum performance
**Cons:** Multiple hook calls instead of one
**Effort:** Small (15 minutes)
**Risk:** Very Low

### Option C: Memoized Selector with Reselect

**Approach:** Use `createSelector` for memoization

```typescript
import { createSelector } from 'reselect';

export const selectProgress = createSelector(
  [
    (state: RefinementState) => state.completedSections.length,
    (state: RefinementState) => state.totalSections,
  ],
  (completed, total) => ({
    completed,
    total,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  })
);
```

**Pros:** Returns same object reference when inputs unchanged
**Cons:** Adds reselect dependency
**Effort:** Small (20 minutes)
**Risk:** Very Low

## Recommended Action

**APPROVED: Option A - Use zustand/shallow**

Import `useShallow` from `zustand/shallow` and wrap the selector in SectionWidget. Calculate percentage in component.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Zustand best practice, prevents wasted renders

## Technical Details

**Affected Files:**

- `apps/web/src/stores/refinement-store.ts` (selector)
- `apps/web/src/components/build-mode/SectionWidget.tsx` (usage)

**Testing:**

- Add React DevTools profiler check to verify reduced re-renders

## Acceptance Criteria

- [ ] SectionWidget only re-renders when progress actually changes
- [ ] selectProgress usage updated to use shallow comparison
- [ ] No functional regression
- [ ] TypeScript build passes

## Work Log

| Date       | Action                   | Learnings                          |
| ---------- | ------------------------ | ---------------------------------- |
| 2026-02-04 | Created from code review | Most impactful performance finding |

## Resources

- PR: Guided Refinement Integration
- Zustand shallow docs: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
