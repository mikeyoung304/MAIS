---
status: completed
priority: p2
issue_id: '527'
tags:
  - code-review
  - react
  - hooks
  - mobile
  - performance
dependencies: []
completed_date: 2026-01-01
---

# usePinchZoom Stale Scale Dependency

## Problem Statement

The `usePinchZoom` hook had `scale` in the dependency array of useCallback handlers, causing listeners to be recreated during pinching and potential jank.

## Solution Implemented

Applied Solution 1 (Use Ref for Initial Scale):

**File modified:** `apps/web/src/hooks/usePinchZoom.ts`

**Changes:**

1. Added scaleRef and sync effect (lines 143-145):
```typescript
const scaleRef = useRef(scale);
useEffect(() => {
  scaleRef.current = scale;
}, [scale]);
```

2. Updated `handleTouchStart` (line 202):
   - Changed `initialScale: scale` to `initialScale: scaleRef.current`
   - Removed `scale` from dependency array

3. Updated `handleTouchEnd` (line 276):
   - Changed `const finalScale = scale` to `const finalScale = scaleRef.current`
   - Removed `scale` from dependency array

**Result:** Event handlers now maintain stable references during pinch gestures while still accessing current scale via the ref. No more unnecessary listener recreation.

## Acceptance Criteria

- [x] Event listeners not recreated during pinch gestures
- [x] Scale updates still work correctly
- [x] No animation jank during zooming
- [x] Initial scale captured correctly at gesture start

## Work Log

| Date       | Action                              | Learnings                  |
| ---------- | ----------------------------------- | -------------------------- |
| 2026-01-01 | Created from mobile UX code review | useEffect dependency array |
| 2026-01-01 | Fixed with scaleRef pattern         | Ref pattern for event handlers |
