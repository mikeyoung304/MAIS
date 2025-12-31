---
status: complete
priority: p2
issue_id: '108'
tags: [code-review, performance, react, ui-redesign]
dependencies: []
---

# Missing React.memo on List Components - Unnecessary Re-renders

## Problem Statement

Several list components (MetricsCards, BlackoutsList, SegmentsList, TabNavigation) are missing React.memo, causing unnecessary re-renders when parent state changes.

**Why it matters:** Performance degradation with larger datasets (100+ items).

## Findings

### From performance-oracle agent:

**Components needing React.memo:**

1. **MetricsCards.tsx** (lines 18-123)
   - Re-renders on every tab change
   - High impact

2. **BlackoutsList.tsx** (lines 17-152)
   - Expensive sorting on every render
   - Medium impact

3. **SegmentsList.tsx** (lines 22-150)
   - Re-renders whenever parent re-renders
   - Medium impact

4. **TabNavigation.tsx** (line 40)
   - Creates 6 new function objects per render
   - Medium impact

## Proposed Solutions

### Solution 1: Add React.memo to All List Components (Recommended)

**Pros:** Immediate performance improvement
**Cons:** Minimal
**Effort:** Small (1 hour for all)
**Risk:** Low

```typescript
export const MetricsCards = React.memo(function MetricsCards({ ... }) {
  // ...
});

export const BlackoutsList = React.memo(function BlackoutsList({ ... }) {
  const sortedBlackouts = useMemo(() =>
    [...blackouts].sort((a, b) => ...),
    [blackouts]
  );
  // ...
});
```

## Acceptance Criteria

- [ ] React.memo added to MetricsCards
- [ ] React.memo added to BlackoutsList with useMemo for sorting
- [ ] React.memo added to SegmentsList
- [ ] React.memo added to TabNavigation
- [ ] React DevTools confirms reduced re-renders

## Work Log

| Date       | Action                   | Learnings                     |
| ---------- | ------------------------ | ----------------------------- |
| 2025-11-30 | Created from code review | Performance issues identified |
