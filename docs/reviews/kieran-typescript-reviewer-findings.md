# Kieran TypeScript Reviewer — Google Calendar Integration Findings

**Date:** 2026-02-20
**Scope:** TypeScript type safety audit focused on Google Calendar integration readiness
**Reviewer:** kieran-typescript-reviewer

---

## Executive Summary

The codebase uses a **service account** approach (not OAuth user tokens) for Google Calendar integration. The server-side type system is largely sound — the `CalendarProvider` port, adapters, and DTOs are well-typed. However, there are four distinct type-safety issues that will cause problems when building the Google Calendar integration: a mistyped `_calendarProvider` parameter in the route factory, a `TenantSecrets` type that is missing an explicit `calendar` property, a duplicate local `TenantSecrets` interface in `stripe-connect.service.ts` with a looser index signature, and a complete absence of any frontend page or type consumer for the calendar settings endpoints.

---

## Findings

### P1 Findings (Block Correctness)

#### P1-1: `_calendarProvider` parameter is typed as `unknown` instead of `CalendarProvider`

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`, line 26

```typescript
export function createTenantAdminCalendarRoutes(
  tenantRepo: PrismaTenantRepository,
  _calendarProvider?: unknown // GoogleCalendarAdapter instance for testing connection
): Router {
```

**Problem:** The second parameter is typed `unknown` with a comment admitting it should be `GoogleCalendarAdapter`. The `/test` endpoint re-implements Google Calendar connection testing inline (lines 248-295) by doing its own JWT creation and fetch calls instead of delegating to the `CalendarProvider` interface. This is a type-safety bypass and a duplication of behaviour already implemented in `gcal.adapter.ts` and `gcal.jwt.ts`.

**Impact:** If this parameter were properly typed as `CalendarProvider`, the test route could use the interface correctly. As-is, `unknown` prevents any type-safe calls, forcing the inline reimplementation. Any future refactor of the test logic will diverge silently.

**Fix Required:** Type the parameter as `CalendarProvider | undefined` (imported from `../lib/ports`) and delegate the test logic to the injected provider.

---

#### P1-2: `TenantSecrets` in `prisma-json.ts` does not declare `calendar` as a typed property

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/types/prisma-json.ts`, lines 116-119

```typescript
export interface TenantSecrets {
  stripe?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}
```

**Problem:** The `calendar` key is accessed in three separate places:

- `server/src/routes/tenant-admin-calendar.routes.ts` lines 52, 64 — accesses `secrets.calendar`
- `server/src/adapters/gcal.adapter.ts` line 64 — accesses `secrets.calendar?.ciphertext`

All of these accesses rely on the index signature `[key: string]: EncryptedData | undefined` rather than an explicit `calendar?: EncryptedData` property. While TypeScript allows this, it is a type-safety gap: there is no single authoritative declaration that the `calendar` property holds `EncryptedData`. If `TenantCalendarConfig` were ever stored differently (e.g., with additional top-level fields), the type would not catch it.

Additionally, the `@property stripe` JSDoc comment in the type's documentation section says nothing about `calendar`, meaning the type's contract is undocumented for the calendar secret.

**Fix Required:** Add `calendar?: EncryptedData;` as an explicit named property to `TenantSecrets` alongside `stripe`. Update the JSDoc.

---

### P2 Findings (Significant Risk)

#### P2-1: Duplicate `TenantSecrets` interface in `stripe-connect.service.ts` has a different (weaker) index signature

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`, lines 23-27

```typescript
// TenantSecrets type - Stripe encrypted secret storage
interface TenantSecrets {
  stripe?: EncryptedData; // Encrypted Stripe restricted key
  [key: string]: unknown; // <-- index signature is 'unknown', not 'EncryptedData | undefined'
}
```

**Canonical type in `prisma-json.ts`:**

```typescript
export interface TenantSecrets {
  stripe?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}
```

**Problem:** `stripe-connect.service.ts` defines its own local `TenantSecrets` with `[key: string]: unknown` instead of importing from `../types/prisma-json`. This means secrets written through the Stripe service are less strictly typed, and the two places can evolve independently and diverge. When the `calendar` property is added to the canonical type, the Stripe service's casting remains incompatible.

**Fix Required:** Delete the local `TenantSecrets` interface and import `TenantSecrets` from `../types/prisma-json` in `stripe-connect.service.ts`. The `[key: string]: unknown` vs `[key: string]: EncryptedData | undefined` discrepancy must be reconciled before changing how secrets are structured.

---

#### P2-2: `CalendarConfigInputSchema` in the contract duplicates `calendarConfigSchema` in the route handler

**Files:**

- Contract: `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/dto.ts`, lines 1197-1202
- Route: `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`, lines 19-22

Contract schema:

```typescript
export const CalendarConfigInputSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  serviceAccountJson: z.string().min(1, 'Service account JSON is required'),
});
```

Route-local schema (identical):

```typescript
const calendarConfigSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  serviceAccountJson: z.string().min(1, 'Service account JSON is required'),
});
```

**Problem:** The route defines and validates against its own locally-defined schema rather than importing and reusing `CalendarConfigInputSchema` from the shared contracts package. This is the codebase's own Pitfall — constants duplication trap. If validation rules diverge (e.g., the contract adds `.max(255)` to `calendarId`), the route will not enforce it.

The route handler also does not use ts-rest contract validation at all — it uses raw `Router.post()` with manual `safeParse`. The schema duplication is the concrete type-safety issue regardless of whether ts-rest is used.

**Fix Required:** Either import `CalendarConfigInputSchema` from `@macon/contracts` into the route and validate against it, or annotate the code with a clear comment explaining why the route is exempt from ts-rest contract enforcement and referencing the shared schema as the authoritative source.

---

#### P2-3: `TenantCalendarConfig` interface is private to the adapter and not exported from ports

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts`, lines 28-31

```typescript
export interface TenantCalendarConfig {
  calendarId: string;
  serviceAccountJson: string; // JSON string (not base64)
}
```

**Problem:** `TenantCalendarConfig` is exported from `gcal.adapter.ts` and imported in `tenant-admin-calendar.routes.ts`:

```typescript
import type { TenantCalendarConfig } from '../adapters/gcal.adapter';
```

This is an adapter-layer type bleeding into a route handler. Following the ports-and-adapters architecture of this codebase, the type should live in the calendar port (`server/src/lib/ports/calendar.port.ts`) or in `types/prisma-json.ts` (since it is the decrypted form of the `TenantSecrets.calendar` field). Routes should not import from adapters.

**Fix Required:** Move `TenantCalendarConfig` to `server/src/lib/ports/calendar.port.ts` and re-export it from `server/src/lib/ports/index.ts`. Update imports in the route and adapter.

---

#### P2-4: Untyped `JSON.parse` of service account JSON at four call sites

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.jwt.ts`, lines 7-10

```typescript
interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}
```

**Problem:** Three places parse the service account JSON from base64 and then pass the result to `createGServiceAccountJWT`:

1. `server/src/adapters/gcal.adapter.ts` line 145 — result is untyped `any`
2. `server/src/adapters/google-calendar-sync.adapter.ts` lines 108, 210, 292 — same pattern repeated three times, result is untyped `any`
3. `server/src/routes/tenant-admin-calendar.routes.ts` line 248 — direct `JSON.parse(calendarConfig.serviceAccountJson)` — result is untyped `any`

In all four call sites, the result of `JSON.parse(...)` is `any`, passed directly to `createGServiceAccountJWT` which expects `ServiceAccountJson`. TypeScript accepts this because `JSON.parse` returns `any`, but there is no runtime validation that `client_email` and `private_key` actually exist. An invalid service account JSON would cause a runtime exception deep inside `crypto.createSign`, not a clear validation error.

**Fix Required:**

1. Export `ServiceAccountJson` from `gcal.jwt.ts`
2. Add a type guard or `zod` parse for the service account JSON at each parse site
3. Return a typed `ServiceAccountJson` so `createGServiceAccountJWT` can enforce its contract

---

### P3 Findings (Improvements / Future Risk)

#### P3-1: No frontend types or pages exist for calendar settings

**Gap:** The API contracts for calendar configuration (`tenantAdminGetCalendarStatus`, `tenantAdminSaveCalendarConfig`, `tenantAdminTestCalendar`, `tenantAdminDeleteCalendarConfig`) exist and are registered in the Express router. However:

- No Next.js page at `/tenant/scheduling/calendar` or similar
- No React Query hooks or fetch calls referencing these endpoints
- The scheduling layout (`/apps/web/src/app/(protected)/tenant/scheduling/layout.tsx`) does not include a "Calendar" nav item in `schedulingSubNav`
- No usage of `CalendarStatusResponse`, `CalendarConfigInput`, or `CalendarTestResponse` types from `@macon/contracts` anywhere in `apps/web/src/`

**What will need to be created for Google Calendar integration — the contract types are already complete:**

```typescript
// Types automatically available from @macon/contracts:
import type {
  CalendarStatusResponse, // { configured: boolean; calendarId: string | null }
  CalendarConfigInput, // { calendarId: string; serviceAccountJson: string }
  CalendarTestResponse, // { success: boolean; calendarId?: string; calendarName?: string; error?: string }
} from '@macon/contracts';

// Contracts already wired:
// Contracts.tenantAdminGetCalendarStatus    -> GET    /v1/tenant-admin/calendar/status
// Contracts.tenantAdminSaveCalendarConfig   -> POST   /v1/tenant-admin/calendar/config
// Contracts.tenantAdminTestCalendar         -> POST   /v1/tenant-admin/calendar/test
// Contracts.tenantAdminDeleteCalendarConfig -> DELETE /v1/tenant-admin/calendar/config
```

The contract layer is complete. No new DTOs are needed. The frontend page is the only missing type consumer.

---

#### P3-2: `express.d.ts` declares `logger?: any` in `Locals`

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/types/express.d.ts`, line 16

```typescript
interface Locals {
  tenantAuth?: TenantTokenPayload;
  logger?: any; // <-- violates strict-mode intent, no justification comment
}
```

**Problem:** This `any` is not justified with a comment (unlike the `z.any()` cases in the contracts which have documented justifications). The `logger` in `Locals` should be typed as the project's logger type from `../lib/core/logger`. While unrelated to the calendar feature itself, any new route code accessing `res.locals.logger` would bypass type checking.

---

#### P3-3: `isDateAvailable` port signature does not accept `tenantId`

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports/calendar.port.ts`, line 17

```typescript
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;  // No tenantId parameter
```

**Implementation in `gcal.adapter.ts`:**

```typescript
async isDateAvailable(dateUtc: string, tenantId?: string): Promise<boolean> {
```

**Problem:** The concrete `GoogleCalendarAdapter.isDateAvailable` accepts an optional `tenantId` for per-tenant config lookup, but the `CalendarProvider` interface only declares `isDateAvailable(date: string)`. Code that holds a `CalendarProvider` reference cannot pass `tenantId` type-safely. Any new consumer that uses the port interface will silently skip per-tenant lookup.

**Fix Required:** Add `tenantId?: string` to the `isDateAvailable` signature in `CalendarProvider`, and update the mock implementation to accept (and ignore) it.

---

#### P3-4: Three duplicated service account decode-and-parse blocks in `google-calendar-sync.adapter.ts`

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts`, lines 108-113, 210-215, 292-297

The same three-line pattern appears three times:

```typescript
const serviceAccountJson = JSON.parse(
  Buffer.from(this.serviceAccountJsonBase64, 'base64').toString('utf8')
);
const accessToken = await createGServiceAccountJWT(serviceAccountJson, [...]);
```

Each repeated `JSON.parse` returns `any` (see P2-4). Extracting this into a private `getAccessToken(scopes: string[]): Promise<string>` method would eliminate the duplication, reduce the `any` surface, and make future scope changes a single-point change.

---

## Interface Types Needed for OAuth Token Flow

The current integration uses **service accounts**, not OAuth user tokens. If a future enhancement adds per-user OAuth (allowing tenants to connect their personal Google Calendar via "Sign in with Google"), the following types would need to be added:

```typescript
// In server/src/types/prisma-json.ts
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number; // Unix timestamp in milliseconds
  token_type: 'Bearer';
  scope: string;
}

// Updated TenantSecrets:
export interface TenantSecrets {
  stripe?: EncryptedData;
  calendar?: EncryptedData; // Service account config (current)
  googleOauth?: EncryptedData; // OAuth tokens (future, if user-oauth is added)
}
```

The OAuth flow would also require new contract endpoints that do not exist yet:

```typescript
// These do NOT exist and would need to be added to packages/contracts/src/api.v1.ts:
tenantAdminInitiateCalendarOAuth; // GET    /v1/tenant-admin/calendar/oauth/start
tenantAdminCalendarOAuthCallback; // GET    /v1/tenant-admin/calendar/oauth/callback
tenantAdminRevokeCalendarOAuth; // DELETE /v1/tenant-admin/calendar/oauth/revoke
```

For the service account flow (current approach), no OAuth token types are needed. `TenantCalendarConfig` adequately represents what is stored.

---

## How Tenant Settings Data Flows Through the Type System

```
Request body (CalendarConfigInput from contracts)
    |
    v
route: calendarConfigSchema.safeParse(req.body)   [local schema -- see P2-2]
    |
    v
TenantCalendarConfig { calendarId, serviceAccountJson }  [adapter type -- see P2-3]
    |
    v
encryptionService.encryptObject<TenantCalendarConfig>()  -> EncryptedData
    |
    v
TenantSecrets.calendar = EncryptedData            [via index signature -- see P1-2]
    |
    v
prisma.tenant.update({ data: { secrets: updatedSecrets } })
    |
    v  (retrieval)
tenant.secrets as PrismaJson<TenantSecrets>       [cast -- no runtime validation]
    |
    v
encryptionService.decryptObject<TenantCalendarConfig>()  -> TenantCalendarConfig
    |
    v
GoogleCalendarAdapter.getConfigForTenant()        [converts to base64 for internal use]
    |
    v
GoogleCalendarSyncAdapter.createEvent / deleteEvent / getBusyTimes
```

**Key type-safety gaps in this flow:**

1. `JSON.parse` at decode sites returns `any` (P2-4)
2. `tenant.secrets` cast assumes shape without runtime validation (P1-2)
3. `TenantCalendarConfig` is not a port-level type (P2-3)
4. Duplicate validation schemas at contract vs route boundary (P2-2)

---

## Summary

| Severity | Count | Issues                                                                                                                                                                     |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | 2     | `_calendarProvider: unknown` in route factory; missing explicit `calendar` key in `TenantSecrets`                                                                          |
| P2       | 4     | Duplicate `TenantSecrets` in stripe service; duplicate validation schemas; `TenantCalendarConfig` not in ports; untyped `JSON.parse` of service account JSON at four sites |
| P3       | 4     | No frontend page or type consumers; `logger?: any` in express.d.ts; `isDateAvailable` port signature missing `tenantId`; triplicated decode blocks in sync adapter         |

**Priority fix order for calendar integration launch:** P1-2 then P1-1 then P2-3 then P2-4 then P2-2 then P2-1, then build the frontend page using the already-correct contract types.
