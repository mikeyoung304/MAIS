---
title: Customer Chatbot End-to-End Audit
date: 2026-02-20
severity: mixed (1 confirmed resolved P1, 4 confirmed active bugs, 3 risks)
scope: full stack — render.yaml, cloud-run-auth, chat routes, agent deploy, frontend
---

# Customer Chatbot End-to-End Audit

Audit of the customer-facing chatbot across the full stack. The working theory
(CUSTOMER_AGENT_URL + GOOGLE_SERVICE_ACCOUNT_JSON missing + lying health check) was
partially correct. Full findings below.

---

## Summary: 8 Findings

| #   | Severity | Status     | Finding                                                                                      |
| --- | -------- | ---------- | -------------------------------------------------------------------------------------------- |
| 1   | P1       | RESOLVED   | CUSTOMER_AGENT_URL missing from Render — was added manually post-deploy                      |
| 2   | P2       | ACTIVE BUG | Health check lies: checks GOOGLE_VERTEX_PROJECT, not CUSTOMER_AGENT_URL                      |
| 3   | P2       | ACTIVE BUG | BOOKING_TOKEN_SECRET absent from render.yaml — server will crash at startup                  |
| 4   | P2       | ACTIVE BUG | GOOGLE_SERVICE_ACCOUNT_JSON missing from render.yaml — Cloud Run auth falls silent           |
| 5   | P2       | ACTIVE BUG | appName mismatch: service sends 'agent', agent defines name: 'customer'                      |
| 6   | P3       | RISK       | NEXT_PUBLIC_API_URL not in render.yaml — chat widget defaults to localhost:3001 in prod      |
| 7   | P3       | RISK       | Storefront page renders TenantChatWidget only through TenantSiteShell, not page.tsx directly |
| 8   | INFO     | OK         | Tool exports, error handling chain, and session management are correct                       |

---

## Finding 1 — CUSTOMER_AGENT_URL was missing from render.yaml [P1, RESOLVED]

**File:** `/Users/mikeyoung/CODING/MAIS/render.yaml`

The `render.yaml` blueprint ends at line 55 with `GOOGLE_VERTEX_LOCATION` and does not
include `CUSTOMER_AGENT_URL`, `TENANT_AGENT_URL`, `RESEARCH_AGENT_URL`, or
`GOOGLE_SERVICE_ACCOUNT_JSON`.

```yaml
# render.yaml stops here — no agent URLs, no service account
- key: GOOGLE_VERTEX_LOCATION
  sync: false
```

Per commit `f2acaa63` and the compound solution at
`docs/solutions/runtime-errors/null-tiers-crash-and-chat-env-var.md`, this was the
confirmed root cause of the chatbot being completely offline. The fix was manually adding
`CUSTOMER_AGENT_URL` in the Render dashboard (not in render.yaml). This means any new
environment provisioned from the blueprint will be broken out of the box.

**Status:** Fixed in production (manual dashboard override), but blueprint is still wrong.
A future re-provisioning or new environment will break again.

**Fix required:** Add all three agent URLs to `render.yaml` as `sync: false` entries.

---

## Finding 2 — Health endpoint checks GOOGLE_VERTEX_PROJECT, not CUSTOMER_AGENT_URL [P2, ACTIVE]

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-customer-chat.routes.ts`, line 128

```typescript
// Line 128 — this is what the health check actually validates
const apiKeyConfigured = !!getConfig().GOOGLE_VERTEX_PROJECT;
```

The health check reports `available: true` when `GOOGLE_VERTEX_PROJECT` is set, even if
`CUSTOMER_AGENT_URL` is absent. In practice, the agent service is what needs to be
reachable — Vertex AI credentials are irrelevant to the chat proxy path (the Cloud Run
agent manages its own Vertex auth). A tenant will see a green health check and open the
widget, only for the first real message to return "Connection issue."

The correct check should be:

```typescript
const agentConfigured = !!getConfig().CUSTOMER_AGENT_URL;
```

Or better: do an actual HEAD/ping to the Cloud Run endpoint (with caching) so the health
response reflects true agent reachability.

---

## Finding 3 — BOOKING_TOKEN_SECRET absent from render.yaml [P2, ACTIVE]

**File:** `/Users/mikeyoung/CODING/MAIS/render.yaml`
**Config schema:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/core/config.ts`, line 42-49

`BOOKING_TOKEN_SECRET` is declared as a required field (no `.optional()`) with a minimum
length of 32 characters:

```typescript
BOOKING_TOKEN_SECRET: z
  .string()
  .min(32, 'BOOKING_TOKEN_SECRET must be at least 32 characters...')
  .describe('Required for booking management tokens...'),
```

If this is not set in the Render dashboard, `loadConfig()` will throw at server startup and
the entire API will be down — not just the chatbot. This is not listed anywhere in
`render.yaml` as a reminder to configure it.

**Note:** It may already be set manually in the Render dashboard (same pattern as
CUSTOMER_AGENT_URL), but the blueprint provides no safety net.

---

## Finding 4 — GOOGLE_SERVICE_ACCOUNT_JSON missing from render.yaml [P2, ACTIVE]

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/services/cloud-run-auth.service.ts`, line 49
- `/Users/mikeyoung/CODING/MAIS/render.yaml`

`CloudRunAuthService` uses a 3-tier fallback for identity tokens:

1. Cloud Run metadata service (only works when the server itself is ON Cloud Run)
2. JWT with `GOOGLE_SERVICE_ACCOUNT_JSON` (correct for Render-hosted server)
3. `gcloud auth print-identity-token` (local dev only)

The server is deployed on Render (not Cloud Run), so tier 1 is never available. Tier 3
will also fail (no gcloud CLI on Render). That means the entire auth path depends on tier
2, which requires `GOOGLE_SERVICE_ACCOUNT_JSON`. If this env var is absent:

```
[CloudRunAuth] No service account configured (local dev mode)
```

The service falls back gracefully but returns `null` for all tokens. Requests to the
Cloud Run customer-agent are sent without `Authorization` headers, and Cloud Run returns
403 to unauthenticated callers.

The code handles `null` tokens correctly (no crash), but the agent becomes unreachable:

```typescript
// cloud-run-auth.service.ts line 156-160
logger.warn(
  { audience },
  '[CloudRunAuth] No identity token available - requests will be unauthenticated'
);
return null;
```

```typescript
// customer-agent.service.ts line 125-128
headers: {
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),  // skipped when token is null
},
```

**render.yaml does not include `GOOGLE_SERVICE_ACCOUNT_JSON` at all.**

---

## Finding 5 — appName mismatch between service call and agent definition [P2, ACTIVE]

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/services/customer-agent.service.ts`, lines 330, 515
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/customer/src/agent.ts`, line 66

The `CustomerAgentService` sends all `/run` requests with `appName: 'agent'`:

```typescript
// customer-agent.service.ts line 329-332
body: JSON.stringify({
  appName: 'agent',       // <-- hardcoded to 'agent'
  userId: adkUserId,
  sessionId: adkSessionId ?? sessionId,
```

The Cloud Run customer-agent is defined with `name: 'customer'`:

```typescript
// agent.ts line 65-66
export const customerAgent = new LlmAgent({
  name: 'customer',       // <-- the actual ADK app name
```

The ADK `appName` in the `/run` request body must match the name registered by the
deployed agent. If ADK uses this field to route to the correct app, any request with
`appName: 'agent'` will fail to resolve the app and return an error.

The session creation endpoint also hard-codes `agent` in the URL path:

```typescript
// line 122
`${getCustomerAgentUrl()}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`;
//                                  ^^^^^
```

The correct path should be `/apps/customer/...` to match the agent's registered name.

**Note:** If the ADK ignores `appName` when there is only one app deployed to the
service, this may be a silent non-issue. But if it matters, every `/run` and session
call is targeting the wrong app name and should be using `'customer'` throughout.

---

## Finding 6 — NEXT_PUBLIC_API_URL not in render.yaml [P3, RISK]

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/chat/CustomerChatWidget.tsx`, line 80

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

`NEXT_PUBLIC_API_URL` is a Next.js build-time variable that must be baked into the
frontend bundle at build time. The `.env.local.example` has it set to localhost. The
`render.yaml` does not define it for the frontend service (the blueprint only covers the
`mais-api` backend service — the web frontend appears to be deployed separately, likely
on Vercel).

If the Vercel deployment does not have `NEXT_PUBLIC_API_URL` set to
`https://api.gethandled.ai` (or wherever the Render API lives), the chat widget will
silently call `http://localhost:3001` in production — which goes nowhere and causes every
health check to throw a network error.

This appears to have been configured manually in production (evidenced by the chat being
verified working via `curl` in the compound doc), but it is not documented in any
blueprint or example file pointing at the production API host.

---

## Finding 7 — TenantChatWidget rendering path [P3, INFO]

**Files:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/t/[slug]/(site)/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantSiteShell.tsx`

The storefront page (`/t/[slug]/(site)/page.tsx`) does not directly render
`TenantChatWidget`. It renders `TenantLandingPageClient`, which internally uses
`TenantSiteShell`. `TenantSiteShell` renders `TenantChatWidget` inside an `EditModeGate`
and `Suspense` boundary:

```typescript
// TenantSiteShell.tsx line 77-80
<TenantChatWidget
  tenantApiKey={tenant.apiKeyPublic}
  businessName={tenant.name}
  primaryColor={tenant.primaryColor}
  chatEnabled={tenant.chatEnabled}
/>
```

The chat widget only renders if `chatEnabled === true` on the tenant record. If
`chatEnabled` is `false` (e.g., unset during onboarding), the widget is silently absent
with no visible error.

Also, the widget is gated behind `EditModeGate`, which suppresses it when the page is
open in the build-mode iframe (`edit + token + iframe` search params). This is correct
behavior — builders should not see the chat bubble while editing.

---

## Finding 8 — Error handling chain, tool exports, and session management [INFO, OK]

### Cloud Run auth fallback (confirmed correct)

When `GOOGLE_SERVICE_ACCOUNT_JSON` is absent, `CloudRunAuthService` logs a warning and
returns `null`. All callers spread the token conditionally (`...(token && { Authorization:
... })`), so requests are sent without auth headers rather than crashing. Cloud Run
responds 403 but the service catches that and returns a user-friendly error. No
uncaught exceptions.

### Tool exports (confirmed correct)

`/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/customer/src/tools/index.ts`
exports all 13 tools: 7 booking tools from `booking.js` and 6 project tools from
`project.js`. These match exactly the tools imported and registered in `agent.ts`. No
missing or misnamed exports.

### Session management (confirmed correct)

The `adkSessionId` fix (commit `7cd09b6b`) correctly stores and reuses the ADK session
UUID across messages. The fallback path for sessions missing `adkSessionId` is also
handled — it creates a new ADK session and updates the DB record before retrying. The
404 + "Session not found" path triggers `retryWithNewADKSession` correctly.

### Quote exhaustion (confirmed correct)

AI quota is checked before every message. If over quota, a friendly human-readable
message is returned immediately without hitting Cloud Run. The quota counter increments
only on successful agent responses.

---

## What render.yaml Is Actually Missing (Complete List)

Comparing `render.yaml` against config.ts required/recommended fields for production:

| Env Var                       | Required?                             | In render.yaml? | Impact if missing              |
| ----------------------------- | ------------------------------------- | --------------- | ------------------------------ |
| `BOOKING_TOKEN_SECRET`        | REQUIRED (Zod min 32)                 | NO              | Server crash at startup        |
| `CUSTOMER_AGENT_URL`          | Required for chat                     | NO              | Chat completely offline        |
| `TENANT_AGENT_URL`            | Required for tenant chat              | NO              | Tenant agent offline           |
| `RESEARCH_AGENT_URL`          | Required for research                 | NO              | Research agent offline         |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Required for Cloud Run auth on Render | NO              | All agent calls get 403        |
| `ALLOWED_ORIGINS`             | Required for multi-origin CORS        | NO              | Cross-origin requests blocked  |
| `SENTRY_DSN`                  | Recommended for error tracking        | NO              | No error visibility            |
| `INTERNAL_API_SECRET`         | Service-to-service auth               | NO              | Internal calls unauthenticated |
| `NEXTJS_REVALIDATE_SECRET`    | Required for ISR cache invalidation   | NO              | Frontend cache never purges    |

---

## Recommended Fix Order

1. **Immediate (prevents future outage):** Add `BOOKING_TOKEN_SECRET` to `render.yaml`
   as `sync: false`. Without it, any fresh deploy will fail at startup.

2. **Immediate (makes blueprint correct):** Add `CUSTOMER_AGENT_URL`,
   `TENANT_AGENT_URL`, `RESEARCH_AGENT_URL`, and `GOOGLE_SERVICE_ACCOUNT_JSON` to
   `render.yaml` as `sync: false` entries with comments matching the agent deploy URLs.

3. **Short-term (stop the lying health check):** Replace the `GOOGLE_VERTEX_PROJECT`
   check in the health route with `CUSTOMER_AGENT_URL`:

   ```typescript
   // server/src/routes/public-customer-chat.routes.ts, line 128
   // BEFORE
   const apiKeyConfigured = !!getConfig().GOOGLE_VERTEX_PROJECT;
   // AFTER
   const agentConfigured = !!getConfig().CUSTOMER_AGENT_URL;
   ```

4. **Investigate (may be silent non-issue):** Verify whether ADK enforces `appName` in
   `/run` requests. If it does, change all occurrences of `appName: 'agent'` and
   `/apps/agent/` URL paths in `customer-agent.service.ts` to use `'customer'` to match
   the agent's registered name.

5. **Documentation:** Add a pre-deployment checklist to `DEVELOPING.md` that requires
   verifying all agent URLs and `BOOKING_TOKEN_SECRET` before any production deploy.
