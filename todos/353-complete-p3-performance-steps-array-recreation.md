---
status: complete
priority: p3
issue_id: "353"
tags: [code-review, performance, react, memoization]
dependencies: []
---

# Performance: Steps Array Recreation on Every Render

## Problem Statement

The `steps` array is recreated on every render, creating 4 new Step objects on every keystroke in the customer details form.

**Why it matters:** Minor GC pressure and unnecessary object allocation. Low priority but easy to fix.

## Findings

**File:** `client/src/features/storefront/DateBookingWizard.tsx:354-364`

```typescript
// Comment claims useMemo not needed, but this runs on EVERY state change
const steps = STEP_LABELS.map((label, index) => ({
  label,
  status: index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming',
}));
```

**Agent:** performance-oracle

## Proposed Solutions

### Option A: Use useMemo with currentStepIndex dependency (Recommended)
- **Pros:** Only recalculates when step changes
- **Cons:** Adds memoization overhead
- **Effort:** Small
- **Risk:** Low

```typescript
const steps = useMemo(() => STEP_LABELS.map((label, index) => ({
  label,
  status: index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming',
})), [currentStepIndex]);
```

## Recommended Action

Option A - Wrap in useMemo.

## Technical Details

- **Affected files:** `client/src/features/storefront/DateBookingWizard.tsx`
- **Components:** DateBookingWizard
- **Database changes:** None

## Acceptance Criteria

- [ ] Steps array only recreated when currentStepIndex changes
- [ ] Wizard navigation still works correctly
- [ ] All date booking tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | performance-oracle agent finding |

## Resources

- React useMemo: https://react.dev/reference/react/useMemo
