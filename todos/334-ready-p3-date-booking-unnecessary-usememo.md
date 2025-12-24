# P3: Unnecessary useMemo in DateBookingWizard

## Priority: P3 Nice-to-have

## Status: ready

## Feature: DATE Booking Flow

## Category: Performance

## Issue

The `useMemo` hook for `steps` has `currentStepIndex` as a dependency but the computation is trivial. The memoization overhead likely exceeds the benefit.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:53-70`

```typescript
const steps: Step[] = useMemo(() => {
  const stepList = [
    { label: 'Confirm', status: 'upcoming' as const },
    { label: 'Date', status: 'upcoming' as const },
    { label: 'Details', status: 'upcoming' as const },
    { label: 'Pay', status: 'upcoming' as const },
  ];

  return stepList.map((step, index) => ({
    ...step,
    status:
      index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming',
  }));
}, [currentStepIndex]);
```

## Impact

- Negligible (4-element array mapping is trivial)
- Adds cognitive overhead without meaningful benefit

## Recommendation

Remove `useMemo` - the computation is simple enough to run on every render:

```typescript
const STEP_LABELS = ['Confirm', 'Date', 'Details', 'Pay'];

const steps: Step[] = STEP_LABELS.map((label, index) => ({
  label,
  status:
    index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming',
}));
```

## Work Log

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference

- Performance Review Finding P3 (Unused Callback useMemo)
- Code Simplicity Review Finding P3-10 (Over-Engineered Steps Array)
