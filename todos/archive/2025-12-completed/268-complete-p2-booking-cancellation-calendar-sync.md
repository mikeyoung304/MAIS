---
status: complete
priority: p2
issue_id: '268'
tags: [code-review, backend-audit, google-calendar, events, sync]
dependencies: []
---

# Booking Cancellations Not Synced to Google Calendar

## Problem Statement

When a booking is cancelled, the corresponding Google Calendar event is not deleted. Events remain on the calendar even after cancellation, causing confusion for tenants who rely on Google Calendar for scheduling.

**Why it matters:**

- Calendar shows cancelled bookings as still scheduled
- Tenants may double-book dates thinking they're busy
- Manual calendar cleanup required
- Inconsistent state between MAIS and Google Calendar

## Findings

### Agent: backend-audit

- **Location:** `server/src/di.ts` (event subscriptions), `server/src/services/google-calendar.service.ts`
- **Evidence:** `BookingEvents.CANCELLED` not subscribed in `di.ts`; no `deleteAppointmentEvent` call on cancellation
- **Impact:** MEDIUM - Calendar becomes out of sync with actual bookings

## Proposed Solutions

### Option A: Add Cancellation Event Subscription (Recommended)

**Description:** Subscribe to `BookingEvents.CANCELLED` and delete calendar event

```typescript
// In di.ts, add subscription:
eventEmitter.subscribe(BookingEvents.CANCELLED, async (payload) => {
  try {
    if (payload.googleEventId) {
      await googleCalendarService.deleteAppointmentEvent(payload.tenantId, payload.googleEventId);
      logger.info(
        { bookingId: payload.bookingId, googleEventId: payload.googleEventId },
        'Deleted calendar event for cancelled booking'
      );
    }
  } catch (err) {
    // Log but don't fail - calendar sync is non-critical
    logger.error(
      { err, bookingId: payload.bookingId },
      'Failed to delete Google Calendar event for cancelled booking'
    );
  }
});
```

**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Batch Calendar Sync Job

**Description:** Periodic job to reconcile calendar events with booking status

**Pros:**

- Catches any missed deletions
- Handles edge cases

**Cons:**

- Not real-time
- More complex implementation

**Effort:** Medium (4-6 hours)
**Risk:** Low

## Recommended Action

Implement Option A - event-driven deletion is simpler and consistent with existing patterns.

## Technical Details

**Affected Files:**

- `server/src/di.ts` - Add `BookingEvents.CANCELLED` subscription
- `server/src/lib/core/events.ts` - Verify `CANCELLED` event payload includes `googleEventId`

**Prerequisites:**

- Ensure `googleEventId` is stored in booking record (already implemented in `BookingRepository.updateGoogleEventId`)
- Ensure cancellation event payload includes `googleEventId`

## Acceptance Criteria

- [ ] `BookingEvents.CANCELLED` subscription added in `di.ts`
- [ ] Google Calendar event deleted when booking is cancelled
- [ ] Graceful error handling (don't fail cancellation if calendar delete fails)
- [ ] Structured logging for success/failure
- [ ] Test coverage for cancellation sync

## Work Log

| Date       | Action                     | Learnings                                 |
| ---------- | -------------------------- | ----------------------------------------- |
| 2025-12-05 | Created from backend audit | Completes one-way calendar sync lifecycle |

## Resources

- Related: `server/src/di.ts:537-565` (BOOKED event subscription pattern)
- Related: `server/src/services/google-calendar.service.ts`
