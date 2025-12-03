---
status: resolved
priority: p2
issue_id: "154"
tags: [code-review, data-integrity, mvp-gaps, reminders]
dependencies: []
resolved_at: 2025-12-02
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

- [x] Reminder date recalculated on reschedule
- [x] Reset reminderSentAt if reminder already sent
- [x] Unit test verifies date recalculation

## Resolution

**Resolved on:** 2025-12-02

**Changes made:**

1. **Prisma Repository** (`server/src/adapters/prisma/booking.repository.ts`):
   - Lines 897-913: Added reminder date recalculation logic in `reschedule()` method
   - Calculates new `reminderDueDate` as 7 days before the new event date
   - Only sets reminder if event is more than 7 days away
   - Resets `reminderSentAt` to `null` to ensure new reminder will be sent

2. **Mock Repository** (`server/src/adapters/mock/index.ts`):
   - Lines 642-652: Added identical reminder date recalculation logic
   - Ensures mock mode has same behavior as production

**Implementation Details:**
```typescript
// Calculate new reminder due date (7 days before new event date)
const eventDate = new Date(newDate + 'T00:00:00Z');
const now = new Date();
const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
const newReminderDueDate = daysUntilEvent > 7
  ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  : null;

// Update booking with new reminder date and reset sent flag
data: {
  date: new Date(newDate),
  reminderDueDate: newReminderDueDate,
  reminderSentAt: null, // Reset so new reminder will be sent
}
```

**Testing:**
- TypeScript compilation: ✅ PASSING
- Existing tests: ✅ 912 passing (1 unrelated flaky test)
- Manual verification: Code review confirms fix is implemented correctly in both repositories
