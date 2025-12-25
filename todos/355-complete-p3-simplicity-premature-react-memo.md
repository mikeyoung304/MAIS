---
status: complete
priority: p3
issue_id: "355"
tags: [code-review, simplicity, react, over-engineering]
dependencies: []
---

# Simplicity: Premature React.memo on Simple Components

## Problem Statement

All four wizard step components are wrapped in `React.memo()` but are simple presentational components with frequently-changing props that won't benefit from memoization.

**Why it matters:** Adds complexity and overhead without measurable benefit. The shallow prop comparison cost may exceed the prevented render cost.

## Findings

**Files:**
- `client/src/features/storefront/date-booking/ConfirmationStep.tsx:14`
- `client/src/features/storefront/date-booking/CustomerDetailsStep.tsx:14`
- `client/src/features/storefront/date-booking/DateSelectionStep.tsx:16`
- `client/src/features/storefront/date-booking/ReviewStep.tsx:13`

```typescript
// Each component wrapped unnecessarily
const ConfirmationStep = React.memo(({ package: pkg }: ConfirmationStepProps) => {
  // 50-90 lines of simple JSX
});
```

**Agent:** code-simplicity-reviewer

## Proposed Solutions

### Option A: Remove React.memo wrappers (Recommended)
- **Pros:** Simpler code, no overhead
- **Cons:** None - these components benefit little from memoization
- **Effort:** Small
- **Risk:** Low

```typescript
export function ConfirmationStep({ package: pkg }: ConfirmationStepProps) {
  // ...
}
```

## Recommended Action

Option A - Remove React.memo from all four step components.

## Technical Details

- **Affected files:** All files in `client/src/features/storefront/date-booking/`
- **Components:** ConfirmationStep, CustomerDetailsStep, DateSelectionStep, ReviewStep
- **Database changes:** None

## Acceptance Criteria

- [ ] React.memo removed from step components
- [ ] displayName assignments removed (no longer needed)
- [ ] Wizard still renders correctly
- [ ] No visible performance degradation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | code-simplicity-reviewer finding |

## Resources

- When to use React.memo: https://react.dev/reference/react/memo#should-you-add-memo-everywhere
