# Learnings Researcher Findings — Google Calendar Integration & OAuth/Auth Patterns

**Date:** 2026-02-20
**Scope searched:** `docs/solutions/`, `docs/plans/`
**Topics searched:** Google Calendar integration, OAuth flows, third-party auth, tenant settings / credential management, Stripe integration patterns, integration architecture decisions

---

## Finding 1: Google Calendar One-Way Sync — FULLY IMPLEMENTED

**Sources:**

- `/Users/mikeyoung/CODING/MAIS/docs/setup/google-calendar-integration.md`
- `/Users/mikeyoung/CODING/MAIS/docs/setup/google-calendar-implementation-summary.md`
- `/Users/mikeyoung/CODING/MAIS/docs/setup/GOOGLE_CALENDAR_QUICK_START.md`

**What exists:** A complete, production-ready Google Calendar one-way sync implementation (MAIS → Google). Implemented via `GoogleCalendarService` + `GoogleCalendarSyncAdapter`.

**Architecture:**

- Uses Google service account JWT authentication — no OAuth user flow required for the platform-level sync
- Service account credentials stored as `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (base64-encoded JSON)
- `CalendarProvider` interface has optional `createEvent?()` and `deleteEvent?()` methods for backward compat
- `Booking.googleEventId` field already exists in schema — no migration needed
- MockCalendarProvider has full in-memory implementation for dev/test
- Calendar sync failures are **never blocking** — booking succeeds even if sync fails (graceful degradation pattern)

**Key patterns:**

```typescript
// Direct integration pattern
const result = await googleCalendar.createAppointmentEvent(tenantId, {
  id: booking.id,
  serviceName, clientName, clientEmail, startTime, endTime, notes,
});
if (result) {
  await bookingRepo.updateGoogleEventId(tenantId, booking.id, result.eventId);
}

// Event-driven alternative
eventEmitter.subscribe('AppointmentBooked', async (payload) => { ... });
```

**Env vars:**

- `GOOGLE_CALENDAR_ID` — optional, falls back to mock
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` — optional, falls back to mock

**Limitation noted:** Current implementation is a SINGLE shared calendar (platform-level). Per-tenant calendars are called out as a future enhancement (store `googleCalendarId` in Tenant model). OAuth2 user flow (letting couples sync to personal calendars) is listed as Phase 5+ future work.

**Auth note:** The implementation uses **service account JWT**, NOT OAuth. Scope used: `https://www.googleapis.com/auth/calendar.events`.

---

## Finding 2: Archived Google Calendar Phased Implementation Plan

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/archive/2025-11/analysis/GOOGLE_CALENDAR_IMPLEMENTATION_PLAN.md`

**What exists:** A detailed 4-phase implementation plan from November 2025. The setup docs indicate Phase 1 (event creation) and Phase 2 (event deletion) are now complete.

**Per-tenant calendar enhancement plan (Phase 5+):**

- Store `googleCalendarId` in Tenant model
- Each vendor gets their own calendar
- Requires DB migration

**OAuth2 user flow (Phase 5+):**

- Would allow customers to sync to personal Google Calendars
- Requires OAuth2 consent screen setup, token storage, and refresh handling
- This has NOT been implemented yet

**Key design decision:** MAIS is the source of truth; Google Calendar is a view. This prevents sync conflicts.

---

## Finding 3: JWT ID Token for Cloud Run (Google Auth Pattern)

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md`

**What exists:** A critical solution for authenticating server-to-server calls to Google Cloud Run from non-GCP environments (Render).

**Root cause documented:** `GoogleAuth.getIdTokenClient(audience).getRequestHeaders()` returns empty headers silently when running outside GCP. The fix is `JWT.fetchIdToken()` directly.

**Correct pattern:**

```typescript
import { JWT } from 'google-auth-library';

const jwtClient = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
});
const idToken = await jwtClient.fetchIdToken(CLOUD_RUN_URL); // audience = service URL
```

**Priority order:** JWT (service account) → GoogleAuth ADC → gcloud CLI

**Relevant env vars:** `GOOGLE_SERVICE_ACCOUNT_JSON` (plain JSON, not base64 — different from calendar var)

**Key lesson:** Store `client_email` and `private_key` separately from `GoogleAuth` instance for JWT use.

---

## Finding 4: NextAuth v5 OAuth/Session Pattern — Comprehensive Guide

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/authentication-issues/NEXTAUTH_V5_GUIDE.md`

**What exists:** Full consolidated guide for NextAuth v5 JWT authentication in MAIS.

**Critical pitfall documented:** Cookie prefix changes between HTTP and HTTPS:

- HTTP (local): `authjs.session-token`
- HTTPS (prod): `__Secure-authjs.session-token`
- Code that only checks one variant **silently fails in production**

**Correct cookie lookup pattern:**

```typescript
const possibleCookieNames = [
  '__Secure-authjs.session-token', // HTTPS (production) — check FIRST
  'authjs.session-token', // HTTP (development)
  '__Secure-next-auth.session-token', // Legacy v4 HTTPS
  'next-auth.session-token', // Legacy v4 HTTP
];
```

**API proxy pattern:** Client components cannot access the backend token directly (HTTP-only cookie). ALL client API calls must route through Next.js API routes (`/api/*`) which retrieve the token server-side and forward with `Authorization: Bearer` header.

**Security principle:** Backend token NEVER exposed to client-side JavaScript.

---

## Finding 5: Client Auth — Centralized Token Selection

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/CLIENT_AUTH_GUIDE.md`

**What exists:** Guide covering the platform admin impersonation token-selection pattern.

**Critical rule:** Always use `getAuthToken()` from `@/lib/auth` — never duplicate token selection logic. Code duplication in 5 files caused a production auth failure during impersonation.

**Token decision tree:**

```
Is impersonationTenantKey set in localStorage?
  YES → Return adminToken (contains impersonation context)
  NO  → Return tenantToken
```

**This is relevant for any new integration feature:** Any per-tenant third-party auth token must respect this centralized selection pattern when accessed from the client.

---

## Finding 6: Stripe Connect — Per-Tenant Credential Encryption Pattern

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/archive/2025-11/phases/PHASE_3_STRIPE_CONNECT_COMPLETION_REPORT.md`

**What exists:** Complete Stripe Connect implementation with per-tenant secret key encryption. This is the definitive pattern to follow for storing any per-tenant third-party credentials.

**Encryption approach:**

- Uses `EncryptionService` (AES-256-GCM)
- Stored in `tenant.secrets` JSON field

**Storage format:**

```json
{
  "stripe": {
    "ciphertext": "a3f8c9d2e1b4f7g8...",
    "iv": "1a2b3c4d5e6f7g8h...",
    "tag": "..."
  }
}
```

**Key methods on `StripeConnectService`:**

- `storeRestrictedKey(tenantId, restrictedKey)` — encrypts and stores
- `getRestrictedKey(tenantId)` — decrypts and retrieves

**Env var:** `TENANT_SECRETS_ENCRYPTION_KEY` (required)

**Reuse guidance:** The `tenant.secrets` JSON field + `EncryptionService` is the established pattern for any per-tenant third-party credentials. Google Calendar OAuth refresh tokens, per-tenant API keys, etc. should follow this same pattern.

---

## Finding 7: Multi-Tenant Stripe Checkout URL Routing — Static Config Anti-Pattern

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/integration-issues/multi-tenant-stripe-checkout-url-routing.md`

**What exists:** Documented P1 fix where Stripe success/cancel URLs were static (same for all tenants). Pattern generalizes to ALL external service callback URLs.

**The anti-pattern:**

```typescript
// WRONG — Static URL at construction time
const paymentProvider = new StripePaymentAdapter({
  successUrl: config.STRIPE_SUCCESS_URL, // same for all tenants!
});
```

**The correct pattern:**

```typescript
// CORRECT — Build at request time with tenant context
const successUrl = `${this.frontendBaseUrl}/t/${tenant.slug}/book/success?session_id={CHECKOUT_SESSION_ID}`;
// Pass tenantSlug in metadata for webhook routing
```

**Key rule:** Environment variables are for deployment config, NOT tenant config. Tenant-specific URLs MUST be built dynamically at request time.

**Generalizes to:** Any OAuth callback URL for per-tenant integrations (e.g., Google Calendar per-tenant OAuth redirect URIs must include tenant slug).

---

## Finding 8: Project Hub ADK Session & Auth Integration — Service Wiring Pattern

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md`

**What exists:** Documented cascading bugs: new service file was created but never wired to routes, and session IDs were generated locally instead of calling the real session service.

**Key lessons for new integrations:**

1. Creating a new service/adapter file is NOT enough — verify it's imported and called in routes
2. Use log prefix mismatches to detect when old code is still running
3. Never generate integration-specific IDs locally (fake sessions, fake event IDs) — always call the external service
4. Test multi-step flows: single-step tests pass with fake IDs, multi-step flows expose the bug

**Detection pattern:**

```bash
grep -rn "import.*NewService\|createNewService" server/src/routes/
```

---

## Finding 9: Stripe Growth Assistant Onboarding Tool — Agent Tool Pattern

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/growth-assistant-error-messaging-stripe-onboarding-MAIS-20251228.md`

**What exists:** Reference implementation for an agent tool that initiates a third-party OAuth/onboarding flow (Stripe Connect).

**Pattern for integration-initiating tools:**

- Trust tier T2 (soft confirm) — appropriate for "you'll be redirected to X anyway"
- Check if already connected before creating proposal (early exit)
- Use `createProposal()` system so user sees preview before redirect
- Fallback to tenant profile data (email, name) if params not provided
- Error code: `STRIPE_ONBOARDING_ERROR`

**Health check pattern** for integration availability:

```typescript
// Ordered by severity:
1. Missing API key → 'missing_api_key' + user message
2. Not authenticated → 'not_authenticated' + user message
3. Context unavailable → 'context_unavailable' + user message
```

---

## Finding 10: Secret Management — Credentials Never Committed

**Source:** `/Users/mikeyoung/CODING/MAIS/docs/security/SECRETS.md`

**Documented standards for all integration credentials:**

- All service account keys: environment variables only, never committed
- Google service account: base64-encoded in `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- Rotation schedule: Google service account every 365 days
- `TENANT_SECRETS_ENCRYPTION_KEY`: must be backed up securely

**For any new OAuth integration, the documented pattern is:**

1. Platform-level: service account credentials in env vars
2. Per-tenant: encrypted in `tenant.secrets` JSON field via `EncryptionService`
3. Never store OAuth tokens in plain text — always encrypt with `TENANT_SECRETS_ENCRYPTION_KEY`

---

## Summary of Key Decisions for Google Calendar OAuth Integration

If the project moves to per-tenant Google Calendar OAuth (each tenant connecting their own Google Calendar):

1. **Token storage:** Use existing `tenant.secrets` JSON field + `EncryptionService` (AES-256-GCM) — exactly as done for Stripe Connect restricted keys
2. **Callback URLs:** Must be tenant-scoped (include `tenantSlug`) — follow the Stripe checkout URL fix pattern
3. **Cookie auth:** Follow NextAuth v5 guide — `__Secure-` prefix in production
4. **Service wiring:** Verify new OAuth service is imported and called in routes, not orphaned
5. **Agent tool:** Follow `initiate_stripe_onboarding` as the template for an `connect_google_calendar` tool — T2 trust tier, early exit if already connected
6. **Graceful degradation:** Calendar features must not block core booking flows (established pattern)
7. **Platform-level vs per-tenant:** Platform already has service account auth; per-tenant OAuth adds a new auth layer stored in `tenant.secrets`

---

**Total findings:** 10
**High-relevance findings:** Findings 1, 3, 6, 7 are directly applicable to Google Calendar OAuth integration work.
