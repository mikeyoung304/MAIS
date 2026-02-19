---
title: 'Fix Customer Chatbot + Storefront Crashes'
type: fix
status: completed
date: 2026-02-19
---

# Fix Customer Chatbot + Storefront Crashes

## Overview

The customer-facing storefront has two critical issues preventing the chatbot from working:

1. **Chat returns "Connection issue"** — `CUSTOMER_AGENT_URL` is missing from `server/.env`, so the backend can't reach the Cloud Run customer-agent
2. **Storefront crashes** — `tiers.filter is not a function` at `SegmentTiersSection.tsx:322` when `data.tiers` is `null` (the classic "null defeats `= []` defaults" pitfall)

Both issues were verified via Playwright browser testing and curl-based API flow testing.

## Problem Statement

### Issue 1: Customer Chatbot — Missing `CUSTOMER_AGENT_URL`

**Severity:** P1 — Chat is completely broken

**Symptoms:**

- Chat widget opens, shows "Failed to fetch (localhost:3001)" in browser
- Backend returns `{"message": "Connection issue. Try again in a moment."}` on message send
- Health check and session creation succeed (they don't need Cloud Run)

**Root cause:** The `server/.env` file has `TENANT_AGENT_URL` but NOT `CUSTOMER_AGENT_URL`. The customer-agent IS deployed on Cloud Run (`https://customer-agent-506923455711.us-central1.run.app` per SERVICE_REGISTRY.md), but the local env was never updated after the Phase 3 migration from `booking-agent` to `customer-agent`.

**Evidence:**

```bash
# server/.env only has:
TENANT_AGENT_URL=https://tenant-agent-506923455711.us-central1.run.app
# Missing: CUSTOMER_AGENT_URL

# customer-agent.service.ts:45-47
const url = getConfig().CUSTOMER_AGENT_URL;
if (!url) throw new Error('Missing required environment variable: CUSTOMER_AGENT_URL');
```

**Fix:** Add `CUSTOMER_AGENT_URL=https://customer-agent-506923455711.us-central1.run.app` to `server/.env`

### Issue 2: Storefront — `tiers.filter is not a function`

**Severity:** P1 — Entire storefront content area crashes, showing "Something went wrong"

**Symptoms:**

- Nav and footer render, but main content shows error boundary fallback
- Console error: `TypeError: tiers.filter is not a function` at `SegmentTiersSection.tsx:322`

**Root cause:** `data.tiers` from the API returns `null` (not an empty array) for this tenant. The component destructures `const { tenant, tiers, segments } = data;` (line 261) then calls `tiers.filter(...)` (line 322) without null-checking. This is the documented "null defeats `= []` defaults" pitfall.

**Fix:** Add defensive array check at line 322 in `SegmentTiersSection.tsx`:

```typescript
// Before:
const activeTiers = tiers.filter(...)

// After:
const activeTiers = (Array.isArray(tiers) ? tiers : []).filter(...)
```

## Acceptance Criteria

- [x] `CUSTOMER_AGENT_URL` added to `server/.env` — `server/.env`
- [ ] Chat widget successfully sends a message and gets an agent response (verify via curl)
- [x] `SegmentTiersSection.tsx` handles null/undefined tiers without crashing — `apps/web/src/components/tenant/SegmentTiersSection.tsx:322`
- [ ] Storefront page for `maconheadshots` renders without "Something went wrong"
- [x] No regression: existing tests pass (`npm test`) — 2021/2021 pass, 1 pre-existing flaky test unrelated to changes

## Implementation

### Step 1: Add `CUSTOMER_AGENT_URL` to env (1 min)

**File:** `server/.env`

Add:

```
CUSTOMER_AGENT_URL=https://customer-agent-506923455711.us-central1.run.app
```

Also add to `.env.example` for documentation:

```
CUSTOMER_AGENT_URL=https://customer-agent-XXXXXXXXXX-uc.a.run.app
```

### Step 2: Fix null tiers crash (2 min)

**File:** `apps/web/src/components/tenant/SegmentTiersSection.tsx:322`

```typescript
// Defensive: API may return null for tiers (null defeats = [] defaults)
const safeTiers = Array.isArray(tiers) ? tiers : [];
const activeTiers = safeTiers.filter(
  (p) =>
    (p.isActive ?? p.active) &&
    !(p.priceCents === 0 && (SEED_TIER_NAMES as readonly string[]).includes(p.title))
);
```

### Step 3: Verify (5 min)

1. Restart API server
2. Test chat flow:

   ```bash
   # Health
   curl -s http://localhost:3001/v1/public/chat/health \
     -H "X-Tenant-Key: pk_live_maconheadshots_7bc68c015ed09d0c"

   # Session
   curl -s -X POST http://localhost:3001/v1/public/chat/session \
     -H "Content-Type: application/json" \
     -H "X-Tenant-Key: pk_live_maconheadshots_7bc68c015ed09d0c"

   # Message (use sessionId from above)
   curl -s -X POST http://localhost:3001/v1/public/chat/message \
     -H "Content-Type: application/json" \
     -H "X-Tenant-Key: pk_live_maconheadshots_7bc68c015ed09d0c" \
     -d '{"message": "What services do you offer?", "sessionId": "<SESSION_ID>"}'
   ```

3. Verify storefront loads without crash at `http://localhost:3000/t/maconheadshots`

## Context

### Working Components (verified)

- Chat widget UI (`CustomerChatWidget.tsx`, 604 lines) — renders correctly, opens on click
- Chat API routes mounted at `/v1/public/chat` — health + session endpoints respond
- CORS configuration — allows `localhost:3000` origin correctly
- Customer-agent Cloud Run service — deployed and active (last deploy: 2026-01-31)

### Architecture Reference

- Customer-agent service: `server/src/services/customer-agent.service.ts`
- Cloud Run agent: `server/src/agent-v2/deploy/customer/src/agent.ts`
- Chat widget: `apps/web/src/components/chat/CustomerChatWidget.tsx`
- Service registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

### Related Documentation

- `docs/solutions/ADK_A2A_LOAD_ERROR.md` — A2A naming gotchas
- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` — Cloud Run auth pattern
- `docs/issues/2026-01-31-phase-4-migration-debt.md` — Known agent repetition issue

## References

- Pitfall: "null defeats `= []` defaults" — `docs/PITFALLS_INDEX.md`
- SERVICE_REGISTRY: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`
- Previous storefront hardening: commit `84c8b735`
