---
status: pending
priority: p1
issue_id: '11029'
tags: [code-review, google-calendar, settings, frontend, ux]
---

# No Frontend UI for Calendar Configuration

## Problem Statement

The Google Calendar backend is complete (routes, contracts, adapters, services) but zero frontend surface calls any of it. There is no page at `/tenant/scheduling/calendar` or within the settings dashboard. Tenants cannot configure calendar integration despite the full backend existing. All 4 backend routes are unreachable from the dashboard.

## Findings

- **Flagged by:** code-simplicity-reviewer, architecture-strategist, kieran-typescript-reviewer, julik-frontend-races-reviewer (4 of 10 agents)
- `apps/web/src/app/(protected)/tenant/settings/page.tsx` — settings page has a "Business Settings coming soon" placeholder, no calendar section
- `server/src/routes/tenant-admin-calendar.routes.ts` — 4 routes exist: POST/GET/DELETE /config, POST /test
- All 4 contract types already exported from `@macon/contracts`: `CalendarStatusResponseSchema`, `CalendarConfigInputSchema`, `CalendarTestResponseSchema`
- No React Query hooks, no form component, no status badge

## Proposed Solutions

### Option A: Service Account Form UI (1-2 days, resolves immediately)

Build a settings panel with: Calendar ID text input, service account JSON textarea, Save button, Test Connection button, status badge showing current connection state.

- **Pros:** Fast; backend 100% ready; no new backend work
- **Cons:** Service account UX is wrong for non-technical users (see P1-02)
- **Effort:** Small
- **Risk:** Low (UI only)

### Option B: Wait for OAuth Decision First (blocks on P1-02)

Build the OAuth "Connect with Google" button flow instead. More correct UX but requires backend changes first.

- **Pros:** Right long-term UX
- **Cons:** Depends on P1-02 architectural decision
- **Effort:** Large
- **Risk:** Medium

### Option C: Build Both in Parallel

Service account form now (so the feature ships); OAuth button later behind a feature flag.

- **Pros:** Ship something today; upgrade later
- **Effort:** Large total
- **Risk:** Low

## Decision: OAuth 2.0 UI (locked in 2026-02-20)

Build OAuth UI — NOT the service account form. Depends on 11030 (OAuth backend) being completed first.

## Technical Details

- **Affected files:** `apps/web/src/app/(protected)/tenant/settings/page.tsx`, new file `apps/web/src/components/tenant/CalendarSettingsCard.tsx`
- **Contracts ready:** `import { calendarContract } from '@macon/contracts'`
- **Pattern to follow:** Stripe Connect onboarding flow (look for StripeConnectCard or billing settings component)
- **Blocked by:** 11030 (OAuth backend routes must exist before UI can call them)

## Acceptance Criteria

- [ ] "Connect Google Calendar" button → redirects to `/v1/tenant-admin/calendar/oauth/start`
- [ ] After OAuth callback, settings page shows "Connected" status badge with connected calendar name
- [ ] "Disconnect" button calls DELETE /v1/tenant-admin/calendar/config and revokes token
- [ ] Status badge: "Connected ✓ [Calendar Name]" / "Not connected"
- [ ] Loading and error states handled
- [ ] Settings route: `/tenant/settings/calendar` or as section in `/tenant/settings`

## Work Log

- 2026-02-20: Identified by code review (4 agents). Root cause: backend shipped before frontend.
