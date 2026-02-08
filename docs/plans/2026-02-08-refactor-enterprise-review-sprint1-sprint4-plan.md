---
title: 'Enterprise Review Sprint 1 + Sprint 4: Security, Performance, Dead Code'
type: refactor
date: 2026-02-08
source: docs/plans/2026-02-08-enterprise-review-findings.md
reviewed: 2026-02-08 (5-agent parallel review — TypeScript, Security, Simplicity, Architecture, Performance)
status: COMPLETE — PR #42 open, pending smoke test + merge
pr: https://github.com/mikeyoung304/MAIS/pull/42
post_review: 2026-02-08 (6-agent review — 0 P1 regressions, 6 follow-up todos #5236-5241)
---

# Enterprise Review Sprint 1 + Sprint 4

## Overview

Execute the first and fourth sprints from the enterprise code review (42 findings across 4 specialized agents). Sprint 1 addresses **critical security vulnerabilities**, **quick performance wins**, and **legacy code removal** (8 items). Sprint 4 is a **~3,850 LOC dead code purge** of confirmed zero-import files.

**Total scope:** 8 Sprint 1 items + 17+ dead files + barrel cleanup = **~4,800 lines removed/improved**

## Problem Statement

The enterprise review identified:

- **SEC-01:** CORS allows ALL HTTPS origins in production — any attacker-controlled domain reads tenant data
- **SEC-02:** Custom timing comparison leaks secret length (timing oracle) in **3 files** (not 2 — `internal-agent.routes.ts` has the same flaw)
- **SEC-03:** 500 errors return raw Prisma/Cloud Run errors to clients (3 locations)
- **SEC-04:** Impersonation tokens use 7-day expiry (TODO in code acknowledges this)
- **PERF-01:** 14+ unbounded `findMany` calls violating Pitfall #60
- **PERF-02:** Sequential queries in context-builder that should be parallel
- **ARCH-06a:** Multi-page model declared removed but still active — **active 500 bug** (toggle-page tool calls deleted route)
- **ARCH-06b:** Dead `AdvisorMemoryRepository` port + mock (zero consumers)
- **~3,850 LOC** of confirmed zero-import dead code across frontend, LLM module, and agent-v2

---

## Phase 1: Security Hardening (Items 1-4)

### Item 1: CORS Wildcard Fix (SEC-01)

**Risk assessment:** Enforcing a strict allowlist without a migration path could break legitimate access. The solution is **phased**: tighten to project-specific patterns NOW, add full tenant-configured allowlist LATER.

**File:** `server/src/app.ts:125-151`

**Current (vulnerable):**

```typescript
} else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  // Allow all HTTPS origins in production (widget embedding on customer sites)
  callback(null, true);
}
```

**Fix (Phase 1 — ship now):** Replace the blanket HTTPS wildcard with a **known-domain allowlist + project-specific Render/Vercel preview patterns**. This blocks arbitrary attacker domains while preserving all current legitimate access.

> **REVIEW FIX (Blocker #1):** The original plan used `.endsWith('.onrender.com')` and `.endsWith('.vercel.app')`. These are shared hosting domains — anyone with a free Render or Vercel account can deploy `evil.onrender.com` and make credentialed cross-origin requests. Must use project-specific regex patterns instead.

```typescript
// Known production origins (hardcoded)
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  'https://gethandled.ai',
  'https://app.gethandled.ai',
  'https://widget.gethandled.ai',
];

// Merge with environment variable overrides
const allowedOrigins = new Set([...defaultOrigins, ...(config.ALLOWED_ORIGINS || [])]);

// Project-specific preview deployment patterns
// Only match OUR project's preview URLs, not all of Render/Vercel
const RENDER_PREVIEW_RE = /^https:\/\/handled-[a-z0-9-]+\.onrender\.com$/;
const VERCEL_PREVIEW_RE = /^https:\/\/handled-[a-z0-9-]+\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, server-to-server)
      if (!origin) return callback(null, true);

      // Exact match against known origins
      if (allowedOrigins.has(origin)) return callback(null, true);

      // Allow OUR Render preview deployments only
      if (RENDER_PREVIEW_RE.test(origin)) return callback(null, true);

      // Allow OUR Vercel preview deployments only
      if (VERCEL_PREVIEW_RE.test(origin)) return callback(null, true);

      // In development, allow all localhost ports
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }

      logger.warn({ origin, requestId: res.locals.requestId }, 'CORS request blocked');
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Key'],
    exposedHeaders: ['X-Tenant-Key'],
  })
);
```

**IMPORTANT:** Before implementing, verify the actual Render/Vercel preview URL naming convention for this project. Run `git log --oneline | grep -i deploy` or check Render dashboard for the actual service name prefix (e.g., `handled-api-*`, `mais-*`, etc.). Update the regex patterns to match.

**Widget embedding consideration:** Review confirmed there are **no embedded booking widgets** in the codebase. The booking flow is a standard Next.js page at `/t/{slug}/book/{packageSlug}`. The `widget.gethandled.ai` domain in the allowlist is provisioned for future use. CORS is NOT a security boundary — authentication (JWT/API keys) is the real access control.

**Why not tenant-configured allowlist now?** Requires: (1) Prisma schema change for `Tenant.allowedOrigins`, (2) migration to seed existing domains, (3) admin UI to manage domains, (4) caching layer to avoid DB lookup on every preflight. That's a Sprint 2+ item.

---

### Item 2: Replace constantTimeCompare (SEC-02)

> **REVIEW FIX (Blocker #2):** The original plan listed only 2 files and called `internal-agent.routes.ts` "already correct." It's NOT — lines 287-301 have the same `secretBuffer.length !== expectedBuffer.length` early return that leaks length info via short-circuit `||`. **All 3 files** need migration.

**Files (3, not 2):**

- `server/src/routes/internal.routes.ts:177-188` — custom `constantTimeCompare`
- `server/src/routes/metrics.routes.ts:91-101` — custom `timingSafeEqual`
- `server/src/routes/internal-agent.routes.ts:287-301` — manual `Buffer.from` + length check before `timingSafeEqual`

**Current (vulnerable in all 3):**

```typescript
// Pattern 1 (internal.routes.ts, metrics.routes.ts):
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;  // <- Early return leaks length information
  }
  // ...
}

// Pattern 2 (internal-agent.routes.ts — NOT "already correct"):
const secretBuffer = Buffer.from(secretStr);
const expectedBuffer = Buffer.from(expectedSecret);
if (secretBuffer.length !== expectedBuffer.length || !timingSafeEqual(...)) {
  // <- || short-circuits: if lengths differ, timingSafeEqual never called
}
```

**Fix:** Delete all 3 custom functions. Replace call sites with a shared utility:

**New file: `server/src/lib/timing-safe.ts`** (tiny, justified because 3 files need it)

```typescript
import { timingSafeEqual, createHash } from 'crypto';

/**
 * Constant-time string comparison using SHA-256 hashing.
 * Both inputs are hashed to fixed-length digests before comparison,
 * preventing length-based timing oracle attacks.
 *
 * Why hash-then-compare? crypto.timingSafeEqual throws RangeError if
 * buffers have different lengths. Hashing both to SHA-256 (32 bytes)
 * guarantees equal length regardless of input. OWASP-recommended pattern.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
```

**Call site updates:**

1. `internal.routes.ts` — delete `constantTimeCompare` function, import `timingSafeCompare` from `../lib/timing-safe`
2. `metrics.routes.ts` — delete custom `timingSafeEqual` function, import `timingSafeCompare` from `../lib/timing-safe`
3. `internal-agent.routes.ts` — delete manual `Buffer.from` + length check, import `timingSafeCompare` from `../lib/timing-safe`

---

### Item 3: Sanitize 500 Error Responses (SEC-03)

**Files:**

- `server/src/routes/tenant-admin-tenant-agent.routes.ts:653-658` (has `success: false`)
- `server/src/routes/tenant-admin-tenant-agent.routes.ts:1034-1039`
- `server/src/routes/internal-agent.routes.ts:2849-2854`

**Current (leaks internal details):**

```typescript
res.status(500).json({
  error: 'Internal server error',
  message: error instanceof Error ? error.message : 'Unknown error',
});
```

> **REVIEW FIX (Blocker #4):** The original plan proposed a NEW request ID middleware. This already exists — `server/src/middleware/request-logger.ts` generates `randomUUID()` and sets `res.locals.requestId`. A second implementation exists in `server/src/lib/errors/request-context.ts`. Do NOT create a third.

**Fix Step 3a: Enhance existing request-logger middleware** (NOT a new middleware)

Add one line to existing `requestLogger` in `server/src/middleware/request-logger.ts`:

```typescript
res.setHeader('X-Request-ID', requestId);
```

This sets the response header so clients can correlate errors. The `res.locals.requestId` is already populated by this middleware.

> **REVIEW FIX (Warning #7):** Do NOT accept client-supplied `x-request-id`. Always generate server-side to prevent log injection and audit trail confusion.

**Fix Step 3b: Update the 3 error handlers:**

```typescript
logger.error({ error, requestId: res.locals.requestId }, '[TenantAgent] Internal error');
res.status(500).json({
  error: 'Internal server error',
  requestId: res.locals.requestId,
});
```

**Note on `success: false` field:** The first error handler at line 654 includes `success: false`. Verify no frontend code checks this field in 500 responses before removing it. If uncertain, keep `success: false` alongside the new format for safety.

**Also clean up:** `internal.routes.ts:111-115` leaks env var name in error response (`NEXTJS_REVALIDATE_SECRET environment variable not set`). Replace with generic message.

---

### Item 4: Shorten Impersonation Token to 2h (SEC-04)

**File:** `server/src/services/identity.service.ts:63-68`

**Current:**

```typescript
createImpersonationToken(payload: UnifiedTokenPayload): string {
  return jwt.sign(payload, this.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d', // Consider shorter expiry for security
  });
}
```

**Fix:**

```typescript
createImpersonationToken(payload: UnifiedTokenPayload): string {
  return jwt.sign(
    { ...payload, type: 'impersonation' },
    this.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: '2h',
    }
  );
}
```

> **REVIEW FIX (Warning #8):** The `type: 'impersonation'` claim is NOT validated by any middleware. It is purely audit metadata for log analysis, not a security control. Add a code comment to prevent confusion:

```typescript
// NOTE: `type: 'impersonation'` is audit metadata only — NOT used in middleware validation.
// Future: add claim-based route restrictions if needed.
```

**Transition:** Old 7-day tokens naturally expire within 7 days. No forced invalidation needed — the next impersonation creates a 2h token.

---

## Phase 2: Performance Wins (Items 5-6)

### Item 5: Promise.all in context-builder.service.ts (PERF-02)

**File:** `server/src/services/context-builder.service.ts`

**Location 1 (lines 363-368):**

```typescript
// BEFORE (sequential — 2 DB round trips)
if (this.sectionContentService) {
  hasDraft = await this.sectionContentService.hasDraft(tenantId);
  hasPublished = await this.sectionContentService.hasPublished(tenantId);
}

// AFTER (parallel — 1 DB round trip)
if (this.sectionContentService) {
  [hasDraft, hasPublished] = await Promise.all([
    this.sectionContentService.hasDraft(tenantId),
    this.sectionContentService.hasPublished(tenantId),
  ]);
}
```

**Location 2 (lines 600-601):**

```typescript
// BEFORE (sequential)
const structure = await this.sectionContentService.getPageStructure(tenantId, {});
const hasDraft = await this.sectionContentService.hasDraft(tenantId);

// AFTER (parallel)
const [structure, hasDraft] = await Promise.all([
  this.sectionContentService.getPageStructure(tenantId, {}),
  this.sectionContentService.hasDraft(tenantId),
]);
```

**Error handling:** `Promise.all` fail-fast is correct here — if either query fails, context building should fail entirely. No need for `Promise.allSettled`.

**Bonus optimization (from review):** `getBootstrapData()` calls `hasNonSeedPackages()` up to twice — once inside `resolveAndBackfillPhase()` and once on line 415 for `revealCompleted`. Cache the result within method scope:

```typescript
const hasNonSeedPkgsPromise = this.hasNonSeedPackages(tenantId);
// Pass as pre-computed thunk to resolveAndBackfillPhase
// Reuse for revealCompleted check
```

**Impact:** Saves 20-40ms per agent session initialization (one less DB round trip per parallelization).

---

### Item 6: Add `take` to Unbounded findMany (PERF-01)

> **REVIEW FIX (Warning #9):** Use `take` (Prisma convention) consistently. Existing `BookingRepository` uses `limit/offset` — don't change that, but all NEW additions use `take` to match Prisma's API.

> **REVIEW FIX (Blocker #6):** Port interfaces in `ports.ts` MUST be updated — this is a committed step, not an afterthought. Each port method that gains `take` must have the parameter added to its interface signature.

> **REVIEW FIX (Warning #10, #11):** Additional unbounded methods discovered. `listWithStats()` max lowered from 500 to 100 due to expensive `_count` subqueries.

**Pattern:**

```typescript
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

async getAll(tenantId: string, options?: { take?: number }): Promise<Package[]> {
  return this.prisma.package.findMany({
    where: { tenantId },
    take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    orderBy: { createdAt: 'asc' },
  });
}
```

**14 methods to update across 7 files:**

| #   | File                     | Method                             | Default | Max     | Notes                                                           |
| --- | ------------------------ | ---------------------------------- | ------- | ------- | --------------------------------------------------------------- |
| 1   | `catalog.repository.ts`  | `getAllPackages()`                 | 50      | 100     | Agent tools pass explicit `take`                                |
| 2   | `catalog.repository.ts`  | `getAllPackagesWithAddOns()`       | 50      | 100     | Same                                                            |
| 3   | `catalog.repository.ts`  | `getAllAddOns()`                   | 50      | 100     | Same                                                            |
| 4   | `catalog.repository.ts`  | `getAllPackagesWithDrafts()`       | 50      | 100     | **Added by review**                                             |
| 5   | `catalog.repository.ts`  | `getPackagesBySegment()`           | 50      | 100     | **Added by review** (bounded by segment, but principle applies) |
| 6   | `catalog.repository.ts`  | `getPackagesBySegmentWithAddOns()` | 50      | 100     | **Added by review**                                             |
| 7   | `catalog.repository.ts`  | `getAddOnsForSegment()`            | 50      | 100     | **Added by review**                                             |
| 8   | `service.repository.ts`  | `getAll()`                         | 50      | 100     |                                                                 |
| 9   | `service.repository.ts`  | `getActiveServices()`              | 50      | 100     |                                                                 |
| 10  | `tenant.repository.ts`   | `list()`                           | 50      | 500     | Admin-only, higher limit                                        |
| 11  | `tenant.repository.ts`   | `listWithStats()`                  | 50      | **100** | **Lowered by review** — expensive `_count` subqueries           |
| 12  | `tenant.repository.ts`   | `listActive()`                     | 50      | 500     | **Added by review** — sitemap gen                               |
| 13  | `project-hub.service.ts` | `getTimeline()`                    | 100     | 200     | **Lowered by review** from 500                                  |
| 14  | `audit.service.ts`       | `getEntityHistory()`               | 100     | 500     | Audit log                                                       |

**Also:** `audit.service.ts` `getTenantAuditLog()` already has `take` but lacks max enforcement. Add `Math.min(options?.limit ?? 50, MAX_LIMIT)`.

**Port interface updates (REQUIRED):** For each method above that has a port interface in `ports.ts`, add the optional `take` parameter to the interface signature. Check mock implementations too.

**Approach:** Add optional `take` parameter with sensible defaults. Do NOT change return types or add `hasMore` yet — that's a contract change for a future sprint. This sprint only adds a safety net against unbounded queries.

**Agent tool consideration:** Agent-facing callers (internal-agent.routes.ts) that need complete catalogs should explicitly pass `{ take: MAX_PAGE_SIZE }`. Most tenants have <20 packages, so 100 is safe.

---

## Phase 3: Legacy Code Removal (Items 7-8)

### Item 7: Complete Multi-Page Model Removal (ARCH-06a)

**Active 500 bug:** The `toggle-page` agent tool calls a deleted backend route `/storefront/toggle-page`, causing a 500 error when the agent invokes it. The tool is already broken — deleting it is a net improvement.

> **REVIEW FIX (Blocker #3):** The original plan listed 5 files to modify. The actual blast radius is **15+ files** across source, tests, PostMessage protocol, capabilities registry, and store barrels. Full inventory below.

> **REVIEW FINDING:** The store does NOT use `zustand/persist` — it uses `devtools`, `subscribeWithSelector`, and `immer`. No persisted state migration needed. Removal is compile-time only.

> **REVIEW FINDING:** `PageName` type in `@macon/contracts` is NOT dead — public storefronts still have multi-page navigation (`/t/slug/about`, `/t/slug/services`). What we're removing is the admin-side page-_switching_ concept, not storefront pages. `PageName` survives.

**Files to delete:**

1. `apps/web/src/app/(protected)/tenant/website/components/PageSwitcher.tsx` — entire file
2. `server/src/agent-v2/deploy/tenant/src/tools/toggle-page.ts` — entire file (132 LOC)

**Files to modify (full blast radius):**

3. **`apps/web/src/app/(protected)/tenant/website/page.tsx`** — **Imports and renders `PageSwitcher`**. Remove import, remove `<PageSwitcher>` component from JSX, remove `currentPage` state usage.

4. **`apps/web/src/stores/agent-ui-store.ts`** — Remove:
   - `currentPage` from `PreviewConfig` type and initial state
   - `setPreviewPage` action
   - `extractPageFromSectionId()` helper
   - `validPages` array
   - All references to `currentPage` in state mutations
   - `selectCurrentPage` selector
   - `'SET_PAGE'` from `AgentActionType` union and `AgentAction` discriminated union
   - `case 'SET_PAGE'` in the undo switch statement

5. **`apps/web/src/stores/index.ts`** — Remove `selectCurrentPage` re-export

6. **`apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`** — Remove `currentPage` prop. Preview URL should always use base path `/t/${tenantSlug}` without page routing.

7. **`server/src/agent-v2/deploy/tenant/src/agent.ts`** (tool registration) — Remove `toggle-page` import and registration from the tool list.

8. **`apps/web/src/lib/agent-capabilities.ts`** — Remove `toggle_page_enabled` capability entry.

9. **`apps/web/src/lib/build-mode/protocol.ts`** — Remove `BUILD_MODE_PAGE_CHANGE` from `BuildModeChildMessageSchema` union (Pitfall #88 — dead PostMessage type).

10. **`apps/web/src/hooks/useBuildModeSync.ts`** — Remove `notifyPageChange()` sender function (Pitfall #88 — dead PostMessage sender).

11. **`apps/web/src/components/preview/PreviewPanel.tsx`** — Remove dead `case 'BUILD_MODE_PAGE_CHANGE'` handler (already a no-op comment).

**Test files to update:**

12. **`apps/web/src/stores/__tests__/agent-ui-store.test.ts`** — Rewrite/delete `describe('setPreviewPage(page)')` block (~40 references to `currentPage`, `setPreviewPage`, `validPages`, `SET_PAGE`).

13. **`e2e/tests/agent-ui-control.spec.ts`** — Remove `setPreviewPage` from `callAgentUIAction` helper, remove 6+ `currentPage` assertions, remove/rewrite entire "About tab" test case (lines 484-552).

**Agent session note:** `toggle_page` already returns 500 errors in production (backend route deleted). Removing the tool from the agent definition prevents the LLM from attempting to call it. Active sessions may see a transient tool-not-found during the deployment window — this is an improvement over the current 500 error on every invocation.

**Verification:**

```bash
# Pre-deletion: find ALL references
grep -rn "currentPage\|PageSwitcher\|toggle.page\|extractPageFromSectionId\|setPreviewPage\|validPages\|SET_PAGE\|PAGE_CHANGE\|toggle_page" \
  apps/web/src/ server/src/ e2e/ --include="*.ts" --include="*.tsx"
```

---

### Item 8: Delete AdvisorMemoryRepository (ARCH-06b)

**Files to delete:**

1. `server/src/adapters/mock/advisor-memory.repository.ts` — entire file (95 LOC)

**Files to modify:** 2. `server/src/lib/ports.ts:1031-1069` — Delete `AdvisorMemoryRepository` interface + JSDoc. Also remove the orphan `import type { AdvisorMemory }` on line 7 and the `export type { AdvisorMemory }` re-export on line 1082 (both become dead after interface deletion). 3. `server/src/adapters/mock/index.ts` — Remove the `export { MockAdvisorMemoryRepository }` line

> **REVIEW FIX (Warning #14):** Also clean up 5+ stale comment references to avoid confusion:

4. `server/src/di.ts` — Remove/update comments referencing `AdvisorMemoryRepository` (2 locations, lines ~62 and ~111)
5. `server/src/services/context-builder.service.ts` — Remove `AdvisorMemoryService` JSDoc reference (line ~5)
6. `server/src/routes/tenant-admin-tenant-agent.routes.ts` — Remove comment reference (line ~676)
7. `server/src/routes/internal-agent.routes.ts` — Remove comment reference (line ~413)
8. `server/src/routes/index.ts` — Remove comment reference (line ~774)

**Verification:** The `AdvisorMemory` TYPE in `@macon/contracts` is independent of the repository interface — it describes data shape, not data access. It survives deletion.

---

## Phase 4: Dead Code Purge (Sprint 4 — ~3,850 LOC)

All files below have been verified as having **zero production imports** via grep across the entire monorepo. Dynamic imports (`import()`) and barrel re-exports were also checked — no additional consumers found.

### 4a: Frontend Dead Code (11 files, ~2,105 LOC)

| #   | File                                                   | LOC | Verified                                                                             |
| --- | ------------------------------------------------------ | --- | ------------------------------------------------------------------------------------ |
| 1   | `apps/web/src/lib/offline-storage.ts`                  | 764 | Zero imports                                                                         |
| 2   | `apps/web/src/components/ui/MicroInteraction.tsx`      | 337 | Zero imports                                                                         |
| 3   | `apps/web/src/components/ui/PressableButton.tsx`       | 153 | Zero imports                                                                         |
| 4   | `apps/web/src/components/ui/BottomNavigation.tsx`      | 214 | Zero imports                                                                         |
| 5   | `apps/web/src/providers/MobileBottomLayerProvider.tsx` | 277 | Zero imports                                                                         |
| 6   | `apps/web/src/providers/ViewportProvider.tsx`          | 119 | Zero imports                                                                         |
| 7   | `apps/web/src/lib/parseHighlights.ts`                  | 48  | Zero imports                                                                         |
| 8   | `apps/web/src/components/ui/SkeletonGallery.tsx`       | 52  | Zero imports                                                                         |
| 9   | `apps/web/src/components/ui/SkeletonList.tsx`          | 40  | Zero imports                                                                         |
| 10  | `apps/web/src/lib/build-mode/config.ts`                | 28  | Zero imports (grep matches for `BUILD_MODE_CONFIG` are string literals, not imports) |
| 11  | `apps/web/src/lib/build-mode/navigation.ts`            | 73  | Zero imports                                                                         |

### 4b: Backend LLM Module Dead Code (4 files + barrel + test files, ~1,400 LOC)

**PRESERVE:** `server/src/llm/vertex-client.ts` (193 LOC) — **actively imported** by `vocabulary-embedding.service.ts` and `internal-agent.routes.ts`

| #   | File                                | LOC | Verified                                                   |
| --- | ----------------------------------- | --- | ---------------------------------------------------------- |
| 12  | `server/src/llm/pricing.ts`         | 168 | Zero production imports                                    |
| 13  | `server/src/llm/retry.ts`           | 361 | Zero production imports (only cross-import with errors.ts) |
| 14  | `server/src/llm/message-adapter.ts` | 338 | Zero imports (barrel has zero external consumers)          |
| 15  | `server/src/llm/errors.ts`          | 353 | Only cross-import with retry.ts                            |

> **REVIEW FIX (Blocker #5):** Test files that import from deleted modules must also be deleted:
> | 16 | Test file for `retry.ts` | ~est | Must delete to avoid `npm test` failure |
> | 17 | Test file for `errors.ts` | ~est | Same |
> | 18 | Test file for `message-adapter.ts` (if exists) | ~est | Same |

Find with: `grep -rn "from.*retry\|from.*errors\|from.*message-adapter" server/test/ --include="*.test.ts"`

> **REVIEW FIX (Warning #12):** The `llm/index.ts` barrel has **zero external consumers** (nothing imports from `'../llm'` or `'../llm/index'`). All consumers import directly from `'../llm/vertex-client'`. **Delete the barrel entirely** instead of updating it.

**After deletion:** Delete `server/src/llm/index.ts` barrel entirely. `vertex-client.ts` remains as a standalone module.

### 4c: Agent-v2 Dead Code (2 files + barrel, ~527 LOC)

| #   | File                                                 | LOC | Verified                                 |
| --- | ---------------------------------------------------- | --- | ---------------------------------------- |
| 19  | `server/src/agent-v2/memory/isolated-memory-bank.ts` | 244 | Zero imports (exported from barrel only) |
| 20  | `server/src/agent-v2/plugins/reflect-retry.ts`       | 283 | Zero imports (exported from barrel only) |

> **REVIEW FIX (Warning #12):** The `agent-v2/index.ts` barrel also has **zero external consumers**. After deleting the two files above, the barrel has zero remaining exports. **Delete the barrel entirely.**

**After deletion:** Delete `server/src/agent-v2/index.ts` barrel (39 LOC). If the `memory/` and `plugins/` directories are empty after deletion, delete the directories too.

**Cloud Run agent verification:** These files are NOT in the `deploy/` directories — they're in the monorepo server code. The deployed agents (`deploy/customer/`, `deploy/tenant/`, `deploy/research/`) have their own codebases and do NOT import from `agent-v2/memory/` or `agent-v2/plugins/`. Safe to delete.

---

## Execution Order

```
Phase 1: Security (commit 1)
  |- Item 2: constantTimeCompare -> timingSafeCompare in ALL 3 FILES
  |- Item 3: Error sanitization (enhance existing request-logger, NOT new middleware)
  |- Item 4: Impersonation token 7d -> 2h
  +- Item 1: CORS tightening with project-specific regex (last -- depends on Item 3 for request ID logging)

Phase 2: Performance (commit 2)
  |- Item 5: Promise.all in context-builder (+ bonus hasNonSeedPackages dedup)
  +- Item 6: Add take to 14 findMany methods + port interface updates

Phase 3: Legacy removal (commit 3)
  |- Item 7: Multi-page model deletion (15+ files: source, tests, PostMessage, capabilities)
  +- Item 8: AdvisorMemoryRepository deletion + comment cleanup

Phase 4: Dead code purge (commit 4)
  |- 4a: 11 frontend dead files
  |- 4b: 4 LLM source files + associated test files + barrel deletion
  +- 4c: 2 agent-v2 dead files + barrel deletion
```

**Between each commit:** Run clean typecheck per Pitfall #79:

```bash
rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck
```

**After Phase 3 specifically:** Also run `npm test` to catch test file failures from multi-page removal.

---

## Acceptance Criteria

### Security

- [x] No CORS wildcard for arbitrary HTTPS origins — project-specific Render/Vercel regex patterns only
- [x] `constantTimeCompare`, custom `timingSafeEqual`, and manual Buffer length checks deleted in **all 3 files**; replaced with hash-then-compare utility
- [x] 500 error responses return ONLY `{ error: 'Internal server error', requestId }` — no `message` field
- [x] Existing `requestLogger` middleware enhanced with `X-Request-ID` response header (no new middleware)
- [x] Impersonation token expiry is 2h with `type: 'impersonation'` audit claim (documented as non-validated)
- [x] Internal route error at `internal.routes.ts:111-115` no longer leaks env var name

### Performance

- [x] `context-builder.service.ts` uses `Promise.all` for independent queries (2 locations)
- [x] All 14 `findMany` methods have `take` parameter with sensible defaults
- [x] Port interfaces in `ports.ts` updated to match new method signatures
- [x] `listWithStats()` max is 100 (not 500) due to expensive `_count` queries
- [x] No unbounded queries in catalog, service, tenant, project-hub, or audit repositories

### Legacy Removal

- [x] `PageSwitcher.tsx` deleted
- [x] `toggle-page.ts` agent tool deleted + removed from agent registration (fixes active 500 bug)
- [x] `currentPage`, `setPreviewPage`, `extractPageFromSectionId`, `validPages`, `SET_PAGE` removed from agent-ui-store
- [x] `selectCurrentPage` removed from store barrel re-exports
- [x] `toggle_page_enabled` removed from agent-capabilities.ts
- [x] `BUILD_MODE_PAGE_CHANGE` removed from PostMessage protocol, sender, and handler (Pitfall #88)
- [x] E2E tests updated: `agent-ui-control.spec.ts` About tab test removed/rewritten
- [x] Unit tests updated: `agent-ui-store.test.ts` `setPreviewPage` describe block removed
- [x] `AdvisorMemoryRepository` interface, mock, and 5+ stale comment references deleted
- [x] `website/page.tsx` updated to remove `PageSwitcher` import and render

### Dead Code Purge

- [x] 17+ dead source files deleted (~3,850 LOC)
- [x] Associated test files for deleted LLM modules also deleted
- [x] `vertex-client.ts` PRESERVED (actively used)
- [x] `llm/index.ts` barrel DELETED entirely (zero consumers)
- [x] `agent-v2/index.ts` barrel DELETED entirely (zero consumers after file deletion)

### Quality Gates

- [x] Clean typecheck: `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [x] Full test suite passes: `npm test` (8 pre-existing context-builder mock failures, 0 new failures)
- [x] `git diff --stat` confirms ~4,800 lines removed
- [x] No `grep -rn "constantTimeCompare"` results remain
- [x] No `grep -rn "toggle.page\|PageSwitcher\|toggle_page"` results remain (excluding plan files)
- [x] No `grep -rn "BUILD_MODE_PAGE_CHANGE"` results remain (excluding plan files)

---

## Review Findings Log

This plan was reviewed by 5 specialized agents on 2026-02-08. Key amendments:

| #   | Severity | Finding                                                          | Resolution                            |
| --- | -------- | ---------------------------------------------------------------- | ------------------------------------- |
| B1  | BLOCKER  | CORS `.endsWith('.onrender.com')` exploitable by any Render user | Changed to project-specific regex     |
| B2  | BLOCKER  | `internal-agent.routes.ts` has same timing leak as other 2 files | Added as 3rd call site                |
| B3  | BLOCKER  | Multi-page removal blast radius: 15+ files, not 5                | Full file inventory added             |
| B4  | BLOCKER  | Request ID middleware already exists (x2)                        | Removed Step 3a; enhance existing     |
| B5  | BLOCKER  | Test files import from dead LLM modules                          | Added to Phase 4b deletion list       |
| B6  | BLOCKER  | Port interfaces need explicit `take` updates                     | Made committed step in Item 6         |
| W7  | WARNING  | Client `x-request-id` header trust                               | Always generate server-side           |
| W8  | WARNING  | `type: 'impersonation'` claim is cosmetic                        | Documented as audit metadata          |
| W9  | WARNING  | `take` vs `limit` naming inconsistency                           | Standardized on `take` for new code   |
| W10 | WARNING  | 5 additional unbounded `findMany` calls                          | Added to Item 6 table (14 total)      |
| W11 | WARNING  | `listWithStats()` max 500 too high                               | Lowered to 100                        |
| W12 | WARNING  | LLM + agent-v2 barrels are dead code                             | Delete entirely, not update           |
| W13 | WARNING  | Duplicate `hasNonSeedPackages()` calls                           | Added as bonus optimization in Item 5 |
| W14 | WARNING  | `AdvisorMemoryRepository` has 5+ comment refs                    | Added cleanup to Item 8               |
| W15 | WARNING  | `success: false` field in 500 response                           | Added verification note               |
| N1  | NOTE     | Zustand store is NOT persisted (uses devtools/immer)             | Corrected in Item 7                   |
| N2  | NOTE     | No embedded booking widgets exist                                | Documented in Item 1                  |
| N3  | NOTE     | `PageName` type survives deletion                                | Documented in Item 7                  |

---

## References

- **Source:** `docs/plans/2026-02-08-enterprise-review-findings.md`
- **CORS incident:** `docs/solutions/integration-issues/storefront-cors-and-tier-display-regression.md`
- **Security patterns:** `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md`
- **Dead code patterns:** `docs/solutions/code-review-patterns/DEAD_CODE_QUICK_REFERENCE.md`
- **Pitfall #60:** Unbounded `findMany` — `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md`
- **Pitfall #79:** Orphan imports after deletions — `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`
- **Pitfall #88:** Dead PostMessage handlers — `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
