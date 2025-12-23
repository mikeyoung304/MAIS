# P1: Missing bookingType Field in Booking Creation

## Priority: P1 Critical
## Status: ready
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The `create()` method in `PrismaBookingRepository` does not explicitly set the `bookingType` field when creating bookings. It relies on the database default.

**File:** `server/src/adapters/prisma/booking.repository.ts:232-264`

```typescript
const created = await tx.booking.create({
  data: {
    id: booking.id,
    tenantId,
    customerId: customer.id,
    packageId: booking.packageId,
    date: new Date(booking.eventDate),
    totalPrice: booking.totalCents,
    status: this.mapToPrismaStatus(booking.status),
    // ... other fields ...
    // ❌ MISSING: bookingType field
  }
});
```

## Impact

- DATE bookings rely on database default (`DATE`) instead of explicit values
- If the domain entity `Booking` contains `bookingType` but it's not persisted, there's a mismatch between in-memory and database state
- TIMESLOT bookings ARE explicitly set (lines 841, 706), creating inconsistent patterns
- Could lead to data integrity issues if schema default is changed

## Recommended Fix

```typescript
const created = await tx.booking.create({
  data: {
    // ... existing fields ...
    bookingType: booking.bookingType || 'DATE', // Explicit value
  }
});
```

## Also Check

1. Verify `Booking` domain entity has `bookingType` field
2. Ensure mapper functions handle `bookingType`
3. Update all booking creation paths for consistency

## Testing

- Create DATE booking, verify `bookingType` is stored as 'DATE'
- Create TIMESLOT booking, verify `bookingType` is stored as 'TIMESLOT'
- Query bookings and verify type is correct



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Data Integrity Review Finding P1-001 (Missing bookingType field in creation)
