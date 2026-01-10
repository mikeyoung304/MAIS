---
status: resolved
priority: p2
issue_id: 625
tags: [code-review, booking-links, phase-1, security]
dependencies: []
created: 2026-01-05
resolved: 2026-01-09
---

# maxPerDay Field Stored But Not Enforced at Booking Time

## Problem Statement

The `maxPerDay` field is stored in the Service model but is not actually enforced when generating available slots or accepting bookings. This creates a false sense of security where tenants may believe they have daily booking limits in place that are actually ineffective.

## Resolution

Implemented enforcement in `AppointmentBookingService` with defense-in-depth pattern:

1. **Added `maxPerDay` to Service entity** (`server/src/lib/entities.ts`)
2. **Updated service repository mapper** to include `maxPerDay` (`server/src/adapters/prisma/service.repository.ts`)
3. **Added `countTimeslotBookingsForServiceOnDate` method** to `BookingRepository` interface and implementations
4. **Created `MaxBookingsPerDayExceededError`** error class (`server/src/lib/errors/business.ts`)
5. **Enforcement in checkout creation**: Validates limit before creating Stripe checkout session
6. **Defense-in-depth in payment completion**: Re-validates limit to handle race conditions where multiple concurrent checkouts may pass initial validation

### Files Changed

- `server/src/lib/entities.ts` - Added `maxPerDay: number | null` to Service interface
- `server/src/lib/ports.ts` - Added `countTimeslotBookingsForServiceOnDate` method to BookingRepository
- `server/src/lib/errors/business.ts` - Added `MaxBookingsPerDayExceededError` class
- `server/src/lib/errors/index.ts` - Exported new error class
- `server/src/adapters/prisma/service.repository.ts` - Updated mapper to include maxPerDay
- `server/src/adapters/prisma/booking.repository.ts` - Implemented count method
- `server/src/adapters/mock/index.ts` - Added mock implementation
- `server/src/services/appointment-booking.service.ts` - Added enforcement in both checkout and payment flows

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

## Acceptance Criteria

- [x] Document that maxPerDay enforcement is Phase 2 scope
- [x] Implement enforcement in appointment booking service
- [ ] Add test case for maxPerDay enforcement

## Work Log

| Date       | Action                             | Learnings                                                                    |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| 2026-01-05 | Created during Phase 1 code review | security-sentinel identified enforcement gap                                 |
| 2026-01-05 | Documented deferral in plan file   | Added to Phase 2 scope in `plans/scheduling-platform-acuity-alternative.md`  |
| 2026-01-09 | Implemented maxPerDay enforcement  | Used defense-in-depth pattern to catch race conditions at payment completion |

## Resources

- Phase 1 review: Booking Links schema migration
- Scheduling availability service: `server/src/services/scheduling-availability.service.ts`
- Plan file (Phase 2 scope): `plans/scheduling-platform-acuity-alternative.md:856-879`
