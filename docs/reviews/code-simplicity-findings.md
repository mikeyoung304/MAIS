# Code Simplicity Review — Settings/Integrations + Google Calendar OAuth Readiness

**Reviewer:** code-simplicity-reviewer
**Date:** 2026-02-20
**Scope:** Tenant settings/integrations area; Stripe Connect implementation as integration pattern; Google Calendar service-account integration; readiness for Google Calendar OAuth.

---

## Summary

2 P1, 3 P2, 4 P3. The settings architecture is in two fundamentally different styles that do not compose: Stripe uses a dedicated service class with proper DI injection; Calendar uses raw `res.locals.tenantAuth` repeated 4× per file with no helper abstraction. Both are functional but the Calendar route is the pattern future integrations will copy — and it is the worse of the two. Google Calendar OAuth can be added without refactoring the service layer (the `CalendarProvider` port is already in place), but the **route and UI layers need work before it is clean**. There is no frontend settings page for Calendar configuration at all; the API exists but is completely unreachable from the UI.

---

## P1 — Calendar Route Uses Inconsistent Auth Pattern (vs. All Other Routes)

**Files:**

- `server/src/routes/tenant-admin-calendar.routes.ts` (all 4 handlers)
- `server/src/routes/tenant-admin-stripe.routes.ts` (all 4 handlers)
- `server/src/routes/tenant-admin-shared.ts` (`requireAuth` + `getTenantId`)

The Stripe route file and the Calendar route file were written by two different hands at different times. The calendar routes repeat the same inline auth check 4 times:

```typescript
// tenant-admin-calendar.routes.ts — repeated in every handler
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
const tenantId = tenantAuth.tenantId;
```

The `tenant-admin-shared.ts` file already exports `requireAuth` middleware and `getTenantId(res)` helper specifically to eliminate this duplication. Stripe routes also inline the same pattern (4×) instead of using the shared helpers. Between the two files there are 8 instances of this boilerplate that could be 1 middleware application + 1 `getTenantId` call.

**The compounding problem:** When a third integration (Google Calendar OAuth) is added, it will copy whichever pattern the author sees first. If they copy Calendar, the inline-auth pattern spreads further.

**Fix:** Apply `requireAuth` middleware at the router level (before registering handlers), and replace all inline `res.locals.tenantAuth` reads with `getTenantId(res)`. This is a mechanical change, not a logic change.

---

## P1 — No Frontend UI for Calendar Configuration: The Backend API Is Unreachable

**Evidence:**

- `server/src/routes/tenant-admin-calendar.routes.ts` — full backend: GET /status, POST /config, DELETE /config, POST /test
- `apps/web/src/app/(protected)/tenant/` — no calendar settings page anywhere in the tree
- Zero occurrences of `tenant-admin/calendar` in `apps/web/src/`

The backend calendar route has been registered since whenever it was written, but there is no UI surface that calls it. A tenant who wants to configure Google Calendar integration has no path to do so from the dashboard. The service account JSON upload flow, the calendar ID input, and the connection test button do not exist on the frontend.

**Impact for Google Calendar OAuth:** If the intent is to add OAuth instead of service-account auth, the absence of a frontend settings page is the first blocker — not the backend. An OAuth flow requires UI to initiate the redirect and receive the callback. There is nowhere to put that button.

**Fix:** Create `apps/web/src/app/(protected)/tenant/scheduling/calendar/page.tsx` with the configuration UI. This can be a simple page with a `Calendar ID` input + `Service Account JSON` upload (current) OR an `Connect with Google` OAuth button (future). The page structure should mirror `payments/page.tsx`.

---

## P2 — `TenantSecrets` Type in `prisma-json.ts` Does Not Declare `calendar` Field

**Files:**

- `server/src/types/prisma-json.ts` (lines 116–119)
- `server/src/routes/tenant-admin-calendar.routes.ts` (lines 51–57, 224–230)
- `server/src/adapters/gcal.adapter.ts` (lines 63–64)

The canonical `TenantSecrets` type in `prisma-json.ts`:

```typescript
export interface TenantSecrets {
  stripe?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}
```

There is no `calendar` field typed. The calendar routes access `secrets.calendar` via the index signature `[key: string]`, which means TypeScript cannot catch mistyped key names (`'calender'`, `'Calendar'`) at the call site. The `StripeConnectService` has its own private `TenantSecrets` interface in `stripe-connect.service.ts` (lines 23–27) that also omits `calendar`.

There are two independent `TenantSecrets` definitions in the codebase:

1. `server/src/types/prisma-json.ts` — public canonical type
2. `server/src/services/stripe-connect.service.ts` — private duplicate

The calendar key is accessed through the catch-all index signature in both. This is not type-safe for the integration key name.

**Fix:** Add `calendar?: EncryptedData` to the canonical `TenantSecrets` in `prisma-json.ts`, delete the duplicate in `stripe-connect.service.ts` and import the canonical one.

---

## P2 — Calendar `test` Route Inlines Business Logic That Belongs in a Service

**File:** `server/src/routes/tenant-admin-calendar.routes.ts` (lines 206–300)

The `/test` endpoint decrypts credentials, imports `createGServiceAccountJWT`, constructs an OAuth bearer token, and fires a raw `fetch()` call to the Google Calendar API — all inline in a route handler. This is the only place in the codebase where a route handler contains this level of API integration logic.

Compare to Stripe: `createLoginLink` is one line in the route — it delegates entirely to `StripeConnectService`. The business logic (API interaction, error handling, retry) lives in the service.

The calendar test logic:

1. Is not testable without a running HTTP server
2. Cannot be reused if a cron job or agent tool wants to verify calendar connectivity
3. Uses a dynamic `await import('../adapters/gcal.jwt')` instead of a static import, which makes the dependency graph opaque

**Fix:** Extract into a `calendarConfigService.testConnection(tenantId)` method (or add `testConnection` to the existing `GoogleCalendarService`), inject the service into the route factory, and replace the inline logic with a single call.

---

## P2 — `createTenantAdminCalendarRoutes` Takes `PrismaTenantRepository` Directly; Stripe Takes a Service

**File:** `server/src/routes/tenant-admin-calendar.routes.ts` (line 24)

```typescript
export function createTenantAdminCalendarRoutes(
  tenantRepo: PrismaTenantRepository,
  _calendarProvider?: unknown
): Router {
```

**File:** `server/src/routes/tenant-admin-stripe.routes.ts` (line 26)

```typescript
export function createTenantAdminStripeRoutes(stripeConnectService: StripeConnectService): Router {
```

The Stripe route accepts a service (the right pattern for layered architecture). The Calendar route directly accepts a Prisma repository, bypassing the service layer entirely. The route file then manually does what a service would do: fetch tenant, decrypt secrets, validate, update. This is not consistent with how every other domain in the codebase is structured.

**Impact for Google Calendar OAuth:** OAuth adds token refresh, state parameter validation, and token storage. If these are added directly in the route file, it will become a god handler. A `GoogleCalendarOAuthService` class would be the correct home.

**Fix:** Extract the read/write logic from the calendar routes into a `CalendarConfigService` (distinct from `GoogleCalendarService` which handles sync operations). The route file should only validate input and delegate.

---

## P3 — `_calendarProvider?: unknown` Parameter Is a Smell

**File:** `server/src/routes/tenant-admin-calendar.routes.ts` (line 26)

```typescript
_calendarProvider?: unknown // GoogleCalendarAdapter instance for testing connection
```

An `unknown`-typed parameter with a leading underscore and a comment explaining what it would be is a deferred design decision masquerading as code. Either the parameter is used (give it a real type and use it) or it is not needed (remove it). Currently it is present but serves no purpose and is never accessed.

**Fix:** Remove the parameter from the function signature until it is actually needed with a concrete type.

---

## P3 — Global Settings Page (`/tenant/settings`) Is a Stub With Mock Data

**File:** `apps/web/src/app/(protected)/tenant/settings/page.tsx` (lines 25–26)

```typescript
// Mock API keys for display (in production these would come from the API)
const apiKeyPublic = tenantId ? `pk_live_${tenantId.slice(0, 8)}...` : 'Not available';
```

The Settings page constructs a fake public API key from the tenant ID without fetching from the API. The Business Settings section is a placeholder with "coming soon" copy. The page is primarily a Danger Zone wrapper for logout.

For Google Calendar OAuth specifically: the Settings page is the natural home for an "Integrations" section (Google Calendar, Stripe, future providers). Currently the page has no integration section and no data fetching pattern to follow.

**No immediate fix needed**, but this context informs where the calendar UI should live: either a new `scheduling/calendar/` page or an Integrations card on the Settings page.

---

## P3 — `maskCalendarId` Is a Module-Private Function That Duplicates No Logic

**File:** `server/src/routes/tenant-admin-calendar.routes.ts` (lines 306–317)

The `maskCalendarId` helper is a reasonable utility, but it is currently only used in this one file. If the masking logic ever needs to change (different mask lengths, different separator), it is a local change. This is fine as-is — noted because it is the right place for it and does not need to move.

---

## Answering the Core Question: Is Google Calendar OAuth Addable Cleanly?

**Short answer:** The service layer is ready. The route and UI layers need work first.

### What works well and does not need changing

1. **`CalendarProvider` port** (`server/src/lib/ports.ts`) — the interface supports `createEvent`, `deleteEvent`, `getBusyTimes`, `isDateAvailable`. An OAuth-based adapter could implement this same port.
2. **`GoogleCalendarService`** — thin delegation layer that wraps `CalendarProvider`. Adding OAuth does not require changing this file.
3. **`gcal.jwt.ts`** — the service-account JWT helper is clean and isolated. OAuth would replace this at the adapter level only.
4. **Encrypted secrets storage pattern** — `TenantSecrets` in `prisma-json.ts` and `encryptionService.encryptObject()` are the right primitives for storing OAuth tokens. The pattern is proven by the service-account approach.
5. **`TenantAdminDeps` / `requireAuth` / `getTenantId` in `tenant-admin-shared.ts`** — the right infrastructure exists; it just is not used consistently.

### What needs to change before OAuth is added cleanly

1. **Missing frontend settings page** (P1) — Without a UI page, there is nowhere to put the "Connect with Google" button or the OAuth callback handler.
2. **Calendar route needs a service layer** (P2) — OAuth adds state management (auth code, refresh tokens) that should not live in a route handler. Create `CalendarConfigService` first.
3. **`TenantSecrets` type needs `calendar` field typed** (P2) — OAuth stores access + refresh tokens, not just a service account blob. The type needs `oauthTokens` (or similar) as a first-class named field.
4. **Auth pattern inconsistency** (P1) — Before adding a new integration file, fix the copy-paste auth guard problem so the new OAuth route uses `requireAuth` middleware from the start.

### Effort estimate

Google Calendar OAuth is a **medium addition** (1–2 days), not a large refactor, if the P1/P2 items above are addressed first. The backend infrastructure (service port, encryption, event emission) is already wired. The work is:

- `CalendarConfigService` class (~100 lines)
- OAuth callback route in `tenant-admin-calendar.routes.ts` (exchange code, store tokens)
- Updated `GoogleCalendarSyncAdapter` to use OAuth tokens instead of service-account JSON
- Frontend calendar settings page (~150 lines, mirrors `payments/page.tsx`)

If the P1/P2 items are skipped and OAuth is bolted onto the existing calendar route file, the result will be a 400-line route handler mixing auth, business logic, API calls, and token storage.

---

## Findings Index

| Priority | Finding                                                                                  | File                                                                       | Action                                                   |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| P1       | Inline auth guard repeated 4× in calendar routes; `requireAuth` helper exists but unused | `tenant-admin-calendar.routes.ts` (all handlers)                           | Apply `requireAuth` middleware at router level           |
| P1       | No frontend UI for calendar configuration — backend API is unreachable from dashboard    | `apps/web/src/app/(protected)/tenant/scheduling/` (missing)                | Create `calendar/page.tsx`                               |
| P2       | `TenantSecrets` type missing `calendar` field; two independent definitions exist         | `prisma-json.ts:116`, `stripe-connect.service.ts:24`                       | Add `calendar` field; delete duplicate type              |
| P2       | `/test` handler inlines JWT generation + raw HTTP — should delegate to a service         | `tenant-admin-calendar.routes.ts:206–300`                                  | Extract to `CalendarConfigService.testConnection()`      |
| P2       | Calendar route accepts raw `PrismaTenantRepository`; Stripe route accepts a service      | `tenant-admin-calendar.routes.ts:24` vs `tenant-admin-stripe.routes.ts:26` | Extract `CalendarConfigService`, inject it               |
| P3       | `_calendarProvider?: unknown` is an unused deferred-design smell                         | `tenant-admin-calendar.routes.ts:26`                                       | Remove until concretely needed                           |
| P3       | `/tenant/settings` page constructs mock API keys client-side                             | `settings/page.tsx:25–26`                                                  | Not urgent; but note as future Integrations section home |
| P3       | `maskCalendarId` is correctly local; no action needed                                    | `tenant-admin-calendar.routes.ts:306–317`                                  | None                                                     |
