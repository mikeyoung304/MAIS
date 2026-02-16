# Performance Oracle -- Plan Review Findings

**Plan:** `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
**Reviewed:** 2026-02-12
**Reviewer:** Performance Oracle Agent

---

## P1 -- Critical Performance Risks (Must Fix Before Ship)

### P1-1: Migration Transaction Lock Duration -- Entire Package-to-Tier Migration in Single $transaction

**Location:** Plan Phase 7 migration script (lines 676-785)

**Issue:** The migration script wraps ALL operations in a single `prisma.$transaction()`:

- Auto-publish pending drafts (`UPDATE Package SET...`)
- Reset stuck onboarding phases (`UPDATE Tenant SET...`)
- ALTER TABLE to add `sourcePackageId` column
- SELECT + iterate all Packages grouped by segment
- INSERT INTO Tier (row by row in a JS loop)
- UPDATE Booking to set `tierId`
- INSERT INTO TierAddOn
- Verification queries (2x COUNT)
- ALTER TABLE DROP COLUMN + DROP TABLE (3x)

This holds a transaction-level write lock on Package, Tier, Booking, Tenant, TierAddOn, and PackageAddOn tables simultaneously. With the stated scale (<1000 packages, <10000 bookings), the row-by-row Tier INSERT loop is the bottleneck: each INSERT is a round-trip to Postgres inside the transaction, holding locks for `O(packages)` round-trips.

**Expected duration estimate:** With <1000 packages and row-by-row inserts, assume ~5ms/insert = ~5 seconds for inserts alone, plus the UPDATE Booking (index scan on packageId, up to 10000 rows) and the DROP TABLE DDL. Total: **10-30 seconds of held locks**.

**Impact:** During this window, ALL writes to Booking, Package, and Tenant tables are blocked. Any in-flight Stripe webhook that tries to update a Booking will timeout or retry. Any customer mid-checkout will get a 500.

**Recommendation:**

1. **Split into 3 smaller transactions:** (a) Publish drafts + reset phases + add column, (b) Migrate data (Tier inserts + Booking updates + TierAddOn), (c) Verification + DROP. This limits the DDL lock (ALTER TABLE) to sub-second transactions.
2. **Batch the Tier inserts** using `INSERT ... VALUES (...), (...), (...)` with 50-100 rows per batch instead of row-by-row. Use `Prisma.$executeRaw` with a VALUES list built from segments. This reduces round-trips from ~1000 to ~10-20.
3. **Run in a maintenance window** as the plan already suggests -- but document the expected downtime (30s-2min depending on data volume) so the team can set appropriate expectations.
4. **Set transaction timeout:** Prisma's `$transaction` default timeout is 5 seconds. The migration WILL timeout at default. Add `{ timeout: 120000 }` (2 minutes) to the `$transaction` options.

---

### P1-2: Missing Prisma $transaction Timeout Override

**Location:** Plan Phase 7 migration script (line 676)

**Issue:** The plan shows `await prisma.$transaction(async (tx) => { ... })` with no timeout option. Prisma's default interactive transaction timeout is **5 seconds**. The migration script contains DDL + DML across 6 tables and will almost certainly exceed 5 seconds.

**Impact:** Migration will fail silently with `Transaction already closed` or `Transaction timed out` error, potentially leaving the database in a partially migrated state (e.g., some Tiers created but Bookings not updated).

**Recommendation:** Add `{ timeout: 120000, maxWait: 30000 }` to the `$transaction` call:

```typescript
await prisma.$transaction(async (tx) => { ... }, { timeout: 120000, maxWait: 30000 });
```

---

### P1-3: Tier Model Missing `tenantId` Index for Common Agent Queries

**Location:** Plan Phase 1 schema (lines 119-156) vs current schema (lines 264-285)

**Issue:** The new Tier model in the plan defines these indexes:

```prisma
@@unique([segmentId, sortOrder])
@@unique([tenantId, slug])
@@index([tenantId, active])
@@index([segmentId])
```

**Missing index:** `@@index([tenantId, segmentId])` -- this is the primary query pattern for the new `manage_tiers` tool ("list all tiers for this tenant in this segment"). Without it, `WHERE tenantId = ? AND segmentId = ?` will use the `@@index([segmentId])` index and then filter by tenantId in memory, which is correct but suboptimal.

The current Tier model (line 284) has only `@@index([segmentId])` with no tenantId. This was acceptable when Tier was always accessed via Segment (which has tenantId scoping), but the new agent tools will query Tier directly by tenantId + segmentId.

**Impact:** Every `manage_tiers list` call from the agent will do a segment-only index scan + filter. With <100 tiers per tenant this is negligible now, but violates the project's defensive indexing pattern (every query path gets an index).

**Recommendation:** Add `@@index([tenantId, segmentId])` to the Tier model. Also add `@@index([tenantId])` as a bare fallback for tenant-scoped queries that don't filter by segment.

---

### P1-4: Booking Table Missing `tierId` Index

**Location:** Plan Phase 1 schema (lines 171-176)

**Issue:** The plan adds `tierId String?` to Booking but does not define `@@index([tierId])`. The current schema has `@@index([packageId])` (line 537). When packageId is dropped in Phase 7, the only way to look up bookings by tier is a full table scan on `tierId`.

**Query patterns affected:**

- Customer-agent: "Show bookings for this tier" (A2A commerce)
- Admin dashboard: Bookings by tier
- Migration verification query: `WHERE packageId IS NOT NULL AND tierId IS NULL`
- `onDelete: Restrict` on Tier -> Booking: Postgres checks FK constraint via index

**Impact:** Without `@@index([tierId])`, the `onDelete: Restrict` FK constraint check becomes a sequential scan on the Booking table for every Tier delete attempt. With 10000+ bookings, this is measurably slow.

**Recommendation:** Add `@@index([tierId])` to the Booking model in Phase 1 (when tierId is added). Also consider `@@index([tenantId, tierId])` for tenant-scoped tier booking queries.

---

## P2 -- Moderate Performance Risks (Should Fix)

### P2-1: Agent Bootstrap Token Budget -- Brain Dump + Segments + Tiers Per Turn

**Location:** Plan Phase 5 system prompt (lines 486-544), context-builder.service.ts

**Issue:** The new bootstrap data includes:

- Brain dump: up to 2000 chars (~500 tokens)
- Discovery facts: variable, typically 10-20 facts (~200-400 tokens)
- Segments: up to 5 segments with name, slug, tiers (~150 tokens/segment)
- Tiers: up to 3 per segment x 5 segments = 15 tiers with name, price, features JSON (~200 tokens/tier)
- Add-ons: variable (~50 tokens each)
- Section content state: 8 sections x status (~100 tokens)
- System prompt: ~500 lines (~3000-4000 tokens)

**Estimated total bootstrap:** ~3000 (prompt) + 500 (brain dump) + 400 (facts) + 750 (segments) + 3000 (tiers with features) + 200 (addons) + 100 (sections) = **~8000 tokens input** per turn.

With Gemini 2.0 Flash's 1M token context window this is well within limits. However, with `maxOutputTokens: 4096` (line 128 of agent.ts), the per-turn cost is ~8000 input + 4096 output = 12K tokens. At Gemini 2.0 Flash pricing (~$0.075/1M input, $0.30/1M output), this is ~$0.002/turn -- acceptable.

**But:** The plan says "Agent maintains this mentally via `get_known_facts` + `get_page_structure`" (line 532). If the agent calls `get_known_facts` AND `get_page_structure` on every turn (which the current agent does), the token budget doubles because the tool results are included in the conversation context. Over a 15-turn session, this compounds to ~120K-180K tokens.

**Recommendation:**

1. The plan should explicitly state that `getBootstrapData()` in `context-builder.service.ts` will be updated to include segments, tiers, and brain dump. Currently it does NOT fetch these (lines 342-418). The plan mentions this in Phase 5 acceptance criteria but doesn't show the implementation.
2. Consider truncating the brain dump to the first 1000 chars in the bootstrap (keep full version in DB). The agent only needs key phrases to adapt behavior.
3. Add a token budget estimate to the plan's non-functional requirements. Current NFR says "Agent response latency <= current" but doesn't mention token cost per session.

---

### P2-2: ISR Cache Invalidation Gap -- Route Rename from packageSlug to tierSlug

**Location:** Plan Phase 6 (lines 572-651), ISR references in `apps/web/src/`

**Issue:** The current booking page is at `/t/[slug]/book/[packageSlug]/page.tsx` with `export const revalidate = 60`. The plan renames this to `/t/[slug]/book/[tierSlug]/page.tsx`.

Two problems:

1. **Stale cache for 60 seconds:** After deploying the frontend with the new route, the ISR cache for the OLD `/book/[packageSlug]` route will serve stale content for up to 60 seconds. If the backend Package model is already deleted, the stale page will try to fetch a non-existent package and 500.
2. **No explicit cache purge in deployment plan:** Phase 9 deployment order (lines 866-876) deploys frontend AFTER backend, but doesn't mention triggering ISR cache purge. The existing `/api/revalidate` endpoint (at `apps/web/src/app/api/revalidate/route.ts`) only purges specific paths -- it won't automatically purge all `/book/[packageSlug]` routes.

**Impact:** 60-second window where booking pages return 500 for existing package URLs.

**Recommendation:**

1. Keep the old `/book/[packageSlug]` route as a **redirect page** (not a full page) that does `redirect(\`/book/${tierSlug}\`)`. This is already suggested in Open Question #1 but isn't part of any phase's acceptance criteria.
2. Add an explicit step in Phase 9: "Trigger ISR cache purge for all tenant storefront pages via `/api/revalidate`."
3. The 301 redirect file should use `revalidate = 0` (no caching) during the 90-day transition period.

---

### P2-3: CatalogService.getAllPackages() Has No `take` Limit (Pitfall #13)

**Location:** `server/src/services/catalog.service.ts` line 70-80, Plan Phase 7 (line 369)

**Issue:** The current `getAllPackages()` method calls `this.repository.getAllPackagesWithAddOns(tenantId)` with no `take` limit. This violates Pitfall #13 ("Unbounded database queries -- ALL findMany MUST have take parameter; max 100").

The plan's `completeOnboarding()` method (discovery.service.ts line 369) calls `this.catalogService.getAllPackages(tenantId)` to check if packages exist. This is an existence check that fetches ALL packages just to check `.length === 0`.

**Impact:** For tenants with many packages (the plan allows up to 5 segments x unlimited packages per segment via the current model), this could fetch hundreds of rows unnecessarily.

**Recommendation:**

1. Replace the existence check with `await prisma.package.count({ where: { tenantId }, take: 1 })` or `prisma.package.findFirst({ where: { tenantId }, select: { id: true } })`.
2. When the new Tier-based `completeOnboarding()` is written, use `prisma.tier.count()` with `take: 1` instead of fetching all tiers.
3. Add `take: 100` to `getAllPackages()` / the future `getAllTiers()` (or document why unbounded is acceptable for this use case).

---

### P2-4: Decimal-to-Int Price Migration -- Implicit Precision Loss

**Location:** Plan Phase 1 schema vs current schema (lines 270-272)

**Issue:** The current Tier model uses `price Decimal @db.Decimal(10, 2)`. The plan changes this to `priceCents Int`. Decision #8 explicitly states "Cents (Int), not Dollars (Decimal)" for consistency with `Booking.totalPrice` and `Payment.amount`.

However, the migration script (line 729) copies `basePrice` from Package directly to `priceCents` in Tier:

```sql
${p.basePrice}, -- This is already Int (cents) from Package
```

This is correct for Package.basePrice (which IS an Int in the current schema, line 363). But the CURRENT Tier.price is Decimal. If any code has already created Tiers with the current schema (Decimal prices like `350.00`), those values will be lost because the migration only creates NEW Tiers from Packages -- it doesn't convert existing Tiers.

**Impact:** Any existing Tier rows created via the current schema (e.g., seed data, manual testing) will be orphaned or lost when the Tier model is redefined. The migration script only creates Tiers FROM Packages -- it doesn't migrate existing Tier rows.

**Recommendation:**

1. Add an explicit step to the migration: "Convert existing Tier rows: `UPDATE Tier SET priceCents = (price * 100)::INT`" before the column type change.
2. Or document that existing Tier rows are expected to be dropped (they're currently just display-only, not bookable).

---

### P2-5: TierAddOn Join Table -- Redundant Indexes

**Location:** Plan Phase 1 schema (lines 159-168)

**Issue:** The plan defines TierAddOn as:

```prisma
@@id([tierId, addOnId])
@@index([tierId])
@@index([addOnId])
```

The composite primary key `@@id([tierId, addOnId])` already creates an index on `(tierId, addOnId)`. The separate `@@index([tierId])` is redundant because the composite PK index is a prefix match for `tierId`-only queries (Postgres B-tree indexes support prefix queries).

**Impact:** Extra index write overhead on every TierAddOn insert/delete. Negligible at current scale but technically wasteful.

**Recommendation:** Remove `@@index([tierId])` -- the composite PK handles it. Keep `@@index([addOnId])` since it's the non-leading column and needs a separate index for reverse lookups. (Note: the current PackageAddOn has the same pattern at line 442 -- this is a pre-existing issue, not introduced by the plan.)

---

### P2-6: Stripe Metadata Transition Window Not Sized

**Location:** Plan Risk Analysis (lines 981-982)

**Issue:** The plan identifies the Stripe metadata transition risk ("Webhook handlers must check for BOTH metadata.tierId AND metadata.packageId during 48-hour transition window") but the 48-hour figure is arbitrary.

Stripe checkout sessions expire after 24 hours by default, but payment intents can linger for up to 7 days if uncaptured. If a customer starts checkout with `packageId` in metadata, then the migration runs, the webhook handler needs to handle `packageId` metadata for up to 7 days.

However, I checked the checkout-session factory (`server/src/services/checkout-session.factory.ts`) and the Stripe adapter -- they use a generic `metadata: Record<string, string>` pattern. The metadata keys are set by the caller (booking orchestrator), not hardcoded with `packageId`. This means the Stripe metadata issue depends on whether the booking orchestrator writes `packageId` to Stripe metadata.

Checking `wedding-booking.orchestrator.ts`: it accepts `packageId` as input (line 30) but the metadata mapping needs verification in the actual checkout call.

**Impact:** If Stripe metadata contains `packageId` and the webhook handler only looks for `tierId`, in-flight payments will fail to link to bookings.

**Recommendation:**

1. Verify exactly which metadata keys the booking orchestrator writes to Stripe. If `packageId` is in metadata, the fallback window should be **7 days**, not 48 hours.
2. Add the `lookupTierByPackageId` helper as suggested in the plan, but keep it for 14 days (not 48 hours) to account for edge cases.

---

### P2-7: ContextBuilder.hasNonSeedPackages() Becomes Dead Code

**Location:** `server/src/services/context-builder.service.ts` lines 529-534

**Issue:** The `hasNonSeedPackages()` method queries `prisma.package.count()` and is called from `resolveAndBackfillPhase()` (line 481) and `getBootstrapData()` (line 417, via `revealCompleted` fallback). After Phase 7 deletes the Package model, this method will cause a runtime crash.

The plan mentions updating `context-builder.service.ts` in Phase 3 (line 336-338) and Phase 5 (line 558), but doesn't explicitly address the `hasNonSeedPackages()` method or its `revealCompleted` fallback.

**Impact:** Runtime crash in `getBootstrapData()` and `getOnboardingState()` after Package table is dropped.

**Recommendation:** Add to Phase 7 acceptance criteria: "Replace `hasNonSeedPackages()` with `hasNonSeedTiers()` (or remove the fallback entirely since all migrated tenants will have `revealCompletedAt` set by the migration)."

---

## P3 -- Low Risk / Optimization Opportunities

### P3-1: Row-by-Row CUID Generation in Migration

**Location:** Plan Phase 7 migration script (lines 723-735)

**Issue:** The migration generates CUIDs in JavaScript (`createId()`) and inserts one row at a time. CUID2 generation is fast (~50us) but the round-trip overhead of individual INSERTs dominates.

**Recommendation:** Build a VALUES clause with pre-generated CUIDs and execute a single multi-row INSERT per segment batch. Example:

```typescript
const values = pkgs.map((p, i) => `('${createId()}', '${p.tenantId}', ...)`).join(',\n');
await tx.$executeRawUnsafe(`INSERT INTO "Tier" (...) VALUES ${values} ON CONFLICT DO NOTHING`);
```

Caveat: Use parameterized queries to avoid SQL injection. `$executeRawUnsafe` with string interpolation is a security risk -- prefer `Prisma.sql` tagged template.

---

### P3-2: Brain Dump Size -- 2000 Chars Is Conservative

**Location:** Plan Phase 2 (line 268)

**Issue:** The plan caps brain dump at 2000 characters. At ~4 chars/token, this is ~500 tokens. This is well within LLM context limits but may be too restrictive for verbose users who want to paste their existing website copy.

**Impact:** Users may be frustrated by the character limit if they want to share detailed information.

**Recommendation:** 2000 chars is a reasonable MVP limit. Consider increasing to 4000 chars in Phase 2 enhancement if user feedback indicates truncation frustration. The token cost difference is negligible (~250 additional tokens).

---

### P3-3: Bootstrap Cache in DiscoveryService Not Updated for New Fields

**Location:** `server/src/services/discovery.service.ts` lines 93-96, 172-183

**Issue:** The `BootstrapData` interface in DiscoveryService (lines 45-53) caches `tenantId, businessName, industry, tier, onboardingDone, discoveryData`. After the plan's changes, bootstrap data should also include `brainDump, city, state, segments, tiers`. The LRU cache (30-minute TTL, 1000 max entries) will serve stale data if a tenant updates their brain dump or creates segments within the cache window.

**Impact:** Agent may not see recently updated brain dump or newly created segments for up to 30 minutes.

**Recommendation:** The plan already calls `invalidateBootstrapCache()` after `storeFact()`. Extend the same pattern to the new `manage_segments`, `manage_tiers`, and `manage_addons` tools: each mutation should invalidate the bootstrap cache for the tenant.

---

### P3-4: Segment.sortOrder + Tier.sortOrder Conflict Potential

**Location:** Plan Phase 1 schema (line 152: `@@unique([segmentId, sortOrder])`)

**Issue:** The `@@unique([segmentId, sortOrder])` constraint on Tier means two tiers in the same segment cannot have the same sort order. However, the agent tool for `manage_tiers create` doesn't specify how sortOrder is assigned. If the LLM generates `sortOrder: 1` for a new tier when sortOrder 1 already exists, the INSERT will fail with a unique constraint violation.

**Impact:** Agent tool failure, requiring a retry with different sortOrder. Not a performance issue per se, but causes wasted LLM turns (each retry costs ~4K tokens).

**Recommendation:** The `manage_tiers create` tool should auto-assign sortOrder as `MAX(sortOrder) + 1` for the segment, not accept it from the LLM. This prevents constraint violations and eliminates a class of agent errors.

---

### P3-5: OnboardingPhase Enum Removal -- Postgres Enum Alteration Complexity

**Location:** Plan Phase 3 (lines 349-356)

**Issue:** Simplifying the OnboardingPhase enum from 7 values to 4 values (NOT_STARTED, BUILDING, COMPLETED, SKIPPED) requires a Postgres enum alteration. Postgres does NOT support removing values from an enum type. The standard approach is:

1. Create new enum type
2. ALTER all columns to use new type
3. DROP old type

This requires DDL operations that take an `ACCESS EXCLUSIVE` lock on the Tenant table.

**Impact:** Brief lock on Tenant table during migration. Acceptable at current scale (<1000 tenants) but should be noted.

**Recommendation:** The migration script in Phase 7 already resets stuck tenants to NOT_STARTED (lines 689-693). Ensure this runs BEFORE the enum alteration so no rows reference the removed values (DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING). Prisma's `migrate dev` handles enum changes automatically via create-new-drop-old pattern, so this is mainly a correctness concern, not performance.

---

### P3-6: Multiple Sequential DB Queries in Bootstrap Path

**Location:** `server/src/services/context-builder.service.ts` lines 342-418

**Issue:** `getBootstrapData()` currently executes these queries sequentially:

1. `prisma.tenant.findUnique()` (line 342)
2. `sectionContentService.hasDraft()` (line 367)
3. `sectionContentService.hasPublished()` (line 368)
4. `resolveAndBackfillPhase()` -> `hasNonSeedPackages()` (line 391, via thunk)

When updated to include segments + tiers for the new plan, this could grow to 6-7 queries.

**Impact:** Bootstrap latency. Currently mitigated by the LRU cache in DiscoveryService (30-min TTL), but cache misses will be slower.

**Recommendation:** The existing code already parallelizes `hasDraft` and `hasPublished` with `Promise.all()` (line 366). When adding segment/tier fetches, include them in the same `Promise.all()` block. Consider a single Prisma `include` query on Tenant that joins segments + tiers in one round-trip.

---

## Summary

| Severity  | Count  | Key Themes                                                                                                                                                    |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1        | 4      | Migration lock duration, missing transaction timeout, missing indexes on Tier and Booking.tierId                                                              |
| P2        | 7      | Bootstrap token budget, ISR cache gap, unbounded queries, Decimal-to-Int migration, Stripe metadata window, dead code after Package deletion, redundant index |
| P3        | 6      | Batch inserts, brain dump size, cache invalidation for new tools, sortOrder conflicts, enum alteration, sequential queries                                    |
| **Total** | **17** |                                                                                                                                                               |
