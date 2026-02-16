# Pattern Recognition -- Plan Review Findings

**Document:** `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
**Reviewer:** Pattern Recognition Specialist (Cross-Phase Consistency)
**Date:** 2026-02-12
**Scope:** All 9 phases post-patch (priceCents Int, sourcePackageId, onDelete:Restrict, TypeScript migration, Stripe dual-ID)

---

## Summary

| Severity       | Count  |
| -------------- | ------ |
| P1 (Critical)  | 6      |
| P2 (Important) | 11     |
| P3 (Minor)     | 5      |
| **Total**      | **22** |

---

## P1 -- Critical Findings

### P1-1: A2A JSON price field is ambiguous (cents vs dollars)

**Location:** Phase 8, line 843-845
**Issue:** The A2A commerce JSON example shows `"price": 3500` and `"price": 500`. With the entire plan switching to `priceCents Int`, these values are ambiguous. Is 3500 = $35.00 (cents) or $3,500 (dollars)? The add-on `"price": 500` could be $5.00 or $500.

The plan explicitly states Tier uses `priceCents` (Phase 1 schema, Decision #8), but the A2A JSON field is named `"price"` -- not `"priceCents"`. This naming inconsistency will cause misinterpretation by customer-agent LLMs and any future A2A consumers.

**Fix required:**

1. Rename the A2A JSON field to `"priceCents"` for consistency, OR
2. Add an explicit unit comment in the JSON spec: `"priceCents": 350000` (for $3,500), OR
3. If the values ARE in dollars for display purposes, document the conversion layer between Tier.priceCents (DB) and A2A display JSON.

**Impact:** Customer-agent could display wrong prices to customers. Financial data integrity risk.

---

### P1-2: Phase 7 migration resets BUILDING tenants to NOT_STARTED

**Location:** Phase 7, lines 687-692; Phase 3, lines 349-355
**Issue:** Phase 3 simplifies OnboardingPhase to `NOT_STARTED | BUILDING | COMPLETED | SKIPPED`. Phase 7 migration runs:

```sql
UPDATE "Tenant" SET "onboardingPhase" = 'NOT_STARTED'
WHERE "onboardingPhase" NOT IN ('NOT_STARTED', 'COMPLETED', 'SKIPPED')
```

This query does NOT include `BUILDING` in the exclusion list. Any tenant who is actively in the `BUILDING` phase (added in Phase 3) will be forcibly reset to `NOT_STARTED` when Phase 7 migration runs.

**Root cause:** The Phase 7 migration was written against the OLD enum (DISCOVERY/MARKET_RESEARCH/SERVICES/MARKETING). After Phase 3 adds BUILDING, the reset query needs to exclude it.

**Fix required:** Change the Phase 7 migration to:

```sql
WHERE "onboardingPhase" NOT IN ('NOT_STARTED', 'BUILDING', 'COMPLETED', 'SKIPPED')
```

**Impact:** Active onboarding tenants lose their progress mid-session. Data loss.

---

### P1-3: Stripe webhook processor hardcodes `packageId` in metadata schema

**Location:** Phase 6 acceptance criteria vs actual code
**Issue:** `server/src/jobs/webhook-processor.ts` lines 37 and 50 define Zod schemas with `packageId` as a required/optional metadata field. The risk table (line 981) acknowledges "Stripe metadata references packageId in checkout-session.factory.ts + 8 webhook handlers" and proposes a dual-ID fallback helper.

However, no phase explicitly lists `server/src/jobs/webhook-processor.ts` in its "Files to modify" section. Phase 6c lists `server/src/routes/bookings.routes.ts` and `server/src/services/booking.service.ts` but omits the webhook processor entirely. The webhook processor contains the critical metadata validation schemas (`StripeSessionSchema`, `MetadataSchema`) that will fail once `packageId` is removed.

**Files missing from plan:**

- `server/src/jobs/webhook-processor.ts` -- must update metadata schemas to accept `tierId`
- `server/src/services/wedding-booking.orchestrator.ts` -- writes `packageId` into Stripe metadata (line 89)
- `server/src/services/wedding-deposit.service.ts` -- likely references packageId in deposit metadata

**Fix required:** Add these files to Phase 6c's file list. Add dual-ID migration window logic as described in the risk table.

**Impact:** Stripe checkout sessions created BEFORE migration will fail webhook processing AFTER migration. Payment data loss.

---

### P1-4: Phase 1 Tier schema missing `Tenant` relation in current schema

**Location:** Phase 1, lines 119-156 vs current schema lines 264-285
**Issue:** The current Tier model has NO `tenantId` field, NO `tenant` relation, NO `bookings` relation, and NO `TierAddOn` relation. Phase 1 adds all of these. However, the Phase 1 migration also needs to handle EXISTING Tier rows that have no `tenantId`.

The plan shows the Phase 1 Tier model with `tenantId String` (non-nullable), but existing Tier rows (created by the current GOOD/BETTER/BEST system) don't have this field. The migration will fail with `NOT NULL constraint violation` unless it either:

1. Backfills `tenantId` from `Segment.tenantId` (since `Tier.segmentId -> Segment.tenantId`)
2. Makes `tenantId` nullable initially

Phase 1's acceptance criteria says "Existing Tier data migrated (level GOOD->1, BETTER->2, BEST->3)" but doesn't mention backfilling `tenantId`.

**Fix required:** Add a data migration step in Phase 1:

```sql
-- Backfill tenantId from parent Segment
UPDATE "Tier" t SET "tenantId" = s."tenantId" FROM "Segment" s WHERE t."segmentId" = s.id;
```

This must run BEFORE the NOT NULL constraint is applied.

**Impact:** Migration will fail on any database with existing Tier data. Blocks all subsequent phases.

---

### P1-5: Customer-agent `recommend_package` tool not addressed in Phase 8

**Location:** Phase 8, lines 826-858
**Issue:** Phase 8 says "Update customer-agent to browse tiers instead of packages" and lists files in `server/src/agent-v2/deploy/customer/src/tools/`. However, the actual customer-agent code at `server/src/agent-v2/deploy/customer/src/tools/booking.ts` contains:

1. `recommendPackageTool` (name: `recommend_package`) -- explicitly "recommend packages" by name
2. `RecommendPackageParams` -- has `budget` enum referencing package concepts

Phase 8 does not mention renaming `recommend_package` to `recommend_tier` or updating its schema. The tool description says "Recommend services based on customer preferences" but the tool name and parameter schema still reference "package".

**Fix required:** Add to Phase 8 file list:

- Rename `recommendPackageTool` to `recommendTierTool`
- Rename tool from `recommend_package` to `recommend_tier`
- Update `RecommendPackageParams` to reference Tier/Segment concepts

**Impact:** Post-migration, the customer-agent will have a tool named `recommend_package` that calls a backend endpoint returning Tier data. Semantic mismatch causes LLM confusion.

---

### P1-6: Phase 6 references non-existent booking path

**Location:** Phase 6a, line 578
**Issue:** Phase 6 says the CURRENT booking path is:

```
/t/[slug]/book/[packageSlug]/page.tsx
```

And references it at `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx`.

Glob confirms the file DOES exist at this path. However, Phase 6 says "Rename to `[tierSlug]`" but does NOT mention creating 301 redirects from the old `[packageSlug]` URL. Open Question #1 (line 919) recommends "Add 301 redirects from `/book/[packageSlug]` -> `/book/[tierSlug]`" but this is listed as an "open question" -- not incorporated into any phase's acceptance criteria or file list.

**Fix required:** Add redirect handling to Phase 6 acceptance criteria:

- Create redirect route at `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx` that 301s to `[tierSlug]`
- Same for `apps/web/src/app/t/_domain/book/[packageSlug]/page.tsx`
- Or resolve the open question and add a clear decision.

**Impact:** All existing bookmarked/shared booking URLs break permanently. SEO damage.

---

## P2 -- Important Findings

### P2-1: Phase 4 deletes `packages.ts`, Phase 7 says "already deleted in Phase 4"

**Location:** Phase 4 line 439, Phase 7 line 806
**Issue:** Phase 4 file list says `server/src/agent-v2/deploy/tenant/src/tools/packages.ts -- **DELETE**`. Phase 7 also lists it in "Files to DELETE" with note "(already deleted in Phase 4)". This is consistent as documentation, but Phase 7 should NOT list it as a file to delete. Including already-deleted files in a deletion list is confusing and could cause script errors.

**Fix:** Remove from Phase 7 deletion list or mark clearly as "verify deleted".

---

### P2-2: Tier model missing `photos` field in current schema -- Phase 1 data migration gap

**Location:** Phase 1 line 143, Risk table line 983
**Issue:** Risk table says "Package has `photos` JSON, Tier has none" and mitigation is "Add `photos Json @default("[]")` to Tier model in Phase 1 schema migration." Phase 1 Tier schema DOES include `photos Json @default("[]")`.

However, there is no mention of MIGRATING existing Package photos to Tier during the Phase 7 data migration. The Phase 7 migration script (lines 725-735) inserts `'[]'::jsonb` for the features column but doesn't copy `Package.photos` to `Tier.photos`.

**Fix:** Add photo migration to Phase 7 script:

```sql
UPDATE "Tier" t SET photos = p.photos
FROM "Package" p WHERE t."sourcePackageId" = p.id AND p.photos != '[]'::jsonb;
```

---

### P2-3: `tenant-admin.routes.ts` references PackageDraftService but not in Phase 7 file list

**Location:** Phase 7, lines 789-801
**Issue:** Grep shows `PackageDraftService` is imported in:

- `server/src/di.ts` (listed in Phase 7)
- `server/src/routes/index.ts` (not listed)
- `server/src/routes/tenant-admin.routes.ts` (not listed)
- `server/src/services/package-draft.service.ts` (listed for deletion)

Phase 7 says to delete `package-draft.service.ts` and remove from `di.ts`, but omits:

- `server/src/routes/tenant-admin.routes.ts` -- likely has draft publish/discard endpoints
- `server/src/routes/index.ts` -- route registration

**Fix:** Add both files to Phase 7's modification list.

---

### P2-4: Booking confirmation emails reference Package name (unaddressed)

**Location:** Risk table line 992
**Issue:** Risk table says "Booking confirmation emails reference Package name" at P2 severity. The mitigation says "Store tier name in Booking record (denormalized) or update email builder to fetch Tier." However, no phase includes this work in its file list or acceptance criteria.

**Fix:** Add email template updates to Phase 6c or Phase 7. Identify the email builder file and add it to the file list.

---

### P2-5: `TierLevel` enum removal creates gap between Phase 1 and contracts

**Location:** Phase 1 line 199, current `packages/contracts/src/schemas/tier.schema.ts`
**Issue:** Phase 1 acceptance criteria says "TierLevel enum removed, replaced with sortOrder." However, the contracts package at `packages/contracts/src/schemas/tier.schema.ts` exports:

- `TierLevelSchema` (z.enum(['GOOD', 'BETTER', 'BEST']))
- `TierLevel` type
- `DEFAULT_TIER_FEATURES` keyed by TierLevel
- `DEFAULT_TIER_NAMES` keyed by TierLevel

Phase 1's file list says to modify `packages/contracts/src/schemas/tier.schema.ts` to "Update TierSchema (remove TierLevel, add sortOrder/slug/bookingType/active)". However, `DEFAULT_TIER_FEATURES` and `DEFAULT_TIER_NAMES` are keyed by `TierLevel` and used elsewhere. Phase 1 does not specify what replaces these constants.

**Fix:** Specify replacement constants:

- `DEFAULT_TIER_FEATURES` should be keyed by sortOrder (1, 2, 3) or renamed
- `DEFAULT_TIER_NAMES` should be keyed by sortOrder or removed (names are now freeform)

---

### P2-6: Phase 3 acceptance criteria missing OnboardingPhase migration for existing tenants

**Location:** Phase 3, lines 348-379
**Issue:** Phase 3 simplifies OnboardingPhase from 7 values to 4 (NOT_STARTED, BUILDING, COMPLETED, SKIPPED). The plan lists a Prisma migration (`npx prisma migrate dev --name simplify_onboarding_phase`), but Prisma cannot remove enum values from PostgreSQL without first ensuring no rows reference the removed values.

Phase 7 has the migration that resets intermediate phases, but Phase 3 happens FIRST. If Phase 3 removes DISCOVERY/MARKET_RESEARCH/SERVICES/MARKETING from the enum without first migrating existing rows, the migration will fail.

**Fix:** Phase 3 MUST include the same row-reset migration that Phase 7 currently has:

```sql
UPDATE "Tenant" SET "onboardingPhase" = 'NOT_STARTED'
WHERE "onboardingPhase" IN ('DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING');
```

Then the Phase 7 migration for this becomes unnecessary (or a no-op safety net).

---

### P2-7: Decision #4 says "Phase 5 adds tierId to Booking" but it is actually Phase 1

**Location:** Decision table line 58, Phase 1 lines 171-176
**Issue:** Decision #4 states "Phase 5 adds `tierId` to Booking (nullable). Phase 7 migrates data + deletes Package model." But the actual implementation puts `tierId` on Booking in Phase 1 (line 171-176), not Phase 5.

Phase 5 is the system prompt rewrite and has nothing to do with schema changes.

**Fix:** Update Decision #4 text: "Phase **1** adds `tierId` to Booking (nullable)."

---

### P2-8: `server/src/adapters/prisma/catalog.repository.ts` missing from Phase 6 file list

**Location:** Phase 6c line 641
**Issue:** Phase 6c DOES list `server/src/adapters/prisma/catalog.repository.ts` in its file list. However, the current code in `catalog.repository.ts` has methods like `getPackageById`, `getPackageByIdWithAddOns`, `getAddOnsByPackageId` that are called from `booking.service.ts` and `wedding-booking.orchestrator.ts`. These methods need Tier equivalents.

The file list says "Query tiers instead of packages" but Phase 6c acceptance criteria don't explicitly verify that Tier-based repository methods exist and are tested.

**Fix:** Add explicit acceptance criteria: "catalog.repository.ts has `getTierById`, `getTierBySlug`, `getAddOnsByTierId` methods replacing Package equivalents."

---

### P2-9: Stripe dual-ID transition window not specified in any acceptance criteria

**Location:** Risk table line 981, Phase 6c
**Issue:** The risk table describes a critical 48-hour transition window where webhook handlers must check for BOTH `metadata.tierId` AND `metadata.packageId`. It even provides a helper: `const tierId = metadata.tierId ?? await lookupTierByPackageId(metadata.packageId)`.

However, this dual-ID logic is not in any phase's acceptance criteria. It's only in the risk table. The webhook processor Zod schemas need to accept both IDs, and the booking service needs the fallback lookup.

**Fix:** Add to Phase 6c acceptance criteria:

- "Webhook processor accepts both `tierId` and `packageId` in metadata"
- "Fallback helper `lookupTierByPackageId` exists for transition window"
- "After 48h (Phase 9), remove packageId fallback"

---

### P2-10: Phase 9 E2E test timing -- "Rewrite E2E tests BEFORE migration" contradicts phase ordering

**Location:** Phase 9, line 877
**Issue:** Phase 9 says "IMPORTANT: Rewrite E2E tests BEFORE migration (not after). Update `e2e/tests/booking.spec.ts` and `booking-mock.spec.ts` to use Tier-based booking flow during Phase 6."

This instruction is in Phase 9 but says to do the work in Phase 6. If this was already done in Phase 6, why repeat it in Phase 9? If not done in Phase 6, Phase 9 is too late (tests should already be updated by then).

**Fix:** Move E2E test rewrite explicitly into Phase 6 file list and acceptance criteria. Phase 9 should only verify they pass.

---

### P2-11: `booking-management.spec.ts` and `booking-flow.spec.ts` not listed for update

**Location:** Phase 6/7/9
**Issue:** Glob found 4 E2E test files:

- `e2e/tests/booking.spec.ts` (listed)
- `e2e/tests/booking-mock.spec.ts` (listed)
- `e2e/tests/booking-management.spec.ts` (NOT listed)
- `e2e/tests/booking-flow.spec.ts` (NOT listed)

The plan only mentions the first two. The other two likely reference Package concepts.

**Fix:** Add `booking-management.spec.ts` and `booking-flow.spec.ts` to Phase 6 or Phase 9 file lists.

---

## P3 -- Minor Findings

### P3-1: Section blueprint still references slot machine in comments

**Location:** `packages/contracts/src/schemas/section-blueprint.schema.ts`, lines 10-11, 41, 65
**Issue:** Current file has comments like:

- "Imported by: server/src/lib/slot-machine.ts (readiness computation)" (line 10)
- "Lowercase section type (matches slot machine keys)" (line 41)
- "8 canonical sections matching slot machine" (line 65)

Phase 3 says to modify this file but only mentions removing `DISCOVERY_FACT_KEYS` and `computeSectionReadiness`. The slot machine references in comments will become stale.

**Fix:** Add to Phase 3: "Update comments in section-blueprint.schema.ts to remove slot machine references."

---

### P3-2: `SEED_PACKAGE_NAMES` in agent constants not mentioned for Phase 4 cleanup

**Location:** `server/src/agent-v2/deploy/tenant/src/constants/shared.ts` line 46
**Issue:** The constants file exports `SEED_PACKAGE_NAMES` with a JSDoc referencing `contracts SEED_PACKAGE_NAMES`. Phase 4 says to update `shared.ts` to "Remove DISCOVERY_FACT_KEYS" but doesn't mention removing `SEED_PACKAGE_NAMES`.

Phase 7 mentions removing `SEED_PACKAGE_NAMES` from the contracts package. But the agent constants copy should be removed in Phase 4 (when `first-draft.ts` is updated to use tiers instead of seed packages) or Phase 7.

**Fix:** Add `SEED_PACKAGE_NAMES` removal to Phase 4's constants update for `shared.ts`.

---

### P3-3: Constants barrel export (`constants/index.ts`) not listed for Phase 4 update

**Location:** `server/src/agent-v2/deploy/tenant/src/constants/index.ts`
**Issue:** This file re-exports `DISCOVERY_FACT_KEYS`, `SEED_PACKAGE_NAMES`, and other constants. When Phase 4 modifies the individual constant files, the barrel export needs updating too. It is not listed in Phase 4's file list.

**Fix:** Add `constants/index.ts` to Phase 4 file list.

---

### P3-4: Design spec says "Package model is deleted" without phase reference

**Location:** `docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md` line 21
**Issue:** The design spec states "Tier replaces Package. Package model is deleted." This is a statement of intent, not a phased plan reference. After Phase 7, this statement becomes true. But during Phases 1-6, the Package model still exists. The design spec should note the transition period.

**Fix:** Add "(deleted in Phase 7 of implementation plan)" after the statement.

---

### P3-5: Workstream table says "8 Workstreams" but lists items 1-8; plan has 9 phases

**Location:** Lines 30-42 (workstream table), Phases 1-9
**Issue:** The overview says "8 Workstreams" and the workstream table lists 8 items. But the implementation has 9 phases (Phase 1-9). Workstream #7 ("Two-phase onboarding") maps to Phase 5 (system prompt), not a separate phase. Phase 8 (customer-agent) and Phase 9 (deployment) are not in the workstream table.

This is a documentation inconsistency -- the workstreams describe conceptual buckets while phases describe execution order. Not a code issue, but could confuse implementers about scope.

**Fix:** Add a note: "Workstreams map to multiple implementation phases. See phases below for execution order."

---

## Cross-Reference Verification

### Design Spec Alignment

- **Package references surviving past Phase 7:** Design spec correctly states Package is deleted. Plan Phase 7 handles this. No Package references should survive in code after Phase 7. Verified.
- **On-demand research:** Both design spec and plan agree. Verified.
- **Brain dump at signup:** Both agree. Verified.
- **3 tiers per segment default:** Design spec says "3 pricing options per segment". Plan Phase 4 says "max 5 tiers per segment (configurable)". Minor discrepancy -- plan is more flexible. Acceptable.

### Risk Table vs Phase Mitigations

- Risk "Booking.packageId FK cascade" (P1-CRITICAL): Mitigated in Phase 1 (tierId added) and Phase 7 (packageId dropped). **Verified.**
- Risk "Stripe metadata references packageId" (P1-CRITICAL): Mitigation described in risk table BUT not in any phase acceptance criteria. **P2-9 above.**
- Risk "Customer-agent browses Packages" (P1-CRITICAL): Phase 8 addresses this. **Partially verified** -- missing `recommend_package` rename (P1-5 above).
- Risk "Package photo system" (P1): Mitigated in Phase 1 schema. Photo DATA migration missing from Phase 7. **P2-2 above.**

### File Deletion Safety

- `slot-machine.ts` deleted in Phase 3, no later references. **Verified.**
- `packages.ts` (agent tool) deleted in Phase 4, referenced as "already deleted" in Phase 7. **P2-1 above.**
- `package-draft.service.ts` deleted in Phase 7, imports exist in files not listed. **P2-3 above.**
