---
status: complete
priority: p1
issue_id: '046'
tags: [code-review, scheduling, security, performance, critical]
dependencies: []
---

# CRITICAL: Admin Appointments Endpoint Uses Client-Side TIMESLOT Filter

## Problem Statement

The tenant admin appointments endpoint fetches ALL bookings for a tenant, then filters for `bookingType === 'TIMESLOT'` in JavaScript using `as any` type assertion. This bypasses type safety and could leak legacy DATE booking data if the filter fails.

**Why this matters:** The endpoint uses a "fail-open" pattern - if the `bookingType` property doesn't exist or has unexpected values, the filter silently passes through all data.

## Findings

### Code Evidence

**Location:** `server/src/routes/tenant-admin-scheduling.routes.ts:501`

```typescript
// Line 498-501
let bookings = await bookingService.getAllBookings(tenantId);

// Client-side filter with 'any' type assertion
bookings = bookings.filter((b: any) => b.bookingType === 'TIMESLOT');
```

### Issues

1. **Type Unsafe:** Using `as any` hides that `bookings` array might not have `bookingType` property
2. **Performance:** Loads ALL bookings into memory, then filters
3. **Fail-Open Pattern:** If `bookingType` is undefined/null, filter doesn't match, but also doesn't error
4. **Data Leak Risk:** If schema changes or field is renamed, filter stops working silently

### Performance Impact

With 10,000 legacy DATE bookings and 100 TIMESLOT appointments:

- Current: Load 10,100 records into memory, return 100
- Should be: Query only TIMESLOT bookings, return 100

### Security Risk Scenario

```
1. Schema migration removes bookingType field (developer mistake)
2. All bookings now have bookingType = undefined
3. filter((b: any) => b.bookingType === 'TIMESLOT') returns []
4. Admin sees no appointments (data loss) but no error thrown
5. OR: If comparison changes to b.bookingType !== 'DATE', all records shown (data leak)
```

## Proposed Solutions

### Option A: Move Filter to Database Query (Recommended)

**Effort:** Small | **Risk:** Low

Add method to BookingService that queries only TIMESLOT bookings:

```typescript
// booking.service.ts
async getTimeslotAppointments(
  tenantId: string,
  filters?: { status?: string; serviceId?: string; startDate?: Date; endDate?: Date }
): Promise<Booking[]> {
  return this.bookingRepo.findMany({
    where: {
      tenantId,
      bookingType: 'TIMESLOT',
      ...(filters?.status && { status: filters.status }),
      ...(filters?.serviceId && { serviceId: filters.serviceId }),
      ...(filters?.startDate && { startTime: { gte: filters.startDate } }),
      ...(filters?.endDate && { startTime: { lte: filters.endDate } }),
    },
    orderBy: { startTime: 'asc' },
  });
}

// tenant-admin-scheduling.routes.ts
const bookings = await bookingService.getTimeslotAppointments(tenantId, {
  status: filters?.status,
  serviceId: filters?.serviceId,
  startDate: filters?.startDate,
  endDate: filters?.endDate,
});
```

**Pros:**

- Database does filtering (efficient)
- Type-safe (no `as any`)
- Fail-closed pattern (DB error if column missing)

**Cons:**

- New method in service

### Option B: Add Type Guard

**Effort:** Small | **Risk:** Low

Add runtime type check before filter:

```typescript
const isTimeslotBooking = (b: unknown): b is Booking & { bookingType: 'TIMESLOT' } => {
  return typeof b === 'object' && b !== null && 'bookingType' in b && b.bookingType === 'TIMESLOT';
};

bookings = bookings.filter(isTimeslotBooking);
```

**Pros:**

- Type-safe filtering
- Explicit about expected structure

**Cons:**

- Still loads all data into memory

## Recommended Action

Implement **Option A** - move filtering to database query for both performance and safety.

## Technical Details

**Files to Update:**

1. `server/src/services/booking.service.ts` - Add `getTimeslotAppointments()` method
2. `server/src/routes/tenant-admin-scheduling.routes.ts:498-501` - Use new method

**Current Code (WRONG):**

```typescript
let bookings = await bookingService.getAllBookings(tenantId);
bookings = bookings.filter((b: any) => b.bookingType === 'TIMESLOT');
```

**Fixed Code:**

```typescript
const appointments = await bookingService.getTimeslotAppointments(tenantId, {
  status: req.query.status,
  serviceId: req.query.serviceId,
  startDate: startDate ? new Date(startDate) : undefined,
  endDate: endDate ? new Date(endDate) : undefined,
});
```

## Acceptance Criteria

- [ ] `getTimeslotAppointments()` method added to BookingService
- [ ] Method queries database with `bookingType: 'TIMESLOT'` filter
- [ ] Route updated to use new method
- [ ] `as any` assertion removed
- [ ] All filters applied at database level
- [ ] Performance test: 10,000 bookings loads in < 100ms

## Work Log

| Date       | Action  | Notes                                                |
| ---------- | ------- | ---------------------------------------------------- |
| 2025-11-27 | Created | Found during Security Sentinel review - BLOCKS MERGE |

## Resources

- Security Sentinel analysis (P1-1)
- Performance Oracle review (P1.2)
