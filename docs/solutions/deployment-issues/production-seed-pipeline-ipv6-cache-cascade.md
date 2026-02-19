---
title: Production Seed Pipeline Cascade — AUTH_SECRET, IPv6 ENETUNREACH, Render Race, Cache Staleness
category: deployment-issues
tags:
  - deployment
  - supabase
  - ipv6
  - prisma
  - seeds
  - cache
  - render
  - github-actions
  - session-pooler
  - auth-secret
  - nextauth
  - enetunreach
severity: critical
date_solved: 2026-02-18
root_cause: >
  Four independent failures cascaded during a production seed deploy:
  (1) AUTH_SECRET missing from deploy-production.yml but present in main-pipeline.yml since Feb 1,
  (2) Render auto-deploy racing with GitHub Actions deploy hook causing health check timeout,
  (3) PRODUCTION_DATABASE_URL GitHub secret using IPv6-only direct Supabase URL (db.*.supabase.co) which GitHub Actions runners cannot reach — compounded by Prisma's Rust query engine ignoring NODE_OPTIONS DNS settings,
  (4) browser cache serving stale storefront content after successful seed write.
resolution_type: configuration_change
affected_files:
  - .github/workflows/deploy-production.yml
  - server/prisma/seeds/little-bit-horse-farm.ts
symptoms:
  - "next build fails with 'AUTH_SECRET is missing' during page data collection"
  - 'Render health check timeout — /health/ready unreachable for 30 attempts'
  - 'Error: connect ENETUNREACH 2600:1f16:...:5432 — seed job cannot reach database'
  - 'GitHub Actions seed job exits with no error output (missing environment scope hides secrets)'
  - 'Storefront appears to have missing sections after seed (browser cache / WebFetch truncation)'
  - 'NODE_OPTIONS=--dns-result-order=ipv4first has no effect on Prisma connections'
related_docs:
  - docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md
  - docs/solutions/database-issues/SUPABASE_IPV6_CONNECTION_PREVENTION.md
  - docs/solutions/database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md
  - docs/solutions/PRODUCTION_DEPLOYMENT_FIXES-20251206.md
  - docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md
---

# Production Seed Pipeline Cascade: AUTH_SECRET + IPv6 + Render Race + Cache Staleness

## Problem Summary

Deploying updated seed data for the "Little Bit Farm" tenant to production failed **4 consecutive times** with 4 different root causes before succeeding on the 5th attempt. Each failure was independent — fixing one revealed the next. The most frustrating aspect: **3 of the 4 issues had existing compound docs** that were not consulted before debugging.

Total debugging time: ~2 hours across 5 deploy attempts.

## Failure Timeline

### Failure 1: AUTH_SECRET Missing During Next.js Build

**Symptom:** `next build` fails during page data collection step in `build-production` job.

**Root cause:** NextAuth v5 validates `AUTH_SECRET` at module import time. When `next build` collects page data, it imports auth modules and crashes if the secret is missing. The `main-pipeline.yml` already had the fix (commit `ed1eb23e`, Feb 1) with a placeholder value, but `deploy-production.yml` was never updated because the two workflow files maintain independent env var lists.

**Fix (commit `71c99ce0`):**

```yaml
# .github/workflows/deploy-production.yml — build-production job
- name: Build packages in dependency order
  run: |
    npm run build --workspace=packages/contracts
    npm run build --workspace=packages/shared
    npm run build --workspace=server
    npm run vercel-build
  env:
    NODE_ENV: production
    # NextAuth v5 requires AUTH_SECRET at build time for page data collection.
    # This is a dummy value for production builds; real secret is used at runtime.
    AUTH_SECRET: production-build-placeholder-not-used-at-runtime
```

**Prior art that existed:** `docs/solutions/PRODUCTION_DEPLOYMENT_FIXES-20251206.md` documents the placeholder env var pattern for build-time variables.

**Lesson:** When adding a build-time env var to one workflow, search for ALL workflows that run `next build` or `npm run build` and add it to each. The two production deploy workflows (`main-pipeline.yml` and `deploy-production.yml`) are independently maintained and drift silently.

---

### Failure 2: Render Health Check Timeout

**Symptom:** "Deploy API to Production" job timed out polling `/health/ready` for 30 attempts (5+ minutes). The build step succeeded.

**Root cause:** Render has `autoDeploy: yes` on the main branch. When we push to main, BOTH Render's auto-deploy AND the GitHub Actions deploy hook trigger simultaneously. The health check polling can fail because Render is mid-redeploy from the auto-trigger when the workflow starts polling.

**Workaround:** This is a timing race, not a blocking error. Render auto-deploy handles the actual deployment independently. The workflow's deploy-api step is technically redundant when auto-deploy is enabled.

**Architectural debt:** The deploy workflow fires a Render deploy hook that duplicates what Render auto-deploy already does. Options to fix:

1. Disable Render auto-deploy, rely solely on workflow deploy hook
2. Remove the Render deploy hook from the workflow, rely on auto-deploy
3. Add a "wait for existing deploy to finish" step before triggering a new one

---

### Failure 3: Seed Job ENETUNREACH (IPv6) — Two Sub-Issues

This was the most complex failure, with two sub-issues stacked on top of each other.

#### Sub-Issue 3a: Missing `environment:` Scope on Seed Job

**Symptom:** Seed job ran but all `secrets.*` references resolved to empty strings. No explicit error — the job just failed silently.

**Root cause:** The seed job (`seed-database-production`) was initially extracted from the migration approval gate but was missing the `environment: production` property. Without it, GitHub Actions cannot access environment-scoped secrets.

**Fix (commits `fb7980c1` + `b916aaee`):**

```yaml
seed-database-production:
  name: Seed Production Database
  runs-on: ubuntu-latest
  needs: [build-production, migrate-database-production]
  environment:
    name: production # <-- REQUIRED for environment-scoped secrets
```

#### Sub-Issue 3b: IPv6-Only Database URL

**Symptom:** `Error: connect ENETUNREACH 2600:1f16:1cd0:3321:e1af:c9eb:c339:186:5432`

**Root cause:** The `PRODUCTION_DATABASE_URL` GitHub secret used the direct Supabase connection format (`db.*.supabase.co`) which resolves to IPv6 addresses only. GitHub Actions runners do not have IPv6 connectivity.

**Failed fix attempt (commit `e94f91bd`):** Added `NODE_OPTIONS: '--dns-result-order=ipv4first'` to the workflow. This has ZERO effect on Prisma because Prisma's Rust-based query engine handles its own DNS resolution and does not read Node.js DNS settings.

```yaml
# THIS DOES NOT WORK FOR PRISMA
env:
  NODE_OPTIONS: '--dns-result-order=ipv4first'
```

**Actual fix:** Updated the `PRODUCTION_DATABASE_URL` GitHub secret to use Supabase Session Pooler URL:

```diff
# Before (IPv6-only, fails on GitHub Actions)
- DATABASE_URL=postgresql://postgres:pass@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres

# After (IPv4+IPv6, works everywhere)
+ DATABASE_URL=postgresql://postgres.gpyvdknhmevcfdbgtqir:pass@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true
```

Also updated `PRODUCTION_DIRECT_URL` to use Transaction Pooler format.

**THIS WAS A KNOWN BUG.** Three existing compound docs cover this exact issue:

| Document                                                                    | Date       | Content                      |
| --------------------------------------------------------------------------- | ---------- | ---------------------------- |
| `docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md` | 2025-12-23 | Full diagnosis + fix         |
| `docs/solutions/database-issues/SUPABASE_IPV6_CONNECTION_PREVENTION.md`     | 2025-12-23 | 800-line prevention strategy |
| `docs/solutions/database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md`           | 2025-12-23 | One-page cheat sheet         |

**Why they weren't consulted:** The seed pipeline was a new job added to `deploy-production.yml`. The existing docs focus on local development and Render runtime connections. Nobody thought to check whether GitHub Actions had the same IPv6 limitation — but it does, because GitHub-hosted runners also lack IPv6.

---

### Failure 4: Stale Storefront Content (False Alarm)

**Symptom:** After successful seeding, the storefront appeared to be missing FAQ, Features, and CTA sections.

**Root cause (dual):**

1. The WebFetch tool truncated page content during verification, making it appear sections were missing
2. The user's browser was serving stale cached content from before the seed update

**Verification:** `curl -sL` confirmed all 6 sections were present in the SSR HTML. A hard browser refresh (`Cmd+Shift+R`) showed the correct content.

**Architectural debt:** Seeds write directly to the database via Prisma, bypassing `SectionContentService.publishAll()` which invalidates the in-memory LRU cache. After seeding, the API serves stale cached data until either:

- The cache TTL expires (5 minutes)
- The Render service restarts (which happens on deploy, but not on seed-only changes)
- An admin endpoint is called to clear the cache (does not exist yet)

---

## Architecture Debt Catalog

### Debt 1: Seed Pipeline Has No Cache Invalidation

Seeds write directly to the database, bypassing the `SectionContentService` cache. After seeding, the API continues serving stale in-memory data.

**Impact:** Users see old content for up to 5 minutes after a seed deploy.

**Fix options:**

- Add a cache-clear step to the workflow (restart Render service via API, or call an admin `/cache/clear` endpoint)
- Make seeds go through `SectionContentService.publishAll()` instead of raw Prisma writes
- Add a `POST /admin/cache/invalidate` endpoint callable from the workflow

**Related:** `docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md` documents the same cache staleness pattern.

### Debt 2: Render Auto-Deploy Races With GitHub Actions Deploy

The Render service has `autoDeploy: yes` on main. When we push, both Render auto-deploy AND the workflow's deploy hook trigger simultaneously. This causes flaky health check timeouts.

**Fix options:**

- **(a) Disable Render auto-deploy**, rely solely on workflow deploy hook — gives us explicit control but adds latency
- **(b) Remove deploy hook from workflow**, rely on Render auto-deploy — simpler but loses health check verification
- **(c) Add deploy-status polling** — check if Render is already deploying before triggering a new deploy

### Debt 3: GitHub Secrets Are Invisible to Validation

The `PRODUCTION_DATABASE_URL` secret used the wrong format (direct connection instead of session pooler) for approximately 3 months. No doctor script, code review, or CI check can validate GitHub secret VALUES because they are masked.

**Fix options:**

- Add a URL format validation step early in the workflow that rejects `db.*.supabase.co` URLs
- Document the correct format in a checklist in the workflow file comments
- Create a runbook for secret rotation that includes format verification steps

### Debt 4: Build-Time Env Var Drift Between Workflows

`main-pipeline.yml` and `deploy-production.yml` maintain independent env var lists. When a new build-time variable is required (like `AUTH_SECRET`), it must be added to both. The AUTH_SECRET was in `main-pipeline.yml` since Feb 1 but missing from `deploy-production.yml` until Feb 18 — a 17-day drift window.

**Fix options:**

- Extract shared env vars into a reusable workflow or composite action
- Add a CI check that compares build env vars between the two workflows
- Document all required build-time env vars in a single reference section

### Debt 5: NODE_OPTIONS Is Misleading for Prisma

The commit `e94f91bd` added `NODE_OPTIONS: '--dns-result-order=ipv4first'` to the workflow. This is still present and gives a **false sense of security** — someone might think IPv6 is "handled" by this flag when it has zero effect on Prisma's Rust query engine.

**Fix:** Add a prominent comment explaining this limitation, or remove the flag entirely.

```yaml
# WARNING: NODE_OPTIONS=--dns-result-order=ipv4first does NOT affect Prisma.
# Prisma's Rust query engine handles its own DNS resolution.
# The ONLY fix for IPv6 issues is using Session Pooler URLs (*.pooler.supabase.com).
NODE_OPTIONS: '--dns-result-order=ipv4first'
```

### Debt 6: Production Seed Mode Only Seeds One Tenant

`SEED_MODE=production` runs `seedPlatform()` + `seedLittleBitHorseFarm()`. When new tenants are onboarded via seeds (e.g., la-petit-mariage, plate, handled), they must be manually added to the production seed case. This is easy to forget.

**Fix:** Make the production seed discover tenant seed files automatically, or add a `workflow_dispatch` input for selecting which tenants to seed.

### Debt 7: No Vercel Deploy on Seed-Only Changes

The deploy workflow chains: seed -> deploy API -> deploy web. If the API deploy step fails (e.g., health check timeout), the Vercel deploy is skipped. But the seed data is already in the database. If ISR pages need regeneration to pick up new seed data, skipping the Vercel step means stale frontend pages until the next deploy or ISR expiry.

---

## Commits Made

| Commit            | Description                                                        | Effective?                      |
| ----------------- | ------------------------------------------------------------------ | ------------------------------- |
| `71c99ce0`        | AUTH_SECRET placeholder for Next.js build in deploy-production.yml | Yes                             |
| `fb7980c1`        | Seed job extracted from migration approval gate                    | Yes                             |
| `b916aaee`        | `environment: production` scope added to seed job                  | Yes                             |
| `e94f91bd`        | `NODE_OPTIONS: --dns-result-order=ipv4first`                       | **No** — does not affect Prisma |
| _(secret update)_ | `PRODUCTION_DATABASE_URL` -> Session Pooler format                 | Yes                             |
| _(secret update)_ | `PRODUCTION_DIRECT_URL` -> Transaction Pooler format               | Yes                             |

---

## Key Decision Table: Supabase URL Formats

| Format             | Hostname Pattern             | IPv4 | IPv6 | Prisma Compatible       | Use Case                            |
| ------------------ | ---------------------------- | ---- | ---- | ----------------------- | ----------------------------------- |
| Direct Connection  | `db.[REF].supabase.co`       | No   | Yes  | Yes                     | Migrations (if IPv6 available)      |
| Session Pooler     | `*.pooler.supabase.com:5432` | Yes  | Yes  | Yes (`?pgbouncer=true`) | Application connections             |
| Transaction Pooler | `*.pooler.supabase.com:6543` | Yes  | Yes  | Yes (`?pgbouncer=true`) | Short-lived connections, DIRECT_URL |

**Rule:** Always use Session Pooler for `DATABASE_URL` in any environment that might lack IPv6 (GitHub Actions, some developer machines, corporate networks). This includes ALL GitHub secrets, not just local `.env` files.

---

## Prevention Strategies

### Immediate (Do Now)

1. **Add DATABASE_URL format validation** to `deploy-production.yml` — reject `db.*.supabase.co` URLs:

```yaml
- name: Validate database URL format
  run: |
    # Prisma ignores NODE_OPTIONS DNS settings — must use pooler URLs
    if echo "${{ secrets.PRODUCTION_DATABASE_URL }}" | grep -q "db\..*\.supabase\.co"; then
      echo "ERROR: PRODUCTION_DATABASE_URL uses direct Supabase connection (IPv6-only)"
      echo "Update the GitHub secret to use Session Pooler: *.pooler.supabase.com"
      echo "See: docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md"
      exit 1
    fi
    echo "Database URL format is valid (using pooler)"
```

2. **Add a warning comment** about `NODE_OPTIONS` ineffectiveness for Prisma in `deploy-production.yml`.

3. **Consider removing** the redundant Render deploy hook step (Render auto-deploys on push to main anyway).

### Short-Term

4. **Extract shared build env vars** between `main-pipeline.yml` and `deploy-production.yml` to prevent drift. Use a composite action or shared env file.

5. **Add a cache invalidation step** after seeding — either restart the Render service or call an admin endpoint:

```yaml
- name: Invalidate API cache after seed
  run: |
    # Option A: Restart Render service to clear in-memory cache
    curl -X POST "${{ secrets.RENDER_PRODUCTION_API_DEPLOY_HOOK }}"
    # Option B: Call admin cache-clear endpoint (if implemented)
    # curl -X POST "${{ env.PRODUCTION_API_URL }}/admin/cache/invalidate" \
    #   -H "Authorization: Bearer ${{ secrets.ADMIN_API_KEY }}"
```

6. **Make production seed mode configurable** via `workflow_dispatch` input:

```yaml
inputs:
  seed_tenants:
    description: 'Which tenants to seed (comma-separated, or "all")'
    required: false
    default: 'all'
    type: string
```

### Long-Term

7. **Build an admin API endpoint** for triggering seeds from within the Render service — eliminates the GitHub Actions -> Supabase network path entirely.

8. **Add GitHub secret format validation** to the doctor script or a dedicated CI validation job.

9. **Consider Supabase dedicated IPv4 addon** ($4/month) to eliminate IPv6 issues permanently across all environments.

---

## Diagnostic Checklist: Future Seed Deploy Failures

When a production seed deploy fails, check in this order:

```
1. [ ] Does the build step pass? (Check for missing env vars like AUTH_SECRET)
2. [ ] Does the seed job have `environment: production`? (Required for secret access)
3. [ ] Is PRODUCTION_DATABASE_URL using pooler format? (*.pooler.supabase.com, NOT db.*.supabase.co)
4. [ ] Is Render already mid-deploy? (Check dashboard for concurrent deploys)
5. [ ] After seed succeeds, is the API cache stale? (Wait 5 min or restart service)
6. [ ] Is the browser serving cached content? (Hard refresh: Cmd+Shift+R)
7. [ ] Is the new tenant included in the production seed case? (Check seed.ts switch)
```

---

## Cross-Reference: Existing IPv6 Documentation

This is the **FOURTH** compound doc about Supabase IPv6 issues. The previous three are still valid and complementary:

| Document                                     | Focus                                             |
| -------------------------------------------- | ------------------------------------------------- |
| `supabase-ipv6-session-pooler-connection.md` | Local development fix (`.env` file)               |
| `SUPABASE_IPV6_CONNECTION_PREVENTION.md`     | Comprehensive prevention strategy                 |
| `SUPABASE_IPV6_QUICK_REFERENCE.md`           | One-page diagnostic cheat sheet                   |
| **This document**                            | GitHub Actions / CI pipeline fix (GitHub secrets) |

**The gap that this document fills:** Previous docs focused on local development and Render runtime. None covered GitHub Actions secrets or the seed pipeline specifically. The key insight is that GitHub-hosted runners ALSO lack IPv6, and Prisma's Rust engine ignores `NODE_OPTIONS`, making the Node.js-level DNS fix completely ineffective for database connections.

---

## Meta-Lesson: Compound Docs Only Work If You Search Them

Three comprehensive docs existed for this exact bug pattern. They were not consulted because:

1. The context was different (new workflow job vs. local development)
2. The symptom keyword was slightly different (`ENETUNREACH` in a GitHub Actions log vs. `P1001` locally)
3. Time pressure during a production deploy encourages "just fix it" over "search for prior art"

**Prevention:** Before debugging any `ENETUNREACH`, `ETIMEDOUT`, or `P1001` database error, run:

```bash
grep -rl "IPv6\|ENETUNREACH\|pooler\|ipv6" docs/solutions/
```

This search takes 0.1 seconds and could have saved 45+ minutes of debugging.
