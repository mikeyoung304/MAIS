---
status: complete
priority: p1
issue_id: '277'
tags: [code-review, feature-gap, calendar, google-calendar, acuity-parity]
dependencies: []
---

# Two-Way Calendar Sync Not Implemented (Acuity Parity)

## Problem Statement

MAIS only has ONE-WAY calendar sync (MAIS -> Google Calendar). Acuity has TWO-WAY sync that reads busy times FROM Google Calendar to block availability. This is a critical feature gap for service providers who manage their schedule in Google Calendar.

**Why it matters:**

- Providers with existing Google Calendar events will show as "available" in MAIS
- Double-bookings across MAIS and external calendar appointments
- Users EXPECT Acuity-like behavior from any scheduling tool
- This is the #1 feature request for scheduling tools

## Findings

### Agent: architecture-strategist

- **Location:** `server/src/services/google-calendar.service.ts` (193 LOC)
- **Evidence:** Only `createAppointmentEvent()` and `cancelAppointmentEvent()` methods exist
- **Missing:** No `getBusyTimes()` or `checkAvailability()` method
- **Severity:** HIGH - Critical Acuity feature gap

### Current vs Expected:

| Capability                            | Acuity | MAIS   |
| ------------------------------------- | ------ | ------ |
| Create events in Google               | Yes    | Yes    |
| Delete events in Google               | Yes    | Yes    |
| Read busy times from Google           | Yes    | **NO** |
| Block availability from Google events | Yes    | **NO** |
| Sync multiple calendars               | Yes    | **NO** |

## Proposed Solutions

### Option A: Google Calendar FreeBusy API Integration (Recommended)

**Description:** Use Google Calendar FreeBusy API to check availability before showing slots

```typescript
// google-calendar.service.ts
async getBusyTimes(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{ start: Date; end: Date }[]> {
  const calendar = await this.getCalendarClient(tenantId);
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      items: [{ id: this.getCalendarId(tenantId) }],
    },
  });

  return response.data.calendars[this.getCalendarId(tenantId)]?.busy || [];
}

// scheduling-availability.service.ts
async getAvailableSlots(...) {
  // Existing slot generation
  const slots = this.generateSlotsFromRules(...);

  // NEW: Filter slots that conflict with Google Calendar
  const busyTimes = await this.googleCalendarService.getBusyTimes(tenantId, date, date);
  const availableSlots = slots.filter(slot =>
    !busyTimes.some(busy =>
      slot.startTime < busy.end && slot.endTime > busy.start
    )
  );

  return availableSlots;
}
```

**Pros:**

- Single API call for entire day's busy times
- Efficient (FreeBusy is faster than listing events)
- Achieves Acuity parity for basic sync

**Cons:**

- Adds latency to availability checks (~200-500ms)
- Requires caching strategy for performance
- Google Calendar credentials required per tenant

**Effort:** Large (2-3 days)
**Risk:** Medium (API rate limits, latency)

### Option B: Background Sync with Cache

**Description:** Periodically sync Google Calendar events to local database

**Effort:** Very Large (1-2 weeks)
**Risk:** High (eventual consistency, cache invalidation)

### Option C: Webhook-Based Real-Time Sync

**Description:** Use Google Calendar push notifications for instant updates

**Effort:** Very Large (1-2 weeks)
**Risk:** High (complex infrastructure, webhook management)

## Recommended Action

Implement Option A first for MVP parity, then evaluate Options B/C based on performance needs.

## Technical Details

**Affected Files:**

- `server/src/services/google-calendar.service.ts`
- `server/src/services/scheduling-availability.service.ts`
- `server/src/lib/ports.ts` (add interface)

**Schema Changes:**
Consider caching busy times:

```prisma
model CalendarBusyTime {
  id        String   @id @default(cuid())
  tenantId  String
  start     DateTime
  end       DateTime
  source    String   // 'google', 'outlook'
  syncedAt  DateTime

  @@index([tenantId, start, end])
}
```

**Performance Consideration:**

- Cache busy times for 5 minutes
- Prefetch next 7 days on tenant dashboard load
- Lazy load on specific date selection

## Acceptance Criteria

- [x] `getBusyTimes()` method added to GoogleCalendarService
- [x] Availability slots filtered against Google Calendar busy times
- [x] Caching implemented for performance (5 minute TTL)
- [x] Graceful degradation if Google API unavailable
- [x] Unit tests for two-way sync functionality
- [ ] Tenant can enable/disable calendar blocking (deferred - not required for MVP)
- [ ] E2E test: Google event blocks MAIS availability (deferred - requires live Google Calendar)

## Work Log

| Date       | Action                              | Learnings                                                                                                                                                                                                              |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-05 | Created from Acuity comparison      | #1 feature gap for scheduling tools                                                                                                                                                                                    |
| 2025-12-06 | Implemented Option A (FreeBusy API) | Added `getBusyTimes()` to CalendarProvider interface, GoogleCalendarSyncAdapter, GoogleCalendarService. Integrated with SchedulingAvailabilityService with 5-minute caching. All tests pass with graceful degradation. |

## Resources

- [Google Calendar FreeBusy API](https://developers.google.com/calendar/api/v3/reference/freebusy/query)
- [Acuity Calendar Sync](https://help.acuityscheduling.com/hc/en-us/articles/360028867451)
- Related: `server/src/services/google-calendar.service.ts`
