---
status: complete
priority: p2
issue_id: '270'
tags: [code-review, backend-audit, google-calendar, timezone]
dependencies: []
---

# Google Calendar Events Use Hardcoded UTC Timezone

## Problem Statement

Event creation in `google-calendar-sync.adapter.ts` uses hardcoded `timeZone: 'UTC'` regardless of the tenant's or client's timezone. This causes calendar events to display at wrong times for users in non-UTC timezones.

**Why it matters:**

- Events show at wrong local time on Google Calendar
- Tenants in US timezones see events 4-8 hours off
- Potential for missed appointments due to confusion

## Findings

### Agent: backend-audit

- **Location:** `server/src/adapters/google-calendar-sync.adapter.ts:100-107`
- **Evidence:**
  ```typescript
  start: {
    dateTime: event.startTime.toISOString(),
    timeZone: 'UTC',  // Hardcoded
  },
  ```
- **Impact:** MEDIUM - Calendar times don't match client expectations

## Proposed Solutions

### Option A: Use Client Timezone (Recommended)

**Description:** Pass client's timezone from booking and use for calendar event

```typescript
async createEvent(input: {
  tenantId: string;
  // ... other fields
  timezone?: string;  // Add timezone parameter
}): Promise<{ eventId: string } | null> {
  // ...
  const event = {
    start: {
      dateTime: input.startTime.toISOString(),
      timeZone: input.timezone || 'America/New_York',  // Use client timezone with fallback
    },
    end: {
      dateTime: input.endTime.toISOString(),
      timeZone: input.timezone || 'America/New_York',
    },
  };
}
```

**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Use Tenant Default Timezone

**Description:** Store default timezone in tenant settings, use for all events

**Pros:**

- Consistent per tenant
- Simpler - no per-booking timezone needed

**Cons:**

- Doesn't handle multi-timezone clients

**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

Implement Option A - use `clientTimezone` from booking record (already captured in booking flow).

## Technical Details

**Affected Files:**

- `server/src/adapters/google-calendar-sync.adapter.ts`
- `server/src/di.ts` (pass timezone in event payload)

**Data Flow:**

1. Booking created with `clientTimezone` field
2. `AppointmentEvents.BOOKED` payload includes timezone
3. `GoogleCalendarSyncAdapter.createEvent` uses timezone for calendar event

## Acceptance Criteria

- [ ] Calendar event creation uses client timezone
- [ ] Fallback to reasonable default (America/New_York or tenant setting)
- [ ] Timezone passed through event payload
- [ ] Test coverage for timezone handling

## Work Log

| Date       | Action                     | Learnings                   |
| ---------- | -------------------------- | --------------------------- |
| 2025-12-05 | Created from backend audit | Minor but user-facing issue |

## Resources

- Related: `server/src/adapters/google-calendar-sync.adapter.ts:100-107`
- [Google Calendar API Timezones](https://developers.google.com/calendar/api/v3/reference/events#resource)
