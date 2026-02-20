# Security Sentinel Findings: Google Calendar Integration Pre-Review

**Reviewer:** security-sentinel
**Date:** 2026-02-20
**Scope:** Credential storage patterns, existing third-party integration security, gaps for Google Calendar OAuth
**Context:** Preparing to add Google Calendar OAuth (refresh token) integration for tenants

---

## Executive Summary

The existing service-account-based Google Calendar integration has a solid encryption foundation (AES-256-GCM via `EncryptionService`, stored in `Tenant.secrets` JSON). However, adding **OAuth 2.0 with refresh tokens** introduces a meaningfully different threat model from service accounts. Six issues span from a critical scope gap in the sync adapter (P1) to missing audit trails (P2) and minor validation gaps (P3).

---

## Findings

### P1 — Over-broad Calendar Scope in Sync Adapter

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts`
**Lines:** 113, 215, 297
**Severity:** P1

The `GoogleCalendarSyncAdapter` requests the full `https://www.googleapis.com/auth/calendar` scope for all three operations (create event, delete event, get busy times). The `getBusyTimes()` method only needs `calendar.readonly`. Requesting write scope for a read-only operation violates the principle of least privilege and means a compromised service account credential has unnecessary write access to the entire calendar.

The `/test` endpoint in `tenant-admin-calendar.routes.ts` (line 255) correctly uses `calendar.readonly` — the sync adapter's `getBusyTimes` should do the same.

**For OAuth:** When adding OAuth refresh tokens, this becomes more critical. Scopes are baked into the refresh token at consent time and cannot be narrowed later without re-authorizing the user. Requesting `auth/calendar` (full write) instead of `auth/calendar.readonly` during the OAuth consent screen will cause tenants to see a broader permission warning and the scope cannot be narrowed without a new OAuth flow.

**Recommendation:** Change `getBusyTimes()` in `google-calendar-sync.adapter.ts` to use `calendar.readonly`. Define scope constants to prevent future drift between methods.

---

### P2 — Webhook HMAC Signing Secret Stored in Plaintext

**File:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`
**Line:** 817 (`secret String`)
**Severity:** P2

The `WebhookSubscription.secret` field is stored as a plain `String` in PostgreSQL. This is a cryptographic HMAC signing secret generated at subscription creation via `crypto.randomBytes(32).toString('hex')` in `tenant-admin-webhooks.routes.ts` (line 146). It should be encrypted at rest like Stripe and Calendar credentials are, using `EncryptionService`. A database read — whether via SQL injection, accidental log exposure, or backup access — exposes the HMAC signing secret directly, enabling an attacker to forge webhook payloads for any tenant.

In contrast, Stripe restricted keys (`Tenant.secrets.stripe`) and Calendar service account JSON (`Tenant.secrets.calendar`) are both AES-256-GCM encrypted before storage.

**Recommendation:** Encrypt the `secret` field in `WebhookSubscription` before persistence and decrypt on retrieval, or store it in `Tenant.secrets` keyed by subscription ID, matching the established secrets namespace pattern.

---

### P2 — No Audit Trail for Calendar Credential Changes

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`
**Lines:** 149-151 (POST /config), 189-191 (DELETE /config)
**Severity:** P2

The `POST /config` and `DELETE /config` calendar routes write and delete encrypted service account credentials with no entry in `ConfigChangeLog`. These operations are only written to the application logger (`logger.info`). If a credential is compromised or changed maliciously by an attacker who obtains a session token, there is no audit record with user attribution, before/after snapshots, or timestamp in the structured audit table.

Branding and tier changes use `ConfigChangeLog` for audit attribution. Calendar credentials store credentials of equivalent sensitivity.

**Recommendation:** Add `ConfigChangeLog` entries for calendar config save and delete operations. Include `entityType: 'CalendarConfig'`, `operation: 'update'` or `'delete'`, `entityId: tenantId`, and explicitly omit the credential ciphertext from the snapshot.

---

### P2 — Stripe `deleteConnectedAccount` Clears ALL Secrets Including Calendar

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`
**Line:** 354 (`secrets: {}`)
**Severity:** P2

When `deleteConnectedAccount()` is called, it sets `secrets: {}`, which clears the entire `Tenant.secrets` JSON object. This silently deletes the Calendar service account JSON stored at `secrets.calendar`. A tenant who disconnects Stripe inadvertently loses their Google Calendar integration without warning or any recovery path. After OAuth is added, this will also silently delete OAuth refresh tokens.

The `TenantSecrets` type in `/server/src/types/prisma-json.ts` is designed as a keyed namespace (`stripe`, `calendar`, and future `googleOAuth` keys) supporting independent integrations. `deleteConnectedAccount` does not respect that contract.

**Recommendation:** Change `deleteConnectedAccount` to perform a scoped delete that removes only `secrets.stripe`, preserving other keys. Use destructuring similar to the calendar DELETE route (line 187: `const { calendar: _calendar, ...remainingSecrets } = currentSecrets`).

---

### P2 — Encryption Key Validation Mismatch Between Schema and Runtime

**Files:** `/Users/mikeyoung/CODING/MAIS/server/src/config/env.schema.ts` (line 59) vs `/Users/mikeyoung/CODING/MAIS/server/src/lib/encryption.service.ts` (lines 35-48)
**Severity:** P2

`env.schema.ts` validates `TENANT_SECRETS_ENCRYPTION_KEY` with `.min(32)`. The `EncryptionService` constructor requires exactly a **64-character hex string** (32 bytes). A value of 32-63 characters passes schema validation but throws a runtime `Error` when the encryption service initializes, producing a confusing startup failure rather than a clear config validation error at boot.

There is also a schema in `lib/core/config.ts` (line 142) where the key is declared with only `z.string().optional()` — no length constraint at all.

**For OAuth:** The same `TENANT_SECRETS_ENCRYPTION_KEY` will encrypt OAuth refresh tokens. This mismatch means a misconfigured key can appear valid during schema validation but fail at runtime only when the first encryption is attempted.

**Recommendation:** Tighten `env.schema.ts` to `.length(64).regex(/^[0-9a-f]{64}$/i, 'Must be 64-character hex string')`. Update `config.ts` to match with the same constraint.

---

### P3 — Service Account JSON Structure Not Validated at API Boundary

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`
**Lines:** 119-126
**Severity:** P3

`POST /v1/tenant-admin/calendar/config` validates that `serviceAccountJson` is valid JSON and within 50 KB, but does not validate that it contains the required Google service account fields (`type: "service_account"`, `client_email`, `private_key`). Invalid service account JSON is encrypted and stored successfully, then only fails later when the adapter attempts to use it. This leads to a poor UX where config is confirmed saved but silently broken, and wastes a full decrypt and API call cycle to surface the error.

**Recommendation:** Add structural validation before encryption:

```typescript
const parsed = JSON.parse(serviceAccountJson);
if (parsed.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
  res.status(400).json({
    error:
      'Invalid service account JSON: missing required fields (type, client_email, private_key)',
  });
  return;
}
```

---

## Google Calendar OAuth Gap Analysis (For Upcoming Work)

The current architecture uses **service account** credentials (tenant provides a service account JSON file and shares their calendar with the service account). When moving to **OAuth 2.0** (tenant authorizes via Google consent screen), the following security requirements are new and must be designed for:

### OAuth State Parameter (CSRF Prevention) — Required

OAuth authorization requests MUST include a `state` parameter containing a bound, unguessable nonce. No existing OAuth implementation exists in the codebase. This is a new flow requiring:

1. Server generates `state = crypto.randomBytes(32).toString('hex')`
2. Store `state` in a short-lived signed JWT (bound to `tenantId`, TTL 10 minutes)
3. Verify `state` in the OAuth callback before accepting the `code`

Without this, a CSRF attack can link an attacker's Google account to a victim tenant's credentials by tricking the victim's browser into completing an OAuth callback from an attacker-initiated flow.

### Refresh Token Storage — Required

OAuth refresh tokens are long-lived credentials equivalent in sensitivity to Stripe secret keys. They MUST be encrypted before storage. The existing `EncryptionService.encryptObject()` is the correct tool — store under `Tenant.secrets.googleOAuth` using the same AES-256-GCM pattern as `secrets.stripe` and `secrets.calendar`. Never log refresh tokens or include them in API responses.

### Token Rotation — Required

Google rotates refresh tokens when `access_type=offline` and a new consent is granted for an already-authorized app. The storage layer must overwrite the old refresh token atomically. A race condition where two concurrent requests both refresh and one stores a stale (now-invalid) token will silently break the integration until the tenant re-authorizes. Use `UPDATE WHERE tenantId = ?` to atomically replace the stored token.

### Scope Minimization at Consent — Required

If tenants only need free/busy data, request only `calendar.readonly`. If they need event creation for booking sync, request `auth/calendar.events`. Never request the full `auth/calendar` scope unless write access to all calendar operations is genuinely needed. Scope is permanently baked into the refresh token at consent time and cannot be narrowed without re-authorization.

### Revocation Handling — Required

When a tenant disconnects their Google Calendar:

1. Call `https://oauth2.googleapis.com/revoke?token={refresh_token}` to revoke server-side
2. Delete `secrets.googleOAuth` from the database atomically
3. The Stripe `deleteConnectedAccount` bug (P2 above) must be fixed first, or disconnecting Stripe will silently delete the OAuth refresh token too

### Token Refresh Concurrency — Important

Access tokens expire after 1 hour. Under concurrent requests (multiple simultaneous availability checks), all requests may attempt to refresh simultaneously, causing token invalidation. Implement a simple in-process or Redis-based lock around the refresh flow to ensure only one refresh runs at a time per tenant.

---

## What Is Already Correct

The following patterns are well-implemented and should be used as the model for OAuth:

- `EncryptionService`: AES-256-GCM with random IV per encryption, authentication tag verification — correct implementation with good key validation at service level
- Calendar service account JSON is encrypted before storage, never returned in API responses (only masked `calendarId` returned)
- `Tenant.secrets` is a keyed namespace (not flat), supporting multiple independent integrations without interference
- `tenant-admin-calendar.routes.ts` uses `tenantAuth` from JWT middleware — tenant isolation is correctly enforced on all routes
- `updateGoogleEventId` uses `updateMany` with both `tenantId` and `bookingId` in the where clause — correctly tenant-scoped
- The `/test` connection endpoint uses minimal `calendar.readonly` scope (the sync adapter should match this)
- Size cap on service account JSON (50 KB) prevents memory exhaustion
- Rate limiting via `tenantAuthMiddleware` is applied to all `/v1/tenant-admin/*` routes

---

## Summary Table

| #   | Severity | File                                             | Issue                                                          |
| --- | -------- | ------------------------------------------------ | -------------------------------------------------------------- |
| 1   | P1       | `google-calendar-sync.adapter.ts:113,215,297`    | Full calendar write scope used for read-only `getBusyTimes`    |
| 2   | P2       | `schema.prisma:817`                              | WebhookSubscription HMAC secret stored in plaintext            |
| 3   | P2       | `tenant-admin-calendar.routes.ts:149,189`        | No audit trail for calendar credential changes                 |
| 4   | P2       | `stripe-connect.service.ts:354`                  | `deleteConnectedAccount` clears all secrets including calendar |
| 5   | P2       | `env.schema.ts:59` vs `encryption.service.ts:35` | Encryption key validation weaker than runtime requirement      |
| 6   | P3       | `tenant-admin-calendar.routes.ts:119`            | Service account JSON structure not validated at API boundary   |

**Finding counts: P1=1, P2=4, P3=1**
