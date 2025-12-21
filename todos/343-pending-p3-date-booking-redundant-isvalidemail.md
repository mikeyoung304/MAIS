# P3: Redundant isValidEmail Helper Function

## Priority: P3 Nice-to-Have
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

The `isValidEmail` function now just wraps Zod validation, making it redundant.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:148-150`

```typescript
// Legacy helper for backward compatibility
const isValidEmail = (email: string) => {
  return z.string().email().safeParse(email).success;
};
```

This function is no longer used - the component now uses `formValidation.isValid` which comes from the full Zod schema validation.

## Impact

- Dead code that could confuse future developers
- Comment says "backward compatibility" but no code uses it

## Recommended Fix

Remove the unused function:

```typescript
// DELETE these lines:
// Legacy helper for backward compatibility
const isValidEmail = (email: string) => {
  return z.string().email().safeParse(email).success;
};
```

## Review Reference
- Code Review PR: feat/date-booking-hardening (ce6443d)
