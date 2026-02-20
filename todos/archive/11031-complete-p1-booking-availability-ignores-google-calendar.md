---
status: pending
priority: p1
issue_id: '11031'
tags: [code-review, google-calendar, booking, agent-tools, data-integrity]
---

# DATE Booking Availability Never Checks Google Calendar

## Problem Statement

The booking availability route for DATE-type bookings (wedding photography, multi-day events) has an explicit TODO and returns `available: true` for ALL dates, never consulting Google Calendar. This means tenants can receive double-bookings on dates they have existing events. Additionally, `getNextAvailableSlot()` does not apply Google Calendar filtering while `getAvailableSlots()` does — inconsistency that causes the "book next available" agent action to offer busy dates.

## Findings

- **Flagged by:** agent-native-reviewer, performance-oracle
- `server/src/routes/internal-agent-booking.routes.ts` lines 252-264: explicit `// TODO` comment, returns `available: true`
- `server/src/services/booking.service.ts`: `getAvailableSlots()` calls `calendarProvider.getBusyTimes()` correctly; `getNextAvailableSlot()` does NOT
- `server/src/adapters/gcal.adapter.ts`: `isDateAvailable()` method exists and works correctly when called

## Proposed Solutions

### Option A: Wire Up the TODO (30 min)

Replace the TODO in the availability route with a call to `calendarProvider.isDateAvailable(date, tenantId)`. This is a 30-minute fix.

- **Effort:** Small
- **Risk:** Low

### Option B: Fix Both + Add Agent Tool

Fix the DATE availability route AND fix `getNextAvailableSlot()` AND add a calendar availability check tool to the agent.

- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option B — fix all three inconsistencies in one PR.

## Technical Details

- `server/src/routes/internal-agent-booking.routes.ts:252-264` — wire the TODO
- `server/src/services/booking.service.ts` — add Google Calendar check to `getNextAvailableSlot()`
- Note: P1-12 (missing tenantId) must be fixed simultaneously

## Acceptance Criteria

- [ ] DATE booking availability check queries Google Calendar busy times
- [ ] `getNextAvailableSlot()` filters out Google Calendar-blocked dates
- [ ] Returns `available: false` for dates with Google Calendar events
- [ ] Gracefully handles case where calendar is not configured (skip check)

## Work Log

- 2026-02-20: Identified by agent-native-reviewer and performance-oracle in code review.
