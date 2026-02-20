---
status: pending
priority: p1
issue_id: '11040'
tags: [code-review, google-calendar, booking, data-integrity]
dependencies: ['11031']
---

# getNextAvailableSlot Does Not Apply Google Calendar Filtering

## Problem Statement

`booking.service.ts:getNextAvailableSlot()` offers time slots without checking Google Calendar busy times. `getAvailableSlots()` (sibling method) correctly calls `calendarProvider.getBusyTimes()`. This inconsistency means the "book next available" AI agent action can offer a slot that conflicts with the tenant's existing calendar events.

## Findings

- **Flagged by:** agent-native-reviewer
- `server/src/services/booking.service.ts`: `getAvailableSlots()` filters by Google Calendar (correct); `getNextAvailableSlot()` does NOT
- Fix: apply same busy times filter logic from `getAvailableSlots()` to `getNextAvailableSlot()`

## Acceptance Criteria

- [ ] `getNextAvailableSlot()` queries Google Calendar busy times before offering a slot
- [ ] Handles calendar not configured (skip check, use existing logic)

## Work Log

- 2026-02-20: Flagged by agent-native-reviewer. Sibling method inconsistency.
