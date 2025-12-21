# P2: Validation Logic Should Use Zod Schemas

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Manual validation logic in component when Zod schema already exists in contracts.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:103-111`

```typescript
// Current approach:
const canProceedFromStep2 =
  customerDetails.name.trim() !== '' &&
  customerDetails.email.trim() !== '' &&
  isValidEmail(customerDetails.email);
```

The server already has `CreateDateBookingDtoSchema` with complete validation in `contracts/src/dto.ts:167-176`.

## Impact

- Client and server validation can drift
- Inconsistent UX (different error messages)
- Duplicated validation logic

## Recommended Fix

Use the existing Zod schema for client-side validation:

```typescript
import { CreateDateBookingDtoSchema } from '@macon/contracts';

const validateStep2 = () => {
  try {
    CreateDateBookingDtoSchema.pick({
      customerName: true,
      customerEmail: true,
    }).parse({
      customerName: customerDetails.name,
      customerEmail: customerDetails.email,
    });
    return true;
  } catch {
    return false;
  }
};

// Or with error details:
const validateStep2WithErrors = () => {
  const result = CreateDateBookingDtoSchema.pick({
    customerName: true,
    customerEmail: true,
  }).safeParse({
    customerName: customerDetails.name,
    customerEmail: customerDetails.email,
  });

  if (!result.success) {
    return { valid: false, errors: result.error.flatten() };
  }
  return { valid: true, errors: null };
};
```

## Benefits

- Single source of truth for validation
- Consistent error messages between client and server
- Type-safe validation

## Review Reference
- Code Simplicity Review Finding P2-6 (Validation Logic Should Use Zod)
