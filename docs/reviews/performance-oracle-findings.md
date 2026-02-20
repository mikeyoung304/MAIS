# Performance Oracle Findings: Google Calendar Integration

**Reviewer:** performance-oracle
**Date:** 2026-02-20
**Scope:** Google Calendar integration performance review — pre-work for Google Calendar feature expansion

---

## Executive Summary

The existing Google Calendar integration has a solid foundation with in-process caching for `isDateAvailable` (60s TTL) and Redis-backed caching for `getBusyTimes` (5 min TTL). However, there are critical issues that will cause silent performance degradation under load:

- **P1 (2 findings):** No HTTP timeout on any Google API call; OAuth access tokens fetched per-call with no caching
- **P2 (2 findings):** Missing `tenantId` in `AvailabilityService` calendar call (cache collision + wrong calendar risk); no retry/backoff for 429 or 5xx
- **P3 (3 findings):** In-process Map not shared across replicas; agent booking loop is sequential; tenant config DB query on every cache miss

**Stripe contrast:** `StripePaymentAdapter` uses `maxNetworkRetries: 3` (built into SDK), handles timeout internally, and uses idempotency keys. The Google Calendar adapter has none of these patterns and must implement them manually.

---

## P1 -- Critical Issues (Must Fix Before Expanding Calendar Feature)

### P1-1: No HTTP Timeout on Any Google API Call

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts` line 158
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts` lines 146, 220, 309
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.jwt.ts` line 54
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts` line 259

**Problem:** Every `fetch()` call to `googleapis.com/calendar/v3/freeBusy`, `googleapis.com/calendar/v3/calendars/.../events`, and `oauth2.googleapis.com/token` has no timeout. Node.js default `fetch()` timeout is infinite. A single network partition or Google API brownout causes:

1. The booking availability check hangs indefinitely, blocking the HTTP response
2. `getAvailableSlots` in the booking flow hangs, stalling all slot queries for that service
3. The agent availability range loop (`internal-agent-booking.routes.ts` lines 229–244) iterates N dates sequentially — one hanging call blocks the entire range response

The specific call sites with no timeout:

```typescript
// gcal.adapter.ts line 158 — NO AbortSignal
const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ ... }),
});

// gcal.jwt.ts line 54 — NO AbortSignal (token exchange also unbounded)
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  ...
});
```

**Pattern to follow:** Node.js 20+ `fetch()` supports `AbortSignal.timeout(ms)`:

```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(10_000), // 10 second hard timeout
  ...
});
```

**Affected paths (all without timeout):**

- `isDateAvailable` — in the DATE booking availability check critical path
- `getBusyTimes` — in the TIMESLOT slot generation critical path
- `createEvent` — called async after payment (non-blocking, but still should not hang)
- `deleteEvent` — called async on cancellation (non-blocking)
- Token exchange in `createGServiceAccountJWT` — called before every API operation

**Fix:** Add `signal: AbortSignal.timeout(10_000)` to all 5 `fetch()` call sites across `gcal.adapter.ts`, `google-calendar-sync.adapter.ts`, `gcal.jwt.ts`, and `tenant-admin-calendar.routes.ts`.

---

### P1-2: OAuth Access Token Fetched on Every API Call — No Token Caching

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.jwt.ts` — `createGServiceAccountJWT` always makes a fresh `fetch` to `oauth2.googleapis.com/token`
- Call sites: `gcal.adapter.ts` line 150, `google-calendar-sync.adapter.ts` lines 113, 215, 297

**Problem:** Every Google Calendar operation independently calls `createGServiceAccountJWT`, which makes a network round trip to `oauth2.googleapis.com/token`. The JWT payload sets `exp: now + 3600` (1 hour validity), but the returned access token is never cached.

**Per-operation overhead:**

- `isDateAvailable` = 1 token fetch (~200-500ms) + 1 freeBusy call (~200-500ms) = 2 RTTs minimum
- `getBusyTimes` = 1 token fetch + 1 freeBusy call = 2 RTTs
- `createEvent` = 1 token fetch + 1 events.insert call = 2 RTTs
- `deleteEvent` = 1 token fetch + 1 events.delete call = 2 RTTs

For the agent availability range loop (7-day range, cold cache): 7 sequential `getAvailableSlots` calls each triggering `getBusyTimes` = **14 network RTTs to Google**, where 7 are unnecessary token fetches.

**Google rate limit risk:** Google Calendar API enforces quota of 1,000,000 requests/day per project. Token exchange calls count against a separate OAuth quota. Fetching tokens per-request doubles effective API call count without any business value.

**Token caching is safe:** Service account tokens are valid for 3600 seconds. A correct cache:

```typescript
// Cache key: serviceAccountEmail + scopes hash
// Cache value: { accessToken: string, expiresAt: number }
// TTL: token_expiry - 5 minutes (early refresh)
private tokenCache = new Map<string, { token: string; expiresAt: number }>();
```

This is safe because:

1. Service account credentials are static per tenant
2. Google access tokens are not per-user (they represent the service account itself)
3. The 5-minute early-refresh buffer handles clock skew

**Fix:** Add token caching to `createGServiceAccountJWT` in `gcal.jwt.ts`, or move caching into the adapter class itself (preferred — the adapter already has `private cache = new Map()`).

---

## P2 -- Moderate Issues (Should Fix Before Going Wider)

### P2-1: `AvailabilityService.checkAvailability` Drops `tenantId` from Calendar Call

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/availability.service.ts` line 55

**Problem:** `checkAvailability(tenantId, date)` correctly scopes `blackoutRepo` and `bookingRepo` to `tenantId`, but passes `isDateAvailable(date)` **without** `tenantId`:

```typescript
// availability.service.ts lines 53-56 — tenantId is NOT passed to calendar
const [isBooked, isCalendarAvailable] = await Promise.all([
  this.bookingRepo.isDateBooked(tenantId, date),
  this.calendarProvider.isDateAvailable(date), // missing tenantId
]);
```

The `GoogleCalendarAdapter.isDateAvailable(dateUtc, tenantId?)` implementation supports `tenantId` as an optional second argument, but when omitted:

1. **Cache key collision:** Uses `dateUtc` as cache key instead of `tenantId:dateUtc`. In a multi-tenant deployment with a shared global adapter instance, tenant A's cached result for "2025-06-15" is served to tenant B — cross-tenant cache pollution.
2. **Wrong calendar used:** `getConfigForTenant(tenantId)` is never called, so per-tenant calendar config stored in `tenant.secrets` is bypassed. The global `GOOGLE_CALENDAR_ID` env var is used instead, meaning all tenants share one calendar for DATE availability checks.
3. **Port interface gap:** The `CalendarProvider` port in `calendar.port.ts` defines `isDateAvailable(date: string)` without `tenantId`. The tenantId overload only exists on the concrete implementation. Callers using the port interface cannot pass tenantId.

**Note:** This only affects the DATE booking path (`AvailabilityService`). The TIMESLOT path via `SchedulingAvailabilityService.filterGoogleCalendarConflicts` correctly passes `tenantId` to `getBusyTimes`. The inconsistency means per-tenant calendar isolation works for appointments but not for wedding/date bookings.

**Fix:**

1. Update `CalendarProvider` port in `calendar.port.ts` to `isDateAvailable(date: string, tenantId?: string): Promise<boolean>`
2. Update `AvailabilityService.checkAvailability` to pass `tenantId` to `isDateAvailable`

---

### P2-2: No Retry/Backoff for Google API 429 or 5xx — Failures Cache as "Available"

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts` lines 171–199
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts` lines 157–170, 317–331

**Problem:** When Google Calendar API returns a non-2xx response, the adapters immediately:

1. Log a warning
2. Cache the failure as `{ available: true }` with the full 60s TTL
3. Return `true` (all dates available) as graceful degradation

```typescript
// gcal.adapter.ts lines 171-179
if (!response.ok) {
  const errorText = await response.text().catch(() => '');
  logger.warn({ status: response.status, error: errorText, ... });
  const result = { available: true, timestamp: Date.now() }; // caches failure
  this.cache.set(cacheKey, result);
  return true; // silent false positive
}
```

**Specific failure modes:**

- **429 (Rate Limited):** Google returns `Retry-After` header with seconds to wait. Current code ignores this header and caches "available=true" for 60s. The rate limit problem is invisible to monitoring — no metric increments, no circuit breaking.
- **503/500 (Transient):** A momentary Google outage caches incorrect "available" results. Once Google recovers, the cached stale result persists for up to 60 more seconds. Bookings made during this window may double-book calendar events.
- **Token exchange 401:** If service account credentials expire or are revoked, `createGServiceAccountJWT` throws. The outer `catch` in `isDateAvailable` (lines 192–200) catches this and also returns `true`. There is no alert, no metric, no visibility.

**Contrast:** `PostmarkMailAdapter` (same `fetch`-based pattern) correctly implements:

- `isRetryableError()` checking 429, ECONNRESET, ETIMEDOUT, 5xx
- `sendWithRetry()` with exponential backoff (1s, 2s base delay) up to 3 attempts

`StripePaymentAdapter` uses `maxNetworkRetries: 3` at the SDK level.

**Fix:** Before caching and returning the fallback, attempt 1 retry for 429 (honoring `Retry-After` header if present) and transient 5xx. Do not cache error responses — only cache successful responses. Match the `PostmarkMailAdapter.sendWithRetry` pattern.

---

## P3 -- Lower Priority Optimizations

### P3-1: In-Process Map Cache for `isDateAvailable` Not Shared Across Replicas

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts` lines 34–35

**Problem:** `GoogleCalendarAdapter` maintains `private cache = new Map<string, CacheEntry>()`. This is an instance-level in-process Map. Each server replica has its own independent cache — under horizontal scaling or multiple dynos, the 60s deduplication provides no cross-instance benefit.

In contrast, `SchedulingAvailabilityService.filterGoogleCalendarConflicts` correctly uses `CacheServicePort` (Redis in production) with key `gcal-busy:{tenantId}:{date}` at 5 min TTL. This inconsistency:

- `isDateAvailable` path: in-process Map (not shared)
- `getBusyTimes` path: Redis via `CacheServicePort` (shared)

Under a booking spike (many users viewing availability simultaneously), each replica independently calls Google Calendar for the same `{tenantId}:{date}` key, multiplying API calls by replica count.

**Fix:** Inject `CacheServicePort` into `GoogleCalendarAdapter` (it already accepts `tenantRepo` as optional — same pattern). Cache key: `gcal-avail:{tenantId}:{dateUtc}` with 60s TTL.

---

### P3-2: Agent Booking Range Loop Calls `getAvailableSlots` Sequentially

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/internal-agent-booking.routes.ts` lines 229–244

**Problem:** The agent availability endpoint iterates a date range day-by-day in a sequential `for` loop:

```typescript
// internal-agent-booking.routes.ts lines 229-244
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const daySlots = await schedulingAvailabilityService.getAvailableSlots({  // sequential
    tenantId,
    serviceId,
    date: new Date(d),
  });
  ...
}
```

Each `getAvailableSlots` call may trigger `getBusyTimes` to Google Calendar on cache miss. For a 7-day range on cold cache: 7 sequential network round trips. Even with the 5-minute Redis cache, any range spanning multiple uncached days compounds latency additively.

**Note:** `getNextAvailableSlot` in `SchedulingAvailabilityService` was already explicitly optimized (comment: "PERFORMANCE FIX P2 #053") to batch-fetch all bookings and rules in 2 queries. The agent booking route does not apply that same optimization for the calendar path.

**Fix:** Use `Promise.all` to parallelize `getBusyTimes` calls across the date range (pre-warm the cache for all dates), then generate slots in memory. This is a P3 because the Redis cache means warm-cache requests are already fast.

---

### P3-3: `getConfigForTenant` DB Query on Every `isDateAvailable` Cache Miss

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts` lines 52–106

**Problem:** On every `isDateAvailable` in-process cache miss, `getConfigForTenant(tenantId)` calls `this.tenantRepo.findById(tenantId)` — a database round trip — to load the tenant's encrypted calendar config. This adds 1 DB query to the critical availability check path on every cold cache entry.

The tenant's calendar configuration (`calendarId`, service account JSON) changes only when the tenant updates it via `POST /v1/tenant-admin/calendar/config`. Between updates, the config is static.

Under concurrent booking spikes where the in-process cache expires simultaneously (e.g., 60+ concurrent users viewing the same date), all requests may miss the in-process cache and all hit DB before the first Google API response returns.

**Fix:** Cache `getConfigForTenant` result in-process with a 5-minute TTL. Cache key: `tenant-cal-config:{tenantId}`. Invalidate on `POST /v1/tenant-admin/calendar/config` and `DELETE /v1/tenant-admin/calendar/config`. This reduces steady-state DB load for calendar availability checks to zero additional queries.

---

## Summary Table

| #   | Severity | Issue                                                                                         | Primary File                            |
| --- | -------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | P1       | No HTTP timeout on Google API calls — event loop can hang indefinitely                        | `gcal.adapter.ts:158`, `gcal.jwt.ts:54` |
| 2   | P1       | OAuth token fetched per-call, not cached — double RTT on every operation                      | `gcal.jwt.ts` (all 4 call sites)        |
| 3   | P2       | `AvailabilityService.checkAvailability` omits tenantId — cache key collision + wrong calendar | `availability.service.ts:55`            |
| 4   | P2       | No retry/backoff on 429 or 5xx — failures cache as "available", quota exhaustion invisible    | `gcal.adapter.ts:171-199`               |
| 5   | P3       | In-process Map for `isDateAvailable` not shared across replicas                               | `gcal.adapter.ts:34`                    |
| 6   | P3       | Agent booking range loop sequential — cold cache adds N×RTT to response                       | `internal-agent-booking.routes.ts:229`  |
| 7   | P3       | `getConfigForTenant` DB query on every cache miss, no config caching                          | `gcal.adapter.ts:52-106`                |

**Total: 2 P1, 2 P2, 3 P3**

---

## Fix Priority Order

**Do first (production correctness and safety):**

1. F3 — Pass `tenantId` to `isDateAvailable` in `AvailabilityService` (1-line fix at `availability.service.ts:55`, update port signature)
2. F1 — Add `AbortSignal.timeout(10_000)` to all `fetch()` calls across Google Calendar adapters and `gcal.jwt.ts`
3. F2 — Cache OAuth access tokens in-process (cache key = serviceAccountEmail + scopes, TTL = 55 minutes)

**Do second (production resilience before scale):** 4. F4 — Add retry logic for 429/5xx in `isDateAvailable` and `getBusyTimes`, do not cache error responses

**Do eventually (scale optimization):** 5. F7 — Cache `getConfigForTenant` result with 5-minute TTL 6. F5 — Move `isDateAvailable` cache to `CacheServicePort` (Redis) for cross-instance deduplication 7. F6 — Parallelize agent availability range fetch with `Promise.all`

---

## Comparison: Stripe vs Google Calendar Adapter Maturity

| Feature                     | Stripe Adapter                   | Google Calendar Adapter           |
| --------------------------- | -------------------------------- | --------------------------------- |
| HTTP timeout                | Yes (SDK manages internally)     | No — **P1**                       |
| Retry on transient failures | Yes (SDK `maxNetworkRetries: 3`) | No — **P2**                       |
| Auth token caching          | N/A (static API key)             | No — **P1**                       |
| Rate limit handling (429)   | Yes (SDK auto-retries)           | No — **P2**                       |
| Idempotency keys            | Yes (all mutations)              | Not implemented for `createEvent` |
| Cross-instance caching      | N/A                              | No (in-process Map only) — **P3** |

The Stripe SDK abstracts HTTP resilience. For direct `fetch()`-based Google API calls, these must be implemented manually. The `postmark.adapter.ts` demonstrates the correct manual pattern for retry/backoff — apply the same pattern to the Google Calendar adapters.
