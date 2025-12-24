---
status: wontfix
priority: p3
issue_id: '287'
tags: [code-review, refactoring, architecture, code-quality]
dependencies: []
resolved_at: '2025-12-23'
resolution: duplicate
duplicate_of: '155'
---

# BookingService Too Large (1,171 LOC) - SRP Violation

## Resolution

**Status: WONTFIX** - Closed 2025-12-23

This TODO has been closed as WONTFIX because it is a **duplicate of TODO-155**.

TODO-155 already tracks the BookingService refactoring work with the same scope and proposed solutions. Consolidating to a single TODO to avoid duplicate tracking and potential conflicting work.

## Problem Statement

The BookingService is 1,171 lines of code handling 7+ responsibilities. This violates Single Responsibility Principle and makes the code hard to maintain and test.

**Why it matters:**

- Hard to understand full service behavior
- Changes in one area risk breaking others
- Testing requires mocking many dependencies
- New developers struggle to onboard
- Mixed concerns: payments, calendar sync, refunds, reminders

## Findings

### Agent: code-simplicity-reviewer

- **Location:** `server/src/services/booking.service.ts` (1,171 LOC)
- **Responsibilities Found:**
  1. Wedding package bookings (DATE type)
  2. Appointment scheduling (TIMESLOT type)
  3. Balance payments
  4. Cancellations & refunds
  5. Reminders
  6. Commission calculations
  7. Idempotency management

## Proposed Solutions

### Option A: Extract Domain-Specific Services (Recommended)

**Description:** Split into focused services by domain

```
booking.service.ts (300 LOC)
  - Core booking CRUD
  - Simple checkout creation

payment.service.ts (200 LOC)
  - Balance payments
  - Refunds
  - Commission splits

appointment.service.ts (200 LOC) OR DELETE IF TIMESLOT UNUSED
  - TIMESLOT bookings
  - Availability checks

reminder.service.ts (100 LOC)
  - Reminder scheduling
  - Reminder notifications
```

**Effort:** Medium (1-2 days)
**Risk:** Low

### Option B: Delete Unused TIMESLOT Code

**Description:** If TIMESLOT bookings not in production, remove ~600 LOC

**Effort:** Small (4 hours)
**Risk:** Low

## Recommended Action

Check production database: `SELECT COUNT(*) FROM bookings WHERE bookingType = 'TIMESLOT'`

- If zero: Implement Option B (delete unused code)
- If non-zero: Implement Option A (extract services)

## Acceptance Criteria

- [ ] Each service under 300 LOC
- [ ] Single responsibility per service
- [ ] All existing tests pass
- [ ] No new dependencies introduced

## Work Log

| Date       | Action                             | Learnings                |
| ---------- | ---------------------------------- | ------------------------ |
| 2025-12-05 | Created from simplification review | Technical debt reduction |

## Resources

- Related: `server/src/services/booking.service.ts`
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)
