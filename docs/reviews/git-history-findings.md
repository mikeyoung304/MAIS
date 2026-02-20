---
title: Git History Analysis — Customer-Facing Chatbot (Why It Never Worked)
date: 2026-02-20
analyst: git-history-analyzer
severity: P0 (customer-facing feature broken in production since launch)
---

# Git History Analysis: Customer Chatbot

## Executive Summary

The customer chatbot was built on **2025-12-28** and has had **at least 3 distinct production-breaking bugs** across its lifetime, each introduced or left unfixed by subsequent "fix" commits. As of the most recent commit (`7cd09b6b`), two of the three bugs have been patched; **the third structural gap — `CUSTOMER_AGENT_URL` never in `render.yaml` — remains unresolved** and requires a manual Render dashboard action to remain fixed after any blueprint re-sync.

---

## Commit Timeline (Chatbot Files Only)

All commits touching `server/src/services/customer-agent.service.ts`, `server/src/routes/public-customer-chat.routes.ts`, and `apps/web/src/components/chat/CustomerChatWidget.tsx`:

| Date                   | Hash                 | Commit Message                                                | Bug Status                                                       |
| ---------------------- | -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2025-12-28             | `66b512f1`           | feat(chat): add customer-facing chatbot                       | Bug #3 planted                                                   |
| 2025-12-28..2025-12-30 | `e2d6545`–`6618f305` | P1/P2 security fixes (HTML injection, proposal enumeration)   | Bugs fixed                                                       |
| 2026-01-26             | `ce120592`           | refactor: delete legacy agent backend (~50k lines)            | Old impl deleted                                                 |
| 2026-01-31             | `904b1552`           | feat(customer-agent): create unified customer agent (Phase 3) | New impl, bugs re-inheritable                                    |
| 2026-01-31             | `a708b1e1`           | feat(agents): Phase 4 — use 3-agent architecture              | `BOOKING_AGENT_URL` → `CUSTOMER_AGENT_URL` (Bug #1 scope change) |
| 2026-02-19             | `390a746c`           | refactor: D2+A3 — centralize process.env reads                | `CUSTOMER_AGENT_URL` now `optional()` in config schema           |
| 2026-02-19             | `6bf4b2f5`           | fix: handle null tiers + restore customer chatbot (#66)       | Bug #1 fixed manually (dashboard only)                           |
| 2026-02-19             | `f2acaa63`           | docs: compound P1 null tiers crash + chat env var fix         | Bug #1 documented                                                |
| 2026-02-19             | `7cd09b6b`           | fix(customer-agent): store and reuse ADK session ID           | Bug #2 fixed                                                     |

---

## Bug #1: Missing `CUSTOMER_AGENT_URL` in Render Deployment

### What Happened

- `render.yaml` was **never updated** to include `CUSTOMER_AGENT_URL`, `TENANT_AGENT_URL`, or `RESEARCH_AGENT_URL`.
- The env var was added to `server/.env.example` in commit `a708b1e1` (2026-01-31) — but not to `render.yaml`.
- All 14 commits to `render.yaml` were inspected: **zero of them added agent URL env vars**.
- Without `CUSTOMER_AGENT_URL`, every call to `getCustomerAgentUrl()` throws immediately, the health endpoint returns an error, and the widget shows "Connection issue. Try again in a moment."

### How It Was Fixed (commit `6bf4b2f5`)

The commit message reads:

> "Also adds `CUSTOMER_AGENT_URL` to `server/.env` (local-only, not committed) to restore customer chatbot connectivity to Cloud Run agent."

The fix was **manual Render dashboard configuration**, not a code change. No corresponding `render.yaml` change was made. This means:

- Any Render blueprint re-sync will wipe the manually-set variable.
- New environments (staging, preview) will not have the variable.
- There is no automated guard against this regression.

### Evidence

```yaml
# render.yaml — current state (2026-02-20)
# CUSTOMER_AGENT_URL, TENANT_AGENT_URL, RESEARCH_AGENT_URL are ALL absent
# Only these AI-related vars are declared:
- key: GOOGLE_VERTEX_PROJECT
  sync: false
- key: GOOGLE_VERTEX_LOCATION
  sync: false
```

### Config Schema: Optional vs Required

```typescript
// server/src/lib/core/config.ts (line 83) — added in commit 390a746c
CUSTOMER_AGENT_URL: z.string().url().optional(),
```

The schema marks the URL as **optional**, meaning the server starts without it and fails only at request time. There is no startup-time validation that would catch this in production. The `getCustomerAgentUrl()` function throws at call time:

```typescript
function getCustomerAgentUrl(): string {
  const url = getConfig().CUSTOMER_AGENT_URL;
  if (!url) {
    throw new Error('Missing required environment variable: CUSTOMER_AGENT_URL');
  }
  return url;
}
```

---

## Bug #2: Wrong Session ID Sent to ADK (commit `7cd09b6b`)

### What Happened

- `createSession()` created an ADK session on Cloud Run, receiving an ADK UUID (e.g., `a7b3c9d2-...`).
- It then stored the **local CUID** (e.g., `cm8xkq0p10000...`) as the DB session ID.
- `chat()` sent this local CUID as `sessionId` in the ADK `/run` request body.
- ADK does not recognize local CUIDs — it returned 404 on every message.
- The code then called `retryWithNewADKSession` → `bootstrap_customer_session` on every single message, wiping the entire conversation history.

### What the "Fix" (`6bf4b2f5`) Did Not Fix

Commit `6bf4b2f5` ("restore customer chatbot") added `CUSTOMER_AGENT_URL` to the local `.env` only. It **did not address the session ID bug**. The chatbot could now reach Cloud Run, but every message would still wipe history.

### What Actually Fixed It (`7cd09b6b`)

```typescript
// BEFORE (broken): always sent local DB CUID
body: JSON.stringify({
  sessionId: sessionId, // local CUID, unknown to ADK
});

// AFTER (fixed): store and reuse ADK UUID
// 1. createSession() now stores adkSessionId via agentSession.update()
// 2. chat() looks up adkSessionId before calling /run:
const sessionWithAdk = await this.prisma.agentSession.findUnique({
  where: { id: sessionId },
  select: { adkSessionId: true },
});
body: JSON.stringify({
  sessionId: adkSessionId ?? sessionId, // prefers ADK UUID
});
```

### Did It Address Env Var Issues?

**No.** Commit `7cd09b6b` touched only `customer-agent.service.ts` and its test file. It made no changes to `render.yaml`, `.env.example`, or `config.ts`. The env var was already fixed manually in the Render dashboard via `6bf4b2f5`.

---

## Bug #3 (Original Architecture): Legacy Orchestrator, Not ADK

The original chatbot (`66b512f1`, Dec 2025) used a custom `CustomerOrchestrator` class that called Claude directly via Anthropic SDK. It was deleted entirely in commit `ce120592` (2026-01-26) when 50,500 lines of legacy agent code were removed. The current architecture (`customer-agent.service.ts`) is a complete rewrite that proxies to the Cloud Run ADK agent. Any bugs from the original implementation are documented in `docs/solutions/CUSTOMER-CHATBOT-PHASE-0-SOLUTIONS.md` but are marked as **legacy** — the code no longer exists.

---

## `render.yaml` Analysis: Agent URLs Were Never Committed

All 14 commits to `render.yaml` were inspected:

| Hash                                                   | What Changed                                             |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `2adfdc0c`                                             | Zod version alignment                                    |
| `6682b3dc`–`df2efe34`–`af8ddc51`–`4a27ce64`–`eb3724c4` | Build/deploy config fixes (tsx runtime, npm ci, rootDir) |
| `5eb27a56`                                             | Plan: free → starter (Hobby tier)                        |
| `1a3eca7a`                                             | Add agent-eval cron job                                  |
| `333ab57c`–`1df96c01`–`82248e75`–`2b021b04`–`1c556271` | Various unrelated changes                                |

**None of these 14 commits added `CUSTOMER_AGENT_URL`, `TENANT_AGENT_URL`, or `RESEARCH_AGENT_URL` to the `envVars` block.** The env vars exist only in the manually-configured Render dashboard and in `.env.example` (documentation only).

---

## Solution Docs Found

The following docs in `docs/solutions/` are relevant to the chatbot:

| File                                                  | Status                                   |
| ----------------------------------------------------- | ---------------------------------------- |
| `CUSTOMER-CHATBOT-PHASE-0-SOLUTIONS.md`               | Legacy — references deleted code         |
| `CUSTOMER_CHATBOT_PREVENTION_STRATEGIES.md`           | Legacy — references deleted code         |
| `CUSTOMER_CHATBOT_QUICK_REFERENCE.md`                 | Legacy — references deleted code         |
| `CUSTOMER_CHATBOT_PREVENTION_DELIVERY_SUMMARY.md`     | Legacy — references deleted code         |
| `runtime-errors/null-tiers-crash-and-chat-env-var.md` | Current — documents Bug #1 fix (env var) |
| `ADK_AGENT_DEPLOYMENT_TYPESCRIPT_ERRORS_FIX.md`       | Current — ADK deployment patterns        |
| `AGENT_ECOSYSTEM_GUIDE.md`                            | Current — 3-agent architecture           |

---

## Root Cause Timeline Summary

```
Dec 28: Chatbot built (legacy CustomerOrchestrator, Anthropic SDK)
Dec 29-30: P1/P2 security fixes applied
Jan 26: Legacy orchestrator deleted (50k lines)
Jan 31: New ADK-based CustomerAgentService created (Phase 3)
Jan 31: Env var renamed BOOKING_AGENT_URL → CUSTOMER_AGENT_URL (Phase 4)
         → render.yaml NOT updated (Bug #1 introduced in deployment)
Feb 19: render.yaml still missing CUSTOMER_AGENT_URL (Bug #1)
         → Fixed manually via Render dashboard
         → ADK session ID bug discovered (Bug #2): local CUID sent as sessionId
Feb 19: Bug #2 fixed: adkSessionId stored on DB session, used for ADK calls
Feb 19: render.yaml still missing CUSTOMER_AGENT_URL (structural gap remains)
```

---

## Outstanding Risks (As of 2026-02-20)

### Risk #1 (P1): `render.yaml` Missing Agent URLs — Fragile Manual Fix

**Status:** Manually set in Render dashboard. Not in `render.yaml`. Will break on blueprint re-sync.

**Fix Required:**

```yaml
# render.yaml — add to envVars block
- key: CUSTOMER_AGENT_URL
  sync: false # Set manually in dashboard — Cloud Run URL from: gcloud run services list
- key: TENANT_AGENT_URL
  sync: false # Set manually in dashboard
- key: RESEARCH_AGENT_URL
  sync: false # Set manually in dashboard
```

### Risk #2 (P2): `CUSTOMER_AGENT_URL` Is Optional in Config Schema

If the URL is absent, the server starts normally and fails silently until a customer tries to chat. Should be required at startup for production.

**Fix Required:**

```typescript
// server/src/lib/core/config.ts
// Change from:
CUSTOMER_AGENT_URL: z.string().url().optional(),
// To (for production validation):
CUSTOMER_AGENT_URL: process.env.NODE_ENV === 'production'
  ? z.string().url()
  : z.string().url().optional(),
```

Or alternatively, add a startup-time check in `di.ts`.

### Risk #3 (P2): Pre-Fix Sessions Have No `adkSessionId`

Sessions created before `7cd09b6b` have `adkSessionId: null` in the DB. The fallback in `chat()` creates a new ADK session for these, but that new session has no history — the customer effectively starts fresh. This is handled gracefully (not a crash) but may confuse users mid-conversation.

---

## What Each "Fix" Claimed vs. What It Actually Did

| Commit     | Claimed Fix                                         | Actual Result                                                                                              |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `6bf4b2f5` | "restore customer chatbot"                          | Added env var to local `.env` only; chatbot could reach Cloud Run but still wiped history on every message |
| `f2acaa63` | "chat env var fix — verified working in production" | Documentation only; no code change; env var was set manually in dashboard                                  |
| `7cd09b6b` | "store and reuse ADK session ID"                    | Correctly fixed the session ID bug; did NOT address the env var structural gap                             |
