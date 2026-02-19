# Learnings Researcher Findings — Production Storefront Hardening Plan

**Date:** 2026-02-18
**Context:** Searching compound docs for patterns relevant to 7 production storefront hardening issues
**Solutions searched:** `docs/solutions/`, `docs/brainstorms/`, `docs/plans/`
**Relevant compound docs found:** 11

---

## Issue 1: Seed Data Field Mismatches (bookingType, field naming)

**Relevant docs:**

- `docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md`
  - Direct match. Seed file called `JSON.stringify()` on Prisma `Json` columns (auto-serialize) causing double-encoding. Storefront crash pattern: `Cannot use 'in' operator to search for 'title'`. In-memory caches (5-min TTL and 900s `CatalogService` TTL) served stale bad data even after database was corrected.
  - **Warning:** After any re-seed, restart the API server or wait 5 minutes. Stale cache creates false negatives — looks like the seed failed when it succeeded.

- `docs/solutions/typescript-build-errors/ENTITY-FIELD-NAMING-PREVENTION.md`
  - Field naming mismatch trap: schema defines `balancePaidAt`, entity uses `paidAt` — silent TypeScript error. `bookingType` / `booking_type` is the same class of error.
  - **Warning:** Field renames must propagate to schema, entity types, services, tests, AND mock adapters. Missing even one causes runtime failures that TypeScript misses if mocks don't match production types.

- `docs/solutions/data-issues/storefront-tier-names-silent-filter-MAIS-20251214.md`
  - Seed data used human-readable names ("Elopement") where canonical values were required (`tier_1`). Frontend `extractTiers()` silently dropped unrecognized values — no error, no warning.
  - **Warning:** Silent filtering is the danger pattern. Any field that drives a switch/filter/lookup must use canonical values in seed data. Grep: `JSON.stringify` in `server/prisma/seeds/`.

---

## Issue 2: Removing Hardcoded UI Components (HowItWorksSection deletion)

**Relevant docs:**

- `docs/solutions/patterns/static-dynamic-section-heading-collision.md`
  - Exact match. `HowItWorksSection` is a static component embedded directly in `TenantLandingPage.tsx` alongside dynamic `SectionRenderer`. When the agent authored an About section titled "How It Works", two consecutive identically-named `<h2>`s appeared — silent at the rendering layer, no console errors.
  - **Warning:** Before deleting `HowItWorksSection`, verify `SECTION_TYPE_TO_ANCHOR_ID` mapping, agent system prompt reserved headings list, and `TenantLandingPage.tsx` composition order. Deleting the component without removing its anchor ID entry will break nav scroll targets.

- `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`
  - After deleting a component file, incremental TypeScript build passes locally (unchanged importers are not re-checked) but CI clean build fails.
  - **Warning:** Run `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck` before committing any deletion. This is Pitfall #14 in CLAUDE.md.

---

## Issue 3: Field Name Transform Bugs (testimonials: name → authorName)

**Relevant docs:**

- `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`
  - Documents the full field mapping table: seed file uses `image`/`backgroundImage`, component props use `imageUrl`/`backgroundImageUrl`. `transformContentForSection()` in `apps/web/src/lib/storefront-utils.ts` bridges them.
  - **Warning:** `name` → `authorName` is exactly this pattern. If the seed uses `name` but the component expects `authorName`, `transformContentForSection()` must have a `testimonials` case that maps it. The transform is the single seam for all field name aliasing.

- `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`
  - Bug 1 was a missing `pricing` case in `transformContentForSection()` — `items` field not mapped to `tiers`. The null then defeated the `= []` default (JS default params only activate for `undefined`, not `null`), crashing the React tree.
  - **Warning (CRITICAL):** When adding a `testimonials` transform case, use `Array.isArray()` guards on the output arrays, NOT default parameter destructuring. `null` defeats `= []`. A missing transform case kills the entire React tree via the ErrorBoundary.

---

## Issue 4: Google Fonts / Next.js `<link>` in Body Issues

**Relevant docs:**

- `docs/solutions/architecture/per-tenant-css-theming-semantic-tokens-and-branding-route-fix.md`
  - Direct match and resolved pattern. `next/font/google` only works for build-time-known fonts. Per-tenant fonts are data-driven (stored as `fontPreset` column). The solution is `<link>` tags in the component body (in `TenantSiteShell`), not `next/font`. Google Fonts includes `font-display: swap` by default, preventing layout shift.
  - **Warning:** React/Next.js emits a hydration warning for `<link>` in body (HTML spec requires it in `<head>`). This is a known acceptable tradeoff for data-driven fonts. The existing implementation in `TenantSiteShell` already uses this pattern — any new Google Fonts integration should follow the same approach rather than introducing `next/font/google` for dynamic fonts.

---

## Issue 5: `reveal-on-scroll` / Scroll Animation Bugs

**Relevant docs:**

- `docs/solutions/ui-bugs/scroll-reveal-playwright-inline-opacity-specificity.md`
  - Exact match. `useScrollReveal` hook sets `el.style.opacity = '0'` as an inline style (specificity 1000). Playwright full-page screenshots never fire IntersectionObserver (below-fold elements are never in viewport). Adding `.reveal-visible` class alone does NOT work — the inline style wins the cascade.
  - **Warning (CRITICAL):** To fix scroll-reveal elements in Playwright or SSR contexts, you must BOTH clear the inline style AND add the class: `el.style.opacity = ''` (or `= '1'`) + `el.classList.add('reveal-visible')`. Adding only the class is a known-broken half-fix. The relevant hook is `apps/web/src/hooks/useScrollReveal.ts` lines 39 and 54.

---

## Issue 6: Nav Derivation from Sections vs Page Flags

**Relevant docs:**

- `docs/solutions/patterns/SECTION_TYPES_CONSTANT_DRIFT_RESOLUTION.md`
  - The 10-step checklist for adding any new section type includes adding anchor IDs to `SECTION_TYPE_TO_ANCHOR_ID` (step in SectionRenderer). Navigation links derived from sections depend on this mapping. If nav is derived from `KNOWN_SECTION_TYPES` or `BLOCK_TO_SECTION_MAP`, those lists must be in sync.
  - **Warning:** A section type that exists in the DB but is missing from the frontend map will be silently excluded from navigation. This is the same constants-duplication trap that caused P1 section loss in the onboarding redesign.

- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
  - Root pattern doc. If nav items are derived from sections rather than page flags, the derivation logic is implicitly an 8th location for section type constants. Any new section type must update the nav derivation logic too.
  - **Warning:** Use `Record<SectionTypeName, ...>` over `Set.has()` allowlist patterns. TypeScript exhaustiveness checking on a `Record` surfaces missing cases at compile time. `Set.has()` silently returns false for unknown types.

---

## Issue 7: Checkout Price Display Confusion

**Relevant docs:**

- `docs/solutions/integration-issues/multi-tenant-stripe-checkout-url-routing.md`
  - Checkout URLs and metadata must be generated per-request (dynamically, from tenant context) not at startup via static env vars. If price display shows wrong amounts, suspect static vs dynamic config — environment variables are for deployment config, not per-tenant pricing config.

- `docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md`
  - `scalingRules` (the per-person pricing config on Tier) is a `Json` column. The littlebit-farm seed had this double-encoded — `scalingRules` returned as a string, breaking "From $X +$Y/person beyond Z guests" display format.
  - **Warning:** After fixing any seed or transform bug touching `scalingRules`, verify the API response returns a plain object (not stringified JSON): `typeof response.scalingRules === 'object'`.

---

## Cross-Cutting Warnings

1. **Silent filter pattern** is the highest-risk class of bug in this codebase. Field mismatches, section type drift, and transform gaps all fail silently — no error, no warning, just missing UI.

2. **Cache invalidation gap after seed** — seeds write directly to Prisma, bypassing `SectionContentService.publishAll()`. After any seed run, the in-memory LRU cache serves stale data for up to 5 minutes (`SectionContentService`) or 15 minutes (`CatalogService.getAllTiers`). Restart API server after seeding to clear.

3. **Orphan imports after deletion** (Pitfall #14) — always run clean typecheck after deleting any component or export. Incremental TypeScript passes locally, CI clean build fails.

4. **Constants duplication trap** — every new section type or field transform touches 7+ locations. See `SECTION_TYPES_CONSTANT_DRIFT_RESOLUTION.md` for the full 10-step checklist.

---

## Previous Session Findings (Deploy Pipeline, 2026-02-18)

The remainder of this file contains findings from an earlier session about the deploy pipeline (IPv6 seed failures, cache staleness after seeding). Those findings remain valid and are not repeated above.

---

## Issue 1: AUTH_SECRET Missing During Next.js Build

### Prior Art Found

**`docs/solutions/PRODUCTION_DEPLOYMENT_FIXES-20251206.md`**

- Documents the exact pattern: runtime env vars missing during build.
- Prior fix was for `BOOKING_TOKEN_SECRET`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`.
- The solution established the pattern of placeholder values for build-time-only vars.
- **Status:** `deploy-production.yml` now has `AUTH_SECRET: production-build-placeholder-not-used-at-runtime` at line 211, matching the documented pattern. **RESOLVED.**

### Assessment

This was a NEW manifestation of a KNOWN pattern. NextAuth v5 requires `AUTH_SECRET` at build time for page data collection. The `main-pipeline.yml` already had this placeholder, but `deploy-production.yml` didn't. The compound doc from Dec 2025 only covered the 3 Render env vars, not the Next.js build-time vars.

**Prevention gap:** The 2025-12-06 compound doc should have established a general rule: "Any new env var that's needed at build time must be added to BOTH `main-pipeline.yml` AND `deploy-production.yml`." Instead, it documented the specific vars, not the pattern.

---

## Issue 2: Render Health Check Timeout

### Prior Art Found

**`docs/solutions/deployment-issues/render-supabase-client-database-verification.md`**

- Documents Render deploy failing during startup with database verification errors.
- Root cause was using Supabase JS client instead of Prisma for DB verification.
- **Status:** Already fixed (commit `386dcdb`). Current health check at `/health/ready` uses Prisma `$queryRaw`.

**`docs/solutions/HEALTH_CHECK_GROUPING_IMPLEMENTATION.md`**

- Documents the health check architecture (3-tier: `/health/live`, `/health/ready`, `/health`).

**`server/src/routes/health.routes.ts`** (current code)

- The `/health/ready` endpoint checks:
  1. Database connectivity via `prisma.$queryRaw`
  2. Required env vars: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Returns 503 if ANY check fails.

### Assessment

The health check timeout in the deploy workflow (`deploy-production.yml` lines 397-421) polls `/health/ready` with 30 attempts at 10-second intervals after a 45-second initial wait (total: ~345 seconds). Failure scenarios:

1. **Render hasn't finished building/deploying** — The deploy hook triggers Render's build pipeline, which takes its own time. The 45-second wait may not be enough for Render to finish building.
2. **Missing env vars on Render** — If `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` are not set on Render, `/health/ready` returns 503 forever.
3. **Database connection failure** — If the Render service can't reach Supabase (see Issue 3).
4. **Render cold start** — Free/starter tier services spin down. First request after deploy may take 30+ seconds.

**Most likely cause:** Render's own build + deploy cycle takes longer than 45 seconds. The deploy hook triggers an async build on Render's side. The GitHub Actions job starts polling before Render's build even completes.

**This is likely a NON-BLOCKING issue for the seed goal.** The API is already running on Render (auto-deployed from main). The `deploy-api-production` job in the workflow is secondary to the seed job. Seed success doesn't depend on this job passing.

---

## Issue 3: ENETUNREACH IPv6 on Seed Job

### Prior Art Found — EXTENSIVE (3 compound documents)

**`docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md`** (2025-12-23)

- **Exact same bug.** Documents ENETUNREACH errors when connecting to `db.*.supabase.co`.
- Root cause: Direct Supabase hostnames resolve to IPv6 only; many environments lack IPv6.
- Solution: Use session pooler URL (`*.pooler.supabase.com`) which has both IPv4 and IPv6.
- **This solution was created 2 months ago and directly applies.**

**`docs/solutions/database-issues/SUPABASE_IPV6_CONNECTION_PREVENTION.md`** (2025-12-23)

- 800+ line prevention strategy with diagnostics, doctor script enhancements, and environment-specific guidelines.
- Explicitly documents: "CI uses local PostgreSQL containers (IPv4 localhost:5432) which always works. Local development / production use Supabase (remote host with DNS resolving to IPv6)."
- **GitHub Actions runners are in the same category as "local dev" — they use public internet to reach Supabase, and lack IPv6.**

**`docs/solutions/database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md`** (2025-12-23)

- One-page cheat sheet: "IPv6 Error? Use Connection Pooler. Change: db.xxx.supabase.co:5432 To: pooler.supabase.com:6543"

### Assessment

This is a **RECURRING issue that was already fully documented and solved**. The `PRODUCTION_DATABASE_URL` GitHub secret was set to the direct Supabase URL (`db.*.supabase.co`) which is IPv6-only. GitHub Actions runners don't support IPv6.

**Issue 4 (NODE_OPTIONS didn't help)** is also documented in the compound knowledge: "Prisma uses its own Rust query engine, ignores Node.js DNS settings." The `deploy-production.yml` has `NODE_OPTIONS: '--dns-result-order=ipv4first'` at line 51, but as the compound doc explains, this only affects Node.js's `dns.lookup()` — Prisma bypasses it.

**Fix applied:** Updated `PRODUCTION_DATABASE_URL` GitHub secret to use the session pooler URL. Seed now succeeds.

**Prevention failure analysis:** The compound doc from 2025-12-23 recommended:

1. Add DATABASE_URL validation to doctor script — NOT DONE
2. Use session pooler everywhere — NOT ENFORCED for GitHub secrets
3. Add `.env.example` with pooler URL — PARTIALLY DONE (local .env but not GitHub secrets)

The prevention gap is that GitHub secrets are invisible and can't be validated by doctor scripts or code review. The only defense is documentation + checklists.

---

## Issue 5: Why Aren't New Sections Showing on the Storefront?

### Data Flow Trace (Seed -> Database -> API -> Frontend)

**Seed file analysis** (`server/prisma/seeds/little-bit-horse-farm.ts`):

- Creates 6 sections: HERO, FEATURES (How It Works), ABOUT (The Story), SERVICES (Experiences), FAQ, CTA
- All created with `isDraft: false` and `publishedAt: new Date()`
- All created with correct `blockType` enum values
- Content uses native JS objects (no `JSON.stringify` — the double-encoding bug from 2026-02-16 is already fixed)

**Service layer** (`server/src/services/section-content.service.ts`):

- `getPublishedSections()` filters by `isDraft: false` (line 286-296)
- Results are cached in LRU cache with 5-minute TTL (key: `published:${tenantId}`)
- Cache is only invalidated on `publishAll()` or `publishSection()` calls

**API route** (`server/src/routes/public-tenant.routes.ts`):

- `GET /v1/public/tenants/:slug/sections` calls `sectionContentService.getPublishedSections()`
- Returns serialized sections with all fields

**Frontend** (`apps/web/src/lib/storefront-utils.ts`):

- `sectionsToPages()` converts `SectionContentDto[]` to `PagesConfig`
- `BLOCK_TO_SECTION_TYPE` mapping handles all 12 block types correctly
- `transformContentForSection()` handles field name remapping (title->headline, items->features, body->content, etc.)

**Frontend rendering** (`apps/web/src/components/tenant/TenantLandingPage.tsx`):

- `buildHomeSections()` splits sections into pre-tier (hero, about) and post-tier (features, faq, cta)
- SERVICES section extracted as heading metadata for SegmentTiersSection
- All section types have SectionRenderer cases

**SectionRenderer** (`apps/web/src/components/tenant/SectionRenderer.tsx`):

- Handles all types: hero, text, about, gallery, testimonials, faq, contact, cta, pricing, features, services, custom
- Error boundaries isolate crashes per section

### Root Cause Analysis

The code path is complete and correct. The seed data uses the right `isDraft: false` flag. Section types are all synced (the 2026-02-13 drift was already fixed). The frontend handles all block types.

**The most likely reasons the storefront still shows OLD data are, in order of probability:**

#### Hypothesis 1: API Server Cache (LRU — 5 minute TTL) — MOST LIKELY

The `SectionContentService.publishedCache` (line 187) is an in-memory LRU cache. After the seed writes new data directly to the database, the Render API server's in-memory cache still holds the old published sections. The cache is ONLY invalidated when `publishAll()` or `publishSection()` is called via the service layer — NOT when data changes via direct database writes (seeds).

**Prior art:** `docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md` (2026-02-16) documents this EXACT pattern: "In-memory cache in SectionContentService.publishedCache was serving stale double-encoded data from an old seed run. The original seed had wrapped every Json column value with JSON.stringify(), causing double-encoding. Re-seeding with correct data didn't clear the cache."

**Fix:** Restart the Render API service. This clears all in-memory caches. Alternatively, wait 5 minutes for the TTL to expire.

#### Hypothesis 2: Next.js ISR Cache (60-second revalidation)

The storefront page has `export const revalidate = 60` (line 156 of `page.tsx`). After the API cache clears, Next.js may still serve its own cached version for up to 60 seconds.

**Fix:** Wait 60 seconds after API cache clears, or manually trigger revalidation.

#### Hypothesis 3: Seed Transaction Didn't Commit

If the seed job logged success but the `$transaction` threw after logging, the data wouldn't persist. The seed has a 120-second timeout (`{ timeout: 120000 }`). Check the GitHub Actions log for the seed job — look for:

- "Little Bit Farm seed transaction committed successfully" (success)
- vs. error messages about transaction timeout

#### Hypothesis 4: Seed Ran Against Wrong Database

If `PRODUCTION_DATABASE_URL` was recently changed (from direct to pooler), verify the new URL points to the same database. Session pooler and direct connection should point to the same underlying database, but different port/hostname.

### Recommended Fix Sequence

1. **Verify seed actually ran:** Check GitHub Actions logs for "LITTLE BIT FARM SEED COMPLETE" message
2. **Restart Render API service:** Clears in-memory caches (published sections + catalog service)
3. **Wait 60 seconds:** For Next.js ISR to expire
4. **Hard refresh browser:** Clear any client-side HTTP cache
5. **Verify via API directly:** `curl https://[API_URL]/v1/public/tenants/littlebit-farm/sections | jq '.sections | length'` — should return 6

---

## Prior Solutions Consulted (Full Index)

| #   | Solution Document                                                         | Relevance                                  | Status                                    |
| --- | ------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| 1   | `database-issues/supabase-ipv6-session-pooler-connection.md`              | **DIRECT** — Exact same IPv6 bug           | Should have been applied from the start   |
| 2   | `database-issues/SUPABASE_IPV6_CONNECTION_PREVENTION.md`                  | **DIRECT** — Prevention strategy for IPv6  | Prevention measures not fully implemented |
| 3   | `database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md`                        | **DIRECT** — Quick fix reference           | Not consulted before deploy               |
| 4   | `database-issues/prisma-json-double-encoding-seed-cache-amplification.md` | **DIRECT** — Cache staleness after seeding | Documents the exact cache issue           |
| 5   | `PRODUCTION_DEPLOYMENT_FIXES-20251206.md`                                 | Related — Runtime env var patterns         | AUTH_SECRET is a new variant              |
| 6   | `deployment-issues/render-supabase-client-database-verification.md`       | Related — Render startup failures          | Different root cause but same area        |
| 7   | `HEALTH_CHECK_GROUPING_IMPLEMENTATION.md`                                 | Related — Health check architecture        | Context for Issue 2                       |
| 8   | `patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`                    | Verified — Section types synced            | Already fixed, not causing current issue  |
| 9   | `patterns/SECTION_TYPES_CONSTANT_DRIFT_RESOLUTION.md`                     | Verified — All types handled               | Already fixed                             |
| 10  | `integration-issues/storefront-cors-and-tier-display-regression.md`       | Related — Prior storefront display bugs    | Different root cause                      |
| 11  | `plans/HANDOFF-section-types-sync.md`                                     | Verified — Already executed                | All 6 fixes were applied                  |

---

## Recurring Patterns

### Pattern 1: Supabase IPv6 Keeps Biting

This is the **third time** IPv6 issues have caused production problems:

1. 2025-12-23: Local dev can't reach Supabase
2. 2026-02-18: GitHub Actions seed job can't reach Supabase
3. Future: Any new environment without IPv6 will hit this

**Prevention:** Add a check to deploy-production.yml that validates the DATABASE_URL format before running any database operations:

```yaml
- name: Validate database URL uses pooler
  run: |
    if echo "$DATABASE_URL" | grep -q "db\..*\.supabase\.co"; then
      echo "ERROR: DATABASE_URL uses direct Supabase connection (IPv6 only)"
      echo "Change to pooler URL: *.pooler.supabase.com"
      exit 1
    fi
```

### Pattern 2: In-Memory Cache After Direct DB Writes

Every time data is written directly to the database (seeds, migrations, manual SQL), in-memory caches go stale. The compound doc from 2026-02-16 established this, but the seed workflow doesn't include a cache-clear step.

**Prevention:** After the seed job, the deploy workflow should either:

1. Restart the Render API service (clears all caches)
2. Call a cache-invalidation endpoint (doesn't exist yet)
3. At minimum, wait 5 minutes before testing the storefront

### Pattern 3: Deploy Workflow Doesn't Match Production Architecture

The deploy-production.yml assumes a linear pipeline (build -> migrate -> seed -> deploy API -> deploy web). But Render auto-deploys from main independently. The workflow's "deploy API" step triggers a deploy hook AND polls for health, but by the time the seed runs, Render may have already auto-deployed. The health check timeout may be because Render is mid-redeploy (triggered by auto-deploy) when the workflow starts polling.

**Prevention:** Either disable Render auto-deploy and rely solely on the workflow's deploy hook, or remove the health check polling from the workflow and let Render handle it.

---

## Pending Todos (Relevant)

| Todo                                                                              | Relevance                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `11002-pending-p2-seed-deletemany-breaks-when-bookings-exist.md`                  | Related — seed cleanup fails if bookings exist         |
| `11004-pending-p2-seed-missing-test-coverage-about-cta-services-hero-sections.md` | Related — test gaps for the exact sections in question |
| `11006-pending-p2-move-existing-tenant-read-inside-transaction.md`                | Related — seed transaction isolation                   |

---

## Key Findings Summary

1. **IPv6 issue was fully documented 2 months ago** — 3 compound docs exist. The `PRODUCTION_DATABASE_URL` GitHub secret should have used the pooler URL from the start.

2. **Storefront not showing new sections is almost certainly a cache issue** — The `SectionContentService.publishedCache` (5-min LRU) and Next.js ISR (60s) both cache published sections. Seeds bypass the service layer, so caches aren't invalidated. **Fix: Restart Render API, wait 60s.**

3. **The seed data is correctly configured** — `isDraft: false`, `publishedAt: new Date()`, correct blockType values, no JSON.stringify double-encoding, all section types synced in frontend/backend.

4. **The Render health check timeout is a separate issue** from the seed/storefront problem. It's likely caused by Render's build cycle being slower than the 45-second initial wait, or missing env vars on Render.

5. **3 prevention gaps remain:**
   - GitHub secrets can't be validated by code review or doctor scripts
   - Seed workflow has no cache-invalidation step
   - Deploy workflow timing assumptions don't match Render's async build cycle
