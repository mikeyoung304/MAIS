---
status: complete
priority: p2
issue_id: '018'
tags: [code-review, performance, react, storefront]
dependencies: []
---

# Add useMemo to Package Filter Operations

## Problem Statement

The `RootTiers.tsx` and `TierDetailPage.tsx` pages filter packages inline without memoization, causing O(n) array operations on every render.

**Why this matters:** While currently the package list is small, filter operations with `.toLowerCase()` calls on every item run unnecessarily on every render.

## Findings

### RootTiers.tsx

**File:** `client/src/pages/RootTiers.tsx` (lines 69-73)

```typescript
// Runs on every render
const rootPackages = (packages || []).filter(
  (p: PackageDto) =>
    !p.segmentId &&
    p.grouping &&
    VALID_TIERS.includes(p.grouping.toLowerCase() as (typeof VALID_TIERS)[number])
);
```

### TierDetailPage.tsx

**File:** `client/src/pages/TierDetailPage.tsx` (lines 103-107)

```typescript
// Same filter logic, also runs on every render
const rootPackages = packages.filter(
  (p: PackageDto) =>
    !p.segmentId && p.grouping && VALID_TIERS.includes(p.grouping.toLowerCase() as TierLevel)
);
```

### Impact

- O(n) filter operation on every render
- `.toLowerCase()` called for every package on every render
- Duplicate logic across files (see todo-016)

## Proposed Solutions

### Option A: Wrap with useMemo (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
const rootPackages = useMemo(
  () =>
    (packages || []).filter(
      (p: PackageDto) =>
        !p.segmentId && p.grouping && VALID_TIERS.includes(p.grouping.toLowerCase() as TierLevel)
    ),
  [packages]
);
```

**Pros:**

- Only recomputes when `packages` changes
- Prevents unnecessary work on unrelated state changes
- Simple change

**Cons:**

- Minimal memory overhead for memoized value

### Option B: Create Custom Hook

**Effort:** Medium | **Risk:** Low

Create `useRootPackages()` hook in `features/catalog/hooks.ts`.

**Pros:**

- Reusable across components
- Centralizes filtering logic

**Cons:**

- More structural change
- Should be combined with todo-016 refactoring

## Recommended Action

Implement **Option A** now, consider **Option B** when addressing todo-016.

## Technical Details

**Files to Update:**

- `client/src/pages/RootTiers.tsx` - Add useMemo import and wrapper
- `client/src/pages/TierDetailPage.tsx` - Add useMemo import and wrapper

**Import Change:**

```typescript
import { useMemo } from 'react';
```

## Acceptance Criteria

- [ ] RootTiers uses useMemo for rootPackages filter
- [ ] TierDetailPage uses useMemo for rootPackages filter
- [ ] Filter only runs when packages data changes
- [ ] TypeScript compilation passes
- [ ] No runtime errors

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-11-27 | Created | Found during PR #6 performance review |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- React useMemo docs: https://react.dev/reference/react/useMemo
