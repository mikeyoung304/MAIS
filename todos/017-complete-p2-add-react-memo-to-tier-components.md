---
status: complete
priority: p2
issue_id: '017'
tags: [code-review, performance, react, storefront]
dependencies: []
---

# Add React.memo to TierCard and SegmentCard Components

## Problem Statement

The `TierCard` and `SegmentCard` components are rendered multiple times per page but are not memoized, causing unnecessary re-renders when parent state changes.

**Why this matters:** Each tier card contains image hover transforms and complex className calculations that recalculate on every render. With 3 cards per page, this multiplies the impact.

## Findings

### TierCard Component

**File:** `client/src/features/storefront/TierCard.tsx` (lines 54-150)

The component is rendered 3x per page (budget/middle/luxury) and includes:

- Complex className template literals with conditional classes (lines 67-75)
- Image with CSS transitions
- Badge rendering with conditional display

### SegmentCard Component

**File:** `client/src/pages/StorefrontHome.tsx` (lines 29-83)

The component is rendered 1-3x per page depending on tenant segments and includes:

- Hero image rendering with gradient overlay
- Conditional content rendering

### Performance Impact

- Every parent state change triggers 3-9 re-renders
- className concatenation recalculates on every render
- No prop changes should trigger re-render, but currently does

## Proposed Solutions

### Option A: Wrap Components with React.memo (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
// TierCard.tsx
import { memo } from 'react';

export const TierCard = memo(function TierCard({
  package: pkg,
  tierLevel,
  segmentSlug,
  highlighted = false,
}: TierCardProps) {
  // ... component code
});

// StorefrontHome.tsx
const SegmentCard = memo(function SegmentCard({ segment }: { segment: SegmentDto }) {
  // ... component code
});
```

**Pros:**

- Simple 2-line change per component
- Prevents re-renders when props haven't changed
- React's default shallow comparison works for these props

**Cons:**

- Minimal overhead from memo comparison

### Option B: Extract Inline Functions and useMemo

**Effort:** Medium | **Risk:** Low

Also memoize internal computations like className generation.

**Pros:**

- Maximum optimization

**Cons:**

- Overkill for 3-item arrays
- Adds complexity

## Recommended Action

Implement **Option A** - Add `React.memo` wrapper to both components.

## Technical Details

**Files to Update:**

- `client/src/features/storefront/TierCard.tsx` - Wrap with memo
- `client/src/pages/StorefrontHome.tsx` - Wrap SegmentCard with memo

**Changes:**

```typescript
// Before
export function TierCard({ ... }) { ... }

// After
export const TierCard = memo(function TierCard({ ... }) { ... });
```

## Acceptance Criteria

- [ ] TierCard wrapped with React.memo
- [ ] SegmentCard wrapped with React.memo
- [ ] React DevTools Profiler shows reduced re-renders
- [ ] No visual regressions
- [ ] TypeScript compilation passes

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-11-27 | Created | Found during PR #6 performance review |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- React memo docs: https://react.dev/reference/react/memo
