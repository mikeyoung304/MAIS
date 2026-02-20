---
issue_id: 11056
status: pending
priority: p2
tags: [integrations, video, coaching, architecture]
effort: Large
---

# P2: Zoom / Google Meet Integration Missing (Video Booking Links)

## Problem Statement

Coaches, therapists, and other service professionals who conduct sessions remotely require a unique per-booking video meeting link. The platform currently has no Zoom or Google Meet integration, and the `Booking` model has no `meetingUrl` field. Without this, remote professionals cannot use HANDLED for their core service delivery workflow.

## Findings

- The `Booking` Prisma model does not include a `meetingUrl` or equivalent field.
- No Zoom OAuth integration exists in the adapters.
- No Google Meet link generation exists (though Google Meet links can be created via the Google Calendar API when creating an event with `conferenceData`).
- Target personas (coaches, therapists) list remote video sessions as their primary or only service delivery format.
- This is a strategic gap — competitors (Calendly, Acuity) all support auto-generated video links.

## Proposed Solutions

### Phase 1: Google Meet (lower effort, leverages existing Google Calendar integration)

When creating a Google Calendar event during booking confirmation, include `conferenceData: { createRequest: { requestId: bookingId } }` in the event creation payload. Google returns a Meet link in the event response. Store this as `meetingUrl` on the `Booking` record.

- Requires: `Booking.meetingUrl` field (migration), event creation payload update in `gcal.adapter.ts`.

### Phase 2: Zoom OAuth Integration (separate adapter)

- Add `ZoomProvider` port to `ports.ts`.
- Implement `zoom.adapter.ts` with OAuth flow and `createMeeting()` method.
- On booking confirmation (when Google Calendar not configured or tenant prefers Zoom), call Zoom to create a meeting and store the join URL as `meetingUrl`.
- Add Zoom OAuth credentials to tenant integration config.

### Immediate Action (Phase 1 unblocks the persona)

Start with Google Meet since the Google Calendar integration already handles auth and event creation. This delivers value for the primary use case without a new OAuth integration.

## Acceptance Criteria

- [ ] `Booking.meetingUrl String?` field added to Prisma schema with migration.
- [ ] When a booking is confirmed and the tenant has Google Calendar connected, a Google Meet link is auto-generated and stored in `meetingUrl`.
- [ ] The meeting URL is included in the booking confirmation email to both tenant and customer.
- [ ] The meeting URL is surfaced in the customer-agent booking detail tool response.
- [ ] (Phase 2) Zoom adapter exists behind `ZoomProvider` port with `createMeeting()` method.
- [ ] (Phase 2) Tenant can configure Zoom OAuth in the Integrations settings section.
- [ ] All queries for `meetingUrl` are tenant-scoped.
- [ ] TypeScript typecheck passes.

## Work Log

_(empty)_
