# Data Integrity Guardian: Google Calendar Integration Review

**Reviewed by:** data-integrity-guardian
**Date:** 2026-02-20
**Scope:** Prisma schema, credential storage, Google Calendar adapter/service, tenant isolation
**Focus:** Pre-integration data integrity assessment for Google Calendar OAuth

---

## Summary

| Severity                                                           | Count |
| ------------------------------------------------------------------ | ----- |
| P1 (Critical — data loss, silent double-booking, no recovery path) | 2     |
| P2 (High — integrity gap, type safety, cross-tenant risk)          | 3     |
| P3 (Low — memory, indexing, future-proofing)                       | 3     |

**Key context:** The MAIS codebase already has a Google Calendar integration using **service account** authentication (not OAuth user tokens). The service account stores its config (calendarId + serviceAccountJson) encrypted in `Tenant.secrets.calendar`. There are no OAuth tokens (access_token, refresh_token, expiry) in the schema today. If OAuth is adopted, this review details the schema changes needed.

---

## 1. Current Credential Storage Model

### Encryption Infrastructure

All tenant secrets use AES-256-GCM authenticated encryption via `EncryptionService` (`server/src/lib/encryption.service.ts`):

- Master key: `TENANT_SECRETS_ENCRYPTION_KEY` env var (64-char hex = 32 bytes)
- Random 16-byte IV per encryption call
- GCM auth tag prevents tampering
- Output format: `{ciphertext, iv, authTag}` all hex-encoded

This is the `EncryptedData` interface from `server/src/types/prisma-json.ts`.

### Secrets Storage Location

All per-tenant secrets are stored in a single `Tenant.secrets` Json column (Postgres `Json` type, default `{}`):

```prisma
// server/prisma/schema.prisma, line 82
secrets Json @default("{}") // {stripe: {ciphertext, iv, authTag}}
```

Runtime type (`server/src/types/prisma-json.ts`, line 116):

```typescript
export interface TenantSecrets {
  stripe?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}
```

The `calendar` key is used by `gcal.adapter.ts` but is NOT typed in this interface — only described in a code comment. This is the index signature `[key: string]: EncryptedData | undefined` that allows it.

---

## 2. How Stripe API Keys Are Stored

Stripe uses a **restricted key** pattern:

1. `tenant.stripeAccountId` — plaintext dedicated column (public identifier `acct_*`, not secret)
2. `tenant.stripeCustomerId` — plaintext dedicated column (public Stripe ID)
3. Stripe restricted key — encrypted in `tenant.secrets.stripe` as `EncryptedData`

Write path (`server/src/services/stripe-connect.service.ts`, line 226):

```typescript
const encrypted = encryptionService.encryptStripeSecret(restrictedKey);
// validates sk_test_* or sk_live_* format before encrypting
```

Read path: decrypts and re-validates format. This is the established pattern for any new secret.

---

## 3. Current Google Calendar Auth Model — Service Account

The existing integration uses **Google Service Account** auth (not OAuth user tokens). The service account contains a long-lived RSA private key that does not expire or need refresh.

Config stored encrypted in `tenant.secrets.calendar`:

```typescript
// server/src/adapters/gcal.adapter.ts, line 28-31
export interface TenantCalendarConfig {
  calendarId: string;
  serviceAccountJson: string; // Full service account JSON blob (~2KB)
}
```

Write path (`server/src/routes/tenant-admin-calendar.routes.ts`, line 140):

```typescript
const encrypted = encryptionService.encryptObject(calendarConfig);
// stored in tenant.secrets.calendar
```

Read path (`server/src/adapters/gcal.adapter.ts`, line 67-75):

```typescript
const decrypted = encryptionService.decryptObject<TenantCalendarConfig>(secrets.calendar);
```

Access tokens are generated **transiently** per API call via `createGServiceAccountJWT()` — they are never stored in the database.

---

## 4. Database Schema Changes Needed for Google Calendar OAuth

If the integration is changed to **OAuth 3-legged flow** (user grants access via Google consent screen), the following changes are needed. Service account auth does NOT need these changes.

### Option A: Extend `Tenant.secrets` JSON (no Prisma migration required)

Add a `googleOAuth` key to `TenantSecrets`:

```typescript
// server/src/types/prisma-json.ts
export interface TenantSecrets {
  stripe?: EncryptedData;
  calendar?: EncryptedData; // existing: service account config
  googleOAuth?: EncryptedData; // new: OAuth token bundle
  [key: string]: EncryptedData | undefined;
}
```

The `googleOAuth` value decrypts to:

```typescript
interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string; // long-lived; survives server restarts
  expiryEpochMs: number; // milliseconds since epoch (1 hour from issue)
  scope: string; // e.g. "https://www.googleapis.com/auth/calendar"
  tokenType: string; // always "Bearer"
}
```

**No migration needed** — `secrets` is already a Json column. The `calendar` key can coexist or be removed.

### Option B: Dedicated columns on `Tenant` model (for background refresh jobs)

If token expiry needs to be queried directly without decrypting all tenant secrets:

```prisma
// server/prisma/schema.prisma — add to Tenant model
// Google Calendar OAuth Integration
googleCalendarConnected Boolean   @default(false)  // Whether OAuth is linked
googleCalendarId        String?                     // Linked calendar (plaintext; public)
googleCalendarStatus    String?                     // 'active' | 'revoked' | 'error'
googleOAuthTokenExpiry  DateTime?                   // Plaintext expiry for background job queries
googleOAuthTokens       String?   @db.Text          // Encrypted JSON: {accessToken, refreshToken, scope}

@@index([googleCalendarConnected, googleOAuthTokenExpiry]) // Background refresh job
```

**Requires Prisma migration.** The `googleOAuthTokenExpiry` column is intentionally plaintext — querying it in a cron job (`WHERE googleOAuthTokenExpiry < NOW() + INTERVAL '5 minutes'`) requires it to be unencrypted. Only the token values are sensitive.

---

## 5. Data Integrity Concerns

### P1-A: No Token Refresh Infrastructure (CRITICAL if OAuth is adopted)

**Current state:** Service account auth has no expiry problem — the private key is indefinitely valid. If OAuth tokens are adopted, there is currently **no infrastructure** for:

- Detecting when an access token is expired before making a Google Calendar API call
- Refreshing via `https://oauth2.googleapis.com/token` using the refresh_token
- Re-encrypting and persisting the new access_token + expiry back to the database

**Risk:** Every Google Calendar API call will fail silently after 1 hour (OAuth access token TTL). The current adapter fail-open pattern returns `true` (date available) on any Google API error:

```typescript
// server/src/adapters/gcal.adapter.ts, line 177-180
logger.warn({ ... }, 'Google Calendar freeBusy API failed; assuming date is available');
const result = { available: true, timestamp: Date.now() };
this.cache.set(cacheKey, result);
return true;
```

This means **double-bookings can occur silently** if the OAuth token expires mid-session with no visible error to the tenant.

**Affected files:**

- `server/src/adapters/gcal.adapter.ts` — all 3 fetch call sites
- `server/src/adapters/google-calendar-sync.adapter.ts` — createEvent, deleteEvent, getBusyTimes

**Required fix for OAuth adoption:** Implement a `GoogleOAuthTokenManager` that:

1. Reads encrypted tokens from storage
2. Checks `expiryEpochMs - 60_000` (60s buffer before expiry)
3. Refreshes via Google OAuth endpoint if expired
4. Re-encrypts and writes new `accessToken` + `expiryEpochMs` back to database
5. Returns fresh access token to caller

### P1-B: Token Revocation Has No Recovery Path

**Current state:** If a tenant revokes MAIS's Google Calendar access from their Google Account settings, all subsequent API calls return `401 UNAUTHORIZED`. The adapter treats this identically to any other API error — log warning, return fail-open (`true` = available).

**Risk:** Calendar sync stops working silently. The tenant has no UI feedback. Availability checks return "available" for all dates regardless of real calendar state. The sync gap is invisible until a double-booking occurs.

**Affected logic:**

```typescript
// server/src/adapters/gcal.adapter.ts, line 171-179
if (!response.ok) {
  logger.warn({ status: response.status, error: errorText, ... },
    'Google Calendar freeBusy API failed; assuming date is available');
  // 401 (revoked) treated same as 503 (transient) — no distinction
}
```

**Required fix:**

- On `401` from any Google Calendar endpoint, set a `googleCalendarStatus = 'revoked'` or `googleCalendarConnected = false` flag
- Surface this in the tenant admin dashboard as a "Reconnect Google Calendar" banner
- Stop returning `available = true` for all dates when calendar is known to be disconnected — return `available = false` or surface an error

---

## 6. Multi-Tenant Isolation in Credential Storage

### Current State (Good)

The `tenant.secrets` column is scoped per tenant — all reads/writes go through `tenantRepo.findById(tenantId)` with the requesting tenant's own ID. There is no cross-tenant secrets access pattern.

The `Booking.googleEventId` write path uses `updateMany({ where: { tenantId, id: bookingId } })` — a stale or incorrect bookingId cannot update another tenant's booking (`server/src/adapters/prisma/booking.repository.ts`, line 450).

Calendar event creation/deletion pass `tenantId` through the full call chain for logging but do not use it to look up per-tenant config in `GoogleCalendarSyncAdapter` (see P2-B below).

### P2-A: Duplicate `TenantSecrets` Interface with Different Types

**Finding:** `TenantSecrets` is defined in two places with incompatible shapes:

1. `server/src/types/prisma-json.ts` (line 116) — **shared, authoritative**:

   ```typescript
   export interface TenantSecrets {
     stripe?: EncryptedData;
     [key: string]: EncryptedData | undefined;
   }
   ```

2. `server/src/services/stripe-connect.service.ts` (line 24) — **private local duplicate**:
   ```typescript
   interface TenantSecrets {
     stripe?: EncryptedData;
     [key: string]: unknown; // <-- different index signature
   }
   ```

The `[key: string]: unknown` vs `[key: string]: EncryptedData | undefined` divergence means `stripe-connect.service.ts` operates with looser type-checking. Any new key added to the shared interface (e.g., `googleOAuth`) will not be reflected in the private definition, creating a type safety gap.

**Risk:** When a developer adds `googleOAuth` to the shared `TenantSecrets` type, the `stripe-connect.service.ts` code could silently overwrite it via the `{ ...existingSecrets, stripe: encrypted }` spread — since the local type won't error on the missing field.

**Fix:** Delete the local `TenantSecrets` interface in `stripe-connect.service.ts` and import from `'../types/prisma-json'`.

### P2-B: `GoogleCalendarSyncAdapter` Uses Global Config for All Tenants

**Finding:** `GoogleCalendarSyncAdapter` stores the **global** service account credentials as instance variables (`this.calendarId`, `this.serviceAccountJsonBase64`) and uses them for all event creation, deletion, and FreeBusy calls — regardless of which tenant initiated the request.

The parent class `GoogleCalendarAdapter.getConfigForTenant()` correctly loads per-tenant config for `isDateAvailable()` checks, but `GoogleCalendarSyncAdapter`'s three event methods do NOT call `getConfigForTenant()`:

```typescript
// server/src/adapters/google-calendar-sync.adapter.ts, line 107-113
async createEvent(input: { tenantId: string; ... }) {
  const serviceAccountJson = JSON.parse(
    Buffer.from(this.serviceAccountJsonBase64, 'base64').toString('utf8')
    // ^ Always uses global credentials, ignores input.tenantId for config lookup
  );
}
```

**Risk:** In a multi-tenant deployment where each tenant has their own Google Calendar configured via the tenant admin calendar UI, events are written to the **global calendar** (the platform-level default), not the tenant's configured calendar. This is a functional data integrity bug — booking events end up in the wrong calendar for tenants with per-tenant config.

**Affected files:** `server/src/adapters/google-calendar-sync.adapter.ts` lines 107–113, 209–215, 292–297

**Fix:** Call `this.getConfigForTenant(input.tenantId)` at the start of each method and use the returned config instead of `this.serviceAccountJsonBase64`.

### P2-C: Service Account JSON Missing Required-Fields Validation

**Finding:** The calendar config save route validates that `serviceAccountJson` is valid JSON but does not validate that it contains `client_email` and `private_key`, which are required by `createGServiceAccountJWT()`:

```typescript
// server/src/routes/tenant-admin-calendar.routes.ts, lines 119-125
try {
  JSON.parse(serviceAccountJson); // only validates JSON syntax, not content
} catch {
  res.status(400).json({ error: 'Invalid service account JSON format' });
}
```

**Risk:** A tenant can save a JSON blob that passes validation but causes a runtime crash or authentication failure when `createGServiceAccountJWT` accesses `serviceAccountJson.client_email` (undefined) or `serviceAccountJson.private_key` (undefined). The error surfaces at the first calendar API call, not at config save time.

**Fix:**

```typescript
const parsed = JSON.parse(serviceAccountJson);
if (!parsed.client_email || typeof parsed.client_email !== 'string') {
  return res.status(400).json({ error: 'Invalid service account JSON: missing client_email' });
}
if (!parsed.private_key || typeof parsed.private_key !== 'string') {
  return res.status(400).json({ error: 'Invalid service account JSON: missing private_key' });
}
```

---

## 7. P3 Findings

### P3-A: In-Memory Availability Cache Grows Unboundedly

**Finding:** `GoogleCalendarAdapter` uses an in-memory `Map<string, CacheEntry>` for caching availability results. Cache keys are tenant-namespaced (`${tenantId}:${dateUtc}`), so there is no cross-tenant leak. However, there is **no eviction** — the cache grows indefinitely for the lifetime of the process:

```typescript
// server/src/adapters/gcal.adapter.ts, line 35-36
private cache = new Map<string, CacheEntry>();
private readonly CACHE_TTL_MS = 60_000;
```

Stale entries are only invalidated on re-read. With many tenants each checking many dates, the cache can hold O(tenants × days) entries permanently in memory.

**Risk:** Memory pressure under high load or many tenants. Not a data integrity issue, but worth noting for production deployment with 50+ tenants.

**Fix:** Use a TTL-aware cache library (e.g., `lru-cache` with `ttl` option) or add periodic cleanup: `setInterval(() => { const now = Date.now(); for (const [k, v] of this.cache) { if (now - v.timestamp > this.CACHE_TTL_MS) this.cache.delete(k); } }, 60_000)`.

### P3-B: `Booking.googleEventId` Lacks Composite Tenant Index

**Finding:** The schema indexes `googleEventId` globally:

```prisma
// server/prisma/schema.prisma, line 514
@@index([googleEventId])
```

The write path (`updateMany({ where: { tenantId, id: bookingId } })`) is tenant-safe. But any future query like "find booking by calendar event ID" (e.g., for a Google push notification webhook) would need a composite `(tenantId, googleEventId)` index to be efficient and enforce tenant isolation at the query level.

**Fix:** Add `@@index([tenantId, googleEventId])` if per-tenant lookups by event ID are planned. Non-urgent but should be added before implementing any Google push notification webhook handler.

### P3-C: `Tenant.secrets` JSON Column Has No Size Bound

**Finding:** The `Tenant.secrets` Json column has no size constraint at the database layer. Each new integration (Stripe, Google Calendar) adds ~2–3KB of encrypted data. The current cap is enforced only at the application layer for incoming service account JSON (`MAX_JSON_SIZE = 50 * 1024` in the calendar route) — not for the final encrypted blob stored in the DB.

**Risk:** Low in practice (Stripe key ~200 bytes encrypted, service account JSON ~4KB encrypted). But as integrations grow (Google Calendar OAuth, Zoom, etc.), the blob will approach multi-kilobyte territory. Worth noting for future schema design: if more than 5–6 integrations are stored here, consider a normalized `TenantIntegration` table.

---

## 8. Recommended Schema for OAuth Tokens (If Service Account Is Replaced)

**Preferred approach** — dedicated columns with mixed plaintext/encrypted storage:

```prisma
// server/prisma/schema.prisma — add to Tenant model
// Google Calendar OAuth (replaces service account if OAuth is adopted)
googleCalendarConnected  Boolean   @default(false)      // Is OAuth linked?
googleCalendarId         String?                         // Target calendar ID (plaintext; public)
googleCalendarStatus     String?                         // 'active' | 'revoked' | 'error'
googleOAuthTokenExpiry   DateTime?                       // Plaintext; queried by background refresh job
googleOAuthTokens        String?   @db.Text              // AES-256-GCM encrypted:
                                                          // {accessToken, refreshToken, scope, tokenType}

@@index([googleCalendarConnected, googleOAuthTokenExpiry]) // Background token refresh job
```

**Design rationale:**

- `googleOAuthTokenExpiry` is plaintext — a background refresh cron job needs `WHERE googleOAuthTokenExpiry < NOW() + INTERVAL '5 minutes'` without decrypting every tenant's secrets blob
- `googleCalendarStatus` is plaintext — needed for efficient health dashboard queries
- `googleOAuthTokens` is encrypted via the existing `EncryptionService` pattern; access_token and refresh_token are the only truly sensitive values
- This replaces the `tenant.secrets.calendar` key if OAuth replaces service accounts, or coexists with it if both modes are supported

---

## Files Reviewed

| File                                                  | Key Finding                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `server/prisma/schema.prisma`                         | Secrets storage, Booking.googleEventId, no OAuth fields         |
| `server/src/lib/encryption.service.ts`                | AES-256-GCM pattern — solid, reuse for OAuth tokens             |
| `server/src/types/prisma-json.ts`                     | TenantSecrets missing `calendar` explicit key; no `googleOAuth` |
| `server/src/services/stripe-connect.service.ts`       | Duplicate TenantSecrets interface (P2-A)                        |
| `server/src/adapters/gcal.adapter.ts`                 | Per-tenant config loading; fail-open on 401 (P1-B)              |
| `server/src/adapters/google-calendar-sync.adapter.ts` | Does not use per-tenant config (P2-B)                           |
| `server/src/adapters/gcal.jwt.ts`                     | Transient service account JWT — no storage                      |
| `server/src/services/google-calendar.service.ts`      | Graceful degradation facade — correct pattern                   |
| `server/src/routes/tenant-admin-calendar.routes.ts`   | Missing field-level JSON validation (P2-C)                      |
| `server/src/adapters/prisma/booking.repository.ts`    | updateGoogleEventId — tenant-scoped correctly                   |
| `server/src/adapters/prisma/tenant.repository.ts`     | Secrets read/write patterns — correct                           |
| `server/src/di.ts`                                    | Event subscription for calendar sync — correct tenant scoping   |
