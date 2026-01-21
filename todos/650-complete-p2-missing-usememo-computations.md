---
status: completed
priority: p2
issue_id: 650
tags: [code-review, performance, react, optimization]
dependencies: []
completed_at: 2026-01-21
---

# Missing useMemo for Computed Values

## Problem Statement

The `packagesBySegment` Map and `segmentsWithPackages` array are recomputed on every render. With many segments/packages, this is wasteful and can cause unnecessary re-renders of child components.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 247-255 (packagesBySegment)
- Lines 258-260 (segmentsWithPackages)

**Current code:**

```typescript
// Recomputed on every render
const packagesBySegment = new Map<string, PackageData[]>();
segments.forEach((segment) => {
  const segmentPackages = activePackages
    .filter((p) => p.segmentId === segment.id)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
  if (segmentPackages.length > 0) {
    packagesBySegment.set(segment.id, segmentPackages);
  }
});

// Also recomputed on every render
const segmentsWithPackages = segments
  .filter((s) => packagesBySegment.has(s.id))
  .sort((a, b) => a.sortOrder - b.sortOrder);
```

**Source:** performance-oracle agent

## Proposed Solutions

### Option 1: Wrap in useMemo (Recommended)

Memoize both computations:

```typescript
const packagesBySegment = useMemo(() => {
  const map = new Map<string, PackageData[]>();
  segments.forEach((segment) => {
    const segmentPackages = activePackages
      .filter((p) => p.segmentId === segment.id)
      .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
    if (segmentPackages.length > 0) {
      map.set(segment.id, segmentPackages);
    }
  });
  return map;
}, [segments, activePackages]);

const segmentsWithPackages = useMemo(
  () =>
    segments.filter((s) => packagesBySegment.has(s.id)).sort((a, b) => a.sortOrder - b.sortOrder),
  [segments, packagesBySegment]
);
```

**Pros:**

- Only recomputes when dependencies change
- Standard React optimization pattern
- No visual change

**Cons:**

- Slight memory overhead for memoization

**Effort:** Small (10 min)
**Risk:** Low

## Recommended Action

Option 1 - Add useMemo wrappers

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Also consider:**

- Adding React.memo to SegmentCard and TierCard components
- These child components will benefit from stable parent values

## Acceptance Criteria

- [ ] `packagesBySegment` wrapped in `useMemo`
- [ ] `segmentsWithPackages` wrapped in `useMemo`
- [ ] Correct dependency arrays
- [ ] No visual changes
- [ ] React DevTools shows fewer re-renders

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-08 | Created from code review | useMemo for derived data prevents unnecessary work |

## Resources

- React useMemo: https://react.dev/reference/react/useMemo
- Code review: Segment-first browsing implementation
