# P1: Insufficient Date Validation in DATE Booking DTO

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Security

## Issue

The `CreateDateBookingDtoSchema` only validates date format (YYYY-MM-DD regex) but does NOT validate:
- Date is in the future (allows booking past dates)
- Date is within reasonable bounds (allows year 9999)
- Date is a valid calendar date (allows 2025-02-30)

**File:** `packages/contracts/src/dto.ts:169`

```typescript
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
```

## Attack Vectors

```json
{"date": "2020-01-01"}  // Past date - bypasses business logic
{"date": "9999-12-31"}  // Far future - could cause integer overflow
{"date": "2025-02-30"}  // Invalid date - undefined behavior
{"date": "2025-13-45"}  // Invalid month/day - could crash calendar
```

## Impact

- Business logic bypass - users can book past dates
- Potential calendar provider crashes with invalid dates
- Poor UX when validation fails only at checkout

## Recommended Fix

```typescript
date: z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => {
    const date = new Date(val + 'T00:00:00Z');
    return !isNaN(date.getTime());
  }, 'Date must be a valid calendar date')
  .refine((val) => {
    const date = new Date(val + 'T00:00:00Z');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date >= now;
  }, 'Date must be in the future')
  .refine((val) => {
    const year = parseInt(val.split('-')[0]);
    return year >= 2025 && year <= 2100;
  }, 'Date must be between 2025 and 2100'),
```

## Testing

- Add unit tests for date validation edge cases
- Test past dates, invalid dates, far-future dates

## Review Reference
- Security Review Finding P1-002
- Data Integrity Review Finding P3-002
