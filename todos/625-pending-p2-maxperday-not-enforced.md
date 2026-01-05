---
status: pending
priority: p2
issue_id: 625
tags: [code-review, booking-links, phase-1, security]
dependencies: []
created: 2026-01-05
---

# maxPerDay Field Stored But Not Enforced at Booking Time

## Problem Statement

The `maxPerDay` field is stored in the Service model but is not actually enforced when generating available slots or accepting bookings. This creates a false sense of security where tenants may believe they have daily booking limits in place that are actually ineffective.

## Findings

**Source:** security-sentinel

**Evidence:**
- Schema defines `maxPerDay: Int?` at `server/prisma/schema.prisma:513`
- Field is saved in executor at `server/src/agent/executors/booking-link-executors.ts:289`
- Field is returned by tools at `server/src/agent/tools/booking-link-tools.ts:406`
- `SchedulingAvailabilityService` does NOT check maxPerDay when generating or filtering slots

**Risk:**
- Tenants with `maxPerDay: 5` could end up with 10+ bookings on a single day
- Creates discrepancy between expected and actual behavior
- Could lead to overbooking and tenant trust issues

## Proposed Solutions

### Option 1: Add enforcement in SchedulingAvailabilityService

**Pros:** Centralized enforcement, clean separation of concerns
**Cons:** Requires modifying existing service, adds query overhead
**Effort:** Medium
**Risk:** Low

```typescript
// In getAvailableSlots()
if (service.maxPerDay !== null) {
  const existingBookingsCount = await prisma.booking.count({
    where: {
      tenantId,
      serviceId: service.id,
      date: targetDate,
      status: { in: ['PENDING', 'CONFIRMED'] }
    }
  });
  if (existingBookingsCount >= service.maxPerDay) {
    // Mark all slots as unavailable or return empty array
  }
}
```

### Option 2: Defer to Phase 2 with documentation

**Pros:** Keeps Phase 1 scope focused, schema ready for future
**Cons:** Field appears functional but isn't
**Effort:** Small
**Risk:** Medium (user confusion)

Add clear documentation that `maxPerDay` is "planned for Phase 2" and remove from tool descriptions.

### Option 3: Remove field until enforcement is implemented

**Pros:** YAGNI - honest API
**Cons:** Would need another migration later
**Effort:** Medium
**Risk:** Low

## Recommended Action

**DEFER TO PHASE 2** - Document that enforcement is not yet implemented. The field schema is correct; enforcement should be added when availability calculation logic is expanded.

## Technical Details

**Affected Files:**
- `server/src/services/scheduling-availability.service.ts` (needs enforcement)
- Tool descriptions should clarify field is "stored but not yet enforced"

## Acceptance Criteria

- [x] Document that maxPerDay enforcement is Phase 2 scope
- [ ] Implement enforcement in availability service (Phase 2)
- [ ] Add test case for maxPerDay enforcement (Phase 2)

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during Phase 1 code review | security-sentinel identified enforcement gap |
| 2026-01-05 | Documented deferral in plan file | Added to Phase 2 scope in `plans/scheduling-platform-acuity-alternative.md` |

## Resources

- Phase 1 review: Booking Links schema migration
- Scheduling availability service: `server/src/services/scheduling-availability.service.ts`
- Plan file (Phase 2 scope): `plans/scheduling-platform-acuity-alternative.md:856-879`
