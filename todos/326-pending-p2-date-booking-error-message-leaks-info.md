# P2: Error Messages Leak Implementation Details

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Security / Data Integrity

## Issue

Error messages reveal internal implementation details to end users.

**File:** `server/src/routes/public-date-booking.routes.ts:76-80`

```typescript
res.status(400).json({
  error: 'Invalid package type',
  details: `Package "${pkg.title}" uses ${pkg.bookingType} booking type. Use the appropriate booking endpoint.`,
});
```

## Problems

1. Exposes `bookingType` enum values to end users
2. Tells users to "use the appropriate booking endpoint" - but they don't know what that is
3. `pkg.title` could be undefined (should check existence)
4. Inconsistent with other error messages in the codebase

## Impact

- Information leakage about system architecture
- Poor UX - users can't act on "use appropriate endpoint"
- Potential for enumeration attacks

## Recommended Fix

```typescript
res.status(400).json({
  error: 'This package cannot be booked online',
  message: 'Please contact us directly to book this package.',
});
```

Or with more context but less implementation detail:

```typescript
res.status(400).json({
  error: 'Booking method not supported',
  message: 'This package requires appointment scheduling. Please use our appointment booking page.',
  redirectUrl: '/book' // Point to TIMESLOT booking
});
```

## Related

- #304 (Date Validation) - Also reviews error messages
- #316 (Error Handling Pattern) - Error handling consistency

## Review Reference
- Security Review Finding P2-001 (Package Type Check Info Leakage)
- Data Integrity Review Finding P2-002 (Inconsistent error messages)
