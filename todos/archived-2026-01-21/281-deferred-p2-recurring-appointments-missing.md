---
status: complete
priority: p2
issue_id: '281'
tags: [deferred, code-review, feature-gap, recurring, appointments, acuity-parity]
dependencies: []
next_review: '2026-01-23'
revisit_trigger: '3 customer requests'
---

# Recurring Appointments Not Implemented (Acuity Parity)

## Problem Statement

Acuity supports recurring appointments (weekly, bi-weekly, monthly). MAIS only supports single appointments. This is a significant feature gap for service providers with regular clients.

**Why it matters:**

- Therapists, coaches, tutors need weekly recurring sessions
- Hair stylists need monthly recurring appointments
- Personal trainers need bi-weekly sessions
- Users expect this from any scheduling tool

## Findings

### Agent: architecture-strategist

- **Location:** `server/src/services/booking.service.ts`, `server/prisma/schema.prisma`
- **Evidence:** No recurrence fields in Booking model, no recurring booking logic
- **Missing:**
  - `recurrenceRule` field (RRULE format)
  - `recurringGroupId` to link recurring instances
  - Logic to generate recurring instances
  - UI for selecting recurrence pattern

### Acuity Recurring Features:

- Weekly (every Monday at 10am)
- Bi-weekly (every other Tuesday)
- Monthly (first Wednesday of month)
- Custom interval (every 3 weeks)
- End date or number of occurrences

## Proposed Solutions

### Option A: RRULE-Based Recurrence (Recommended)

**Description:** Use iCal RRULE format for flexible recurrence patterns

**Schema:**

```prisma
model Booking {
  // Existing fields...

  // Recurring appointment fields
  isRecurring       Boolean   @default(false)
  recurrenceRule    String?   // RRULE format: "FREQ=WEEKLY;BYDAY=MO;COUNT=10"
  recurringGroupId  String?   // Links all instances in series
  recurringIndex    Int?      // Instance number (1, 2, 3...)
  recurringParentId String?   // Original booking that spawned this

  @@index([recurringGroupId])
}
```

**Service Logic:**

```typescript
import { RRule } from 'rrule';

async createRecurringAppointment(input: CreateRecurringAppointmentInput): Promise<Booking[]> {
  const { serviceId, startTime, recurrenceRule, tenantId } = input;

  // Parse RRULE
  const rule = RRule.fromString(recurrenceRule);
  const dates = rule.all(); // Get all occurrence dates

  // Validate all dates are available
  for (const date of dates) {
    const available = await this.isSlotAvailable(tenantId, serviceId, date);
    if (!available) {
      throw new RecurringConflictError(date);
    }
  }

  // Create all bookings in transaction
  const groupId = cuid();
  const bookings = await this.prisma.$transaction(
    dates.map((date, index) =>
      this.prisma.booking.create({
        data: {
          tenantId,
          serviceId,
          startTime: date,
          endTime: new Date(date.getTime() + service.durationMinutes * 60000),
          isRecurring: true,
          recurrenceRule,
          recurringGroupId: groupId,
          recurringIndex: index + 1,
          // ...other fields
        },
      })
    )
  );

  return bookings;
}
```

**API Endpoints:**

```typescript
// Create recurring series
POST /v1/bookings/appointment/recurring/checkout
{
  serviceId: "...",
  startTime: "2025-12-10T10:00:00Z",
  recurrenceRule: "FREQ=WEEKLY;COUNT=10",
  clientName: "...",
  clientEmail: "..."
}

// Cancel single instance
DELETE /v1/public/bookings/:id?token=X&mode=single

// Cancel entire series
DELETE /v1/public/bookings/:id?token=X&mode=series

// Reschedule single instance
PATCH /v1/public/bookings/:id?token=X&mode=single
{ newStartTime: "..." }

// Reschedule this and future
PATCH /v1/public/bookings/:id?token=X&mode=thisAndFuture
{ newStartTime: "..." }
```

**Pros:**

- Industry-standard RRULE format
- Flexible recurrence patterns
- Compatible with calendar exports

**Cons:**

- Complex cancellation/reschedule logic
- Payment complexity (pay upfront vs per session?)
- Large schema change

**Effort:** Very Large (1-2 weeks)
**Risk:** Medium

### Option B: Simple Weekly Recurrence Only

**Description:** MVP with just weekly recurring appointments

**Effort:** Large (3-5 days)
**Risk:** Low (but limited functionality)

## Recommended Action

Defer to Phase 2. Focus on core booking flow first, then add recurring as enhancement.

## Technical Details

**Affected Files:**

- `server/prisma/schema.prisma`
- `server/src/services/booking.service.ts`
- NEW: `server/src/services/recurring-booking.service.ts`
- `packages/contracts/src/dto.ts`
- NEW: UI components for recurrence picker

**Dependencies:**

- `rrule` npm package for RRULE parsing

**Payment Considerations:**

- Prepaid packages: Charge upfront for all sessions
- Pay-as-you-go: Charge per session
- Subscription: Monthly billing regardless of sessions

## Acceptance Criteria

- [ ] Booking model extended with recurrence fields
- [ ] RRULE parsing implemented
- [ ] Availability validation for all occurrences
- [ ] Bulk booking creation in transaction
- [ ] Cancel single vs series options
- [ ] Reschedule single vs thisAndFuture options
- [ ] UI recurrence picker component

## Work Log

| Date       | Action                         | Learnings        |
| ---------- | ------------------------------ | ---------------- |
| 2025-12-05 | Created from Acuity comparison | Defer to Phase 2 |

## Resources

- [iCal RRULE Specification](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html)
- [rrule npm package](https://www.npmjs.com/package/rrule)
- [Acuity Recurring Appointments](https://help.acuityscheduling.com/hc/en-us/articles/16676922487949)
