---
title: 'fix: Customer chatbot session persistence, health check, and config bugs'
type: fix
status: completed
date: 2026-02-20
todos: 11022, 11023, 11024, 11026, 11027
---

# fix: Customer chatbot session persistence, health check, and config bugs

## Overview

Five interconnected bugs prevent the customer chatbot from recovering reliably after ADK cold starts, cause the health endpoint to lie about agent availability, and leave infrastructure config undocumented. Fixes are ordered by blast radius — session persistence first (compound failure loop), then operational correctness, then config.

**Scope:** `server/src/services/customer-agent.service.ts`, `server/src/routes/public-customer-chat.routes.ts`, `render.yaml`

---

## Root Cause Analysis

### The compound failure loop (11022 + 11023)

```
ADK cold start (15-min idle)
  → chat() sends message to stale session
  → ADK returns 404 / session-expired
  → retryWithNewADKSession() creates NEW session
  → stores new ADK session ID in local variable only   ← Bug 11022
  → retries the message successfully (works THIS time)
  → next message from same chat: DB still has OLD session ID
  → loops forever on every message                     ← consequence of 11022

If ADK was unreachable at createSession() time:
  → DB stores "local:customer:tenant:1234567890"       ← Bug 11023-A
  → chat() reads adkSessionId = "local:..." (truthy)
  → `if (!adkSessionId)` recovery guard is BYPASSED
  → sends "local:..." to ADK → guaranteed 404
  → retryWithNewADKSession() creates new session but never persists
  → permanent loop                                     ← 11022 + 11023 compound
```

---

## Fixes

### Fix 1 — 11022: Persist new ADK session ID in retryWithNewADKSession()

**File:** `server/src/services/customer-agent.service.ts`
**Location:** Inside `retryWithNewADKSession()`, after `newAdkSessionId` is set (~line 492)

**Before:**

```typescript
if (parseResult.success) {
  newAdkSessionId = parseResult.data.id;
  // nothing — new session ID lives in local var only
}
```

**After:**

```typescript
if (parseResult.success) {
  newAdkSessionId = parseResult.data.id;
  await this.prisma.agentSession.update({
    where: { id: dbSessionId },
    data: { adkSessionId: newAdkSessionId },
  });
  logger.info(
    { dbSessionId, newAdkSessionId },
    '[CustomerAgent] Persisted new ADK session ID after retry'
  );
}
```

**Why `dbSessionId` is available:** `retryWithNewADKSession()` already receives it as a parameter. This is the pattern already used in `createSession()` at lines 175–178.

---

### Fix 2 — 11023: Null fallback + local: prefix detection

**File:** `server/src/services/customer-agent.service.ts`

#### Change A — `createSession()` catch block (~line 158)

Store `null` instead of a truthy-but-invalid string:

**Before:**

```typescript
adkSessionId = `local:customer:${tenantId}:${Date.now()}`;
logger.warn(
  { tenantId, adkSessionId, error },
  '[CustomerAgent] Using local session (ADK unreachable)'
);
```

**After:**

```typescript
adkSessionId = null;
logger.warn(
  { tenantId, error },
  '[CustomerAgent] ADK unreachable during createSession — storing null; chat() will trigger recovery'
);
```

#### Change B — `chat()` after DB lookup (~line 259)

Sanitize any pre-existing `local:` values already in production DB:

**After retrieving `adkSessionId` from `sessionWithAdk`:**

```typescript
let adkSessionId = sessionWithAdk?.adkSessionId ?? null;
// Sanitize legacy fallback values (11023-B)
if (adkSessionId?.startsWith('local:')) {
  logger.warn(
    { adkSessionId },
    '[CustomerAgent] Found local: fallback in DB — treating as null for recovery'
  );
  adkSessionId = null;
}
```

This ensures the existing `if (!adkSessionId)` recovery guard fires correctly for both new and historical sessions.

---

### Fix 3 — 11024: Health check env var correctness

**File:** `server/src/routes/public-customer-chat.routes.ts`
**Location:** Health endpoint handler (~line 128)

**Before:**

```typescript
const apiKeyConfigured = !!getConfig().GOOGLE_VERTEX_PROJECT;
// ...
return { available: apiKeyConfigured && !!tenant };
```

**After:**

```typescript
const agentConfigured = !!getConfig().CUSTOMER_AGENT_URL;
// ...
return { available: agentConfigured && !!tenant };
```

Also rename all uses of `apiKeyConfigured` → `agentConfigured` within the handler (variable name only, no interface/contract changes needed).

**Why:** `GOOGLE_VERTEX_PROJECT` is the tenant AI feature config. `CUSTOMER_AGENT_URL` is the actual Cloud Run endpoint that chat depends on. If it's missing, every chat request fails — but the health endpoint was returning `available: true`.

**Test update:** Find the unit test covering the health endpoint. If the test checks that `GOOGLE_VERTEX_PROJECT` controls `available`, update the assertion to use `CUSTOMER_AGENT_URL`. If no test exists for this path, add a minimal one:

```typescript
// server/src/routes/__tests__/public-customer-chat.routes.test.ts
it('returns available: false when CUSTOMER_AGENT_URL is not set', async () => {
  // arrange: config without CUSTOMER_AGENT_URL
  // act: GET /v1/public/chat/health with valid tenant
  // assert: response.body.available === false
});
```

---

### Fix 4 — 11026: render.yaml missing agent env vars

**File:** `render.yaml`
**Location:** After the last env var entry (currently `GOOGLE_VERTEX_LOCATION`)

Add the following block:

```yaml
- key: BOOKING_TOKEN_SECRET
  sync: false # REQUIRED — server crashes at startup if unset (Zod min 32 chars)
- key: CUSTOMER_AGENT_URL
  sync: false # Cloud Run URL for customer-facing agent
- key: TENANT_AGENT_URL
  sync: false # Cloud Run URL for tenant admin agent
- key: RESEARCH_AGENT_URL
  sync: false # Cloud Run URL for web research agent (optional)
- key: GOOGLE_SERVICE_ACCOUNT_JSON
  sync: false # GCP service account JSON for Cloud Run auth (required on Render)
- key: GOOGLE_CLOUD_PROJECT
  sync: false # GCP project ID (e.g., handled-484216)
- key: GOOGLE_CLOUD_LOCATION
  sync: false # GCP region (e.g., us-central1)
```

**Why `sync: false`:** Render won't try to read values from a file. Secrets remain managed in the dashboard. This documents _which_ variables must exist without storing values in git — it's the IaC source-of-truth for disaster recovery and new developer onboarding.

---

### Fix 5 — 11027: Remove inner rate limiter (double rate limiting)

**File:** `server/src/routes/public-customer-chat.routes.ts`
**Location:** ~line 55 (definition) and ~line 104 (application)

**Remove** the `publicChatRateLimiter` definition and its `router.use()` call. The outer `customerChatLimiter` applied in `index.ts` at the mount point is the correct, visible location for this middleware.

```typescript
// DELETE these lines:
const publicChatRateLimiter = rateLimit({ ... });
// ...
router.use(publicChatRateLimiter);
```

**Why:** Both limiters run on every request. The outer one (`customerChatLimiter`: 20 req/min) is the tighter constraint, but both counters increment. The inner one adds middleware overhead and obscures the effective rate limit. Mount-point rate limiting is the conventional pattern in this codebase (see all other routes in `index.ts`).

---

## Implementation Order

1. Fix 11022 (DB persist on retry) — unblocks the retry path
2. Fix 11023 (null fallback + local: guard) — requires working retry path from Fix 1
3. Fix 11024 (health check) — independent, trivial
4. Fix 11026 (render.yaml) — independent, no-code change
5. Fix 11027 (rate limiter) — independent, trivial deletion

---

## Acceptance Criteria

- [x] `retryWithNewADKSession()` persists new `adkSessionId` to DB immediately after successful creation
- [x] Subsequent messages after a retry use the persisted ADK session without re-triggering retry
- [x] `createSession()` stores `null` (not `"local:..."`) when ADK is unreachable
- [x] `chat()` detects `local:` prefix values and treats them as null (recovery for existing production sessions)
- [x] `if (!adkSessionId)` recovery guard fires correctly in both new and historical cases
- [x] Health endpoint returns `available: false` when `CUSTOMER_AGENT_URL` is unset
- [x] Health endpoint unit test updated/written to cover `CUSTOMER_AGENT_URL` check
- [x] `render.yaml` documents all 7 agent env vars with `sync: false`
- [x] Only one rate limiter applies to `/v1/public/chat/*`
- [x] Full typecheck passes: `rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [x] All server tests pass: `npm run --workspace=server test`

---

## After Each Fix

```bash
npm run --workspace=server typecheck
npm run --workspace=server test -- --reporter=verbose src/services/__tests__/customer-agent.service.test.ts
```

---

## Commit & Archival

Single commit covering all 5 fixes:

```
fix(chatbot): persist ADK session on retry, null fallback, health check, render config, rate limit
```

Archive todos in the same commit:

```bash
mv todos/11022-pending-p1-chatbot-retry-doesnt-update-adk-session-id.md todos/archive/11022-complete-p1-chatbot-retry-doesnt-update-adk-session-id.md
mv todos/11023-pending-p1-chatbot-local-fallback-session-id-breaks-chat.md todos/archive/11023-complete-p1-chatbot-local-fallback-session-id-breaks-chat.md
mv todos/11024-pending-p1-chatbot-health-check-wrong-env-var.md todos/archive/11024-complete-p1-chatbot-health-check-wrong-env-var.md
mv todos/11026-pending-p1-render-yaml-missing-agent-env-vars.md todos/archive/11026-complete-p1-render-yaml-missing-agent-env-vars.md
mv todos/11027-pending-p2-chatbot-double-rate-limiting.md todos/archive/11027-complete-p2-chatbot-double-rate-limiting.md
```

---

## Deferred (Do Not Fix Now)

- **11025** — ADK Firestore sessions (replace in-memory ADK sessions with Firestore for persistence across Cloud Run instances) — medium effort, separate work
- **11028** — ADK connectivity smoke test (P3) — separate work

---

## Key Files

| File                                               | Purpose                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| `server/src/services/customer-agent.service.ts`    | Primary fix target (Fixes 1 + 2)                     |
| `server/src/routes/public-customer-chat.routes.ts` | Health check + rate limiter (Fixes 3 + 5)            |
| `render.yaml`                                      | IaC env var documentation (Fix 4)                    |
| `server/src/routes/index.ts`                       | Verify outer `customerChatLimiter` mount (reference) |
| `server/src/middleware/rateLimiter.ts`             | Verify `customerChatLimiter` definition (reference)  |
