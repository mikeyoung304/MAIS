# P1: Unique Constraint Mismatch with bookingType

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The unique constraint includes `bookingType`:
```prisma
@@unique([tenantId, date, bookingType]) // schema.prisma:358
```

However, the double-booking check in `booking.repository.ts` does NOT include `bookingType`:

```typescript
// Line 188-190: Missing bookingType in conflict check
const existing = await tx.booking.findFirst({
  where: { tenantId, date: new Date(booking.eventDate) },
  // ❌ MISSING: bookingType: 'DATE' filter
});
```

## Critical Impact

**DOUBLE-BOOKING VULNERABILITY:**

1. Customer A books wedding package (DATE type) for June 15, 2025
2. Customer B books consultation (TIMESLOT type) for June 15, 2025 at 2pm
3. Both bookings succeed because check doesn't filter by `bookingType`

This violates the business rule: one DATE booking per tenant per date.

## Root Cause

The advisory lock (`hashTenantDate`) also uses only `tenantId:date`, not `bookingType`:

```typescript
function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  // ... hash implementation
}
```

## Recommended Fix

1. Fix the conflict check in `booking.repository.ts`:

```typescript
const existing = await tx.booking.findFirst({
  where: {
    tenantId,
    date: new Date(booking.eventDate),
    bookingType: booking.bookingType || 'DATE' // Add this filter
  },
});
```

2. Update advisory lock to include bookingType for DATE bookings:

```typescript
function hashTenantDateBookingType(
  tenantId: string,
  date: string,
  bookingType: string
): number {
  const str = `${tenantId}:${date}:${bookingType}`;
  // ... hash implementation
}
```

## Files to Update

1. `server/src/adapters/prisma/booking.repository.ts` - Add bookingType to findFirst
2. Consider if unique constraint should be `[tenantId, date]` only for DATE type

## Testing

- Test booking DATE and TIMESLOT on same date (should fail for DATE)
- Test concurrent DATE booking attempts on same date

## Review Reference
- Data Integrity Review Finding P1-002 (Unique constraint mismatch)
