# Deploy Pipeline Architecture Debt Assessment

**Date:** 2026-02-18
**Scope:** Production deploy workflow, seed pipeline, cache layers, pending todos 11001-11008

---

## Section 1: Current State

### Deploy Pipeline Step-by-Step

The production deploy is a 7-job GitHub Actions workflow (`.github/workflows/deploy-production.yml`) triggered in three ways:

1. **`workflow_run`** -- fires after `Main CI/CD Pipeline` completes successfully on `main`
2. **Tag push** (`v*.*.*`) -- runs quick-validation tests first, then deploys
3. **Manual dispatch** -- emergency hotfix path with optional test skip

**Job sequence:**

| Step | Job                           | What it does                                                                                                        | Timeout |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| 0    | `check-ci-status`             | Gate: verifies main-pipeline passed (workflow_run only)                                                             | 2m      |
| 1    | `pre-deployment-checks`       | Checkout, version tag validation, breaking change scan                                                              | 5m      |
| 2    | `quick-validation`            | Lint + typecheck + package builds (tags/manual only)                                                                | 10m     |
| 3    | `build-production`            | Full production build: Prisma generate, contracts, shared, server, Next.js. Uploads 3 artifacts.                    | 10m     |
| 4a   | `migrate-database-production` | Prisma migrate deploy against Supabase. Manual approval gate via `production-migrations` environment.               | 15m     |
| 4b   | `seed-database-production`    | Runs `SEED_MODE=production` which executes `seedPlatform()` then `seedLittleBitHorseFarm()`.                        | 10m     |
| 5    | `deploy-api-production`       | Triggers Render deploy hook, waits 45s, health check retries (30x 10s = 5 min max), then smoke test `/v1/packages`. | 15m     |
| 6    | `deploy-web-production`       | Deploys to Vercel via `amondnet/vercel-action@v25`, verifies client accessible.                                     | 15m     |
| 7    | `post-deployment-validation`  | Installs Playwright, runs E2E against production, creates rollback instructions on failure.                         | 25m     |

**Total worst-case runtime:** ~87 minutes.

### Seed Pipeline: DB to Storefront

The seed orchestrator (`server/prisma/seed.ts`) maps `SEED_MODE=production` to:

1. `seedPlatform(prisma)` -- creates/updates platform admin user
2. `seedLittleBitHorseFarm(prisma)` -- single `$transaction` that:
   - Reads existing tenant outside transaction (debt: #11006)
   - Generates or reuses API keys
   - `deleteMany` on tierAddOn, tier, addOn, sectionContent, segment (clean slate)
   - Creates 3 segments, 8 tiers with scaling rules
   - Creates 6 `SectionContent` rows (`isDraft: false`, `publishedAt: new Date()`) directly as published content
   - Creates 6 blackout dates via upsert

**Critical observation:** The seed writes `SectionContent` rows with `isDraft: false` (published). This bypasses the `SectionContentService.publishAll()` flow entirely and therefore does NOT invalidate the in-memory LRU cache. If the API server is already running when the seed completes, the old published sections remain cached for up to 5 minutes.

### Cache Layers

Three independent cache layers sit between the database and the browser:

| Layer                         | Location                         | TTL                                  | Invalidation                                                          |
| ----------------------------- | -------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| **SectionContentService LRU** | Server memory (`publishedCache`) | 5 min, max 1000 tenants              | `publishedCache.delete()` on `publishSection()` / `publishAll()` only |
| **Next.js ISR**               | Vercel edge CDN                  | Per-page `revalidate` value (if set) | On redeploy or manual `revalidateTag()`                               |
| **Browser cache**             | Client `Cache-Control` headers   | Varies per route                     | User hard refresh                                                     |

**Gap:** The seed writes directly to the database via Prisma. None of these cache layers are aware of the write. The LRU cache only invalidates on `publishSection()` / `publishAll()` calls through the service. Seeds bypass the service entirely.

---

## Section 2: Active Debt Items (Todos 11001-11008)

### 11001 -- Isolate HANDLED marketing colors from tenant storefront tokens

**Priority:** P2 (unchanged)
**Still relevant?** Yes. The autofill `:root` hardcoding and body `bg-background` fragility are real. No fixes have been applied.
**Deploy impact:** None -- this is a rendering issue, not a deploy issue.
**Batch opportunity:** Standalone. CSS/Tailwind only, no server changes.

### 11002 -- Seed deleteMany breaks when bookings exist (FK Restrict)

**Priority:** P2 -> **P1** (upgrade recommended)
**Still relevant?** Yes -- this is the single most dangerous deploy debt. The very next deploy after the first real booking will fail the seed job, which blocks the API deploy job.
**Deploy impact:** Direct. Seed failure -> deploy halt. The `if: always()` condition on `deploy-api-production` partially mitigates (it runs if seed is `skipped`), but NOT if seed fails -- `needs.seed-database-production.result` would be `failure`, not `skipped`.
**Batch opportunity:** Must be done with #11006 (both touch the same transaction).

### 11003 -- Seed test mock returns same segment ID

**Priority:** P2 (unchanged)
**Still relevant?** Yes. The mock still uses a single segment ID. However, this is a test quality issue, not a deploy blocker.
**Deploy impact:** None.
**Batch opportunity:** Bundle with #11004 (both are test improvements for the same test file).

### 11004 -- Missing test coverage for ABOUT/CTA/SERVICES/HERO sections

**Priority:** P2 (unchanged)
**Still relevant?** Yes. Four section types have zero content assertions.
**Deploy impact:** None directly, but would catch accidental content deletion in seed refactors.
**Batch opportunity:** Bundle with #11003.

### 11005 -- Extract GRAZING_PER_PERSON_CENTS constant + use BlockType enum

**Priority:** P2 -> **P3** (downgrade)
**Still relevant?** Yes, but it is a code hygiene issue, not a correctness issue. The inline `2500` value is only used once. The `satisfies BlockType` pattern is nice-to-have.
**Deploy impact:** None.
**Batch opportunity:** Bundle with #11007 (both are small cleanup in the same file).

### 11006 -- Move existingTenant read inside transaction

**Priority:** P2 (unchanged)
**Still relevant?** Yes. The read-outside-transaction pattern is structurally wrong even if unlikely to bite in practice.
**Deploy impact:** Indirect. If the stale read causes key generation issues, the tenant API keys become invalid.
**Batch opportunity:** Must be done with #11002 (both modify the transaction structure).

### 11007 -- Seed cleanup: blackout dates, slug convention, log hardcode

**Priority:** P3 (unchanged)
**Still relevant?** Yes. `${6}` is still a template literal wrapping a literal.
**Deploy impact:** None.
**Batch opportunity:** Bundle with #11005.

### 11008 -- Seed helpers duplication + PrismaOrTransaction drift

**Priority:** P3 (unchanged)
**Still relevant?** Yes. Four copies of `PrismaOrTransaction` still exist, `utils.ts` version is stale.
**Deploy impact:** None directly, but increases risk of divergent seed behavior across tenants.
**Batch opportunity:** Standalone refactor, or defer until a second tenant seed needs creation.

---

## Section 3: New Debt From This Session

### 3.1 Render Auto-Deploy Race Condition

**render.yaml** sets `autoDeploy: false`, and the deploy workflow triggers via deploy hook. However, Render also auto-deploys when branch settings change in the dashboard. If someone accidentally enables auto-deploy in the Render dashboard, Render will deploy on push to `main` BEFORE the GitHub Actions seed job runs, creating a window where the API is live but the database has not been seeded with latest content.

**Impact:** Medium. Misconfiguration-dependent, not a code bug.
**Fix:** Add a `render.yaml` CI check that verifies `autoDeploy: false` has not been changed. Or add a startup check in the API that verifies expected seed data exists.

### 3.2 NODE_OPTIONS Comment is Misleading

Line 49-51 of `deploy-production.yml`:

```yaml
# Force IPv4 DNS resolution -- GitHub Actions runners lack IPv6 connectivity,
# but Supabase/AWS hostnames resolve to AAAA (IPv6) first, causing ENETUNREACH.
NODE_OPTIONS: '--dns-result-order=ipv4first'
```

This environment variable is set at workflow level but only matters for the `seed-database-production` and `migrate-database-production` jobs that connect to Supabase. The comment is accurate, but the scope is overly broad -- it applies to build jobs and validation jobs that never connect to Supabase. Not harmful, but confusing to future readers who may wonder why build failures mention DNS.

**Impact:** Low. Cosmetic.
**Fix:** Move `NODE_OPTIONS` to only the jobs that need it (seed + migrate), or add a clarifying note.

### 3.3 No Cache Invalidation After Seed

The seed writes `SectionContent` rows with `isDraft: false` directly to the database. The `SectionContentService` LRU cache (`publishedCache`, 5-minute TTL) is NOT invalidated because the seed does not call `publishAll()` or `publishSection()`. If the API server is already running (which it is -- Render has `autoDeploy: false` but the existing deployment is live), the LRU cache serves stale sections for up to 5 minutes after the seed completes.

In the current deploy flow this is partially mitigated because:

1. Seed runs BEFORE the Render deploy hook triggers (Job 4b before Job 5)
2. The Render deploy creates a new process, which starts with an empty LRU cache

But if the seed runs WITHOUT a subsequent API redeploy (e.g., re-running only the seed job, or running seeds locally against production), the cache serves stale data.

**Impact:** Medium. Currently mitigated by deploy ordering, but fragile.
**Fix:** Either:

- Add a `POST /internal/cache/invalidate` endpoint that the seed job calls after completion
- Or accept the 5-minute TTL window and document it

### 3.4 Build-Time Env Var Drift Between Workflows

The `build-production` job sets `AUTH_SECRET: production-build-placeholder-not-used-at-runtime` as a build-time env var. If future builds require additional env vars at build time (e.g., `NEXT_PUBLIC_*` variables), they must be added in both the GitHub Actions workflow AND the Vercel project settings. There is no validation that the two match.

Additionally, the Vercel deploy step passes `NEXT_PUBLIC_API_URL` via `--env` flag, but other `NEXT_PUBLIC_*` variables are presumably set in Vercel project settings. This creates two sources of truth for client-side env vars.

**Impact:** Medium. Will cause hard-to-debug build/runtime mismatches when new env vars are added.
**Fix:** Add a job step that compares `NEXT_PUBLIC_*` vars from the workflow against Vercel project settings via `vercel env ls`.

### 3.5 Production Seed Mode Hardcoded to One Tenant

`SEED_MODE=production` runs `seedPlatform()` + `seedLittleBitHorseFarm()` only. When additional production tenants are onboarded (Plate, La Petit Mariage, HANDLED itself), they must be manually added to the `case 'production':` branch of `seed.ts`. There is no configuration file or environment variable that controls which tenants to seed.

This means:

- Adding a new production tenant requires a code change to `seed.ts`
- There is no way to seed a single tenant in production without adding a new SEED_MODE
- The seed always runs ALL production tenants even if only one changed

**Impact:** Low now (one tenant). Medium when scaling to 3-5 tenants.
**Fix:** Either accept as-is (seeds are fast), or add `SEED_TENANTS=littlebit-farm,plate` env var for selective seeding.

### 3.6 Deploy Workflow Halts on API Health Check Even When Seed Succeeded

The `deploy-api-production` job depends on `seed-database-production` with:

```yaml
if: always() && (needs.seed-database-production.result == 'success' || needs.seed-database-production.result == 'skipped')
```

If the seed FAILS (not skipped), the entire downstream pipeline halts -- no API deploy, no web deploy, no validation. This is arguably correct (seed failure = data integrity issue), but the failure mode is confusing because:

1. The API may already be running fine on the previous code
2. The seed failure may be unrelated to the code being deployed (e.g., the FK violation from #11002)
3. There is no way to "skip seed and deploy anyway" without using `workflow_dispatch` with `run_migrations: false` (which skips migrations AND seeds together)

**Impact:** High when #11002 triggers. The first booking will halt ALL future deploys.
**Fix:** Separate `run_seeds` input from `run_migrations` in the manual dispatch. Or make the seed job `continue-on-error: true` with a notification step.

### 3.7 Smoke Test Hits Stale `/v1/packages` Endpoint

The production smoke test (line 433) curls `$PRODUCTION_API_URL/v1/packages`. The Package model was fully removed in the Package-to-Tier migration (PRs #51-53, ~160 files, -3100 LOC). This endpoint likely no longer exists or returns an empty result. The `curl -f -s` will fail with a 404 if the route was removed.

Checking the route registration: no route file matched a search for `packages` in `server/src/routes/`. The endpoint may be served by a legacy catch-all or ts-rest contract router, but if the contract was removed during the migration, this smoke test will fail on every deploy.

**Impact:** High. Will block every deploy if the endpoint 404s.
**Fix:** Update the smoke test to hit a current endpoint (e.g., `/v1/tiers` or `/health/ready` which is already checked in the health check step).

---

## Section 4: Recommended Batch

### PR: "fix: deploy pipeline reliability -- FK guard, stale smoke test, seed decoupling"

Group the following into a single PR, prioritized by "what would prevent the NEXT deploy from failing":

#### Must-Fix (deploy blockers)

| Item                         | File(s)                            | Change                                                                                                                               | Effort |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **#11002 + #11006**          | `little-bit-horse-farm.ts`         | Move tenant read inside transaction. Add booking count guard: if bookings exist, skip `deleteMany` and use upsert-only.              | Medium |
| **3.7 Stale smoke test**     | `deploy-production.yml` (line 433) | Replace `curl /v1/packages` with `curl /v1/tiers` or remove it (health check already validates API).                                 | Small  |
| **3.6 Seed/deploy coupling** | `deploy-production.yml`            | Add separate `skip_seeds` input to `workflow_dispatch`. Change seed job to `continue-on-error: true` with failure notification step. | Small  |

#### Should-Fix (reliability)

| Item                       | File(s)                                               | Change                                                                                                     | Effort |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| **3.3 Cache invalidation** | `section-content.service.ts`, `deploy-production.yml` | Add internal cache flush endpoint. Call it from seed job after seed completes.                             | Small  |
| **#11005 + #11007**        | `little-bit-horse-farm.ts`                            | Extract `GRAZING_PER_PERSON_CENTS`, fix `${6}` log, add blackout comment. Bundle with transaction changes. | Small  |

#### Defer (not deploy-blocking)

| Item                       | Reason                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **#11001**                 | CSS scoping. No deploy impact. Separate PR.                                         |
| **#11003 + #11004**        | Test quality. Valuable but no deploy impact. Separate PR.                           |
| **#11008**                 | Seed helpers refactor. Risk of regression in 4 files. Defer until next tenant seed. |
| **3.1 Render auto-deploy** | Misconfiguration guard. Low probability.                                            |
| **3.2 NODE_OPTIONS**       | Cosmetic.                                                                           |
| **3.4 Env var drift**      | Important but requires Vercel CLI integration. Separate effort.                     |
| **3.5 Single-tenant seed** | Acceptable until second production tenant onboards.                                 |

### Minimum Viable Fix (3 changes, <1 hour)

If time is constrained, the absolute minimum to prevent the next deploy from failing:

1. **Replace `/v1/packages` smoke test** with `/health/ready` (already checked above, but removing the redundant broken check prevents a 404 failure)
2. **Add booking guard to seed** (#11002) -- `if (await tx.booking.count({ where: { tier: { tenantId: tenant.id } } }) > 0) { logger.warn('Bookings exist, skipping deleteMany'); }` and skip the deleteMany block
3. **Move tenant read inside transaction** (#11006) -- while touching the transaction anyway

These three changes protect the deploy pipeline from the two most likely failure modes: stale endpoint and FK violation on first booking.
