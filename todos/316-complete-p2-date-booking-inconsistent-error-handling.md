# P2: Inconsistent Error Handling Pattern in Route

## Priority: P2 Important

## Status: pending

## Feature: DATE Booking Flow

## Category: Architecture

## Issue

The route directly sends HTTP responses instead of throwing domain errors for package type validation.

**File:** `server/src/routes/public-date-booking.routes.ts:74-81`

```typescript
// 2. Validate package is DATE type
if (pkg.bookingType !== 'DATE') {
  res.status(400).json({
    error: 'Invalid package type',
    details: `Package "${pkg.title}" uses ${pkg.bookingType} booking type...`,
  });
  return;
}
```

Compare to lines 70-72 and 83-94 which correctly throw domain errors.

## Impact

- Inconsistent with established error handling pattern
- Error middleware bypassed for this case
- Harder to test and maintain

## Recommended Fix

1. Create a new domain error:

```typescript
// In server/src/lib/errors/business.ts
export class InvalidBookingTypeError extends BusinessRuleError {
  constructor(packageTitle: string, actualType: string, expectedType: string) {
    super(
      `Package "${packageTitle}" uses ${actualType} booking type. Use the ${expectedType} booking endpoint.`,
      'INVALID_BOOKING_TYPE'
    );
  }
}
```

2. Throw in route:

```typescript
if (pkg.bookingType !== 'DATE') {
  throw new InvalidBookingTypeError(pkg.title, pkg.bookingType, 'DATE');
}
```

3. Handle in error middleware (if not already):

```typescript
if (error instanceof InvalidBookingTypeError) {
  return res.status(400).json({ error: error.message });
}
```

## Files to Update

1. `server/src/lib/errors/business.ts` - Add error class
2. `server/src/routes/public-date-booking.routes.ts` - Throw error
3. Error middleware if needed

## Review Reference

- Architecture Review Finding P2 (Inconsistent Error Handling Pattern)
