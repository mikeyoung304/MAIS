# Integration Review — Google Calendar & Tenant Settings

**Date:** 2026-02-20
**Scope:** Google Calendar integration, tenant settings UI/UX, missing integrations, deploy pipeline health
**Agents:** agent-native-reviewer, architecture-strategist (x2), chatbot-deep-dive, code-simplicity-reviewer (x2), data-integrity-guardian (x2), git-history-analyzer, julik-frontend-races-reviewer, kieran-typescript-reviewer, learnings-researcher, pattern-recognition-specialist, performance-oracle, security-sentinel

---

## TL;DR

The backend Google Calendar integration is largely complete (routes, adapters, services, port abstraction, event-driven sync), but the frontend UI is entirely absent — no tenant can configure calendar integration from the dashboard. The integration uses a service account model that is inappropriate for non-technical users (photographers, coaches, therapists). A strategic decision must be made: stay with service accounts (add a form UI) or move to OAuth (the right UX, but requires significant new backend work). Separately, the deployment blueprint (`render.yaml`) is missing 8+ required environment variables, the chatbot's health check lies, and a cross-tenant cache collision in availability checks can cause incorrect "date available" responses.

---

## Finding Counts

- P1 Critical: 17
- P2 Important: 27
- P3 Nice-to-have: 19
- Total unique findings: 63

---

## P1 — Critical

---

### [P1-01] No Frontend UI for Calendar Configuration — Backend API Is Unreachable

- **Type:** UX / architecture
- **Flagged by:** code-simplicity-reviewer, architecture-strategist, kieran-typescript-reviewer, julik-frontend-races-reviewer
- **Effort:** Medium (1-2 days)
- **Details:** The backend calendar routes (`GET /v1/tenant-admin/calendar/status`, `POST /v1/tenant-admin/calendar/config`, `DELETE /v1/tenant-admin/calendar/config`, `POST /v1/tenant-admin/calendar/test`) have been implemented but there is zero frontend surface to call them. No page exists at `/tenant/scheduling/calendar` or any equivalent. Zero occurrences of `tenant-admin/calendar` exist in `apps/web/src/`. The backend integration is inaccessible from the product. The scheduling sub-nav in `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx` should gain a "Calendar Sync" entry pointing to a new `calendar/page.tsx`. Contract types are already defined in `@macon/contracts` (`CalendarStatusResponse`, `CalendarConfigInput`, `CalendarTestResponse`) — only the frontend page is missing.
- **Known Pattern:** Pattern matches `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — creating a service/adapter file without wiring it to the UI is a documented pitfall.

---

### [P1-02] Service Account UX Is Unsuitable for Target Users (Photographers, Coaches, Therapists)

- **Type:** UX / architecture (strategic)
- **Flagged by:** architecture-strategist (gcal-oauth-findings), code-simplicity-reviewer
- **Effort:** Large (3-5 days for OAuth path)
- **Details:** The current Google Calendar configuration requires tenants to: (1) create a Google Cloud project, (2) create a service account in GCP Console, (3) download a service account JSON (~2 KB RSA private key), (4) manually share their Google Calendar with the service account's email, and (5) paste the JSON into the UI. This is a developer-grade operation. Non-technical service professionals cannot complete this. The OAuth 2.0 "Connect Google Calendar" button is the appropriate consumer UX. The `CalendarProvider` port abstraction in `server/src/lib/ports/calendar.port.ts` is already correct — a `GoogleOAuthCalendarAdapter` can be added without changing the service layer. Decision required: build service account UI (fast, wrong UX) or build OAuth (correct UX, 3-5 days).

---

### [P1-03] DATE Booking Availability Never Checks Google Calendar Via Agent

- **Type:** architecture / quality
- **Flagged by:** agent-native-reviewer, performance-oracle
- **Effort:** Small (30 min)
- **Details:** `server/src/routes/internal-agent-booking.routes.ts` lines 252-264 contains an explicit `TODO` and returns `available: true` for all DATE-type bookings without calling `AvailabilityService.checkAvailability()`. When a customer agent calls `check_availability` for a wedding or event date, Google Calendar busy status is silently ignored. The TIMESLOT path correctly threads through Google Calendar. Fix: wire `AvailabilityService.checkAvailability()` into the DATE branch of the `/availability` internal route.

---

### [P1-04] `GoogleCalendarSyncAdapter` Uses Global Credentials for All Tenant Mutations

- **Type:** architecture / security
- **Flagged by:** agent-native-reviewer, architecture-strategist, data-integrity-guardian, performance-oracle, security-sentinel (5 agents)
- **Effort:** Medium (2 hours)
- **Details:** `server/src/adapters/google-calendar-sync.adapter.ts` lines 63-85 and 96-196 store `this.calendarId` and `this.serviceAccountJsonBase64` as constructor-initialized instance variables from global env vars. All `createEvent()` and `deleteEvent()` operations use these global credentials regardless of which tenant initiated the booking. Only `isDateAvailable()` (via the parent class `getConfigForTenant()`) performs per-tenant config lookup. Tenants who configured their own calendar credentials via `POST /v1/tenant-admin/calendar/config` will have booking events written to the platform's global calendar. Fix: call `this.getConfigForTenant(input.tenantId)` at the start of each mutation method and use the returned config instead of `this.serviceAccountJsonBase64`.

---

### [P1-05] No OAuth Callback Route Exists

- **Type:** architecture
- **Flagged by:** architecture-strategist (gcal-oauth-findings)
- **Effort:** Large (required if OAuth path chosen)
- **Details:** There is no `GET /v1/tenant-admin/calendar/oauth/callback` route in `server/src/routes/index.ts`. Without this, the OAuth authorization code can never be exchanged for tokens. This is the single most critical missing piece for any OAuth implementation. The Stripe Connect architecture (`tenant-admin-stripe.routes.ts` + `stripe-connect.service.ts`) is the correct reference pattern to follow for building the OAuth initiation and callback routes.

---

### [P1-06] No HTTP Timeout on Any Google API Call — Event Loop Can Hang Indefinitely

- **Type:** performance
- **Flagged by:** performance-oracle
- **Effort:** Small (30 min, ~5 fetch() call sites)
- **Details:** Every `fetch()` call in `server/src/adapters/gcal.adapter.ts` (line 158), `server/src/adapters/google-calendar-sync.adapter.ts` (lines 146, 220, 309), `server/src/adapters/gcal.jwt.ts` (line 54), and `server/src/routes/tenant-admin-calendar.routes.ts` (line 259) has no timeout. Node.js default `fetch()` timeout is infinite. A Google API brownout causes booking availability checks to hang indefinitely, blocking HTTP responses. For the agent availability range loop (7-day range), one hanging call blocks the entire range response. Fix: add `signal: AbortSignal.timeout(10_000)` to all 5 call sites.

---

### [P1-07] `render.yaml` Blueprint Missing 8+ Required Environment Variables

- **Type:** architecture / quality
- **Flagged by:** chatbot-deep-dive, git-history-analyzer
- **Effort:** Small (30 min)
- **Details:** The `render.yaml` blueprint is missing the following variables required or critical for production:

  | Env Var                       | Required?                             | Impact if missing              |
  | ----------------------------- | ------------------------------------- | ------------------------------ |
  | `BOOKING_TOKEN_SECRET`        | REQUIRED (Zod min 32)                 | Server crash at startup        |
  | `CUSTOMER_AGENT_URL`          | Required for chat                     | Chat completely offline        |
  | `TENANT_AGENT_URL`            | Required for tenant chat              | Tenant agent offline           |
  | `RESEARCH_AGENT_URL`          | Required for research                 | Research agent offline         |
  | `GOOGLE_SERVICE_ACCOUNT_JSON` | Required for Cloud Run auth on Render | All agent calls get 403        |
  | `ALLOWED_ORIGINS`             | Required for multi-origin CORS        | Cross-origin requests blocked  |
  | `INTERNAL_API_SECRET`         | Service-to-service auth               | Internal calls unauthenticated |
  | `NEXTJS_REVALIDATE_SECRET`    | Required for ISR cache invalidation   | Frontend cache never purges    |

  `CUSTOMER_AGENT_URL` was the confirmed root cause of the chatbot being completely offline. The fix was a manual Render dashboard override documented in `docs/solutions/runtime-errors/null-tiers-crash-and-chat-env-var.md` that will be wiped on any blueprint re-sync.

---

### [P1-08] Chat Health Endpoint Reports `available: true` When `CUSTOMER_AGENT_URL` Is Absent

- **Type:** quality
- **Flagged by:** chatbot-deep-dive
- **Effort:** Small (1-line fix)
- **Details:** `server/src/routes/public-customer-chat.routes.ts` line 128 checks `!!getConfig().GOOGLE_VERTEX_PROJECT` for the health check, not `CUSTOMER_AGENT_URL`. When `CUSTOMER_AGENT_URL` is unset, the health endpoint reports `available: true`, the widget opens, and the first real message fails with "Connection issue." Fix: change the health check to `!!getConfig().CUSTOMER_AGENT_URL`.

---

### [P1-09] `appName: 'agent'` Mismatch — Agent Deployed as `name: 'customer'`

- **Type:** quality
- **Flagged by:** chatbot-deep-dive
- **Effort:** Small
- **Details:** `server/src/services/customer-agent.service.ts` lines 330 and 515 hardcode `appName: 'agent'` in all `/run` requests and session URL paths (`/apps/agent/...`). The Cloud Run customer-agent is defined with `name: 'customer'` in `server/src/agent-v2/deploy/customer/src/agent.ts` line 66. ADK routes requests by `appName`. If ADK enforces this field, every message and session call targets the wrong app name. Fix: change all occurrences of `appName: 'agent'` and `/apps/agent/` URL paths in `customer-agent.service.ts` to `'customer'`.

---

### [P1-10] No Agent Tools Exist for Calendar Operations

- **Type:** architecture
- **Flagged by:** agent-native-reviewer
- **Effort:** Large
- **Details:** Both `tenant-agent` (36 tools, `server/src/agent-v2/deploy/tenant/src/tools/`) and `customer-agent` (13 tools, `server/src/agent-v2/deploy/customer/src/tools/`) have zero calendar-specific tools. The tenant cannot ask their AI assistant "Is my Google Calendar connected?" There is no internal API route for calendar management accessible to agents (no file at `server/src/routes/internal-agent-calendar.routes.ts`). Suggested new tenant-agent tools: `get_calendar_status` (T1), `configure_calendar` (T3, modifies secrets), `test_calendar_connection` (T1), `remove_calendar` (T3). New internal route file required using `INTERNAL_API_SECRET` auth.

---

### [P1-11] `TenantSecrets` Missing Explicit `calendar` and `googleOAuth` Fields — Type Safety Gap

- **Type:** quality / architecture
- **Flagged by:** code-simplicity-reviewer, data-integrity-guardian, kieran-typescript-reviewer, architecture-strategist, security-sentinel (5 agents)
- **Effort:** Small
- **Details:** `server/src/types/prisma-json.ts` line 116:
  ```typescript
  export interface TenantSecrets {
    stripe?: EncryptedData;
    [key: string]: EncryptedData | undefined; // calendar accessed via index signature
  }
  ```
  The `calendar` key is used in 3 places but not explicitly typed. TypeScript cannot catch `'calender'` or `'Calendar'` misspellings. A second `TenantSecrets` definition exists in `server/src/services/stripe-connect.service.ts` (line 24) with a weaker `[key: string]: unknown` index signature — the two can evolve independently and diverge. Fix: add `calendar?: EncryptedData` and `googleOAuth?: EncryptedData` as explicit named properties; delete the duplicate local interface in `stripe-connect.service.ts` and import from `../types/prisma-json`.

---

### [P1-12] `AvailabilityService.checkAvailability` Drops `tenantId` from Calendar Call — Cross-Tenant Cache Pollution

- **Type:** security / performance
- **Flagged by:** performance-oracle
- **Effort:** Small
- **Details:** `server/src/services/availability.service.ts` line 55:
  ```typescript
  this.calendarProvider.isDateAvailable(date); // missing tenantId
  ```
  When `tenantId` is omitted: (1) the in-process cache key is just `dateUtc` — tenant A's cached result for "2025-06-15" is served to tenant B, and (2) the global `GOOGLE_CALENDAR_ID` env var is used for all tenants instead of their configured calendar. This only affects DATE bookings (wedding-style); TIMESLOT correctly passes `tenantId`. Fix: update `CalendarProvider` port signature in `server/src/lib/ports/calendar.port.ts` to `isDateAvailable(date: string, tenantId?: string)` and pass `tenantId` from `AvailabilityService.checkAvailability`.

---

### [P1-13] `deleteConnectedAccount` Clears ALL Secrets Including Calendar — Silent Data Loss

- **Type:** security / architecture
- **Flagged by:** security-sentinel
- **Effort:** Small
- **Details:** `server/src/services/stripe-connect.service.ts` line 354 sets `secrets: {}` when a tenant disconnects Stripe. This silently deletes `secrets.calendar` (Google Calendar service account JSON) without warning or any recovery path. After OAuth is added, this will also silently delete OAuth refresh tokens. Fix: perform a scoped delete that removes only `secrets.stripe`, preserving other keys. The calendar DELETE route (line 187) demonstrates the correct pattern using destructuring.

---

### [P1-14] Encryption Key Validation Accepts 32-char Strings at Schema Level but Requires 64-char at Runtime

- **Type:** security
- **Flagged by:** security-sentinel
- **Effort:** Small
- **Details:** `server/src/config/env.schema.ts` validates `TENANT_SECRETS_ENCRYPTION_KEY` with `.min(32)` but `server/src/lib/encryption.service.ts` lines 35-48 requires exactly a 64-character hex string (32 bytes). A 32-63 character value passes schema validation and throws a runtime `Error` only when the first encryption is attempted — a confusing startup failure. `server/src/lib/core/config.ts` declares it with only `z.string().optional()` — no length constraint. Fix: tighten to `.length(64).regex(/^[0-9a-f]{64}$/i)` in both files.

---

### [P1-15] Webhook HMAC Secret Stored in Plaintext in PostgreSQL

- **Type:** security
- **Flagged by:** security-sentinel
- **Effort:** Medium
- **Details:** `server/prisma/schema.prisma` line 817: `WebhookSubscription.secret` is a plain `String` column. This is a cryptographic HMAC signing secret generated via `crypto.randomBytes(32).toString('hex')`. A database read — via SQL injection, accidental log exposure, or backup access — exposes it directly, enabling forgery of webhook payloads for any tenant. Stripe restricted keys and calendar service account JSON are both AES-256-GCM encrypted. Fix: encrypt the `secret` field using `EncryptionService` before persistence and decrypt on retrieval.

---

### [P1-16] `getNextAvailableSlot()` Does Not Apply Google Calendar Filtering

- **Type:** architecture / quality
- **Flagged by:** agent-native-reviewer
- **Effort:** Medium
- **Details:** `server/src/services/scheduling-availability.service.ts` lines 564-644: `getNextAvailableSlot()` does not call `filterGoogleCalendarConflicts()`. Only `getAvailableSlots()` applies Google Calendar busy-time filtering. If a slot is blocked on Google Calendar but not in the MAIS database, "book next available" logic may offer that slot, producing double-bookings against the tenant's existing Google Calendar events.

---

### [P1-17] No Token Refresh Infrastructure — OAuth Calendar Sync Silently Fails After 1 Hour

- **Type:** architecture
- **Flagged by:** architecture-strategist, data-integrity-guardian, performance-oracle (3 agents)
- **Effort:** Large (required if OAuth is adopted)
- **Details:** No infrastructure exists for detecting when an OAuth access token is expired, refreshing via `POST https://oauth2.googleapis.com/token`, re-encrypting, and persisting the new token. The adapter's fail-open pattern in `server/src/adapters/gcal.adapter.ts` lines 171-180 returns `available: true` on any API error including 401 (token expired). Double-bookings can occur silently after OAuth token expiry. Service account tokens are indefinitely valid so this does not affect the current implementation — but must be designed before OAuth is adopted.

---

## P2 — Important

---

### [P2-01] No `get_calendar_status` or `configure_calendar` Agent Tools

- **Type:** architecture / UX
- **Flagged by:** agent-native-reviewer
- **Effort:** Large (part of P1-10)
- **Details:** Even if the calendar settings UI exists, the tenant-agent has no awareness of calendar integration status. Suggested tools: `get_calendar_status` (T1, calls new internal route), `configure_calendar` (T3, modifies secrets), `test_calendar_connection` (T1), `remove_calendar` (T3). Trust tier guidance: status/test = T1 (read-only), configure/remove = T3 (modifies secrets).

---

### [P2-02] Calendar Route Accepts Raw `PrismaTenantRepository` — Should Accept a Service

- **Type:** architecture / quality
- **Flagged by:** code-simplicity-reviewer, kieran-typescript-reviewer
- **Effort:** Medium
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` line 24 accepts `tenantRepo: PrismaTenantRepository` directly, bypassing the service layer. Stripe routes correctly accept `stripeConnectService: StripeConnectService`. Adding OAuth (token refresh, state parameter validation, token storage) directly in the route file would create a 400-line god handler. Fix: extract `CalendarConfigService` class and inject it into the route factory.

---

### [P2-03] `/test` Handler Inlines JWT Generation and Raw HTTP — Should Delegate to a Service

- **Type:** quality / architecture
- **Flagged by:** code-simplicity-reviewer, architecture-strategist, security-sentinel (3 agents)
- **Effort:** Small
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` lines 206-300: the `/test` endpoint imports `createGServiceAccountJWT` directly, constructs an OAuth bearer token, and fires a raw `fetch()` to the Google Calendar API inline in a route handler. This duplicates adapter logic, is not testable without a running HTTP server, uses a dynamic `await import('../adapters/gcal.jwt')`, and does not exercise the actual adapter path used in production. Fix: extract `GoogleCalendarService.testConnection(tenantId)` and have the route call it.

---

### [P2-04] Calendar Route Auth Pattern Inconsistent — Inline Guard Repeated 4x When Shared Helper Exists

- **Type:** quality
- **Flagged by:** code-simplicity-reviewer
- **Effort:** Small
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` repeats the same inline auth check 4 times:
  ```typescript
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) { ... }
  const tenantId = tenantAuth.tenantId;
  ```
  `server/src/routes/tenant-admin-shared.ts` already exports `requireAuth` middleware and `getTenantId(res)` helper to eliminate this. Fix: apply `requireAuth` middleware at the router level and replace all inline reads with `getTenantId(res)`.

---

### [P2-05] No Audit Trail for Calendar Credential Changes

- **Type:** security
- **Flagged by:** security-sentinel
- **Effort:** Small
- **Details:** `POST /config` and `DELETE /config` calendar routes write and delete encrypted service account credentials with no `ConfigChangeLog` entry. Only application logger output exists. Branding and tier changes use `ConfigChangeLog` for audit attribution. Fix: add `ConfigChangeLog` entries for calendar config save and delete operations, including `entityType: 'CalendarConfig'`, with credential ciphertext explicitly omitted from the snapshot.

---

### [P2-06] Service Account JSON Missing Structural Validation at API Boundary

- **Type:** security / quality
- **Flagged by:** security-sentinel, data-integrity-guardian, kieran-typescript-reviewer (3 agents)
- **Effort:** Small
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` lines 119-126 validates only JSON syntax and size, not that the payload contains `type: "service_account"`, `client_email`, and `private_key`. Invalid service account JSON is encrypted and stored successfully, then silently fails at the first calendar API call. Fix:
  ```typescript
  const parsed = JSON.parse(serviceAccountJson);
  if (parsed.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
    return res.status(400).json({ error: 'Invalid service account JSON: missing required fields' });
  }
  ```

---

### [P2-07] OAuth Access Token Fetched Per-Call With No Caching — Double RTT on Every Operation

- **Type:** performance
- **Flagged by:** performance-oracle, architecture-strategist (2 agents)
- **Effort:** Small (1-2 hours)
- **Details:** `server/src/adapters/gcal.jwt.ts`: `createGServiceAccountJWT()` makes a fresh network round trip to `oauth2.googleapis.com/token` on every invocation. The returned access token (valid 3600 seconds) is never cached. For the agent 7-day availability range loop on cold cache: 14 network RTTs where 7 are unnecessary token fetches. Fix: cache the access token in-process keyed by service account email with a 55-minute TTL (early-refresh buffer). The adapter already has a private `Map` cache for availability results — extend the same pattern.

---

### [P2-08] No Retry/Backoff for Google API 429 or 5xx — Failures Cache as "Available"

- **Type:** performance / quality
- **Flagged by:** performance-oracle
- **Effort:** Medium
- **Details:** `server/src/adapters/gcal.adapter.ts` lines 171-199: on any non-2xx response, the adapter caches the failure as `{ available: true }` with the full 60s TTL and returns `true`. Rate-limit 429s, transient 503s, and token 401s all produce silent false-positive availability. `PostmarkMailAdapter` correctly implements retry with exponential backoff — apply the same pattern. Fix: retry once for 429 (honoring `Retry-After` header) and transient 5xx; never cache error responses.

---

### [P2-09] Duplicate `CalendarConfigInputSchema` at Contract vs Route Level

- **Type:** quality
- **Flagged by:** kieran-typescript-reviewer
- **Effort:** Small
- **Details:** `packages/contracts/src/dto.ts` lines 1197-1202 and `server/src/routes/tenant-admin-calendar.routes.ts` lines 19-22 define identical Zod schemas for the calendar config input. If validation rules diverge, the route will not enforce contract changes. Fix: import `CalendarConfigInputSchema` from `@macon/contracts` into the route instead of defining a local duplicate.

---

### [P2-10] `TenantCalendarConfig` Type Leaks From Adapter Layer Into Route Handler

- **Type:** architecture / quality
- **Flagged by:** kieran-typescript-reviewer
- **Effort:** Small
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` imports `TenantCalendarConfig` from `../adapters/gcal.adapter` — an adapter-layer type used directly in a route handler. Per the ports-and-adapters architecture, types should flow from port layer outward. Fix: move `TenantCalendarConfig` to `server/src/lib/ports/calendar.port.ts` and re-export from `server/src/lib/ports/index.ts`.

---

### [P2-11] `isDateAvailable` Port Signature Lacks `tenantId` — Per-Tenant Lookup Impossible Via Port Interface

- **Type:** quality / architecture
- **Flagged by:** performance-oracle, kieran-typescript-reviewer (2 agents)
- **Effort:** Small
- **Details:** `server/src/lib/ports/calendar.port.ts` line 17: `isDateAvailable(date: string)` — no `tenantId`. The concrete `GoogleCalendarAdapter.isDateAvailable(dateUtc, tenantId?)` accepts it as an optional override, but code holding a `CalendarProvider` reference cannot pass `tenantId` type-safely. Fix: add `tenantId?: string` to the `isDateAvailable` signature in the port interface and update the mock implementation to accept and ignore it.

---

### [P2-12] Over-Broad Calendar Scope — `getBusyTimes` Requests Full Write Scope

- **Type:** security
- **Flagged by:** security-sentinel
- **Effort:** Small
- **Details:** `server/src/adapters/google-calendar-sync.adapter.ts` lines 113, 215, 297: `getBusyTimes()` requests `https://www.googleapis.com/auth/calendar` (full write access). The method only needs `calendar.readonly`. The `/test` endpoint in the same file's route correctly uses `calendar.readonly`. For OAuth, the broader scope is baked into the refresh token at consent time and cannot be narrowed without re-authorization. Fix: change `getBusyTimes()` in the sync adapter to use `calendar.readonly`; define scope constants to prevent future drift.

---

### [P2-13] No OAuth Token Revocation on Calendar Disconnect

- **Type:** security
- **Flagged by:** architecture-strategist, security-sentinel (2 agents)
- **Effort:** Small
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` lines 169-200: `DELETE /config` removes credentials from `Tenant.secrets` locally but does not call `https://oauth2.googleapis.com/revoke`. For OAuth, leaving the token active on Google's side violates least privilege. Fix: add a revoke call before clearing local state, wrapped in try/catch so revocation failure logs a warning but does not block local cleanup.

---

### [P2-14] Three Triplicated Service Account Decode Blocks in Sync Adapter

- **Type:** quality
- **Flagged by:** kieran-typescript-reviewer
- **Effort:** Small
- **Details:** The same 3-line decode-and-parse pattern appears in `server/src/adapters/google-calendar-sync.adapter.ts` at lines 108-113, 210-215, and 292-297. Each returns `any` from `JSON.parse`. Extract into a private `getAccessToken(scopes: string[]): Promise<string>` method to eliminate duplication and reduce the `any` surface.

---

### [P2-15] `useSearchParams` Called Without Suspense in Billing and Revenue Pages

- **Type:** quality / UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/billing/page.tsx` line 67 and `apps/web/src/app/(protected)/tenant/revenue/page.tsx` line 39 call `useSearchParams()` without a Suspense boundary. In Next.js 14 App Router, this can fail static rendering during production builds. The reset-password page correctly wraps the inner component in `<Suspense>`. Any new calendar OAuth callback page reading `?code=...` or `?state=...` query params will need this pattern applied from the start.

---

### [P2-16] Stripe Dialog "Continue" Button Not Disabled During In-Flight Requests — Double-Submit Race

- **Type:** quality / UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/payments/page.tsx` line 321: the dialog `Continue to Stripe` button disables only when fields are empty (`disabled={!dialogEmail || !dialogBusinessName}`), not when `isCreating` is true. On slow networks, clicking multiple times submits multiple account creation requests. Additionally, `handleOnboard()` is called immediately after `fetchStatus()` without awaiting the committed React state update. Fix: add `|| isCreating` to the disabled guard.

---

### [P2-17] Settings Page Shows Fabricated Mock API Key Instead of Fetched Real Data

- **Type:** UX / quality
- **Flagged by:** julik-frontend-races-reviewer, code-simplicity-reviewer (2 agents)
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/settings/page.tsx` line 25:
  ```typescript
  const apiKeyPublic = tenantId ? `pk_live_${tenantId.slice(0, 8)}...` : 'Not available';
  ```
  This is a fabricated placeholder that looks like a real API key. It does not match the valid format (`pk_live_{slug}_{random}`). Tenants may copy and attempt to use it. No fetch from the API occurs. Fix: fetch the real (server-masked) key from the API, or show a clear "Not yet generated" state.

---

### [P2-18] In-Process `Map` Cache for `isDateAvailable` Not Shared Across Replicas

- **Type:** performance
- **Flagged by:** performance-oracle
- **Effort:** Medium
- **Details:** `server/src/adapters/gcal.adapter.ts` lines 34-35: `private cache = new Map<string, CacheEntry>()`. Each server replica has an independent cache. Under horizontal scaling, replicas independently call Google Calendar for the same `{tenantId}:{date}` key. The TIMESLOT path via `SchedulingAvailabilityService.filterGoogleCalendarConflicts` correctly uses `CacheServicePort` (Redis). Fix: inject `CacheServicePort` into `GoogleCalendarAdapter` and use it for `isDateAvailable` caching with key `gcal-avail:{tenantId}:{dateUtc}` and 60s TTL.

---

### [P2-19] `EmailProvider` Port Only Declares `sendEmail()` — Booking Emails Bypass the Port

- **Type:** architecture
- **Flagged by:** pattern-recognition-specialist
- **Effort:** Medium
- **Details:** `server/src/di.ts` event handlers call `mailProvider.sendBookingConfirm(...)` and `mailProvider.sendBookingReminder(...)` directly on the concrete `PostmarkMailAdapter`, not through the `EmailProvider` port. Any email provider swap requires modifying `di.ts` event subscriptions, not just swapping the adapter class. The port provides zero abstraction for the most critical email flows. Fix: extend `EmailProvider` with typed methods matching the concrete adapter's booking email methods.

---

### [P2-20] `StripeConnectService` Bypasses `PaymentProvider` Port — Not Testable via Mock

- **Type:** architecture
- **Flagged by:** pattern-recognition-specialist
- **Effort:** Medium
- **Details:** `server/src/services/stripe-connect.service.ts` holds its own `Stripe` SDK instance directly. The existing `MockPaymentProvider` does not cover Connect/subscription operations. Mocking subscription management in tests requires real Stripe or a manual override. Fix: extend `PaymentProvider` with subscription/Connect methods, or create a separate `SubscriptionProvider` port; document the architectural split either way.

---

### [P2-21] `_calendarProvider?: unknown` Parameter in Route Factory Is a Deferred Design Smell

- **Type:** quality
- **Flagged by:** code-simplicity-reviewer, kieran-typescript-reviewer (2 agents)
- **Effort:** Small (minutes)
- **Details:** `server/src/routes/tenant-admin-calendar.routes.ts` line 26: `_calendarProvider?: unknown` — an `unknown`-typed parameter with a comment explaining what it should be but never used. The `/test` endpoint re-implements Google Calendar connection testing inline instead of delegating to this parameter. Fix: either type it as `CalendarProvider | undefined` and use it, or remove it entirely.

---

### [P2-22] `navigator.clipboard.writeText` Promise Ignored — False-Positive Copy Success

- **Type:** quality / UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/settings/page.tsx` line 28 calls `navigator.clipboard.writeText(key)` without awaiting or catching. If the write fails silently (non-HTTPS, denied permission), the UI shows a checkmark indicating success but nothing was copied. Fix: wrap in `async`/`await`/`try`-`catch` and show an error state on failure.

---

### [P2-23] Agent Booking Range Loop Is Sequential — Cold Cache Adds N x RTT to Response

- **Type:** performance
- **Flagged by:** performance-oracle
- **Effort:** Medium
- **Details:** `server/src/routes/internal-agent-booking.routes.ts` lines 229-244: the agent availability endpoint iterates a date range in a sequential `for` loop. Each `getAvailableSlots` call may trigger `getBusyTimes` to Google Calendar on cache miss. For a 7-day range on cold cache: 7 sequential Google API round trips. Fix: use `Promise.all` to parallelize `getBusyTimes` calls across the date range, pre-warming the cache for all dates, then generate slots in memory.

---

### [P2-24] `getConfigForTenant` DB Query on Every Calendar Cache Miss — No Config Caching

- **Type:** performance
- **Flagged by:** performance-oracle
- **Effort:** Small
- **Details:** `server/src/adapters/gcal.adapter.ts` lines 52-106: on every `isDateAvailable` cache miss, `getConfigForTenant(tenantId)` calls `this.tenantRepo.findById(tenantId)` — a database round trip — to load encrypted calendar config. The tenant's calendar config changes only when explicitly updated. Fix: cache the `getConfigForTenant` result with a 5-minute in-process TTL keyed by `tenant-cal-config:{tenantId}`, invalidated on `POST /config` and `DELETE /config`.

---

### [P2-25] Revenue Page Mounts Full Page Components as Tab Children — Remount Churn

- **Type:** performance / quality
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/revenue/page.tsx` lines 80-82 mounts `<PaymentsContent />` and `<BillingContent />` conditionally with no CSS visibility preservation. Full remount on tab switch causes re-fetches — `BillingPage` calls `useSubscription()` on mount. Fix: use CSS visibility toggling or a stable shared QueryClient cache key so re-mounting reads from cache.

---

### [P2-26] Seed Writes `SectionContent` Directly as Published — Bypasses LRU Cache Invalidation

- **Type:** architecture / quality
- **Flagged by:** deploy-pipeline review
- **Effort:** Medium
- **Details:** The production seed (`server/prisma/seed.ts`) writes `SectionContent` rows with `isDraft: false` directly, bypassing `SectionContentService.publishAll()`. The in-memory LRU cache is never invalidated. If the API server is running when the seed completes, old published sections remain cached for up to 5 minutes post-seed. Fix: call `SectionContentService.publishAll()` as part of the seed process, or flush the relevant cache keys after direct writes.

---

### [P2-27] OAuth Token Refresh Concurrency Risk — No Lock Around Refresh Flow

- **Type:** security / architecture
- **Flagged by:** security-sentinel
- **Effort:** Small
- **Details:** For OAuth token management, concurrent requests may all attempt to refresh simultaneously when an access token expires, causing token invalidation race conditions. One request stores a newly-issued token; another stores the stale (now-revoked) previous token. Fix: implement a Redis-based lock around the refresh flow per tenant (`gcal-oauth-refresh:{tenantId}` with short TTL) to ensure only one refresh runs at a time.

---

## P3 — Nice-to-Have

---

### [P3-01] Agent System Prompts Do Not Mention Calendar Capabilities

- **Type:** quality / UX
- **Flagged by:** agent-native-reviewer
- **Effort:** Small
- **Details:** Neither `TENANT_AGENT_SYSTEM_PROMPT` nor `CUSTOMER_AGENT_SYSTEM_PROMPT` mentions Google Calendar integration. Once calendar tools are added, both prompts must be updated. The tenant prompt needs vocabulary guidance (e.g., use "your calendar credentials" not "service account JSON").

---

### [P3-02] `checkAvailabilityTool` Does Not Surface Reason for Unavailability

- **Type:** UX
- **Flagged by:** agent-native-reviewer
- **Effort:** Small
- **Details:** The tool returns `available: true/false` but not why a slot is unavailable. `AvailabilityService.checkAvailability()` returns a `reason` field (`booked`, `calendar`, `blackout`). Surfacing this would let the agent say "That date is already on your Google Calendar" vs "That date is already booked by a client."

---

### [P3-03] `Booking.googleEventId` Lacks Composite Tenant Index

- **Type:** performance
- **Flagged by:** data-integrity-guardian
- **Effort:** Small
- **Details:** `server/prisma/schema.prisma` line 514: `@@index([googleEventId])` — global index. A future query "find booking by calendar event ID" (e.g., for Google push notification webhooks) would need `@@index([tenantId, googleEventId])` to be efficient and enforce tenant isolation at the query level.

---

### [P3-04] In-Memory Availability Cache Grows Unboundedly

- **Type:** performance
- **Flagged by:** data-integrity-guardian
- **Effort:** Small
- **Details:** `server/src/adapters/gcal.adapter.ts` lines 34-36: `private cache = new Map<string, CacheEntry>()` with no eviction. With many tenants each checking many dates, the cache can hold O(tenants x days) entries permanently in memory. Fix: use `lru-cache` with a `max` entry count and `ttl` option, or add periodic `setInterval` cleanup.

---

### [P3-05] `Tenant.secrets` JSON Column Has No Size Bound at Database Level

- **Type:** architecture
- **Flagged by:** data-integrity-guardian
- **Effort:** Small (document only)
- **Details:** The `Tenant.secrets` JSON column has no size constraint at the database layer. Current payloads: Stripe key ~200 bytes encrypted, service account JSON ~4 KB encrypted. As integrations grow (Google Calendar OAuth, Zoom, QuickBooks), consider a normalized `TenantIntegration` table if more than 5-6 integrations are stored.

---

### [P3-06] `logger?: any` in Express `Locals` Type — Unjustified `any`

- **Type:** quality
- **Flagged by:** kieran-typescript-reviewer
- **Effort:** Small
- **Details:** `server/src/types/express.d.ts` line 16: `logger?: any` has no justification comment unlike other `any` usages in the codebase. Fix: type as the project's logger type from `../lib/core/logger`.

---

### [P3-07] No `loading.tsx` for Billing or Revenue Route Segments

- **Type:** UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/billing/` and `tenant/revenue/` have `error.tsx` but no `loading.tsx`. Without it, there is no skeleton shown during initial load. The new calendar settings page should include a `loading.tsx` from the start given the async decrypt-from-DB latency on config fetch.

---

### [P3-08] Prometheus Metrics Are Default Only — No Business Counters

- **Type:** quality
- **Flagged by:** pattern-recognition-specialist
- **Effort:** Medium
- **Details:** `prom-client` is installed and `server/src/routes/metrics.routes.ts` exists, but only Node.js default metrics are emitted. No custom counters for `bookings_created_total`, `payments_failed_total`, `ai_messages_used_total`, `calendar_sync_latency_ms`, or `calendar_api_errors_total`. Makes SLA monitoring and capacity planning difficult.

---

### [P3-09] Ghost `reveal-on-scroll` Class Remains in `CTASection.tsx`

- **Type:** quality
- **Flagged by:** architecture-strategist
- **Effort:** Small (1-line delete)
- **Details:** `apps/web/src/components/tenant/sections/CTASection.tsx` line 31 has `reveal-on-scroll` class not defined in `globals.css` and not used by `useScrollReveal`. The class was removed from `TestimonialsSection.tsx` in commit `24a37db7` but `CTASection.tsx` was missed.

---

### [P3-10] Duplicate Anchor ID Risk When Multiple Sections of Same Type Exist

- **Type:** quality
- **Flagged by:** architecture-strategist
- **Effort:** Small
- **Details:** `apps/web/src/components/tenant/SectionRenderer.tsx`: if a tenant has two `testimonials` sections, two `<div id="testimonials">` elements are rendered, violating HTML spec. Browsers match only the first. Fix: track assigned anchor IDs in a `Set<string>` scoped to the render call and skip the `id` attribute for subsequent duplicate anchors.

---

### [P3-11] Testimonials Seed Uses `name`/`role` While Schema Canonical Form Is `authorName`/`authorRole`

- **Type:** quality / architecture
- **Flagged by:** architecture-strategist
- **Effort:** Small
- **Details:** `server/prisma/seeds/macon-headshots.ts` uses `name`/`role` for testimonial items while `TestimonialsSectionSchema` defines `authorName`/`authorRole` as canonical. A transform in `apps/web/src/lib/storefront-utils.ts` papers over this at the read path — the wrong layer for the fix. Fix: correct the seed files; remove the testimonials case from `transformContentForSection`.

---

### [P3-12] Section Type Mappings Are Spread Across 4 Files With No TypeScript Enforcement

- **Type:** architecture
- **Flagged by:** architecture-strategist
- **Effort:** Small
- **Details:** `BLOCK_TO_SECTION_TYPE` (storefront-utils), `SECTION_TYPE_TO_ANCHOR_ID` (SectionRenderer), `SECTION_TYPE_TO_PAGE` (navigation), and a proposed fourth table exist independently. Adding a new section type requires updating 4 files. Fix: consolidate `SECTION_TYPE_TO_ANCHOR_ID` from `SectionRenderer.tsx` into `navigation.ts` alongside `SECTION_TYPE_TO_PAGE`.

---

### [P3-13] Nav Excluded Section Types Should Be an Explicit Set

- **Type:** architecture
- **Flagged by:** architecture-strategist
- **Effort:** Small
- **Details:** `hero` and `cta` are excluded from nav only by not appearing in the mapping — not by explicit exclusion. Add `NAV_EXCLUDED_SECTION_TYPES = new Set(['hero', 'cta'])` to make the exclusion intentional and documented.

---

### [P3-14] Nav Item Order Should Derive From `PAGE_ORDER`, Not DB Insertion Order

- **Type:** quality
- **Flagged by:** code-simplicity-reviewer
- **Effort:** Small
- **Details:** The current `getNavItemsFromHomeSections()` iterates `pages.home.sections` in DB insertion order, so nav order varies by when sections were created. Iterating `PAGE_ORDER` instead guarantees canonical order regardless of DB insertion order, eliminates the `seen` Set, and reduces the function from 12 to 7 lines.

---

### [P3-15] Supabase Auth Variables Collected but Unused — Operational Confusion

- **Type:** architecture
- **Flagged by:** pattern-recognition-specialist
- **Effort:** Small (document only)
- **Details:** `SUPABASE_ANON_KEY` and `SUPABASE_JWT_SECRET` are validated and required in real mode but Supabase Auth is not used — the platform uses its own JWT system. This creates operational confusion. Consider removing these env var requirements or documenting clearly that Supabase is used only for blob storage.

---

### [P3-16] Revenue Page Tab Remount Churn — Covered in P2-25

- **Type:** performance
- **Flagged by:** julik-frontend-races-reviewer
- **Details:** Merged with P2-25 above.

---

### [P3-17] No `loading.tsx` for Calendar Settings Page

- **Type:** UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** When the calendar settings page is built, it must include a `loading.tsx` skeleton given the async decrypt-from-DB latency when fetching calendar config status. Covered in P3-07.

---

### [P3-18] Schedule Sub-Nav Missing "Calendar Sync" Entry

- **Type:** UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small
- **Details:** `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx` `schedulingSubNav` array has no "Calendar Sync" entry. When the calendar page is created, add:
  ```tsx
  { href: '/tenant/scheduling/calendar', label: 'Calendar Sync', icon: <CalendarCheck className="h-4 w-4" /> }
  ```

---

### [P3-19] Service Account JSON Input Should Use Textarea or File Upload, Not Text Input

- **Type:** UX
- **Flagged by:** julik-frontend-races-reviewer
- **Effort:** Small (design guidance)
- **Details:** The service account JSON is ~2 KB of text. The calendar settings form should use `<textarea>` or a file upload input with show/hide toggle (private key semantics), not a standard `<Input>`. Client-side JSON parse validation before submit prevents unnecessary round-trips. The 50 KB server-side size guard should be mirrored client-side (`serviceAccountJson.length > 50 * 1024`).

---

## Missing Integrations (Strategic)

Based on pattern-recognition-specialist findings. The platform covers approximately 25% of integrations typical for a service professional membership platform.

| Integration                              | Priority           | Gap                               | Implementation Path                                                                                                   | Why It Matters                                                                                         |
| ---------------------------------------- | ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **SMS / Twilio**                         | P1 — Before Launch | Entirely missing                  | New `SMSProvider` port + `TwilioSMSAdapter`; wire to `BookingEvents.REMINDER_DUE`; `Customer.phone` already collected | No-shows are the #1 service professional pain; 98% SMS open rate vs 20% email                          |
| **Contract / eSignature (DocuSign)**     | P1 — Before Launch | Entirely missing                  | New `ContractProvider` port; add `AWAITING_SIGNATURE` booking state; `FileCategory.CONTRACT` schema exists            | Photographers and therapists require signed contracts; competitors HoneyBook/Dubsado lead with this    |
| **Branded Invoice / PDF**                | P1 — Before Launch | Entirely missing                  | Stripe hosted billing portal or `pdfkit` PDF generation; trigger on `BookingEvents.PAID`                              | Therapists with HSA/FSA clients and coaches with corporate clients require formal invoices             |
| **Google Calendar OAuth**                | P1 — Strategic     | Auth model wrong for target users | `GoogleOAuthCalendarAdapter implements CalendarProvider`; OAuth routes; token storage in `tenant.secrets.googleOAuth` | Current service account UX requires GCP knowledge; target users are photographers and coaches          |
| **Outlook / Microsoft 365 Calendar**     | P2 — Post-Launch   | Entirely missing                  | `OutlookCalendarAdapter implements CalendarProvider`; Microsoft Graph API; `calendar.port.ts` already supports it     | Many therapists and corporate-adjacent planners use Outlook                                            |
| **Video Meetings (Zoom / Google Meet)**  | P2 — Post-Launch   | Entirely missing                  | New `VideoProvider` port; `ZoomVideoAdapter`; `meetingUrl String?` on Booking; hook into `AppointmentEvents.BOOKED`   | Coaches and therapists require unique per-booking video links; static Zoom links are a privacy problem |
| **Deliverable Delivery**                 | P2 — Post-Launch   | Schema exists, no delivery        | Shareable project link `/project/{token}`; `ProjectFile`/`FileCategory.DELIVERABLE` schema exists                     | Photographers' final step: delivering edited photos to clients                                         |
| **Review / Testimonial Automation**      | P2 — Post-Launch   | Partially missing                 | Trigger review request 3 days after `Project.status = COMPLETED`; new `Testimonial` model                             | Photographers live on Google reviews; manual process today                                             |
| **CRM / HubSpot via Webhook**            | P2 — Partial       | No UI                             | Add webhook subscription management UI; add `customer.created` event type                                             | Webhook infra is built (`WebhookDeliveryService`) but inaccessible without UI                          |
| **HoneyBook / Dubsado Migration Import** | P2 — Strategic     | Entirely missing                  | Import service; `MigrationJob` model for async processing                                                             | Most new tenants are migrating from HoneyBook/Dubsado; painless migration = acquisition                |
| **QuickBooks / Xero Accounting**         | P3 — Roadmap       | Entirely missing                  | New `AccountingProvider` port; OAuth; event listener on `BookingEvents.PAYMENT_CONFIRMED`                             | Payment reconciliation into accounting software                                                        |
| **Apple Calendar / iCal Export**         | P3 — Roadmap       | Entirely missing                  | Optional `exportICS()` on `CalendarProvider`; near-zero implementation cost                                           | Creative professionals use Apple Calendar; `.ics` export is low-effort                                 |
| **Email Marketing (ConvertKit)**         | P3 — Roadmap       | Entirely missing                  | Separate from transactional Postmark; nurture sequences and campaigns                                                 | Coaches who run email nurture sequences; seasonal promotions                                           |
| **Pre-Booking Intake Questionnaires**    | P3 — Roadmap       | Schema gap                        | New `IntakeForm` model; attach to booking flow pre-confirmation                                                       | Therapists require clinical intake; coaches need discovery info before first session                   |

---

## Architectural Decision Required

### Service Account vs. OAuth for Google Calendar

**Current state:** The Google Calendar integration uses service account credentials. Tenants must: (1) create a Google Cloud project, (2) create a service account in GCP Console, (3) download a service account JSON (~2 KB RSA private key), (4) manually share their Google Calendar with a machine email address, and (5) paste the JSON into the UI.

**The UX problem:** This is a developer-grade operation. A wedding photographer, therapist, or life coach cannot be expected to navigate Google Cloud Console. The target persona does not have the technical background for this workflow.

**The right UX:** OAuth 2.0 with a "Connect Google Calendar" button. The tenant clicks, is redirected to Google's consent screen, grants access, and is redirected back. No JSON files, no cloud console.

**What already works — no changes needed at these layers:**

- `CalendarProvider` port (`server/src/lib/ports/calendar.port.ts`) — already correctly abstracted; a `GoogleOAuthCalendarAdapter` can implement it without changing the service layer
- `Tenant.secrets` + `EncryptionService` (AES-256-GCM) — correct storage mechanism for OAuth tokens
- `StripeConnectService` + `tenant-admin-stripe.routes.ts` — exact architectural reference pattern to follow

**What must be built for OAuth:**

1. `GoogleOAuthCalendarAdapter` — reads from `Tenant.secrets.googleOAuth`, auto-refreshes access tokens, handles `getBusyTimes`, `createEvent`, `deleteEvent`
2. `GET /v1/tenant-admin/calendar/oauth/start` — generates Google OAuth URL with HMAC-signed `state` parameter (CSRF prevention)
3. `GET /v1/tenant-admin/calendar/oauth/callback` — exchanges code for tokens, stores encrypted in `secrets.googleOAuth`, redirects to settings page
4. Token refresh logic with concurrency protection (Redis lock per tenant per P2-27)
5. Explicit `googleOAuth?: EncryptedData` field in `TenantSecrets` (P1-11)
6. New env vars: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_STATE_SECRET`

**Effort comparison:**

- Service account form UI (wrong UX, faster): 1-2 days, minimal new backend
- OAuth implementation (correct UX): 4-6 days, significant new backend

**Recommendation:** Build the OAuth path. The service account form can be offered as an "Advanced" escape hatch for enterprise/technical tenants. The `CalendarProvider` port abstraction means both adapters can coexist in `di.ts`.

**Known patterns from `docs/solutions/` (learnings-researcher findings):**

- `docs/solutions/integration-issues/multi-tenant-stripe-checkout-url-routing.md` — OAuth callback URLs must be tenant-scoped at request time, not static env vars
- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` — correct JWT pattern for Google auth from Render
- `docs/archive/2025-11/phases/PHASE_3_STRIPE_CONNECT_COMPLETION_REPORT.md` — reference for per-tenant credential encryption using `tenant.secrets` + AES-256-GCM
- `docs/solutions/growth-assistant-error-messaging-stripe-onboarding-MAIS-20251228.md` — agent tool pattern for initiating third-party OAuth (T2 trust tier, early exit if already connected)

---

## Deduplication Notes

The following findings were flagged by 3 or more agents and counted once:

- **`GoogleCalendarSyncAdapter` uses global credentials** — flagged by agent-native-reviewer, architecture-strategist, data-integrity-guardian, performance-oracle, security-sentinel (5 agents) — counted as P1-04
- **`TenantSecrets` missing explicit `calendar` field** — flagged by code-simplicity-reviewer, data-integrity-guardian, kieran-typescript-reviewer, architecture-strategist, security-sentinel (5 agents) — counted as P1-11
- **No frontend UI for calendar configuration** — flagged by code-simplicity-reviewer, architecture-strategist, kieran-typescript-reviewer, julik-frontend-races-reviewer (4 agents) — counted as P1-01
- **`/test` handler inlines business logic** — flagged by code-simplicity-reviewer, architecture-strategist, security-sentinel (3 agents) — counted as P2-03
- **Duplicate `TenantSecrets` in `stripe-connect.service.ts`** — flagged by code-simplicity-reviewer, data-integrity-guardian, kieran-typescript-reviewer (3 agents) — merged into P1-11

---

_Report written to `docs/reviews/REVIEW-SUMMARY.md`_
