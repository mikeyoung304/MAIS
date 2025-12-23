# P2: Missing React.memo on DateBookingWizard Steps

## Priority: P2 Important
## Status: ready
## Feature: DATE Booking Flow
## Category: Performance

## Issue

The `renderStepContent()` function recreates all step JSX on every render, even though only one step is visible at a time.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:175-410`

```typescript
// Line 175-410 - Recreates ALL steps on every render
const renderStepContent = () => {
  switch (currentStepIndex) {
    case 0: return <Card>...</Card>;  // ~40 lines of JSX
    case 1: return <Card>...</Card>;  // ~45 lines of JSX (DayPicker)
    case 2: return <Card>...</Card>;  // ~75 lines of JSX (forms)
    case 3: return <Card>...</Card>;  // ~60 lines of JSX
  }
};
```

## Impact

- Unnecessary re-renders when unrelated state changes (e.g., typing in email field)
- DayPicker calendar re-renders on every keystroke
- Moderate performance impact (wasteful but not critical)

## Recommended Fix

Split into memoized step components:

```typescript
// New files
// - DateBookingConfirmationStep.tsx
// - DateBookingDateSelectionStep.tsx
// - DateBookingDetailsStep.tsx
// - DateBookingReviewStep.tsx

const ConfirmStep = React.memo(({ pkg }: { pkg: PackageDto }) => {
  return <Card>...</Card>;
});

const DateSelectionStep = React.memo(({
  selectedDate,
  onDateSelect,
  unavailableDates
}: DateStepProps) => {
  return <Card>...</Card>;
});

// In DateBookingWizard:
const renderStepContent = () => {
  switch (currentStepIndex) {
    case 0: return <ConfirmStep pkg={pkg} />;
    case 1: return <DateSelectionStep {...} />;
    // ...
  }
};
```

## Benefits

- Only active step re-renders
- Easier to test individual steps
- Reduces DateBookingWizard from 472 to ~150 lines

## Related

- #321 (Component Size) - Extracting steps also addresses size issue



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Performance Review Finding P2 (Missing React.memo)
- Code Simplicity Review Finding P2-3 (Component Size)
