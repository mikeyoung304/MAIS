---
title: Scheduling Platform P1 Critical Issues - Double-Booking Prevention & Type Safety
category: logic-errors
created: 2025-11-28
tags: [multi-tenant, scheduling, double-booking, type-safety, database-constraints, code-review]
severity: P1
status: resolved
component: scheduling-platform
symptoms:
  - getTimeslotBookings() returns empty array instead of actual bookings
  - Interface mismatch between scheduling-availability.service.ts and ports.ts requiring `as any` assertions
  - Missing database unique constraint on timeslot double-booking prevention
  - Admin appointments endpoint filters all bookings client-side with `as any` type bypass
  - No ts-rest API contract for POST /v1/public/appointments/checkout endpoint
  - React TimeSlotPicker uses array index for key prop instead of stable identifier
root_cause: Feature implementation bypassed architectural patterns (ports/adapters, type-safe contracts, database constraints) leading to silent failures in conflict detection and type safety violations
---

# Scheduling Platform P1 Critical Issues

## Problem Summary

During code review of the scheduling platform feature (commit `862a324`), 6 P1 critical issues were discovered that blocked merge. These issues would have caused:

1. **Double-booking of time slots** - No conflict detection working
2. **Type safety bypasses** - Multiple `as any` assertions hiding bugs
3. **No database-level protection** - Race conditions could cause duplicates
4. **Performance issues** - Client-side filtering of all bookings
5. **Broken API contracts** - Frontend using raw fetch
6. **UI state bugs** - Wrong time slots selected after list updates

## Investigation Steps

### Step 1: Code Review Discovery

The scheduling platform was implemented in a single large commit (71 files, 12,972 insertions). A comprehensive multi-agent code review was performed using 6 specialized reviewers:

- **Security Sentinel** - Found tenantId exposure, missing rate limiting
- **Architecture Strategist** - Found interface mismatches, missing contracts
- **Performance Oracle** - Found N+1 queries, client-side filtering
- **Data Integrity Guardian** - Found missing unique constraint
- **Code Quality Reviewer** - Found placeholder methods, console.error in prod
- **API Contract Reviewer** - Found missing public appointment endpoint

### Step 2: Root Cause Analysis

Each issue traced back to **bypassing established architectural patterns**:

| Issue                       | Pattern Bypassed                  | Consequence                  |
| --------------------------- | --------------------------------- | ---------------------------- |
| Empty getTimeslotBookings() | Complete implementations          | Silent failure               |
| Duplicate interfaces        | Single source of truth (ports.ts) | Type mismatches              |
| Missing DB constraint       | Database-level validation         | Race condition vulnerability |
| Client-side filtering       | Repository pattern                | Performance + type safety    |
| Missing API contract        | Contract-first development        | No type safety               |
| Array index as key          | React best practices              | UI bugs                      |

### Step 3: Fix Implementation

All 6 issues were fixed in a single commit (`ff5e7eb`) following the execution plan in `plans/fix-scheduling-platform-p1-critical-issues.md`.

---

## Solution

### Issue #043: `getTimeslotBookings()` returns empty array

**Problem**: The `SchedulingAvailabilityService.getTimeslotBookings()` method was returning an empty array instead of fetching actual timeslot bookings from the database, causing all time slots to appear available even when already booked.

**Location**: `server/src/services/scheduling-availability.service.ts:339-345`

**Root Cause**: The method was a placeholder stub that didn't implement the actual repository call.

**Solution**:

1. **Added `findTimeslotBookings()` to BookingRepository interface** (`ports.ts:58-72`):

```typescript
findTimeslotBookings(
  tenantId: string,
  date: Date,
  serviceId?: string
): Promise<TimeslotBooking[]>;
```

2. **Implemented repository method** (`booking.repository.ts:422-474`):

```typescript
async findTimeslotBookings(
  tenantId: string,
  date: Date,
  serviceId?: string
): Promise<TimeslotBooking[]> {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const bookings = await this.prisma.booking.findMany({
    where: {
      tenantId,
      bookingType: 'TIMESLOT',
      startTime: { gte: startOfDay, lte: endOfDay },
      ...(serviceId && { serviceId }),
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { id: true, tenantId: true, serviceId: true, startTime: true, endTime: true, status: true },
  });

  return bookings
    .filter((b) => b.serviceId !== null && b.startTime !== null && b.endTime !== null)
    .map((b) => ({ ...b, status: b.status as TimeslotBooking['status'] }));
}
```

3. **Wired into SchedulingAvailabilityService**:

```typescript
private async getTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]> {
  return this.bookingRepo.findTimeslotBookings(tenantId, date);
}
```

---

### Issue #044: Interface mismatch in SchedulingAvailabilityService

**Problem**: The service defined duplicate local interfaces instead of importing from `ports.ts`, causing type inconsistencies.

**Before**:

```typescript
// Duplicate local interfaces (WRONG)
interface ServiceRepository {
  getById(tenantId: string, id: string): Promise<Service | null>;
}
```

**After**:

```typescript
import type {
  BookingRepository,
  ServiceRepository,
  AvailabilityRuleRepository,
  TimeslotBooking,
} from '../lib/ports';

// Re-export for external consumers
export type { TimeslotBooking as TimeSlotBooking } from '../lib/ports';
```

---

### Issue #045: Missing unique constraint for TIMESLOT bookings

**Problem**: No database-level constraint prevented double-booking the same time slot.

**Solution**: Created migration with partial unique index:

```sql
-- Migration: 20251128000000_add_timeslot_unique_constraint

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_timeslot_unique"
ON "Booking"("tenantId", "serviceId", "startTime")
WHERE "startTime" IS NOT NULL AND "serviceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Booking_tenantId_serviceId_startTime_endTime_idx"
ON "Booking"("tenantId", "serviceId", "startTime", "endTime")
WHERE "bookingType" = 'TIMESLOT';
```

**Defense-in-Depth**:

1. **Database constraint** (this fix) - PostgreSQL enforces uniqueness
2. **Transaction locks** (already implemented) - Advisory locks prevent concurrent writes
3. **Application logic** (already implemented) - Explicit availability check

---

### Issue #046: Admin appointments using client-side filter

**Problem**: Fetched ALL bookings and filtered in JavaScript with `as any`.

**Before**:

```typescript
let bookings = await bookingService.getAllBookings(tenantId);
bookings = bookings.filter((b: any) => b.bookingType === 'TIMESLOT');
```

**After**:

```typescript
const appointments = await bookingRepo.findAppointments(tenantId, {
  status: typeof status === 'string' ? status : undefined,
  serviceId: typeof serviceId === 'string' ? serviceId : undefined,
  startDate: typeof startDate === 'string' ? startDate : undefined,
  endDate: typeof endDate === 'string' ? endDate : undefined,
});
```

Also added date range validation (max 90 days).

---

### Issue #047: Missing public appointment API contract

**Problem**: No API contract for `POST /v1/public/appointments/checkout`.

**Solution**: Added to `packages/contracts/src/api.v1.ts`:

```typescript
createAppointmentCheckout: {
  method: 'POST',
  path: '/v1/public/appointments/checkout',
  body: CreateAppointmentCheckoutDtoSchema,
  responses: {
    201: AppointmentCheckoutResponseDtoSchema,
    400: BadRequestErrorSchema,
    401: UnauthorizedErrorSchema,
    404: NotFoundErrorSchema,
    409: ConflictErrorSchema,
    500: InternalServerErrorSchema,
  },
  summary: 'Create checkout session for appointment booking (public, requires X-Tenant-Key)',
},
```

---

### Issue #048: React key uses array index

**Problem**: TimeSlotPicker used `key={index}` instead of stable identifier.

**Before**:

```typescript
{data.slots.map((slot: TimeSlotDto, index: number) => (
  <button key={index} ...>
))}
```

**After**:

```typescript
{data.slots.map((slot: TimeSlotDto) => (
  <button key={slot.startTime} ...>  {/* ISO datetime is unique */}
))}
```

---

## Prevention Strategies

### 1. Placeholder Methods

**Rule**: Never commit code with TODO placeholders in production paths.

```typescript
// ✅ CORRECT - Fails loudly
throw new Error('Not implemented: getTimeslotBookings');

// ❌ WRONG - Fails silently
return []; // TODO: implement
```

**ESLint Rule**:

```json
{ "no-warning-comments": ["error", { "terms": ["TODO", "FIXME"] }] }
```

### 2. Interface Duplication

**Rule**: Single source of truth in `lib/ports.ts`.

```typescript
// ✅ CORRECT
import { SchedulingRepository } from '../lib/ports';

// ❌ WRONG
interface SchedulingRepository { ... }  // Duplicate!
```

### 3. Database Constraints

**Rule**: Add unique constraints for all business-critical uniqueness rules.

```prisma
@@unique([tenantId, serviceId, startTime], name: "timeslot_unique")
```

### 4. Client-Side Filtering

**Rule**: Always filter on server (database level).

```typescript
// ✅ CORRECT - SQL WHERE clause
findMany({ where: { tenantId, active: true } });

// ❌ WRONG - JavaScript filter
data.filter((x) => x.active);
```

### 5. API Contracts

**Rule**: Define contract first, then implement route.

```typescript
// ✅ CORRECT - Contract-first
const router = tsRestExpress(contract.endpoint, handler);

// ❌ WRONG - Direct Express
app.get('/path', handler);
```

### 6. React Keys

**Rule**: Always use unique, stable IDs.

```typescript
// ✅ CORRECT
key={item.id}

// ❌ WRONG
key={index}
```

---

## Code Review Checklist

Before approving scheduling-related PRs:

- [ ] No TODO/FIXME comments in production code
- [ ] All interfaces imported from `ports.ts`
- [ ] Database constraints for uniqueness rules
- [ ] Server-side filtering (no client-side `filter()`)
- [ ] API contracts defined for all endpoints
- [ ] React keys use stable identifiers
- [ ] Multi-tenant: All queries filter by `tenantId`
- [ ] No `as any` type assertions

---

## Related Documentation

### Issue Tracking

- [#043 - Timeslot Conflict Detection Broken](../../../todos/043-pending-p1-timeslot-conflict-detection-broken.md)
- [#044 - Interface Mismatch](../../../todos/044-pending-p1-interface-mismatch-scheduling-service.md)
- [#045 - Missing Unique Constraint](../../../todos/045-pending-p1-missing-timeslot-unique-constraint.md)
- [#046 - Client-Side Filter](../../../todos/046-pending-p1-admin-appointments-clientside-filter.md)
- [#047 - Missing API Contract](../../../todos/047-pending-p1-missing-public-appointment-endpoint.md)
- [#048 - React Key Issue](../../../todos/048-pending-p1-react-key-timeslot-picker.md)

### Architecture

- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md)
- [Prevention Quick Reference](../PREVENTION-QUICK-REFERENCE.md)

### Plans

- [Fix Scheduling Platform P1 Issues](../../../plans/fix-scheduling-platform-p1-critical-issues.md)

---

## Commits

| Commit    | Description                                           |
| --------- | ----------------------------------------------------- |
| `862a324` | feat(scheduling): add Acuity-like scheduling platform |
| `ff5e7eb` | fix(scheduling): resolve 6 P1 critical issues         |

---

## Verification

All fixes verified:

- TypeScript compiles without errors
- 512/512 unit tests pass
- Integration tests require DB migration (pending on prod DB)

---

**Last Updated**: 2025-11-28
**Author**: Claude Code
**Status**: Resolved
