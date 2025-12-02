---
status: complete
priority: p1
issue_id: "043"
tags: [code-review, scheduling, data-integrity, double-booking, critical]
dependencies: []
---

# CRITICAL: Time Slot Conflict Detection Returns Empty Array

## Problem Statement

The `getTimeslotBookings()` method in `SchedulingAvailabilityService` is a stub that ALWAYS returns an empty array. This completely disables double-booking prevention for the scheduling platform.

**Why this matters:** Two users can book the exact same time slot simultaneously. The availability check provides zero protection against double-booking.

## Findings

### Code Evidence

**Location:** `server/src/services/scheduling-availability.service.ts:392-407`

```typescript
private async getTimeslotBookings(
  tenantId: string,
  date: Date
): Promise<TimeSlotBooking[]> {
  // For now, return empty array
  // This method should be implemented when the Booking repository is extended
  // to support TIMESLOT booking queries

  // TODO: Extend BookingRepository with:
  // findTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]>

  return [];  // ← ALWAYS EMPTY!
}
```

### Attack Scenario

```
1. User A requests slot: 2:00 PM - 2:30 PM on June 15
2. isSlotAvailable() returns true (no bookings detected - array is empty)
3. Checkout session created for User A

4. User B simultaneously requests same slot: 2:00 PM - 2:30 PM on June 15
5. isSlotAvailable() returns true (still empty - A's booking not confirmed yet)
6. Checkout session created for User B

7. Both users complete payment
8. DOUBLE BOOKING occurs - no database constraint catches this
```

### Cascade Impact

- `isSlotAvailable()` (line 430-456) always returns `true`
- `filterConflictingSlots()` (line 282-307) never filters anything
- `getAvailableSlots()` shows all slots as available regardless of existing bookings
- Customers see false availability, book conflicting slots

## Proposed Solutions

### Option A: Implement Repository Method (Recommended)
**Effort:** Medium | **Risk:** Low

1. Add method to `BookingRepository` interface in `ports.ts`:
```typescript
findTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]>;
```

2. Implement in `PrismaBookingRepository`:
```typescript
async findTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]> {
  const bookings = await this.prisma.booking.findMany({
    where: {
      tenantId,
      bookingType: 'TIMESLOT',
      date: date,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      serviceId: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });
  return bookings.map(b => ({
    id: b.id,
    serviceId: b.serviceId!,
    startTime: b.startTime!,
    endTime: b.endTime!,
    status: b.status,
  }));
}
```

3. Update `getTimeslotBookings()` to call repository method

**Pros:**
- Follows existing repository pattern
- Type-safe implementation
- Testable

**Cons:**
- Need to handle nullable fields from Prisma

### Option B: Direct Prisma Query in Service
**Effort:** Small | **Risk:** Medium

Query directly in the service method (bypasses repository pattern):

```typescript
private async getTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]> {
  const bookings = await this.prisma.booking.findMany({
    where: { tenantId, date, bookingType: 'TIMESLOT' },
  });
  return bookings;
}
```

**Pros:**
- Quick fix

**Cons:**
- Violates layered architecture
- Requires injecting PrismaClient into service

## Recommended Action

Implement **Option A** - add `findTimeslotBookings()` to BookingRepository interface and implementation.

## Technical Details

**Files to Update:**
- `server/src/lib/ports.ts` - Add interface method
- `server/src/adapters/prisma/booking.repository.ts` - Implement method
- `server/src/services/scheduling-availability.service.ts` - Call repository method

**Database Index Needed:**
```prisma
@@index([tenantId, date, bookingType])
```

## Acceptance Criteria

- [ ] `findTimeslotBookings()` method added to BookingRepository interface
- [ ] Method implemented in PrismaBookingRepository
- [ ] `getTimeslotBookings()` calls repository method instead of returning `[]`
- [ ] Unit tests verify conflict detection works
- [ ] Integration test: two concurrent booking attempts for same slot - one fails
- [ ] Database index added for query performance

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during scheduling platform code review - BLOCKS MERGE |

## Resources

- Data Integrity Guardian review
- Performance Oracle analysis (query optimization needed)
- Security Sentinel review confirmed double-booking risk
