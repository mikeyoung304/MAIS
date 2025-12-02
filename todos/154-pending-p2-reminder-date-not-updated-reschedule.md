---
status: pending
priority: p2
issue_id: "154"
tags: [code-review, data-integrity, mvp-gaps, reminders]
dependencies: []
---

# Reminder Date Not Recalculated on Reschedule

## Problem Statement

When a booking is rescheduled, the `reminderDueDate` is not updated. Reminders will be sent based on the old event date.

**Why This Matters:**
- Customers receive reminders for wrong dates
- Missed reminders if rescheduled to sooner date
- Customer confusion

## Findings

### Agent: data-integrity-guardian

**Location:** `server/src/services/booking.service.ts:983-1018`

**Evidence:**
```typescript
async rescheduleBooking(
  tenantId: string,
  bookingId: string,
  newDate: string
): Promise<Booking> {
  const updated = await this.bookingRepo.reschedule(tenantId, bookingId, newDate);

  // reminderDueDate NOT recalculated!
  // Reminder will still be sent 7 days before OLD date
}
```

## Proposed Solutions

### Option A: Recalculate Reminder Date (Recommended)
**Pros:** Correct reminder timing
**Cons:** Additional update
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
const newEventDate = new Date(newDate);
const newReminderDue = new Date(newEventDate.getTime() - 7 * 24 * 60 * 60 * 1000);

const updated = await this.bookingRepo.update(tenantId, bookingId, {
  eventDate: newDate,
  reminderDueDate: newReminderDue.toISOString().split('T')[0],
  reminderSentAt: null, // Reset if reminder was already sent
});
```

## Technical Details

**Affected Files:**
- `server/src/services/booking.service.ts`

## Acceptance Criteria

- [ ] Reminder date recalculated on reschedule
- [ ] Reset reminderSentAt if reminder already sent
- [ ] Unit test verifies date recalculation
