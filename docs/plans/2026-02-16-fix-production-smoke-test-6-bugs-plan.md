---
title: 'fix: Production Smoke Test — 6 Critical Bugs'
type: fix
status: complete
date: 2026-02-16
reviewed: 2026-02-16 (8-agent review, 28 deduplicated findings applied)
---

# fix: Production Smoke Test — 6 Critical Bugs

## Overview

Full end-to-end smoke test on production (gethandled.ai) with 2 fresh test accounts revealed 6 bugs blocking storefront rendering, onboarding flow, and dashboard functionality. Two are P1 (all storefronts broken, onboarding blocked), two P2 (UX degradation), two P3 (cosmetic/prompt).

**Test Accounts:**

- `smoketest-1771278423676@test.com` → tenant `ember-amp-ash-photography-1771278792778`
- `smoketest-1771279162571@test.com` → tenant `ember-ash-photography-1771279208898`

## Bug Summary

| #   | Priority | Bug                                         | Root Cause                                                                                 | Files                                                                                 |
| --- | -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | **P1**   | Storefront crash — pricing section          | No `'pricing'` case in `transformContentForSection()`                                      | `storefront-utils.ts`, `SectionRenderer.tsx`                                          |
| 2   | **P1**   | Agent chat hangs after tool calls           | Frontend fetch has no timeout + backend ADK timeout too short                              | `useTenantAgentChat.ts`, `TenantAgentChat.tsx`, `tenant-admin-tenant-agent.routes.ts` |
| 3   | **P2**   | Raw `[SESSION CONTEXT]` visible in chat     | No filtering of context prefix in message display                                          | `tenant-admin-tenant-agent.routes.ts`, `ChatMessage.tsx`                              |
| 4   | **P2**   | Missing tenant-admin tier route (404)       | `GET /tiers` never created after Package→Tier migration                                    | `tenant-admin.routes.ts`                                                              |
| 5   | **P3**   | Agent parrots user input verbatim           | System prompt lacks anti-parroting instruction                                             | `system.ts`                                                                           |
| 6   | **P3**   | `&` encoded as `amp` in slugs + stored name | Global sanitize middleware HTML-encodes `&` before slug generation AND tenant name storage | `auth-signup.routes.ts`                                                               |

---

## Phase 1: Storefront Crash Fix (Bug 1) — BLOCKS ALL STOREFRONTS

### Root Cause Analysis

The storefront rendering pipeline:

1. API returns sections with database field names (e.g., `items` for pricing tiers)
2. `transformContentForSection()` maps DB field names → component prop names
3. Section components render with transformed data

**The gap:** `transformContentForSection()` (`apps/web/src/lib/storefront-utils.ts:61-92`) has cases for `text/about`, `hero`, `features/services`, `gallery` — but **no case for `pricing`**. Database content with `items` field passes through unchanged. PricingSection expects `tiers`.

**Crash path:** When `tiers` is explicitly `null` (not just missing), JS default parameters (`tiers = []`) don't activate → `.map()` on `null` → `TypeError` → React tree dies → TenantSiteShell never mounts → no CSS vars, no fonts, no theming.

**Prior art:** `docs/solutions/agent-issues/ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md` documented this exact `.map()` crash pattern — `null` defeats `= []` defaults.

**Review note (data-integrity-guardian):** Verify actual PRICING section content JSON in the production DB for test tenants. `PricingContentSchema` stores display settings (`title`, `subtitle`, `showComparison`), not tier data. If `items` is NOT present in the content JSON, the crash root cause may be that `tiers` arrives as `null`/`undefined` from the route (not joined), not from a missing transform. The `items` → `tiers` mapping is still correct to add defensively.

### Changes

#### 1.1 Add pricing transform case + default catch-all

**File:** `apps/web/src/lib/storefront-utils.ts`
**Location:** Inside `switch (sectionType)` block (~line 61-92)

```typescript
case 'pricing':
  if ('items' in content && !('tiers' in content)) {
    transformed.tiers = content.items;
    delete transformed.items;
  }
  // Ensure tiers is always an array (Array.isArray guards against non-array truthy values)
  if (!Array.isArray(transformed.tiers)) {
    transformed.tiers = [];
  }
  break;

// After all specific cases — catch-all null-coalescing for known array fields
default: {
  const arrayFields = ['items', 'tiers', 'features', 'images', 'testimonials', 'questions'];
  for (const field of arrayFields) {
    if (field in transformed && !Array.isArray(transformed[field])) {
      transformed[field] = [];
    }
  }
  break;
}
```

#### 1.2 Add defensive null coalescing in section components

**Files:** All components in `apps/web/src/components/tenant/sections/`

For each component, replace the destructured default with explicit null guard using `Array.isArray()`. Use the correct variable name per component:

| Component                 | Array prop | Guard                                                           |
| ------------------------- | ---------- | --------------------------------------------------------------- |
| `PricingSection.tsx`      | `tiers`    | `const safeTiers = Array.isArray(tiers) ? tiers : [];`          |
| `FeaturesSection.tsx`     | `features` | `const safeFeatures = Array.isArray(features) ? features : [];` |
| `GallerySection.tsx`      | `images`   | `const safeImages = Array.isArray(images) ? images : [];`       |
| `TestimonialsSection.tsx` | `items`    | `const safeItems = Array.isArray(items) ? items : [];`          |
| `FAQSection.tsx`          | `items`    | `const safeItems = Array.isArray(items) ? items : [];`          |

Remove the destructured default (`= []`) to avoid the double-allocation pattern, and use the safe variable throughout.

#### 1.3 Add per-section Error Boundary (minimal class component)

**File:** `apps/web/src/components/tenant/SectionRenderer.tsx`

**Do NOT install `react-error-boundary`** — it's not in the project. Write a minimal class component inline (~12 lines):

```typescript
class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; sectionType: string; sectionId?: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    logger.error('Section render failed', {
      sectionType: this.props.sectionType,
      sectionId: this.props.sectionId,
      error: error.message,
      // Do NOT log section content data (security)
    });
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
```

Wrap each section in the render:

```typescript
<SectionErrorBoundary key={section.id} sectionType={section.type} sectionId={section.id}>
  {renderSection(section)}
</SectionErrorBoundary>
```

**Note:** Adding this class component to SectionRenderer requires `'use client'` directive. Verify SectionRenderer doesn't already have it — if not, adding it is fine since all child section components are already client-side.

### Acceptance Criteria

- [ ] Fresh storefront loads without crash for both test tenants
- [ ] Pricing section renders with tier data from database
- [ ] A broken section doesn't kill the entire page
- [ ] CSS vars from TenantSiteShell are injected (theming unblocked)
- [ ] Unit test: `transformContentForSection('pricing', { items: [...] })` returns `{ tiers: [...] }`
- [ ] Unit test: `transformContentForSection('pricing', { tiers: null })` returns `{ tiers: [] }`
- [ ] Unit test: default case null-coalesces non-array values to `[]`

---

## Phase 2: Agent Chat Hang Fix (Bug 2) — BLOCKS ONBOARDING

### Root Cause Analysis

The chat system uses **traditional HTTP JSON** (not SSE). Flow:

1. `useTenantAgentChat.ts:414` → `sendMessageCore()` sets `isLoading = true`
2. Line 436-446 → POST to `/api/tenant-admin/agent/tenant/chat`
3. Line 453 → Parse JSON response
4. Line 472-479 → Add assistant message
5. Line 493 → `isLoading = false` in `finally` block

**Primary root cause (confirmed by agent-native-reviewer):** The frontend `fetch()` at line 436 has **NO timeout** — no AbortController, no signal. The backend ADK timeout at `tenant-admin-tenant-agent.routes.ts:541` uses `fetchWithTimeout` defaulting to **30 seconds**, but multi-tool agent turns (e.g., `manage_tiers` x3 + `build_first_draft` + `update_section` x3) realistically take **20-45 seconds**. When the backend times out mid-execution:

- Backend sends 502 → frontend `response.ok` is false → catch block fires → `setError()` runs
- OR: Render proxy times out (60-120s) → network error → `response.json()` throws → caught → `setError()` runs → `finally` runs → `isLoading = false`

**Secondary root cause:** If `fetchAgentGreeting` fails (catch block at line 290-300), it adds a fallback greeting but **never sets `sessionId`** → `sessionId` stays `null` → input permanently disabled (`!sessionId` is always true).

**Input disabled condition** (`TenantAgentChat.tsx:273`):

```typescript
disabled={isLoading || !sessionId}
```

### Changes

#### 2.1 Add frontend fetch timeout (PRIMARY FIX)

**File:** `apps/web/src/hooks/useTenantAgentChat.ts`

Add AbortController with **150-second timeout** (exceeds backend's timeout to avoid masking backend errors):

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 150_000); // 2.5 min
try {
  const res = await fetch(url, { ...opts, signal: controller.signal });
  // ...
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    setError('Request timed out. Please try again.');
  } else {
    setError(err instanceof Error ? err.message : 'Failed to send message');
  }
} finally {
  clearTimeout(timeout);
}
```

#### 2.2 Increase backend ADK timeout

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
**Location:** Line ~541, the `fetchWithTimeout` call to ADK `/run`

Override the default 30s timeout to **120 seconds** for the `/run` endpoint (matches Cloud Run's max request timeout):

```typescript
const response = await fetchWithTimeout(url, opts, 120_000);
```

#### 2.3 Fix sessionId null after greeting failure

**File:** `apps/web/src/hooks/useTenantAgentChat.ts`

In the `fetchAgentGreeting` catch block (line 290-300), ensure a fallback session is created or offer a "Start new session" button when `sessionId` is null and `isInitializing` is false.

#### 2.4 Add recovery mechanism

**File:** `apps/web/src/components/agent/TenantAgentChat.tsx`

If `isLoading` has been true for >60s, show a "Something went wrong. Try again" button that:

1. **Aborts the pending fetch** via stored AbortController ref (CRITICAL — must abort before resetting state)
2. Sets `isLoading = false`
3. If `sessionId` is null, offer "Start new session" instead of "Try again"

#### 2.5 Add diagnostic logging (temporary)

**File:** `apps/web/src/hooks/useTenantAgentChat.ts`

Add `logger.debug()` (NOT `logger.info()` — debug is stripped in production) at key points. **Security rules:**

- Truncate sessionId: `sessionId?.slice(0, 8) + '...'`
- Log `error.message` only, never full error objects
- Mark with `// DIAGNOSTIC: remove after Bug 2 is resolved`

### Acceptance Criteria

- [ ] After agent tool call completes, chat input becomes active within 5s
- [ ] Frontend fetch timeout (150s) surfaces user-visible error message
- [ ] Backend ADK timeout raised to 120s for `/run` endpoint
- [ ] Recovery button appears after 60s of loading, aborts pending fetch
- [ ] Greeting failure doesn't permanently disable input
- [ ] Page refresh restores functional chat (sessionId persisted)

---

## Phase 3: Session Context Filtering (Bug 3)

### Root Cause

Context injection at `server/src/routes/tenant-admin-tenant-agent.routes.ts:522-539` prepends `[SESSION CONTEXT]...[END CONTEXT]` to the user's first message. When chat history is displayed, the raw prefix is visible.

### Changes

#### 3.1 Strip context prefix SERVER-SIDE (primary fix)

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`

The context was injected by the server — the server should clean up its own artifacts. Two locations:

**Location A: `extractMessagesFromEvents()` (~line 805)**
When transforming ADK events into messages for history loading, strip the context prefix from user messages:

```typescript
function stripSessionContext(content: string): string {
  const startTag = '[SESSION CONTEXT]';
  const endTag = '[END CONTEXT]';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endTag, startIdx);
  if (endIdx === -1) return content; // Malformed — return as-is
  return content.slice(endIdx + endTag.length).trim();
}
```

Use `indexOf`-based approach (not regex) for guaranteed O(n), no backtracking. Apply to user-role messages before returning.

**Location B: Chat response handler**
After `extractAgentResponse`, strip context from the user's message echo if the response includes it.

#### 3.2 Lightweight client-side fallback (defense-in-depth)

**File:** `apps/web/src/components/chat/ChatMessage.tsx`

Apply the same `stripSessionContext` as a display-layer fallback for any messages that slip through. Define at module level (not inside component) to avoid re-creation per render.

### Acceptance Criteria

- [ ] Chat history shows clean user messages (no `[SESSION CONTEXT]` prefix)
- [ ] Agent still receives context (backend injection unchanged)
- [ ] New messages don't show context prefix after send
- [ ] Page refresh shows clean history
- [ ] Stripping happens server-side primarily, client-side as fallback

---

## Phase 4: Tenant-Admin Tier Route (Bug 4) — GET ONLY

### Root Cause

The Package → Tier migration (PRs #51-53) removed Package routes but never created a `GET /tiers` endpoint for the tenant-admin API.

Frontend Dashboard (`DashboardView.tsx:88`) calls:

- `/api/tenant-admin/tiers` → 404 (only used to count tiers: `Array.isArray(tiers) ? tiers.length : 0`)

**Review note (architecture-strategist):** The `/api/tenant-admin/stripe/status` 404 is **expected behavior** when Stripe is not configured — `stripeConnect` is optional in DI, and the route is conditionally mounted. The dashboard gracefully degrades (`hasStripeConnected: false`). This is NOT a bug — remove from scope.

### Changes — REDUCED SCOPE (GET only)

**Review finding (code-simplicity-reviewer, architecture-strategist):** The dashboard only calls `GET /tiers` for a count. Full CRUD (POST/PUT/DELETE/PATCH) is not needed — all tier management happens through agent tools. Reducing to GET-only eliminates the need for rate limiters, Zod mutation schemas, booking FK checks, reorder transactions, and API contracts.

#### 4.1 Add GET /tiers to existing route aggregator

**File:** `server/src/routes/tenant-admin.routes.ts`

Add inline in the aggregator (no new file needed for a single GET route):

```typescript
// Tier listing for dashboard
router.get('/tiers', requireAuth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(res);
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  const tiers = await deps.catalogService.getAllTiers(tenantId);
  res.json(tiers);
});
```

`CatalogService.getAllTiers()` delegates to the repository which already enforces `take` bounds (default 50, max 100) and tenant scoping. No additional `take` parameter needed at the route level.

#### 4.2 Remove stale `/packages` references

**Files:** Search frontend for `/tenant-admin/packages` — remove or redirect to `/tenant-admin/tiers`.

### Acceptance Criteria

- [ ] `GET /v1/tenant-admin/tiers` returns tier list (200)
- [ ] Dashboard loads without 404 on `/tiers`
- [ ] Query scoped by `tenantId` (via CatalogService)
- [ ] No new dependencies, no new files

---

## Phase 5: Agent Anti-Parroting (Bug 5)

### Root Cause

System prompt at `server/src/agent-v2/deploy/tenant/src/prompts/system.ts:44` defines confirmation vocabulary but doesn't instruct against repeating user input.

### Changes

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

#### 5.1 Fix existing voice drift

Remove `bet` from confirmation vocabulary at line 44 (it's forbidden in `voice.ts:139`: `Never: bet | say less | aight`). Replace with `cool` (which IS in the approved list).

Before: `got it | done | on it | heard | bet | take a look`
After: `got it | done | on it | heard | cool | take a look`

Add cross-reference comment:

```typescript
// Sync with: server/src/agent-v2/shared/voice.ts TENANT_CONFIRMATIONS
// Canonical allowed: got it | done | on it | heard | queued it | cool | next
```

#### 5.2 Add nuanced anti-parroting instruction

Add to the confirmation vocabulary section, worded to NOT conflict with the Financial Safety Protocol (which requires echoing specific prices for confirmation):

```
**Anti-parroting rule:** Don't repeat what the user just said as your opening line. Instead, acknowledge briefly and act.
- When confirming PRICES or DESTRUCTIVE actions: cite the specific values ("3 tiers: Mini $1,800, Standard $3,000, Full Day $4,500 — creating now")
- When acknowledging intent: summarize in 1 sentence max, don't echo their exact words
- NEVER restate the entire brain dump or rephrase long inputs
-> Acknowledge briefly, then call the appropriate tool
```

**Do NOT use emojis or quoted dialogue in examples** (Pitfall #9). Use action arrow format (`-> Call tool_name()`) for positive examples.

### Acceptance Criteria

- [ ] Agent acknowledges in ≤1 sentence before acting
- [ ] Agent never echoes user's exact phrasing back (except prices/destructive actions)
- [ ] "bet" removed from system.ts confirmation vocabulary
- [ ] Financial Safety Protocol confirmations still work (prices echoed for verification)

---

## Phase 6: Slug + Business Name Sanitization (Bug 6)

### Root Cause (CONFIRMED)

Global sanitize middleware at `server/src/app.ts:200-203` applies `sanitizeInput()` to ALL non-agent routes. `sanitizeObject(req.body)` recursively calls `sanitizePlainText()` → `validator.escape()` → converts `&` to `&amp;`. By the time `auth-signup.routes.ts:82` runs, `req.body.businessName` is already `Ember &amp; Ash Photography`.

The slug regex `[^a-z0-9]+` turns `&amp;` into `-amp-`, producing `ember-amp-ash-photography`.

**Review finding (architecture-strategist, data-integrity-guardian):** The plan originally only fixed the slug. But `businessName` is ALSO passed to `tenantProvisioningService.createFromSignup()` at line 113. The stored `tenant.name` in the database contains `&amp;` — this propagates to storefront headers, emails, and agent context. Fix BOTH slug AND stored name.

### Changes

#### 6.1 Unescape businessName immediately after extraction

**File:** `server/src/routes/auth-signup.routes.ts`

Apply `validator.unescape()` to a clean variable right after extracting from `req.body` (line ~45), BEFORE both slug generation AND provisioning:

```typescript
// Undo global sanitize middleware's HTML encoding for business names
// (React auto-escapes on output, making server-side escaping redundant and harmful)
const cleanBusinessName = validator.unescape(businessName);

// Use cleanBusinessName for BOTH slug generation AND tenant provisioning
const baseSlug = cleanBusinessName
  .toLowerCase()
  .replace(/&/g, 'and')           // & → and (human-readable)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 50);

// Pass cleanBusinessName (not businessName) to provisioning
await tenantProvisioningService.createFromSignup({ name: cleanBusinessName, ... });
```

**Security note:** `validator.unescape()` only reverses HTML entity encoding. The `cleanBusinessName` is safe because:

1. Slug path: subsequent regex strips everything except `a-z0-9`
2. Storage path: React auto-escapes on render; Prisma parameterizes queries
3. `businessName` (original escaped version) is NOT used elsewhere in this function

#### 6.2 Also fix the shared slugify function

**File:** `server/src/routes/internal-agent-shared.ts:61-68`

Apply the same `validator.unescape()` + `&` → `and` mapping. This function is used by agent tools for segment/tier slug creation.

```typescript
import validator from 'validator';

export function slugify(text: string): string {
  return validator
    .unescape(text)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
```

### Acceptance Criteria

- [ ] "Ember & Ash Photography" → slug `ember-and-ash-photography-{timestamp}`
- [ ] "Ember & Ash Photography" → stored name `Ember & Ash Photography` (NOT `Ember &amp; Ash Photography`)
- [ ] "Smith & Co" → slug `smith-and-co-{timestamp}`
- [ ] Existing slugs unaffected (no migration needed)
- [ ] Unit test covers `&`, `<`, `>`, `"` entity decoding in slugify
- [ ] Unit test covers clean business name storage

---

## Implementation Order

```
Phase 1 (Bug 1) ──► Phase 2 (Bug 2) ──► Phase 3 (Bug 3)
     │                                        │
     │                                        ▼
     │                               Phase 5 (Bug 5)
     │
     ├──► Phase 4 (Bug 4) [can parallel with Phase 2]
     │
     └──► Phase 6 (Bug 6) [can parallel with Phase 2]
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 5
**Parallel track:** Phase 4 and Phase 6 are independent after Phase 1

**Optimization:** Phase 3 + Phase 5 can be combined into a single commit (both are agent UX improvements in adjacent server files).

## Testing Strategy

1. **Unit tests** for each fix (transform, slug, context filtering, business name storage)
2. **Workspace typecheck:** `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
3. **Full test suite:** `npm test` (all 1961+ tests)
4. **Manual smoke test:** Repeat the production flow on both test tenants
5. **Deploy:** Push to Render + trigger Cloud Run agent redeploy (`agent=all`) — Phase 5 modifies `system.ts` which IS in the agent deploy directory, so auto-deploy should trigger

## Review Summary (2026-02-16)

8-agent review produced 66 raw findings → 28 deduplicated (7 P1, 12 P2, 9 P3). All P1 findings have been addressed in this plan revision:

| P1                                   | Resolution                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| Phase 4 missing rate limiters        | Eliminated — reduced to GET-only                            |
| Phase 4 missing Zod validation       | Eliminated — reduced to GET-only                            |
| Phase 4 DELETE must check bookings   | Eliminated — reduced to GET-only                            |
| `react-error-boundary` not installed | Changed to minimal class component                          |
| Null guard uses wrong check          | Changed to `Array.isArray()` + per-component variable names |
| "Bet" contradicts voice system       | Removed from vocabulary, replaced with "cool"               |
| Frontend fetch has no timeout        | Made primary fix (Phase 2.1), 150s timeout                  |

**Full review findings:** `docs/reviews/REVIEW-SUMMARY.md` + 8 individual agent reports in `docs/reviews/`

## References

### Internal

- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- `docs/solutions/agent-issues/ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md`
- `docs/solutions/patterns/API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md`
- `docs/solutions/ui-bugs/ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md`
- `docs/solutions/security-issues/PREVENT-CRUD-ROUTE-VULNERABILITIES.md`
- `docs/solutions/agent-issues/AGENT_DEPLOYMENT_ENV_AND_RESPONSE_PARSING.md`
- `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`

### Key Files

- `apps/web/src/lib/storefront-utils.ts` — Section data transform
- `apps/web/src/components/tenant/SectionRenderer.tsx` — Section router
- `apps/web/src/hooks/useTenantAgentChat.ts` — Chat hook (18KB)
- `apps/web/src/components/chat/ChatMessage.tsx` — Message renderer
- `server/src/routes/tenant-admin.routes.ts` — Route aggregator
- `server/src/routes/tenant-admin-tenant-agent.routes.ts` — Agent chat endpoint + context injection
- `server/src/routes/auth-signup.routes.ts` — Signup/slug generation
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` — Agent prompt
- `server/src/agent-v2/shared/voice.ts` — Canonical voice system

### Prior Art

- Package → Tier migration: PRs #51-53
- Onboarding conversation redesign: PR #47
- Constants duplication fix: PR #55
