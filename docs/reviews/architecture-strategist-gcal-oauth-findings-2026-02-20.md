# Architecture Strategist Findings — Google Calendar Integration

**Date:** 2026-02-20
**Scope:** Google Calendar OAuth architecture, third-party integration patterns, tenant settings maturity

---

## Executive Summary

The codebase has a **partially-built Google Calendar integration** using a Service Account model rather than OAuth. The service is operational for the service account path but has three structural gaps that block OAuth-based user-facing calendar connections: no OAuth callback route, no token refresh lifecycle, and no token storage model for OAuth tokens. The Stripe Connect integration provides the correct architectural reference for building an OAuth-style flow. The tenant settings page is a stub. Six other integrations are strategic priorities for a service professional platform.

**Finding counts:** 4 P1 (blocking/wrong), 5 P2 (architectural debt), 4 P3 (future features)

---

## Section 1: How Stripe Is Integrated (The Reference Pattern)

### What Stripe Does Well

Stripe Connect is the most mature third-party integration in the codebase. Its architecture is the right reference for Google Calendar OAuth:

**Schema storage:** Dedicated scalar columns on `Tenant` for state that needs to be queried:

```prisma
// server/prisma/schema.prisma
stripeAccountId String? @unique  // Foreign key to Stripe's system
stripeOnboarded Boolean @default(false)  // Status flag for conditional routing
stripeCustomerId String? @unique  // For subscription management
```

**Encrypted secrets:** Arbitrary credential payloads live in `Tenant.secrets Json` (AES-256-GCM via `EncryptionService`):

```typescript
// server/src/lib/encryption.service.ts
encryptObject<T>(data: T): EncryptedData  // Serialize + encrypt any object
decryptObject<T>(encrypted: EncryptedData): T  // Decrypt + deserialize
```

**Service layer:** `StripeConnectService` owns all Stripe state transitions — create account, generate onboarding link, poll status, revoke. Takes `PrismaClient` in its constructor.

**Route layer:** `tenant-admin-stripe.routes.ts` exposes `POST /connect`, `POST /onboard`, `GET /status`, `POST /dashboard`. All routes read `res.locals.tenantAuth.tenantId` from JWT middleware. Pattern is clean and follows the factory function convention.

**Onboarding flow:**

1. `POST /connect` → create account ID, store it
2. `POST /onboard` → get redirect URL, send user to Stripe
3. Stripe redirects back to `returnUrl` (tenant-controlled)
4. `GET /status` → poll to confirm charges enabled

This is exactly the pattern that Google OAuth requires, with the addition of a callback route that Stripe doesn't need (Stripe's hosted flow handles state internally).

### What To Copy For Google Calendar OAuth

- `Tenant.secrets` JSON field with `encryptionService.encryptObject()` for token storage
- Factory function route pattern (`createTenantAdminCalendarRoutes`)
- `res.locals.tenantAuth.tenantId` for tenant scoping
- Service class owning all state transitions and external API calls
- Status/disconnect endpoints alongside the connect flow

---

## Section 2: Current State of Google Calendar Integration

### What Exists

The calendar integration is more complete than it might appear. Five files form the current implementation:

**`server/src/adapters/gcal.adapter.ts`** — `GoogleCalendarAdapter` implements `CalendarProvider` port. Reads per-tenant config from `Tenant.secrets.calendar` (an encrypted `TenantCalendarConfig` containing `calendarId` and `serviceAccountJson` string). Falls back to global env var config. Handles `isDateAvailable()` via FreeBusy API with a 60-second in-memory cache.

**`server/src/adapters/google-calendar-sync.adapter.ts`** — `GoogleCalendarSyncAdapter extends GoogleCalendarAdapter`. Adds `createEvent()`, `deleteEvent()`, `getBusyTimes()` using Google Calendar API v3 directly with `fetch`. Stores `tenantId` in event `extendedProperties.private` for traceability.

**`server/src/adapters/gcal.jwt.ts`** — `createGServiceAccountJWT()` handles the service account JWT-to-access-token exchange. Creates a fresh JWT per call — no token caching.

**`server/src/services/google-calendar.service.ts`** — `GoogleCalendarService` is the domain facade. Methods: `createAppointmentEvent()`, `cancelAppointmentEvent()`, `getBusyTimes()`. All degrade gracefully to `null`/`false`/`[]` on error or missing config.

**`server/src/routes/tenant-admin-calendar.routes.ts`** — REST API for tenant configuration: `GET /status`, `POST /config` (save credentials), `DELETE /config`, `POST /test` (verify connection). All operations use `Tenant.secrets` encrypted JSON.

**`server/src/lib/ports/calendar.port.ts`** — Clean `CalendarProvider` interface with optional `createEvent`, `deleteEvent`, `getBusyTimes`. The `isDateAvailable()` is the only required method.

### The Critical Observation: Service Account vs. OAuth

The current implementation uses **Google Service Account credentials**, not OAuth. A service account requires:

1. Tenant creates a Google Cloud project
2. Tenant creates a service account in GCP Console
3. Tenant downloads the service account JSON (a ~2KB file containing a private RSA key)
4. Tenant manually shares their Google Calendar with the service account's email address
5. Tenant pastes the JSON into the MAIS settings UI

This is a developer-grade flow, not appropriate for photographers, coaches, or therapists. **OAuth 2.0 with a "Connect Google Calendar" button is the standard consumer UX.** The underlying `CalendarProvider` port is already correctly abstracted — a new `GoogleOAuthCalendarAdapter` could be added without changing the service layer.

---

## Section 3: OAuth Flow Architecture for Google Calendar

### What a Complete OAuth Flow Would Look Like

An OAuth-based Google Calendar integration requires these components that do not currently exist:

**1. Schema additions needed:**

```prisma
// server/prisma/schema.prisma — add to Tenant model
googleCalendarConnected Boolean @default(false)
// Token storage goes in Tenant.secrets.googleCalendar (encrypted EncryptedData)
// No need to add calendarId as a scalar column — it lives inside the encrypted blob
```

**2. Update `TenantSecrets` type definition:**

```typescript
// server/src/types/prisma-json.ts
export interface TenantSecrets {
  stripe?: EncryptedData;
  calendar?: EncryptedData; // existing: service account path
  googleCalendar?: EncryptedData; // new: OAuth token storage
}

// New interface for the decrypted OAuth payload:
export interface GoogleCalendarOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
  scope: string;
  tokenType: string;
  calendarId: string; // Which calendar the tenant selected
  calendarName: string; // Display name for settings UI
}
```

**3. OAuth initiation route (does not exist):**
`GET /v1/tenant-admin/calendar/oauth/start` → generates Google OAuth URL with:

- `client_id` from env (`GOOGLE_OAUTH_CLIENT_ID`)
- `redirect_uri` pointing to the callback route
- `scope`: `https://www.googleapis.com/auth/calendar`
- `state`: HMAC-signed JSON `{ tenantId, nonce, timestamp }` (prevents CSRF)
- `access_type=offline` to receive refresh token
- `prompt=consent` to force refresh token issuance on re-connect

**4. OAuth callback route (does not exist):**
`GET /v1/tenant-admin/calendar/oauth/callback`:

- Receives `code` and `state` from Google's redirect
- Verifies HMAC signature of `state`, validates timestamp (reject if >10 minutes old)
- Exchanges code for tokens: `POST https://oauth2.googleapis.com/token`
- Stores `{ accessToken, refreshToken, expiresAt, scope, tokenType }` encrypted in `Tenant.secrets.googleCalendar`
- Fetches calendar list to show tenant which calendar to sync: `GET https://www.googleapis.com/calendar/v3/users/me/calendarList`
- Redirects to `apps/web` settings page: `/tenant/settings/calendar?status=connected`

**5. Calendar selection route (partially exists):**
`GET /v1/tenant-admin/calendar/list` — fetches tenant's calendar list using stored OAuth token, returns `[{ id, name, primary }]` for the tenant to pick one. Existing `GET /status` could be extended to return this list.

**6. Token refresh logic (does not exist):**
Before any Google API call, the adapter checks `expiresAt - Date.now() < 5 * 60 * 1000` (5-minute buffer). If near expiry, calls `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`. On success, updates `Tenant.secrets.googleCalendar` with the new access token and expiry.

**7. New environment variables needed:**

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://api.gethandled.ai/v1/tenant-admin/calendar/oauth/callback
GOOGLE_OAUTH_STATE_SECRET=  # HMAC key for state parameter signing
```

---

## Section 4: P1 Findings — Blocking Issues

### P1-1: Service Account UX Is Unsuitable For Target Users

**Files:** `server/src/routes/tenant-admin-calendar.routes.ts`, `server/src/adapters/gcal.adapter.ts`
**Issue:** The current configuration flow requires tenants to create a Google Cloud service account, download a JSON key file, and manually share their calendar with a machine email address. Photographers, coaches, and therapists cannot be expected to complete this workflow.
**Recommendation:** Build `GoogleOAuthCalendarAdapter` alongside the existing service account path. The `CalendarProvider` port abstraction means the service layer needs no changes. The service account path can remain for advanced/enterprise tenants.

### P1-2: No OAuth Callback Route Exists

**File:** `server/src/routes/index.ts` (route registry)
**Issue:** There is no `GET /v1/tenant-admin/calendar/oauth/callback` route. Without this, the OAuth authorization code can never be exchanged for tokens. This is the single most critical missing piece.

### P1-3: No Token Refresh Logic

**Files:** `server/src/adapters/gcal.jwt.ts`, `server/src/adapters/google-calendar-sync.adapter.ts`
**Issue:** Service account tokens are re-fetched fresh on every API call (a new JWT is signed and exchanged every time). For OAuth, the access token expires in 1 hour and must be refreshed using the stored `refresh_token`. No token expiry check, refresh call, or storage update logic exists.
**Impact:** OAuth-connected calendars would silently fail after 1 hour. The `GoogleCalendarService` graceful degradation would mask this as "calendar not configured."

### P1-4: OAuth Token Structure Not Defined In Type System

**File:** `server/src/types/prisma-json.ts`
**Issue:** `TenantSecrets` has `stripe?: EncryptedData` and an open index signature but no explicit `googleCalendar` key. The `calendar` key (service account path) is also not explicitly declared — it relies on the index signature. OAuth tokens (access token, refresh token, expiry, scope, selected calendar ID) are structurally different from a service account JSON. Neither is formally typed.
**Impact:** TypeScript does not enforce what gets stored under each key. Key naming drift is a documented pitfall in this codebase (Pitfall #30 analog: cache key drift applies equally to secret key naming).

---

## Section 5: P2 Findings — Architectural Debt

### P2-1: Token Per-Call Fetching Has No Caching

**File:** `server/src/adapters/gcal.jwt.ts`
**Issue:** `createGServiceAccountJWT()` makes an HTTP call to `https://oauth2.googleapis.com/token` on every invocation. A 1-hour token is fetched fresh for every `createEvent()`, `deleteEvent()`, and `getBusyTimes()` call. At scale this wastes latency and burns Google API quota.
**Recommendation:** Cache the access token in Redis (or in-memory for mock mode) keyed by service account email, with TTL of 55 minutes. The `CacheServicePort` already exists and is injected into `SchedulingAvailabilityService`.

### P2-2: Settings Page Is A Stub

**File:** `apps/web/src/app/(protected)/tenant/settings/page.tsx`
**Issue:** The settings page contains: "Business settings configuration coming soon." There is no UI for Google Calendar configuration despite backend routes existing at `/v1/tenant-admin/calendar/*`. The Stripe Connect onboarding also has no dedicated settings panel.
**Impact:** The backend integration exists but is inaccessible via the product. Tenants cannot configure Google Calendar without calling the REST API directly.

### P2-3: `/test` Route Bypasses Adapter Abstraction

**File:** `server/src/routes/tenant-admin-calendar.routes.ts`, lines 246-268
**Issue:** The `POST /test` route imports `createGServiceAccountJWT` directly from `gcal.jwt.ts` and calls the Google Calendar API via inline `fetch`, bypassing the `GoogleCalendarAdapter` abstraction. This means the test logic duplicates adapter logic and does not exercise the actual adapter path used in production.
**Recommendation:** Extract `testConnection(tenantId): Promise<{ success: boolean; calendarName?: string; error?: string }>` onto `GoogleCalendarService`. The route calls the service method.

### P2-4: `GoogleCalendarSyncAdapter` Uses Global Credentials For Mutations

**File:** `server/src/adapters/google-calendar-sync.adapter.ts`, lines 63-85 and 96-196
**Issue:** `GoogleCalendarSyncAdapter` stores `this.calendarId` and `this.serviceAccountJsonBase64` in instance variables initialized from the constructor's `config` argument (which comes from the global env vars `GOOGLE_CALENDAR_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`). The `createEvent()` and `deleteEvent()` methods use these global instance-level credentials. Only `isDateAvailable()` (via the parent `GoogleCalendarAdapter.getConfigForTenant()`) performs per-tenant config lookup.
**Impact:** In multi-tenant deployments where individual tenants have their own service account credentials configured, `createEvent()` calls would use the platform's global service account rather than the tenant's configured credentials.

### P2-5: No OAuth Token Revocation On Disconnect

**File:** `server/src/routes/tenant-admin-calendar.routes.ts`, lines 169-200
**Issue:** The `DELETE /config` endpoint removes credentials from `Tenant.secrets` locally but does not call Google's token revocation endpoint (`https://oauth2.googleapis.com/revoke`). For service accounts this is irrelevant. For OAuth, leaving the token active on Google's side violates the principle of least privilege and is a security/compliance concern.
**Recommendation:** Add a `revokeOAuthToken(refreshToken)` call before clearing local state. Wrap in try/catch — revocation failure should log a warning but not block the local cleanup.

---

## Section 6: P3 Findings — Future Integrations For Service Professionals

### P3-1: Zoom / Google Meet for Virtual Appointments

**Why it matters:** Coaches, therapists, and consultants need video calls. When a TIMESLOT appointment is booked, automatically creating a Zoom/Meet link and including it in confirmation email is table-stakes.
**Architectural gap:** No `VideoProvider` port exists. A `MeetingProvider` port in `server/src/lib/ports/` would be needed. Note: Google Meet links can be created as part of the Google Calendar event via the `conferenceData` field in the events API — zero additional OAuth scope needed once calendar is connected. A `zoomMeetingUrl` or `meetingUrl` column would be needed on `Booking`.

### P3-2: Zapier / Make Automation Surface

**Why it matters:** Service professionals use Zapier heavily — booking data to CRMs (HubSpot, Airtable), email sequences (Mailchimp, ConvertKit), spreadsheets. The infrastructure is built but invisible.
**Architectural gap:** `WebhookSubscription` model, `WebhookDeliveryService`, and `tenant-admin-webhooks.routes.ts` are production-ready. The gap is: no UI to manage subscriptions, no Zapier app, no pre-built automation templates. This is a near-zero backend effort — purely a frontend and partnership effort.

### P3-3: HoneyBook / Dubsado Migration Import

**Why it matters:** Most service professionals switching to MAIS are migrating from HoneyBook or Dubsado. First-mover advantage comes from making migration painless — zero data loss.
**Architectural gap:** No import service, no `MigrationJob` model for async processing, no schema mapping. This is a significant new build — but would dramatically reduce churn at the consideration stage.

### P3-4: QuickBooks / FreshBooks Accounting Sync

**Why it matters:** Photographers and wedding planners need bookings to flow into accounting software automatically. Currently `Payment` records exist in the database with no export path.
**Architectural gap:** No `AccountingProvider` port. Would need OAuth for QuickBooks (similar pattern to Google), a `QuickBooksAdapter`, and an event listener on `BookingEvents.PAYMENT_CONFIRMED`. The `InProcessEventEmitter` in `server/src/lib/core/events.ts` already supports this pattern.

---

## Section 7: Recommended Implementation Sequence

The following order minimizes rework and maximizes compound value:

**Step 1 (P1-4 fix, 30 min):** Add explicit `googleCalendar?: EncryptedData` and `calendar?: EncryptedData` keys to `TenantSecrets` interface in `server/src/types/prisma-json.ts`. Add `GoogleCalendarOAuthTokens` interface. Remove reliance on index signature for known keys.

**Step 2 (P1-2 + P1-3, 4-6 hours):** Build `GoogleOAuthCalendarAdapter` implementing `CalendarProvider`. Reads from `Tenant.secrets.googleCalendar`, auto-refreshes tokens when within 5 minutes of expiry, updates storage on refresh. Add `GET /v1/tenant-admin/calendar/oauth/start` and `GET /v1/tenant-admin/calendar/oauth/callback` routes.

**Step 3 (P2-4 fix, 2 hours):** Fix `GoogleCalendarSyncAdapter.createEvent()` and `deleteEvent()` to load per-tenant config via `tenantRepo` rather than using constructor-initialized global credentials.

**Step 4 (P2-1 fix, 1 hour):** Add token caching to `createGServiceAccountJWT()` using `CacheServicePort` with 55-minute TTL keyed by service account `client_email`.

**Step 5 (P2-3 fix, 1 hour):** Extract `GoogleCalendarService.testConnection(tenantId)` method. Route calls service, not Google API directly.

**Step 6 (P2-2, 4-6 hours):** Build tenant settings UI: calendar integration section with "Connect Google Calendar" OAuth button and "Disconnect" button. Add webhook subscription management to settings.

---

## Section 8: Integration Architecture Summary Table

| Integration               | Pattern               | Token Storage                               | Revoke Route                    | Refresh Logic             | UI                  |
| ------------------------- | --------------------- | ------------------------------------------- | ------------------------------- | ------------------------- | ------------------- |
| Stripe Connect            | OAuth (Stripe-hosted) | `Tenant.stripeAccountId` scalar             | None (Stripe handles)           | N/A                       | None (billing page) |
| Stripe Billing            | Platform key          | `Tenant.stripeCustomerId` scalar            | N/A                             | N/A                       | Billing page        |
| Google Calendar (current) | Service Account       | `Tenant.secrets.calendar` (encrypted)       | DELETE only, no revoke API call | None (fresh JWT per call) | None                |
| Google Calendar (target)  | OAuth 2.0             | `Tenant.secrets.googleCalendar` (encrypted) | Needs revoke endpoint           | Needs auto-refresh        | Needs settings UI   |
| Zoom                      | Not built             | —                                           | —                               | —                         | —                   |
| QuickBooks                | Not built             | —                                           | —                               | —                         | —                   |

**Key architecture principle:** The `Tenant.secrets` JSON-with-encryption pattern is the correct choice for OAuth tokens. Scalar columns on `Tenant` are appropriate only for values that need to be queried via SQL (like `stripeAccountId` which is used in `WHERE` clauses). OAuth tokens are never queried — they are only read and decrypted on use — so the JSON `secrets` field is correct.

---

_Reviewed by: architecture-strategist agent_
_Files reviewed:_

- `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/google-calendar.service.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.jwt.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/stripe.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-stripe.routes.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/index.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports/calendar.port.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/encryption.service.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/types/prisma-json.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/di.ts`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/settings/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/api.v1.ts`
