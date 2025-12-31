---
status: complete
priority: p2
issue_id: '233'
tags: [performance, code-review, landing-page, react, memoization]
dependencies: []
source: 'code-review-landing-page-visual-editor'
---

# TODO-233: Add Memoization Strategy for Editable Section Components

## Priority: P2 (Important - Should Fix)

## Status: Pending

## Source: Performance Review - Landing Page Visual Editor Plan

## Problem Statement

The plan specifies 7 editable section components but lacks detailed memoization strategy. Without proper `useMemo` and `useCallback`, every auto-save will trigger cascading re-renders across all sections.

**Why It Matters:**

- Keyboard input jank during typing
- 60fps target missed during edits
- All sections re-render when editing single field

## Findings

**Evidence:**

- Plan shows basic `memo()` wrapper (line 413) but children lack optimization
- Existing `EditablePackageCard.tsx` (lines 34-58) demonstrates proper dual-memo pattern
- useVisualEditor.ts uses functional state updates (lines 199-223)

**Required Pattern:**

```typescript
const effectiveValues = useMemo(
  () => ({
    headline: config.headline,
    subheadline: config.subheadline,
    ctaText: config.ctaText,
  }),
  [config.headline, config.subheadline, config.ctaText]
);

const handleHeadlineChange = useCallback(
  (headline: string) => {
    onUpdate({ headline });
  },
  [onUpdate]
);
```

## Proposed Solutions

### Option A: Replicate EditablePackageCard Pattern (Recommended)

Apply same memoization strategy from visual editor to all landing page sections.

**Pros:** Proven pattern, consistent codebase
**Cons:** More boilerplate per component
**Effort:** Medium (2-3 hours across 7 components)
**Risk:** Low

### Option B: Generic EditableSection Wrapper

Create wrapper component that handles memoization for all sections.

**Pros:** DRY, single implementation
**Cons:** More abstraction
**Effort:** Medium (2 hours)
**Risk:** Medium

## Recommended Action

**Option A** - Replicate proven pattern for reliability.

## Acceptance Criteria

- [ ] All 7 section components use `React.memo()`
- [ ] All derived values wrapped in `useMemo()`
- [ ] All callbacks wrapped in `useCallback()`
- [ ] Profile: <16ms re-render on single keystroke
- [ ] No cascading re-renders when editing one section

## Work Log

| Date       | Action  | Notes                                                 |
| ---------- | ------- | ----------------------------------------------------- |
| 2025-12-04 | Created | Performance review of landing page visual editor plan |

## Tags

performance, code-review, landing-page, react, memoization
