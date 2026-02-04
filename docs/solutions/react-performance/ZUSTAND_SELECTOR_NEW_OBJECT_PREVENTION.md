# Zustand Selector New Object Prevention

## Problem

Zustand selectors that return computed objects cause unnecessary re-renders because a new object is created on every call, and Zustand's default shallow comparison sees `{} !== {}`.

## Anti-Pattern

```typescript
// BAD: Creates new object on every call
export const selectProgress = (state: RefinementState) => ({
  completed: state.completedSections.length,
  total: state.totalSections,
  percentage:
    state.totalSections > 0 ? (state.completedSections.length / state.totalSections) * 100 : 0,
});

// In component - re-renders on ANY store update
const progress = useRefinementStore(selectProgress);
```

## Why It Happens

1. Zustand uses `Object.is()` for equality by default
2. `{a: 1} !== {a: 1}` because they're different object references
3. Every store update calls the selector, creating a new object
4. New object !== previous object, so React re-renders

## Solutions

### Option A: useShallow (Recommended)

```typescript
import { useShallow } from 'zustand/shallow';

// Selector still returns object
export const selectProgress = (state: RefinementState) => ({
  completed: state.completedSections.length,
  total: state.totalSections,
});

// In component - useShallow compares object values
const progress = useRefinementStore(useShallow(selectProgress));

// Calculate derived values in component
const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
```

### Option B: Split Into Primitive Selectors

```typescript
// Primitives are compared by value
export const selectCompletedCount = (state: RefinementState) => state.completedSections.length;

export const selectTotalSections = (state: RefinementState) => state.totalSections;

// In component - each returns a primitive
const completed = useRefinementStore(selectCompletedCount);
const total = useRefinementStore(selectTotalSections);
const percentage = total > 0 ? (completed / total) * 100 : 0;
```

### Option C: Memoized Selector with Reselect

```typescript
import { createSelector } from 'reselect';

// Memoized - returns same reference when inputs unchanged
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

## When to Use Each

| Approach                | Use When                                       |
| ----------------------- | ---------------------------------------------- |
| **useShallow**          | Object has 2-5 primitive fields, quick fix     |
| **Primitive selectors** | Maximum performance, fields used independently |
| **createSelector**      | Complex derived state, multiple computations   |

## Detection

Signs your selector has this issue:

1. Component re-renders when unrelated store fields change
2. React DevTools shows frequent renders
3. Selector returns `{ ... }` object literal
4. No `useShallow`, `createSelector`, or memoization

## Quick Diagnostic

```typescript
// Add to component temporarily
useEffect(() => {
  console.log('[Component] rendered');
});

// If this logs on every store update, you have the problem
```

## Related

- Zustand docs: [Extracting Actions from State](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions)
- Zustand docs: [Auto Generating Selectors](https://docs.pmnd.rs/zustand/guides/auto-generating-selectors)
- CLAUDE.md Pitfall #96
