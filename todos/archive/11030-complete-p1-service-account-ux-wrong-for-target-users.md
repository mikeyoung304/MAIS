---
status: complete
priority: p1
issue_id: '11030'
decision: oauth
tags: [code-review, google-calendar, architecture, ux]
dependencies: ['11035']
---

# Service Account UX Is Unsuitable for Target Users (Architectural Decision Required)

## Problem Statement

The current Google Calendar integration uses Google service accounts — requiring the tenant to navigate Google Cloud Console, create a project, create a service account, download a JSON key file, and share their calendar with the service account email. This is a developer workflow. Photographers, coaches, therapists, and wedding planners cannot be expected to complete this setup. The correct consumer UX is OAuth 2.0: a "Connect Google Calendar" button → Google consent screen → callback → done.

## Findings

- **Flagged by:** architecture-strategist, code-simplicity-reviewer
- Target users: photographers, coaches, therapists, wedding planners — NOT developers
- Service account setup requires: GCP project creation, API enablement, service account JSON download, calendar sharing — 8+ steps
- OAuth setup requires: Click "Connect with Google" → approve permissions → done — 2 steps
- The Stripe Connect architecture is the exact reference pattern: `tenant-admin-stripe.routes.ts` + `stripe-connect.service.ts`
- `CalendarProvider` port abstraction already exists — a new `GoogleOAuthCalendarAdapter` requires NO service layer changes
- `Tenant.secrets` encrypted JSON is the correct storage for OAuth tokens (same as service account)

## Proposed Solutions

### Option A: OAuth 2.0 ("Connect with Google") — Recommended

Add `/v1/tenant-admin/calendar/oauth/initiate` and `/v1/tenant-admin/calendar/oauth/callback` routes. Store access_token + refresh_token in `Tenant.secrets.googleCalendarOAuth`. Create `GoogleOAuthCalendarAdapter` implementing `CalendarProvider`.

- **Pros:** Correct consumer UX; follows Stripe pattern already in codebase
- **Cons:** 4-6 days of new backend work; requires Google Cloud app with OAuth credentials
- **Effort:** Large
- **Risk:** Medium

### Option B: Keep Service Accounts with Better Documentation

Add the service account UI (P1-01) and provide an in-app setup wizard linking to the GCP Console steps.

- **Pros:** 1-2 days; backend already done
- **Cons:** Still requires 8+ steps; high drop-off rate; support burden
- **Effort:** Small
- **Risk:** Low

### Option C: Hybrid — OAuth Default, Service Account Advanced

Build OAuth as the primary path; keep service account as "Advanced" for power users.

- **Pros:** Best of both; graceful upgrade
- **Effort:** XL
- **Risk:** Medium

## Decision: OAuth 2.0 (locked in 2026-02-20)

Build Option A — OAuth 2.0. Service account path is too complex for target users.

## Acceptance Criteria

- [ ] `GoogleOAuthCalendarAdapter` implementing `CalendarProvider` port — reads from `Tenant.secrets.googleCalendar`, auto-refreshes tokens, updates storage on refresh
- [ ] `GET /v1/tenant-admin/calendar/oauth/start` — generates Google OAuth URL with HMAC-signed state
- [ ] `GET /v1/tenant-admin/calendar/oauth/callback` — exchanges code, stores encrypted tokens, redirects to settings
- [ ] `googleCalendarConnected Boolean` scalar added to Prisma `Tenant` model
- [ ] Token refresh: check `expiresAt - Date.now() < 5min`, call refresh endpoint, update secrets
- [ ] Decision documented in DECISIONS.md
- [ ] Env vars documented in render.yaml: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_STATE_SECRET`

## Work Log

- 2026-02-20: Architecture strategist flagged as wrong UX for target users. Decision required before P1-01 is built.
- 2026-02-20: OAuth 2.0 decision locked in by user.
- 2026-02-20: Wave 2 implementation complete. Files created:
  - `server/src/services/google-calendar-oauth.service.ts` — OAuth flow, token refresh, Redis caching, token revocation
  - `server/src/routes/tenant-admin-calendar-oauth.routes.ts` — /oauth/start (protected), /oauth/callback (public)
  - `server/src/adapters/google-calendar-oauth.adapter.ts` — CalendarProvider impl using OAuth tokens
  - Modified: config.ts (4 env vars), di.ts (DI wiring), routes/index.ts (route registration), render.yaml (env vars), tenant-admin-calendar.routes.ts (status includes OAuth)
