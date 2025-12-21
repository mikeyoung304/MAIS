# P2: DateBookingWizard Component Too Large (472 lines)

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

The DateBookingWizard component at 472 lines approaches the threshold where it should be refactored into smaller sub-components.

**File:** `client/src/features/storefront/DateBookingWizard.tsx`

**Current Structure:**
- Lines 178-219: Step 0 - Package Confirmation Card (~42 lines)
- Lines 222-264: Step 1 - Date Selection Card (~43 lines)
- Lines 267-339: Step 2 - Customer Details Form (~73 lines)
- Lines 345-405: Step 3 - Review & Payment Summary (~61 lines)

## Impact

- Hard to read/navigate
- Difficult to test individual steps in isolation
- Higher cognitive load for developers
- Harder to maintain

## Recommended Fix

Extract each step into separate components:

```
client/src/features/storefront/date-booking/
├── DateBookingWizard.tsx        (~150 lines - orchestration)
├── ConfirmationStep.tsx         (~42 lines)
├── DateSelectionStep.tsx        (~43 lines)
├── CustomerDetailsStep.tsx      (~73 lines)
├── ReviewStep.tsx               (~61 lines)
└── types.ts                     (shared interfaces)
```

**Simplified DateBookingWizard:**

```typescript
export function DateBookingWizard({ package: pkg }) {
  // State management
  // Navigation handlers

  const renderStepContent = () => {
    switch (currentStepIndex) {
      case 0: return <ConfirmationStep package={pkg} />;
      case 1: return <DateSelectionStep {...dateStepProps} />;
      case 2: return <CustomerDetailsStep {...detailsStepProps} />;
      case 3: return <ReviewStep {...reviewStepProps} />;
    }
  };

  return (
    <div>
      <Stepper steps={steps} currentStep={currentStepIndex} />
      {renderStepContent()}
      <NavigationButtons />
    </div>
  );
}
```

## Benefits

- Each step is testable in isolation
- Reduces cognitive load
- Enables parallel development
- Memoization is natural (see #320)

## Related

- #320 (Missing React.memo) - Extracting enables memoization

## Review Reference
- Code Simplicity Review Finding P2-3 (Component Size)
