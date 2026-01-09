# Continuation Prompt: Build Mode Preview Not Updating - Diagnosis & Planning

**Date:** 2026-01-09
**Context:** Multi-agent code review completed, diagnosis-first approach selected
**Goal:** Deep understanding of data flow issue, then create enterprise-grade fix plan

---

## Executive Summary

Build Mode preview iframe never updates despite AI agent tools reporting success. Playwright testing revealed:

- Agent calls `update_page_section` → Tool pill shows success → Preview unchanged
- Agent calls `publish_draft` → Agent says "now live" → Public storefront still shows `[Hero Headline]` placeholder
- Onboarding progress stuck at "1/4" despite completing phases

**Original Plan:** `plans/fix-build-mode-preview-not-updating.md` (500+ lines)
**Multi-Agent Review Result:** 2 APPROVE WITH CHANGES, 4 NEEDS REWORK
**Key Disagreement:** Is this an SSR data source problem or a PostMessage state management problem?

---

## The Two Competing Hypotheses

### Hypothesis A: SSR Data Source Problem (Original Plan)

The preview iframe SSR fetches published `landingPageConfig` instead of draft `landingPageConfigDraft`. The `?preview=draft` query param is ignored.

**Evidence For:**

- `getTenantStorefrontData()` always fetches from `/v1/public/tenants/:slug` which returns published config
- No code path checks for `?preview=draft` in page.tsx

**Solution (Original):** Add authenticated SSR fetch of draft data when preview mode detected.

### Hypothesis B: PostMessage State Management Problem (DHH/Simplicity)

The PostMessage system already handles draft updates. The parent (`BuildModePreview`) has `draftConfig` and sends it via `BUILD_MODE_INIT`. The problem is upstream - the parent's `draftConfig` is stale or never populated.

**Evidence For:**

- `BuildModePreview.tsx` lines 74-81 show `BUILD_MODE_INIT` is sent with `draftConfig`
- `BuildModeWrapper` has `useBuildModeSync` that receives and applies updates
- If this system worked, SSR content would be immediately replaced

**Solution (DHH):** Skip SSR in preview mode entirely. Render loading state, wait for PostMessage.

---

## Critical Files to Understand

### Frontend - Build Mode Parent Components

**`apps/web/src/components/build-mode/BuildModePreview.tsx`**

- Lines 15-20: Props include `draftConfig`
- Lines 74-81: Sends `BUILD_MODE_INIT` with draftConfig when iframe ready
- Line 58: Builds iframe URL with `?preview=draft&edit=true`

```typescript
// Line 74-81
case 'BUILD_MODE_READY':
  setIsReady(true);
  if (draftConfig && iframeRef.current?.contentWindow) {
    iframeRef.current.contentWindow.postMessage({
      type: 'BUILD_MODE_INIT',
      config: draftConfig,
    }, window.location.origin);
  }
```

**Question to diagnose:** Where does `draftConfig` come from? Is it always fresh?

**`apps/web/src/app/(protected)/tenant/build/page.tsx`** (or similar)

- This is the parent page that renders `BuildModePreview`
- Need to trace: How does it fetch `draftConfig`? React Query? Direct fetch?
- Does it refetch after tool execution?

### Frontend - Iframe/Storefront Components

**`apps/web/src/app/t/[slug]/(site)/page.tsx`**

- Lines 66-92: Server component that fetches tenant data
- Line 70: Calls `getTenantStorefrontData(slug)` - always returns PUBLISHED
- No handling of `searchParams.preview`

**`apps/web/src/components/tenant/TenantLandingPageClient.tsx`**

- Client component that receives data from page.tsx
- Should have `BuildModeWrapper` integration for edit mode

**`apps/web/src/components/build-mode/BuildModeWrapper.tsx`**

- Contains `useBuildModeSync` hook
- Receives PostMessage updates and applies to local state
- If SSR renders published, this should replace with draft from PostMessage

**`apps/web/src/hooks/useBuildModeSync.ts`** (if exists)

- The actual PostMessage listener logic
- Handles `BUILD_MODE_INIT` and `BUILD_MODE_CONFIG_UPDATE`

### Frontend - Data Fetching

**`apps/web/src/lib/tenant.ts`**

- Lines 247-269: `getTenantBySlug` - fetches `/v1/public/tenants/:slug`
- Lines 423-436: `getTenantStorefrontData` - combines tenant + packages + segments
- All fetches use ISR with 60-second revalidation
- No draft-specific fetch function exists

### Backend - Executors

**`server/src/agent/executors/storefront-executors.ts`**

- Lines 114-175: `update_page_section` executor - writes to `landingPageConfigDraft`
- Lines 566-631: `publish_draft` executor - copies draft to live, clears draft
- Lines 501-560: `update_storefront_branding` - writes directly to live (bypasses draft!)

**Key observation:** `publish_draft` does NOT use advisory lock (race condition risk)

### Backend - Draft API

**`server/src/routes/tenant-admin-landing-page.routes.ts`**

- Lines 209-227: `GET /draft` endpoint - returns `{ draft, published, draftUpdatedAt, publishedAt }`
- This endpoint EXISTS and works correctly
- Question: Is the frontend calling it? Is response being stored?

### Backend - Orchestrator

**`server/src/agent/orchestrator/base-orchestrator.ts`**

- Lines 615-627: T2 soft-confirm trigger
- T2 proposals (like `update_page_section`) create PENDING proposals
- Execution happens on NEXT user message, not immediately

---

## Multi-Agent Review Findings

### DHH (Architecture) - NEEDS REWORK

> "You've written a 500-line plan to solve a 10-line problem. The architecture already supports draft preview - you just need to wire it correctly."

**Key Points:**

1. The draft endpoint already exists (`/v1/tenant-admin/landing-page/draft`)
2. PostMessage system is designed to handle this - iframe shouldn't SSR published content
3. Adding auth to storefront pages creates coupling complexity
4. Cache invalidation via cross-service HTTP is overengineered

**Proposed Fix:**

```tsx
// In TenantLandingPageClient or similar
if (isEditMode) {
  return (
    <BuildModeWrapper initialConfig={null} pageName="home">
      {/* Wait for PostMessage to populate */}
    </BuildModeWrapper>
  );
}
```

### Kieran (TypeScript) - APPROVE WITH CHANGES

**Critical Issues:**

1. Plan uses `session.backendToken` but codebase intentionally excludes it - use `getBackendToken()` instead
2. Return type should be `LandingPageDraftResponse` not `LandingPageConfig | null`
3. Revalidate endpoint signature mismatch - existing uses query params, plan proposes headers
4. Missing `cache()` wrapper for draft fetches

**Existing Auth Pattern (auth.ts lines 64-79):**

```typescript
// SECURITY: backendToken is intentionally NOT included here.
// It's stored in an HTTP-only cookie (mais_backend_token)
interface MAISSession extends Session {
  user: { id; email; role; tenantId; slug }; // NO backendToken
}
```

### Code Simplicity - NEEDS REWORK

> "The plan treats symptoms, not causes. The fix should be 1-5 lines of code."

**Diagnosis Steps Recommended:**

1. Add `console.log` to trace where draftConfig comes from
2. Find the disconnect (likely React Query cache or missing refetch)
3. Fix that one line
4. Test

**What Can Be Removed from Original Plan:**

- `getTenantDraftConfig()` - PostMessage already handles this
- `searchParams` detection in page.tsx - Not needed if PostMessage works
- `getServerSession` in storefront - Keep public pages public
- `/api/revalidate` endpoint - Use `revalidateTag` instead
- Phase 3 (orchestrator fixes) - Separate concern
- Phase 4 (pending changes UI) - Separate ticket

### Agent-Native Architecture - APPROVE WITH CHANGES

**Critical Gaps:**

1. **Agent cannot verify its changes** - No `get_draft` tool to read current state
2. **T2 timing is invisible** - Agent says "Done!" but execution is deferred
3. **Race condition** - Executor writes to DB but parent refetches before commit

**Recommended:**

1. Add `get_landing_page_draft` tool (T1, read-only)
2. Consider T1 for draft writes (drafts are inherently safe, not live until publish)
3. Add `configVersion` to executor responses for staleness detection

**Action Parity Gaps:**

- `publish_draft` and `discard_draft` executors exist but not exposed in chat
- `update_storefront_branding` bypasses draft (immediate live) - agent can't know this

### Security Sentinel - NEEDS REWORK

**CRITICAL: Missing Tenant Ownership Verification**

```typescript
// INSECURE (original plan):
if (session?.backendToken) {
  const draftConfig = await getTenantDraftConfig(slug, session.backendToken);
  // If Tenant A visits /t/tenant-b?preview=draft, they apply their own draft to wrong storefront!
}

// SECURE (required):
if (session?.user?.slug === slug && backendToken) {
  // Only allow preview for YOUR OWN storefront
}
```

**Cache Poisoning Risk:**

- If preview mode renders draft content and ISR caches it, public users see draft
- Must use `force-dynamic` for preview routes OR separate route segment

**Revalidation Endpoint Security:**

- Add rate limiting (10/min/slug)
- Consider HMAC signature instead of bare secret
- Validate `NEXT_PUBLIC_URL` to prevent SSRF

### Data Integrity Guardian - APPROVE WITH CHANGES

**Race Conditions Found:**

1. `publish_draft` executor has NO advisory lock - concurrent edit+publish can cause data loss
2. `toggle_page_enabled` executor missing lock
3. UI autosave and AI tools may use different locking mechanisms

**Required Fix for `publish_draft`:**

```typescript
return await prisma.$transaction(
  async (tx) => {
    const lockId = hashTenantStorefront(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
    // ... rest of publish logic
  },
  { timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS, isolationLevel: STOREFRONT_ISOLATION_LEVEL }
);
```

**Cache Coherence:**

- ISR cache (60s), React cache() (request-scoped), no Express cache
- Plan's revalidation approach is sound but needs correct endpoint signature

---

## Diagnostic Steps (Do These First)

### Step 1: Trace draftConfig Data Flow

Find the Build Mode page and trace `draftConfig`:

```bash
# Find Build Mode page
grep -r "BuildModePreview" apps/web/src --include="*.tsx" -l

# Find where draftConfig is fetched
grep -r "draftConfig" apps/web/src --include="*.tsx" -B5 -A5
```

**Questions to Answer:**

1. What component owns `draftConfig` state?
2. Is it fetched via React Query? `useQuery` key?
3. Is there a refetch trigger after tool execution?
4. Does `handleConfigUpdate` callback exist and get called?

### Step 2: Verify PostMessage Flow

Add logging to trace PostMessage:

```typescript
// In BuildModePreview.tsx
console.log('[BuildModePreview] Sending BUILD_MODE_INIT', {
  hasDraftConfig: !!draftConfig,
  draftConfigKeys: draftConfig ? Object.keys(draftConfig) : null,
});

// In BuildModeWrapper.tsx or useBuildModeSync.ts
console.log('[BuildModeWrapper] Received message', event.data.type);
console.log('[BuildModeWrapper] Applying config', event.data.config);
```

### Step 3: Check API Calls in Network Tab

During Build Mode session:

1. Does `/v1/tenant-admin/landing-page/draft` get called?
2. What does it return?
3. After `update_page_section` tool, is there a refetch?

### Step 4: Verify Executor Actually Executes

Check if T2 proposals are confirmed and executed:

```typescript
// Add to base-orchestrator.ts softConfirmPendingT2
logger.info(
  {
    tenantId,
    sessionId,
    proposalsFound: proposals.length,
    proposalIds: proposals.map((p) => p.id),
  },
  'T2 soft-confirm check'
);
```

---

## Test Evidence from Playwright Session

**Test Report:** `docs/test-reports/ONBOARDING_FLOW_TEST_REPORT_20260109.md`

| Tool                      | Called | Effect                                                    |
| ------------------------- | ------ | --------------------------------------------------------- |
| `get_market_research`     | ✅     | Data shown correctly                                      |
| `update_onboarding_state` | ✅     | Phase updated (T1 auto-execute)                           |
| `upsert_services`         | ⚠️     | Tool pill shown, unverified if packages created           |
| `update_page_section`     | 🔴     | Tool pill shown, preview unchanged                        |
| `publish_draft`           | 🔴     | No tool pill, agent claimed success, storefront unchanged |

**Key Observation:** T1 tools work. T2 tools show as called but effect not visible.

---

## Security Requirements (Non-Negotiable)

Regardless of which hypothesis is correct, these must be implemented:

1. **Tenant ownership verification** for any preview/draft access
2. **`getBackendToken()`** instead of `session.backendToken`
3. **ISR cache protection** - preview routes cannot poison public cache
4. **Advisory lock on `publish_draft`** executor

---

## Agent-Native Requirements (Enterprise Quality)

1. **Add `get_landing_page_draft` tool** - Agent must be able to verify its changes
2. **Consider T1 for draft-only writes** - Drafts don't affect live site
3. **Add executor response metadata** - `configVersion`, `status: EXECUTED | PENDING`
4. **Expose `publish_draft` and `discard_draft`** in chat tools

---

## Files That Need Changes (Final List After Diagnosis)

**Definitely:**

- `server/src/agent/executors/storefront-executors.ts` - Add advisory lock to `publish_draft`
- Auth handling - Use `getBackendToken()` pattern

**Probably (depends on diagnosis):**

- Build Mode page - Add refetch trigger after tool execution
- `BuildModeWrapper` - Improve PostMessage handling
- OR `page.tsx` - Skip SSR in preview mode

**If SSR approach chosen:**

- `apps/web/src/lib/tenant.ts` - Add draft fetch with `cache()`
- `apps/web/src/app/t/[slug]/(site)/page.tsx` - Add preview mode handling
- Security: Add tenant ownership check

---

## Existing Documentation References

- **Test Report:** `docs/test-reports/ONBOARDING_FLOW_TEST_REPORT_20260109.md`
- **Original Plan:** `plans/fix-build-mode-preview-not-updating.md`
- **Build Mode Patterns:** `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`
- **Dual Mode Orchestrator:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md`
- **T2 Execution Fix:** `plans/fix-t2-onboarding-proposal-execution.md`
- **Proposal Flow:** `docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md`

---

## Prompt for New Session

Copy everything above this line, then add:

---

**Your Task:**

1. **Diagnose first** - Run the diagnostic steps above to determine whether this is:
   - Hypothesis A: SSR data source problem
   - Hypothesis B: PostMessage state management problem

2. **Based on diagnosis**, create a revised plan that:
   - Addresses the actual root cause (not symptoms)
   - Includes all security requirements (tenant ownership, cache protection)
   - Includes all agent-native requirements (get_draft tool, advisory locks)
   - Follows the "simplest solution that works" principle
   - Does NOT include unrelated fixes (orchestrator consistency is separate ticket)

3. **The plan must be enterprise-grade** - no shortcuts, proper locking, proper auth, proper testing.

Start by reading the key files and tracing the draftConfig data flow. Report findings before proposing solutions.
