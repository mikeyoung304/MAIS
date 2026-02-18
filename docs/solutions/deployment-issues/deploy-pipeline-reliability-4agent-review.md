# Deploy Pipeline Reliability: 4-Agent Review and Fix

**Date:** 2026-02-18
**PR:** fix/deploy-pipeline-reliability
**Todos resolved:** #11002, #11006
**Review agents:** data-integrity-guardian, architecture-strategist, code-simplicity-reviewer, learnings-researcher

---

## Problem

A "simple" seed deploy turned into a 4-failure cascade because 3 prior compound docs were never applied to the deploy pipeline. Post-mortem review by 4 independent agents found 2 P0/P1 deploy blockers that would break the NEXT deploy.

## Root Causes

### 1. Stale `/v1/packages` smoke test (P0 — deploy blocker)

Both `deploy-production.yml` (line 433) and `deploy-staging.yml` (line 236) curl `/v1/packages` as a smoke test. The Package model was fully removed in PRs #51-53 (Tier migration). This endpoint 404s, blocking every deploy.

**Fix:** Replaced with `/health/ready` (validates DB connectivity + route serving).

### 2. `deleteMany` FK bomb (P1 — ticking time bomb)

`little-bit-horse-farm.ts` uses `deleteMany` on Tier and AddOn before recreating. `Booking.tierId` has `onDelete: Restrict` and `BookingAddOn.addOnId` has `onDelete: Restrict`. First real booking makes every subsequent seed deploy throw P2003, which halts the entire deploy pipeline.

**Fix:** Added booking count guard. If `booking.count() > 0`, skip destructive deletes and use upsert-only mode. Section content (no FK from bookings) is still cleared.

### 3. Tenant read outside transaction (P2 — stale read)

`existingTenant` was read outside `$transaction`, then used inside to decide whether to generate new API keys. Concurrent operations could cause key reuse or generation skip.

**Fix:** Moved `findUnique` call inside the transaction. Post-transaction logging now uses `secretKeyForLogging` (non-null = new tenant) instead of the old `existingTenant` reference.

### 4. NODE_OPTIONS false security theater (P2 — misleading)

`NODE_OPTIONS='--dns-result-order=ipv4first'` was set at workflow level, but Prisma's Rust query engine does its own DNS resolution and ignores Node.js settings. The flag gave false confidence that IPv6 was handled.

**Fix:** Removed the flag. Added comment explaining IPv4 is enforced via the connection string (`?family=4`).

## Key Pattern: Environments Affected Checklist

The meta-lesson from this incident: **compound docs must enumerate every environment where a fix must be applied.**

The IPv6 pooler fix was documented in December 2025 across 3 compound docs, but focused on local dev and Render runtime. Nobody extended it to GitHub Actions secrets because the docs didn't have an explicit "Environments Affected" section.

### Template for future compound docs:

```markdown
## Environments Affected

- [ ] Local `.env` / `.env.local`
- [ ] Render environment variables
- [ ] GitHub Actions secrets
- [ ] Vercel environment variables
- [ ] Cloud Run environment variables
- [ ] CI workflow YAML (`NODE_OPTIONS`, build args, etc.)
```

Every compound doc that involves infrastructure changes should include this checklist.

## Convergence Signal

All 4 agents independently flagged the same top 3 issues:

1. `deleteMany` FK bomb (4/4 agents)
2. `/v1/packages` stale smoke test (4/4 agents)
3. Cache invalidation gap (3/4 agents)

The learnings-researcher uniquely found the staging workflow also had the stale test (doubling the fix surface). The code-simplicity-reviewer found the seed files are 4x larger than needed due to copy-paste duplication.

## Diagnostic Checklist: Future Seed Deploy Failures

1. Check `booking.count()` for the tenant — FK Restrict will block deletes
2. Verify smoke test endpoints match current API routes (Package model removed)
3. Check `PRODUCTION_DATABASE_URL` uses pooler URL with `?family=4`
4. Verify `NODE_OPTIONS` is NOT being relied on for DNS (Prisma ignores it)
5. Check cache invalidation — seeds bypass `SectionContentService`
6. Grep `docs/solutions/` for prior art before debugging

## Files Changed

| File                                                   | Change                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `.github/workflows/deploy-production.yml`              | Replace `/v1/packages` smoke test, remove `NODE_OPTIONS` |
| `.github/workflows/deploy-staging.yml`                 | Replace `/v1/packages` smoke test                        |
| `server/prisma/seeds/little-bit-horse-farm.ts`         | Booking guard, tenant read inside tx                     |
| `server/test/seeds/little-bit-horse-farm-seed.test.ts` | 2 new tests for booking guard                            |

## Remaining Debt (not in this PR)

- **Cache invalidation after seed** — seeds bypass `SectionContentService` LRU cache (5-min TTL). Mitigated by deploy ordering but fragile.
- **Seed helper duplication** — `PrismaOrTransaction`, `createOrUpdateSegment`, etc. duplicated across 4 files (#11008).
- **Single-tenant seed mode** — `SEED_MODE=production` hardcoded to one tenant (#3.5 in audit).
- **Env var drift** — `AUTH_SECRET` and `NEXT_PUBLIC_*` vars have no cross-workflow validation (#3.4 in audit).
