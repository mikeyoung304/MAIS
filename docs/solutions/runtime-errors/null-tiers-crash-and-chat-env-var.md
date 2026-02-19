---
title: 'P1: Null Tiers Storefront Crash + Missing CUSTOMER_AGENT_URL'
date: 2026-02-19
category: runtime-errors
severity: P1
components:
  - apps/web/src/components/tenant/storefront/sections/SegmentTiersSection.tsx
  - apps/web/src/components/chat/CustomerChatWidget.tsx
  - server chat proxy routes
  - Render production environment
symptoms:
  - "Storefront crashes with React error boundary: 'Something went wrong'"
  - 'tiers.filter is not a function'
  - "Chat widget shows 'Connection issue. Try again in a moment.'"
  - Customer agent unreachable from production
tags:
  - null-vs-undefined
  - api-contract-boundary
  - defensive-programming
  - array-guard
  - environment-configuration
  - cloud-run-integration
  - agent-connectivity
related_issues:
  - 'PR #66: fix: handle null tiers in storefront + restore customer chatbot'
---

# P1: Null Tiers Storefront Crash + Missing CUSTOMER_AGENT_URL

Two P1 production bugs fixed and verified together. Both affected the public-facing Macon Headshots storefront.

## Symptoms

### Bug 1: Storefront Crash

- Entire storefront page showed React error boundary ("Something went wrong")
- Console error: `TypeError: tiers.filter is not a function`
- All content sections below the crash point were invisible to visitors

### Bug 2: Customer Chat Unavailable

- Chat widget opened but displayed: "Connection issue. Try again in a moment."
- Health check to `/v1/public/chat/health` failed
- No agent responses possible — booking assistant completely offline

## Root Cause Analysis

### Bug 1: Null Tiers — `tiers.filter is not a function`

**File:** `apps/web/src/components/tenant/storefront/sections/SegmentTiersSection.tsx`

The API endpoint `/v1/tiers` returns `null` when a tenant has no tiers configured. The component called `.filter()` directly on the response without null-safety:

```typescript
// CRASHED — tiers was null, not undefined
const activeTiers = tiers.filter((t) => t.active);
```

**Why default params don't help:** JavaScript default parameters (`= []`) only activate for `undefined`, not `null`. When the API explicitly returns `null`, the default is bypassed:

```typescript
// This does NOT protect against null
function renderTiers(tiers = []) {
  return tiers.filter((t) => t.active); // Still crashes if tiers is null
}
```

This is the documented "null defeats `= []` defaults" pitfall (MEMORY.md, PITFALLS_INDEX.md).

### Bug 2: Missing CUSTOMER_AGENT_URL

The Render production environment was missing the `CUSTOMER_AGENT_URL` environment variable. The server's chat proxy route needs this URL to forward requests to the Cloud Run customer-agent service. Without it:

1. Chat widget sent health check to `/v1/public/chat/health`
2. Server tried to proxy to customer-agent but URL was `undefined`
3. Server returned connection error
4. Widget displayed "Connection issue" to user

## Solution

### Fix 1: Array.isArray Guard

```typescript
// BEFORE (crashes when tiers is null)
const activeTiers = tiers.filter((t) => t.active);

// AFTER (safe — handles null, undefined, and non-arrays)
const safeTiers = Array.isArray(tiers) ? tiers : [];
const activeTiers = safeTiers.filter((t) => t.active);
```

`Array.isArray()` returns `false` for `null`, `undefined`, objects, strings — only `true` for actual arrays. This is the correct guard at API consumption boundaries.

### Fix 2: Configure CUSTOMER_AGENT_URL

Added the environment variable to the Render production service:

```
CUSTOMER_AGENT_URL=https://customer-agent-<deployment-hash>-uc.a.run.app
```

Request flow restored: Web Client -> Server Proxy -> Customer-Agent (Cloud Run)

## Verification

Both fixes verified in production (`gethandled.ai/t/maconheadshots`):

| Test                | Method                              | Result                                                                           |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Storefront renders  | Playwright + visual inspection      | All 3 pricing tiers display, no error boundary                                   |
| Chat health check   | `curl` with `X-Tenant-Key` header   | `{"available":true,"businessName":"Macon Headshots"}`                            |
| Chat session create | `curl POST /v1/public/chat/session` | Session created with greeting                                                    |
| Chat message send   | `curl POST /v1/public/chat/message` | Agent responded, called `bootstrap_customer_session` + `get_business_info` tools |
| Console errors      | Playwright console capture          | No crash-related errors                                                          |

**Note:** Playwright MCP browser sandbox blocks cross-origin requests (`net::ERR_FAILED` on both Google Fonts and API health check). Storefront renders because Next.js SSR fetches data server-side. Chat widget verification required direct `curl` testing. This is a testing environment limitation, not a production issue.

## Prevention

### Code-Level: Always `Array.isArray()` at API Boundaries

```typescript
// Pattern: normalize API responses before component use
const data = await fetchFromAPI();
const items = Array.isArray(data.items) ? data.items : [];
const tiers = Array.isArray(data.tiers) ? data.tiers : [];
```

**Rule:** Never trust that an API response array field is actually an array. Prisma `.include()` can return `null`, backend normalization can miss cases, and contract changes can introduce `null` where `[]` was expected.

### Deployment: Env Var Verification

**Pre-deployment checklist for agent-dependent features:**

- [ ] All agent URLs configured: `CUSTOMER_AGENT_URL`, `TENANT_AGENT_URL`, `RESEARCH_AGENT_URL`
- [ ] Post-deploy health check: `curl -H "X-Tenant-Key: <key>" <API_URL>/v1/public/chat/health`
- [ ] Consider startup-time validation that fails fast if required URLs are missing in production

### Monitoring

- Alert on `AGENT_URL_MISSING` or `Connection refused` in server logs
- Browser error tracking for `TypeError: *.filter is not a function` patterns
- Post-deploy smoke test: verify storefront renders and chat widget connects

## Related Documentation

- **Previous null tiers fix:** `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md` — Bug #1 covered `.map()` on null tiers in 5 other components
- **CORS regression:** `docs/solutions/integration-issues/storefront-cors-and-tier-display-regression.md` — Related storefront/API connectivity issue
- **Cloud Run chat integration:** `docs/solutions/integration-issues/project-hub-chat-cloud-run-integration-failures.md` — Agent proxy architecture and 403/session issues
- **Env var patterns:** `docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md` — Multi-tenant config anti-patterns
- **Pitfalls index:** `docs/PITFALLS_INDEX.md` — Pitfall pattern: null vs undefined at API boundaries
- **MEMORY.md:** "null defeats `= []` defaults" cross-session pattern
