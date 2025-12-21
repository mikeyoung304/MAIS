# P1: Duplicate Email Validation Logic

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Email validation logic is duplicated between frontend and backend with identical regex patterns.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:103-106`

```typescript
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

**Duplicate in:** `server/src/lib/validation.ts:41-46`

## Impact

- If email validation rules change, updates must be made in multiple places
- Risk of inconsistency between client and server validation
- Maintenance burden increases with each duplication

## Recommended Fix

1. Create shared validation utilities in `client/src/lib/validation.ts`:

```typescript
// client/src/lib/validation.ts
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
```

2. Import in DateBookingWizard:

```typescript
import { isValidEmail } from '@/lib/validation';
```

3. Optionally, use Zod schema from contracts for consistency:

```typescript
import { CreateDateBookingDtoSchema } from '@macon/contracts';

// Validate using existing schema
const result = CreateDateBookingDtoSchema.pick({
  customerEmail: true
}).safeParse({ customerEmail: email });
```

## Files to Update

1. Create `client/src/lib/validation.ts`
2. Update `client/src/features/storefront/DateBookingWizard.tsx`
3. Consider other forms that duplicate this pattern

## Related

- #312 (Use Zod Schemas for Validation) - Alternative approach

## Review Reference
- Code Simplicity Review Finding P1-1 (Duplicate Email Validation Logic)
