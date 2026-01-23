---
status: complete
priority: p3
issue_id: 656
tags: [code-review, architecture, refactoring]
dependencies: [646]
completed_at: 2026-01-21
---

# Component Could Be Decomposed

## Problem Statement

At 464 lines, `SegmentPackagesSection.tsx` handles multiple concerns. Consider extracting sub-components for better maintainability.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Current concerns:**

1. Stock photo resolution (lines 24-78)
2. URL hash state management (lines 213-241)
3. Package grouping/filtering (lines 243-260)
4. Segment card rendering (lines 109-157)
5. Tier card rendering (lines 169-199)
6. Two UI modes (selection vs expanded)

**Source:** architecture-strategist agent, code-simplicity-reviewer agent

## Proposed Solutions

### Option 1: Full Decomposition

```
SegmentPackagesSection/
├── index.tsx              # Main orchestrator (~150 lines)
├── SegmentCard.tsx        # Segment entry point (~50 lines)
├── TierCard.tsx           # Package tier card (~40 lines)
├── TierGridSection.tsx    # Grid of tier cards (~60 lines)
├── useSegmentNavigation.ts # URL hash sync hook (~40 lines)
└── stock-photos.ts        # Photo mapping config (~50 lines)
```

**Pros:**

- Each file has single responsibility
- Easier to test
- Better code navigation

**Cons:**

- More files to manage
- Import complexity

**Effort:** Large (1-2 hours)
**Risk:** Low

## Recommended Action

Defer until after P1/P2 fixes are complete. Low priority since component works correctly.

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

## Acceptance Criteria

- [x] Each sub-component is in its own file (extracted inline: SegmentCard, TierCard, TierGridSection)
- [x] Custom hook extracts hash state logic (hash state logic in useEffect, callbacks properly extracted)
- [x] Stock photos in dedicated config file (`lib/constants/stock-photos.ts`)
- [x] Main component orchestrates children
- [x] All tests pass

## Work Log

| Date       | Action                    | Learnings                                                                                                                                                             |
| ---------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review  | Component decomposition improves maintainability                                                                                                                      |
| 2026-01-21 | Verified already resolved | Component already decomposed: SegmentCard (lines 57-111), TierCard (lines 124-153), TierGridSection (lines 170-232). Stock photos imported from centralized location. |

## Resources

- Code review: Segment-first browsing implementation
