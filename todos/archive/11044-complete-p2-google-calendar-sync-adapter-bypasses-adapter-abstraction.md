---
issue_id: 11044
status: pending
priority: p2
tags: [architecture, google-calendar, abstraction]
effort: Small
---

# P2: Google Calendar Sync Adapter Bypasses Adapter Abstraction

## Problem Statement

The `/test` route in the calendar routes calls the Google Calendar adapter directly, bypassing the `CalendarProvider` port abstraction. This violates the layered architecture (routes → service → port → adapter) and makes the route untestable with mock adapters. It also means any future calendar provider swap would not cover the `/test` route.

## Findings

- The `/test` route reaches into the adapter layer directly instead of going through the service layer.
- The `CalendarProvider` port abstraction exists specifically to decouple routes from concrete adapters.
- This is the same anti-pattern documented in the layered architecture reference (`server/src/di.ts`, `server/src/lib/ports.ts`).
- Correct call chain: route handler → calendar service → `CalendarProvider` port → `gcal.adapter.ts`

## Proposed Solutions

Refactor the `/test` route handler to call the calendar service method (or a dedicated `testConnection()` method on the service), which in turn calls through the `CalendarProvider` port. The adapter should never be imported or called directly from a route file.

If no suitable service method exists, add one (e.g., `calendarService.testConnection(tenantId)`).

## Acceptance Criteria

- [ ] The `/test` route no longer imports or calls the Google Calendar adapter directly.
- [ ] The route calls a service method, which calls the `CalendarProvider` port.
- [ ] The test route is exercisable with the mock adapter in test environments.
- [ ] Existing integration tests for the calendar routes continue to pass.
- [ ] TypeScript typecheck passes.

## Work Log

_(empty)_
