---
status: complete
priority: p2
issue_id: "052"
tags: [code-review, scheduling, performance, memory]
dependencies: []
---

# getAppointments() Loads All Bookings Into Memory

## Problem Statement

The `BookingService.getAppointments()` method fetches ALL bookings for a tenant, then filters in JavaScript. With 10,000+ bookings, this causes memory exhaustion and timeouts.

**Why this matters:** Enterprise tenants with high booking volume will experience crashes and poor performance.

## Findings

### Code Evidence

**Location:** `server/src/services/booking.service.ts:666-704`

```typescript
async getAppointments(tenantId: string, filters?: GetAppointmentsFilters): Promise<any[]> {
  // Loads EVERY booking for the tenant into memory
  const allBookings = await this.bookingRepo.findAll(tenantId);

  // Filters in JavaScript (inefficient)
  let appointments = allBookings.filter((booking: any) => booking.bookingType === 'TIMESLOT');

  if (filters?.status) {
    appointments = appointments.filter(...);
  }
  // ... more filters

  appointments.sort((a, b) => {...});  // O(n log n) sort in JS
  return appointments;
}
```

### Scaling Impact

| Bookings | Memory | Filter Time | Risk |
|----------|--------|-------------|------|
| 100 | ~1MB | <1ms | ✓ |
| 1,000 | ~10MB | 5ms | ✓ |
| 10,000 | ~100MB | 50ms | ⚠️ |
| 100,000 | ~1GB | 500ms+ | ❌ crash |

## Proposed Solutions

### Option A: Filter at Database Level (Recommended)
**Effort:** Medium | **Risk:** Low

```typescript
async getAppointments(
  tenantId: string,
  filters?: GetAppointmentsFilters
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
    take: 100,  // Pagination
  });
}
```

### Option B: Add Pagination
**Effort:** Medium | **Risk:** Low

```typescript
interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
```

## Recommended Action

Implement **Option A** with pagination support.

## Technical Details

**Files to Update:**
- `server/src/services/booking.service.ts:666-704`
- `server/src/lib/ports.ts` - Add findMany with filters to interface
- `server/src/adapters/prisma/booking.repository.ts` - Implement filtered query

## Acceptance Criteria

- [ ] Filters applied at database level
- [ ] Pagination supported (default limit: 50)
- [ ] Query time < 100ms with 10,000 bookings
- [ ] Memory usage stable regardless of booking count

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Performance Oracle review |
