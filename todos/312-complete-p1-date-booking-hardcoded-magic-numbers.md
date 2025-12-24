# P1: Hardcoded Magic Numbers in DateBookingWizard

## Priority: P1 Critical

## Status: complete

## Feature: DATE Booking Flow

## Category: Code Simplicity

## Issue

The number `3` (representing the last step index) is hardcoded in multiple locations.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:74-75, 448`

```typescript
if (currentStepIndex < 3) {  // Line 74
  setCurrentStepIndex(currentStepIndex + 1);
}

{currentStepIndex < 3 ? (  // Line 448
```

## Impact

- If wizard steps change (add/remove), all instances must be updated
- Error-prone maintenance - easy to miss an instance
- Will cause bugs if steps are modified

## Recommended Fix

```typescript
const STEP_LABELS = ['Confirm', 'Date', 'Details', 'Pay'] as const;
const TOTAL_STEPS = STEP_LABELS.length;
const LAST_STEP_INDEX = TOTAL_STEPS - 1;

// Navigation handlers
const goToNextStep = () => {
  if (currentStepIndex < LAST_STEP_INDEX) {
    setCurrentStepIndex(currentStepIndex + 1);
  }
};

// In JSX
{currentStepIndex < LAST_STEP_INDEX ? (
  <Button onClick={goToNextStep}>Continue</Button>
) : (
  <Button onClick={handleCheckout}>Proceed to Payment</Button>
)}
```

## Also Update

1. The `steps` useMemo should derive from `STEP_LABELS`
2. `canProceedFromStep2` → use constant for step 2 index
3. Consider extracting step configuration to a separate constant

## Testing

- Verify navigation works correctly
- Test adding/removing steps (constants should handle it)

## Work Log

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference

- Code Simplicity Review Finding P1-2 (Hardcoded Magic Numbers)
