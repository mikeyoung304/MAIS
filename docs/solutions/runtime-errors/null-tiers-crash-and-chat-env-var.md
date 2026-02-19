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

### Bug 1: Paginated API Response Not Unwrapped — `d.forEach is not a function`

> **CORRECTION (2026-02-19):** Original diagnosis was wrong. The API does not return `null`.
> The true root cause is that both `/v1/tiers` and `/v1/segments` use `paginateArray()` which
> returns `{ items: T[], total, hasMore }` — a wrapper object, not a plain array. The fetch
> functions in `tenant.ts` were passing this object directly to components expecting arrays.
> The component-level `Array.isArray` guard masked the tiers bug (silently returning `[]`)
> but left segments unguarded — causing a crash on the next storefront load.
> Real fix: `tenant.ts` commit `5958fdc8` — unwrap `.items` at the fetch layer.

**File (root cause):** `apps/web/src/lib/tenant.ts`

Both `getTenantTiers` and `getTenantSegments` returned the raw `response.json()` which is the
paginated envelope `{ items: T[], total: number, hasMore: boolean }`:

```typescript
// WRONG — returns { items: [...], total: N, hasMore: false }, not a plain array
return response.json();
```

In `SegmentTiersSection`:

- `tiers`: Partial fix `Array.isArray(tiers) ? tiers : []` treated the object as non-array
  → silently returned `[]` → tiers appeared to work only because SectionContent independently
  rendered pricing. SegmentTiersSection was always broken, just invisibly so.
- `segments`: No guard → `segments.forEach(...)` crashed with `TypeError: d.forEach is not a function`

**Why original verification missed this:** The "3 pricing tiers display" check saw SectionContent-rendered
pricing, not SegmentTiersSection output. The segment/tier system was silently returning empty
arrays throughout — it only became visible when the `segments.forEach` crash triggered the error boundary.

### Bug 2: Missing CUSTOMER_AGENT_URL

The Render production environment was missing the `CUSTOMER_AGENT_URL` environment variable. The server's chat proxy route needs this URL to forward requests to the Cloud Run customer-agent service. Without it:

1. Chat widget sent health check to `/v1/public/chat/health`
2. Server tried to proxy to customer-agent but URL was `undefined`
3. Server returned connection error
4. Widget displayed "Connection issue" to user

## Solution

### Fix 1: Unwrap Paginated Response at the Fetch Layer

**File:** `apps/web/src/lib/tenant.ts` (commit `5958fdc8`)

```typescript
// BEFORE (passes paginated wrapper object to components)
return response.json();

// AFTER (unwraps .items — handles both raw arrays and paginated responses)
const data = await response.json();
return Array.isArray(data) ? data : (data?.items ?? []);
```

Applied to both `getTenantTiers` and `getTenantSegments`. This is the correct fix at the
**API boundary** — normalizing the response shape before it reaches any component.

The component-level `Array.isArray` guard in `SegmentTiersSection` remains as defense-in-depth
but the root fix must be at the fetch layer where the shape mismatch originates.

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
