# Data Integrity Guardian — Plan Review Findings

**Plan:** `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
**Reviewer:** Data Integrity Guardian
**Date:** 2026-02-12
**Focus:** Migration safety, referential integrity, cascade chains, data loss risk

---

## Summary

| Severity                                     | Count |
| -------------------------------------------- | ----- |
| P1 (Critical — data loss or corruption risk) | 7     |
| P2 (High — integrity gap, silent failure)    | 8     |
| P3 (Low — cosmetic or future-proofing)       | 4     |

---

## P1 Findings (Critical)

### P1-1: COALESCE in Draft Auto-Publish Overwrites Non-Draft Fields with NULL

**Location:** Plan Phase 7, migration script step 0 (lines 679-685)

**Issue:** The migration uses:

```sql
UPDATE "Package"
SET name = COALESCE("draftTitle", name),
    description = COALESCE("draftDescription", description),
    "basePrice" = COALESCE("draftPriceCents", "basePrice"),
    "hasDraft" = false
WHERE "hasDraft" = true
```

However, the Open Question #5 (line 923) uses a **different, incorrect** version:

```sql
UPDATE "Package" SET name = "draftTitle", description = "draftDescription", "basePrice" = "draftPriceCents" WHERE "hasDraft" = true
```

The Open Question version **does not use COALESCE** — if `draftTitle` is NULL (tenant started a draft but only changed the price), this would set `name = NULL`, violating the `String` (non-nullable) constraint on Package.name. The migration script version correctly uses COALESCE, but the **two versions are inconsistent** and someone implementing from Open Questions instead of the script will cause data corruption.

**Recommendation:** Remove the incorrect version from Open Question #5. Add a comment in the migration script: "CRITICAL: COALESCE required because draft fields are individually nullable."

---

### P1-2: Packages WITHOUT segmentId Are Silently Excluded from Migration

**Location:** Plan Phase 7, migration script step 2 (line 709)

**Issue:** The migration query filters `WHERE "segmentId" IS NOT NULL`, meaning any Package without a segmentId is **silently skipped** — never migrated to a Tier. The existence of `server/scripts/fix-orphaned-packages.ts` proves that orphaned packages (null segmentId) have occurred in production.

After migration, step 6 (lines 766-773) checks:

```sql
SELECT COUNT(*) as count FROM "Package"
WHERE "segmentId" IS NOT NULL
  AND id NOT IN (SELECT "sourcePackageId" FROM "Tier" WHERE "sourcePackageId" IS NOT NULL)
```

This verification **also excludes null-segmentId packages**, meaning packages without a segmentId will pass the verification check AND be silently dropped when the Package table is deleted in step 7.

**Impact:** Any bookings referencing these orphaned packages would lose their packageId→Tier linkage. The orphan abort guard (step 5) only checks `WHERE "packageId" IS NOT NULL AND "tierId" IS NULL` — but if the Package was never migrated to a Tier, the booking's packageId still points to a Package that gets deleted.

**Recommendation:**

1. Run `fix-orphaned-packages.ts` as a **prerequisite** before the migration (not optional).
2. Add a pre-migration guard: `SELECT COUNT(*) FROM "Package" WHERE "segmentId" IS NULL` — abort if count > 0.
3. Or: extend step 2 to create a "General" segment for orphaned packages automatically (matching what `fix-orphaned-packages.ts` does).

---

### P1-3: Booking FK Orphan Guard Misses TIMESLOT Bookings (False Positive Abort)

**Location:** Plan Phase 7, migration script step 5 (lines 757-762)

**Issue:** The orphan check is:

```sql
SELECT COUNT(*) as count FROM "Booking"
WHERE "packageId" IS NOT NULL AND "tierId" IS NULL
```

TIMESLOT bookings have `packageId = NULL` (confirmed in `appointment-booking.service.ts:257`: "packageId omitted - TIMESLOT bookings don't have packages"). These bookings correctly have no packageId and thus are **not affected** by the guard — this is fine.

However, the **real risk** is that DATE bookings from very early in the platform's life (before segments were enforced) might have a `packageId` pointing to a Package with `segmentId = NULL`. Since the migration in step 2 skips null-segmentId packages (see P1-2), these bookings' packageId would NOT get a corresponding Tier.sourcePackageId, so step 3's UPDATE would miss them, and step 5 would correctly **abort the entire migration**.

This is actually the **intended behavior** of the guard, but only if P1-2 is addressed first. If orphaned packages are not fixed pre-migration, the abort guard will fire on every migration attempt with no clear resolution path.

**Recommendation:** This finding is a consequence of P1-2. Fix P1-2 (run fix-orphaned-packages.ts first) and this resolves automatically.

---

### P1-4: Stripe Webhook Processor Hardcodes packageId in Zod Schema

**Location:** `server/src/jobs/webhook-processor.ts` lines 32-45 (StripeSessionSchema) and lines 48-70 (MetadataSchema)

**Issue:** The `StripeSessionSchema` requires `packageId: z.string()` as a **non-optional** field (line 37). The `MetadataSchema` has `packageId: z.string().optional()` (line 50). When the booking flow switches to use `tierId` in checkout metadata (Phase 6), **in-flight Stripe sessions created before deployment will still have packageId** in their metadata. New sessions will have `tierId`.

The plan mentions a "48-hour transition window" (risk table, line 981) with a helper `const tierId = metadata.tierId ?? await lookupTierByPackageId(metadata.packageId)`, but:

1. The `StripeSessionSchema` makes `packageId` **required** — new sessions with `tierId` instead of `packageId` will **fail Zod validation** entirely.
2. The `lookupTierByPackageId` helper is mentioned in the risk section but is **not in any phase's implementation plan**.
3. The `onPaymentCompleted` method in BookingService (line 591) explicitly takes `packageId: string` as a required field in its input.

**Impact:** After Phase 6 deployment, any new checkout session with `tierId` instead of `packageId` will fail the StripeSessionSchema validation, causing the webhook to be rejected. Conversely, keeping `packageId` in new sessions means the migration is incomplete.

**Recommendation:**

1. Phase 6 must update `StripeSessionSchema` to make `packageId` optional and add `tierId` as optional.
2. Add `tierId: z.string().optional()` to `MetadataSchema`.
3. Update `processNewBooking` to accept either `packageId` or `tierId`, with the Tier lookup as fallback.
4. Explicitly add this as a Phase 6 acceptance criterion with a transition compatibility test.

---

### P1-5: Existing Tier Data Conflict — Current Tiers Have No tenantId, No slug, No bookingType

**Location:** Current schema (`server/prisma/schema.prisma` lines 264-285) vs Plan Phase 1 (lines 119-156)

**Issue:** The current Tier model has:

- `level: TierLevel` (GOOD/BETTER/BEST enum)
- `price: Decimal @db.Decimal(10, 2)` (dollars, not cents)
- NO `tenantId` field
- NO `slug` field
- NO `bookingType` field
- NO `active` field
- NO `photos` field
- Unique constraint: `@@unique([segmentId, level])`

The plan's new Tier model has:

- `sortOrder: Int` (replacing TierLevel)
- `priceCents: Int` (cents, not dollars)
- `tenantId: String` (new required field)
- `slug: String` (new required field)
- `bookingType: BookingType @default(DATE)` (new field)
- `active: Boolean @default(true)` (new field)
- `photos: Json @default("[]")` (new field)
- Unique constraint: `@@unique([segmentId, sortOrder])`

**The plan treats this as "add fields to existing model" but it is actually a near-complete rewrite.** Existing Tier rows in production (created by `tenant-provisioning.service.ts` for every new tenant) have:

- No tenantId → the new `tenantId String` column would be NULL on existing rows, violating the non-nullable constraint
- No slug → the new `slug String` column would be NULL, violating non-nullable
- Price in Decimal(10,2) dollars → must be converted to Int cents
- TierLevel enum → must be mapped to sortOrder

**The plan mentions "Existing Tier data migrated (level GOOD→1, BETTER→2, BEST→3)" in Phase 1 acceptance criteria (line 200) but provides NO migration SQL for existing Tier data.** The Phase 7 migration script only handles Package→Tier migration, not existing Tier row transformation.

**Impact:** Prisma migration will fail because adding `tenantId String` (non-nullable) to a table with existing rows requires a default value or a data migration step. Same for `slug String`.

**Recommendation:**

1. Phase 1 must include a multi-step Prisma migration:
   a. Add new columns as **nullable** first: `tenantId String?`, `slug String?`, `sortOrder Int?`
   b. Run data migration: populate tenantId from Segment→Tenant join, generate slug from name, convert level to sortOrder, convert price Decimal→Int cents
   c. Make columns non-nullable: `ALTER TABLE "Tier" ALTER COLUMN "tenantId" SET NOT NULL` etc.
   d. Drop old columns: `level`, `price` (after renaming `priceCents`)
   e. Drop old unique constraint `[segmentId, level]`, add new `[segmentId, sortOrder]`
2. Add explicit Phase 1 migration SQL or TypeScript script for existing Tier data transformation.

---

### P1-6: OnboardingPhase Enum Migration — Removing Values from PostgreSQL Enum Is Not Trivial

**Location:** Plan Phase 3 (lines 349-355), Phase 7 migration step 0b (lines 689-693)

**Issue:** The plan simplifies OnboardingPhase from 7 values to 4:

```
Current:  NOT_STARTED | DISCOVERY | MARKET_RESEARCH | SERVICES | MARKETING | COMPLETED | SKIPPED
New:      NOT_STARTED | BUILDING | COMPLETED | SKIPPED
```

Phase 7, step 0b correctly resets intermediate-phase tenants to NOT_STARTED **before** altering the enum. However:

1. **PostgreSQL cannot remove values from an enum.** The `ALTER TYPE ... DROP VALUE` syntax does not exist. To remove enum values, you must: create a new enum → update all columns to use new enum → drop old enum → rename new enum. This requires careful migration ordering.

2. **Adding BUILDING** to the existing enum is straightforward (`ALTER TYPE "OnboardingPhase" ADD VALUE 'BUILDING'`), but **removing DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING** requires the full enum recreation dance.

3. The plan says Phase 3 handles the enum simplification and Phase 7 handles the data migration (step 0b). But **Phase 3 cannot remove enum values** if any rows still reference them — and the data migration is in Phase 7. These phases are **out of order** for the enum change.

**Recommendation:**

1. Phase 3 should ONLY add `BUILDING` to the enum (safe, additive).
2. Phase 7 should: (a) migrate data (step 0b), (b) recreate enum without removed values, (c) alter column to use new enum.
3. Provide explicit Prisma migration SQL for enum recreation (Prisma's standard migration won't handle enum value removal automatically).

---

### P1-7: A2A Commerce JSON Uses Ambiguous "price" Field — Cents vs Dollars Unspecified

**Location:** Plan Phase 8 (lines 838-852)

**Issue:** The A2A commerce JSON example shows:

```json
{ "id": "tier_1", "name": "Essential", "price": 3500, "features": [...] }
```

The field is `"price": 3500`. Is this $3,500.00 (dollars) or $35.00 (cents)? The plan states Tier.priceCents stores cents (Decision #8, line 62), but:

1. The JSON field is named `"price"`, not `"priceCents"` — ambiguous.
2. The current context-builder (`server/src/agent-v2/deploy/tenant/src/context-builder.ts` line 204) passes tier price as `price: typeof t.price === 'number' ? t.price : parseFloat(String(t.price))` — this reads from the current Decimal(10,2) field which stores **dollars**. After migration, Tier.priceCents stores **cents**.
3. The customer-agent that receives this JSON will interpret `3500` differently depending on the field name and documentation.

**Impact:** If the context builder sends `priceCents: 350000` (cents for $3,500) but the A2A JSON calls it `"price": 350000`, the customer agent might display "$350,000.00" to the user.

**Recommendation:**

1. A2A JSON field MUST be named `"priceCents"`, not `"price"`.
2. Update context-builder to convert Decimal→cents if reading old data, or pass through directly if Tier.priceCents is already in cents.
3. Add explicit unit documentation in the A2A JSON schema comment.
4. Add a smoke test: verify tier prices in A2A JSON are reasonable (< $50,000 typically for service businesses).

---

## P2 Findings (High)

### P2-1: Segment→Tier(Cascade) + Tier→Booking(Restrict) Creates a Deadlock on Segment Deletion

**Location:** Plan Phase 1 schema (lines 124, 174)

**Issue:** The plan specifies:

- `Segment → Tier: onDelete: Cascade` (deleting a segment cascades to delete its tiers)
- `Tier → Booking: onDelete: Restrict` (prevent deleting a tier that has bookings)

When a tenant tries to delete a segment that has tiers with bookings:

1. Segment delete triggers Cascade to Tier
2. Tier delete is blocked by Restrict from Booking
3. The entire operation fails with a foreign key violation

This is **correct behavior** (you shouldn't delete a segment with active bookings), but the plan's Phase 4 acceptance criteria (line 466) says `manage_segments` tool should support `delete` action. The agent tool needs explicit guidance that segment deletion will fail if any tier under it has bookings.

**Recommendation:**

1. The `manage_segments` delete action must first check: `SELECT COUNT(*) FROM "Booking" b JOIN "Tier" t ON b."tierId" = t.id WHERE t."segmentId" = $1 AND b.status NOT IN ('CANCELED', 'REFUNDED')`.
2. If count > 0, return a user-friendly message: "Can't delete this segment — it has active bookings."
3. Add this pre-check to the Phase 4 acceptance criteria.

---

### P2-2: TierAddOn Migration — No Segment Consistency Validation

**Location:** Plan Phase 7, migration script step 4 (lines 748-754)

**Issue:** The PackageAddOn→TierAddOn migration blindly copies:

```sql
INSERT INTO "TierAddOn" ("tierId", "addOnId")
SELECT t.id, pa."addOnId"
FROM "PackageAddOn" pa
JOIN "Tier" t ON t."sourcePackageId" = pa."packageId"
ON CONFLICT DO NOTHING
```

But AddOns can be segment-scoped (`AddOn.segmentId`). A PackageAddOn might link a Package in Segment A with an AddOn in Segment B — this was possible in the old schema because Package.segmentId and AddOn.segmentId had no cross-validation.

After migration, a TierAddOn could link a Tier in Segment A with an AddOn scoped to Segment B. This is semantically incorrect: an AddOn for "Wedding Photography" shouldn't be available on a "Corporate Retreat" tier.

**Recommendation:** Add a post-migration validation step:

```sql
SELECT ta."tierId", ta."addOnId", t."segmentId" as "tierSegment", a."segmentId" as "addonSegment"
FROM "TierAddOn" ta
JOIN "Tier" t ON ta."tierId" = t.id
JOIN "AddOn" a ON ta."addOnId" = a.id
WHERE a."segmentId" IS NOT NULL AND a."segmentId" != t."segmentId"
```

Log warnings for mismatched segment pairs. Don't abort — but flag for manual review.

---

### P2-3: sortOrder Collision Risk During Package→Tier Migration

**Location:** Plan Phase 7, migration script step 2 (lines 714-735)

**Issue:** The migration computes sortOrder by iterating packages per segment:

```typescript
for (let i = 0; i < pkgs.length; i++) {
  // sortOrder = i + 1
}
```

But existing Tiers (from provisioning) already have `@@unique([segmentId, level])` and after P1-5's migration would have `sortOrder` values (GOOD=1, BETTER=2, BEST=3). The Phase 7 Package→Tier migration creates **new** Tier rows with sortOrder 1, 2, 3... which would collide with the **already-migrated existing Tiers** under the new `@@unique([segmentId, sortOrder])` constraint.

The migration has `ON CONFLICT DO NOTHING` (line 734), so collisions are silently dropped — meaning some packages would never be migrated to tiers.

The NOT IN check (line 710) prevents re-migration of already-converted packages, but doesn't prevent sortOrder collisions with tiers that came from the provisioning defaults (P1-5).

**Recommendation:**

1. Before Package→Tier migration, query existing max sortOrder per segment: `SELECT "segmentId", MAX("sortOrder") FROM "Tier" GROUP BY "segmentId"`.
2. Start new tier sortOrder from `maxExisting + 1` instead of from 1.
3. Or: delete provisioning-default tiers first (they have price=0 and are placeholder data), then migrate packages. Safer if default tiers were never customized.

---

### P2-4: Booking Confirmation Emails Reference Package Name — Not in Migration Plan

**Location:** Risk table (line 992), `server/src/services/booking.service.ts` lines 280-284

**Issue:** The `confirmChatbotBooking` method fetches package name for the PAID event:

```typescript
if (booking.packageId) {
  const pkg = await this.catalogRepo.getPackageById(tenantId, booking.packageId);
  packageTitle = pkg?.title || 'Package';
}
```

After Phase 7 drops the Package table, `getPackageById` will fail. This code needs to be updated to fetch from Tier. Additionally, `onPaymentCompleted` (line 607) calls `getPackageByIdWithAddOns` — also Package-dependent.

The `getAllPlatformBookings` method (line 431) includes `package: { select: { name: true } }` in the Prisma query — this will cause a Prisma runtime error after Package table deletion.

**Recommendation:**

1. Phase 6 must update BookingService to use `tierId` instead of `packageId` for name lookups.
2. Add `getAllPlatformBookings` to the Phase 6 modification list — it currently queries Package for display.
3. Reminder service (`server/src/services/reminder.service.ts` line 80) also batch-fetches packages by packageId — add to modification list.

---

### P2-5: Missing Tier.tenantId in Current Schema Creates Tenant Isolation Gap

**Location:** Current schema (`server/prisma/schema.prisma` lines 264-285)

**Issue:** The current Tier model has NO `tenantId` field. Tiers are accessed via Segment.tenantId join. The plan adds `tenantId` directly to Tier for "isolation queries" (line 121).

During the transition (Phases 1-6), any code that queries Tier directly (without joining through Segment) has no tenant isolation. The plan's new tools (`manage_tiers`) will presumably filter by `tenantId`, but if Phase 1 adds `tenantId` as a column, the migration must populate it from the Segment join for existing rows.

If this population step is missed, tenantId would be NULL on existing Tiers, and `WHERE tenantId = $1` queries would return zero results — appearing as if the tenant has no tiers.

**Recommendation:** This is covered by P1-5 but worth calling out explicitly as a tenant isolation risk. The Phase 1 migration MUST populate tenantId for all existing Tier rows before making the column non-nullable.

---

### P2-6: Tier.price Decimal→Int Conversion Loses Precision for Non-Round Prices

**Location:** Current schema `Tier.price Decimal @db.Decimal(10,2)` → Plan `Tier.priceCents Int`

**Issue:** Converting Decimal(10,2) to Int cents requires multiplying by 100. For values like `199.99`, this gives `19999` (correct). But PostgreSQL Decimal arithmetic with rounding could produce `19999.00000001` which, when cast to Int, becomes `19999` — correct. However, if any tier price was entered with sub-cent precision (unlikely but possible via direct DB manipulation), the conversion would truncate.

More importantly, existing `DEFAULT_TIER_CONFIGS` in `tenant-defaults.ts` set `price: 0` (line 82). Converting `0.00` → `0` cents is fine. But the context-builder currently reads `t.price` as a number (line 204) and passes it directly — during the transition period, some tiers will have Decimal prices (old) and some will have Int cents (new).

**Recommendation:** Phase 1 migration should use `ROUND(price * 100)::INT` for the conversion. Add a validation query after conversion: `SELECT id, price, "priceCents" FROM "Tier" WHERE "priceCents" != ROUND(price * 100)`.

---

### P2-7: The Plan Has No Rollback Strategy for the Phase 7 Breaking Migration

**Location:** Plan Phase 7 (lines 654-819)

**Issue:** Phase 7 drops the Package table, PackageAddOn table, and Booking.packageId column in a single transaction. If any issue is discovered after the migration commits (e.g., a missed reference, a service that still queries Package), there is no rollback path — the data is gone.

The plan mentions "Backup production DB before migration" and "Test on staging first" (risk table, line 984), but provides no explicit rollback script.

**Recommendation:**

1. Before Phase 7, create a backup table: `CREATE TABLE "Package_backup" AS SELECT * FROM "Package"` and `CREATE TABLE "PackageAddOn_backup" AS SELECT * FROM "PackageAddOn"` and `ALTER TABLE "Booking" ADD COLUMN "packageId_backup" TEXT; UPDATE "Booking" SET "packageId_backup" = "packageId"`.
2. Keep backup tables for 30 days. Add a Phase 10 todo: "Drop backup tables after 30-day soak."
3. Include rollback SQL in the migration directory.

---

### P2-8: Stripe Checkout `metadata.packageId` in StripeSessionSchema Is Non-Optional

**Location:** `server/src/jobs/webhook-processor.ts` lines 36-37

**Issue:** The `StripeSessionSchema` defines:

```typescript
metadata: z.object({
    tenantId: z.string(),
    packageId: z.string(),  // <-- REQUIRED
```

This schema validates ALL checkout.session.completed webhooks for booking (non-subscription) flows. TIMESLOT bookings go through `AppointmentBookingService.createAppointmentCheckout()` which puts `serviceId` in metadata but NOT `packageId`.

Looking at the webhook processor flow:

1. It first tries `StripeSessionSchema.safeParse()` (line 198)
2. If that fails, it logs an error and throws `WebhookValidationError`

This means TIMESLOT appointment webhooks should be **failing** the StripeSessionSchema validation. The fact that they work suggests either: (a) TIMESLOT webhooks don't go through this code path, or (b) the appointment metadata happens to include a packageId field.

Reviewing `appointment-booking.service.ts` line 128-139: the TIMESLOT metadata does NOT include `packageId`. But the webhook processor checks `bookingType: z.enum(['DATE', 'TIMESLOT']).optional()` in MetadataSchema — however StripeSessionSchema is validated FIRST and would reject TIMESLOT sessions.

This is a **latent bug in the current codebase** (TIMESLOT webhooks may be failing silently), but it becomes a **blocker** for the Package→Tier migration because the schema must be updated to handle both `packageId` and `tierId`.

**Recommendation:**

1. Investigate whether TIMESLOT booking webhooks are currently working in production (check webhook failure logs).
2. Make `packageId` optional in `StripeSessionSchema` (it already is in `MetadataSchema`).
3. As part of Phase 6, add `tierId` as optional to both schemas.

---

## P3 Findings (Low)

### P3-1: groupingOrder→sortOrder Mapping May Produce Non-Contiguous Values

**Location:** Plan Phase 7, migration step 2 (lines 711, 723)

**Issue:** Packages are ordered by `"groupingOrder" NULLS LAST, "createdAt"`. If a tenant has packages with groupingOrder values [1, 3, 5] (skipping 2 and 4), the migration maps them to sortOrder [1, 2, 3] — which is correct. However, if packages have been deleted (e.g., original groupingOrder [1, 2, 3] but package 2 was deleted), the remaining packages get [1, 2] — also correct.

The only edge case: if `groupingOrder` is NULL for all packages (no explicit ordering), they sort by `createdAt`, which may not match the tenant's intended display order. This is cosmetic, not a data integrity issue.

**Recommendation:** Acceptable as-is. Document that post-migration, tenants may need to reorder tiers if they had no explicit groupingOrder.

---

### P3-2: TierAddOn Lacks tenantId for Direct Tenant-Scoped Queries

**Location:** Plan Phase 1, TierAddOn model (lines 159-168)

**Issue:** TierAddOn has no `tenantId` field — queries must join through Tier to verify tenant ownership. This is consistent with the current PackageAddOn pattern (also no tenantId). For performance, if TierAddOn queries become frequent, a denormalized tenantId would help — but this is not a correctness issue.

**Recommendation:** Acceptable for MVP. Consider adding `tenantId` to TierAddOn in a future optimization pass if agent tools query it frequently.

---

### P3-3: Migration Script Uses `Date.now()` Instead of `NOW()` for updatedAt

**Location:** Plan Phase 7, migration step 2 (line 729)

**Issue:** The INSERT uses `NOW()` for both `createdAt` and `updatedAt`, which is correct. No issue here upon closer inspection. However, the script uses `createId()` from `@paralleldrive/cuid2` for Tier IDs — this is correct and matches the project's CUID convention.

**Recommendation:** No action needed. Noting for completeness that the CUID usage is correct per Pitfall #7.

---

### P3-4: Plan References `tier` in Tenant Model (`tierDisplayNames`) — Name Collision with New Tier Entity

**Location:** Current schema, Tenant model (line 105-106)

**Issue:** The current schema has `tierDisplayNames Json?` on the Tenant model, which refers to the old GOOD/BETTER/BEST tier display names. After the migration replaces TierLevel with sortOrder, this field becomes obsolete. The plan doesn't mention deleting or migrating `tierDisplayNames`.

Additionally, the Tenant model has `tier SubscriptionTier` (line 75) for subscription pricing — this is a different concept from the Segment→Tier entity, creating naming ambiguity.

**Recommendation:** Add `tierDisplayNames` to the Phase 7 cleanup list — drop the column or migrate its data to per-Tier `name` fields. The `SubscriptionTier` naming ambiguity is cosmetic but worth a code comment.

---

## Cross-Reference Validation

### Verified Correct

1. **Package.basePrice (Int/cents) → Tier.priceCents (Int/cents):** Direct copy is correct. Both are Int fields storing cents. The migration step 2 uses `${p.basePrice}` directly as `"priceCents"` — correct.

2. **Booking.totalPrice is Int (cents):** Consistent with Tier.priceCents. No unit conversion needed at the booking creation boundary.

3. **Payment.amount is Int (cents):** Consistent. No changes needed in payment flow.

4. **sourcePackageId join strategy:** Correct choice over slug-based join. Slugs are mutable (`@@unique([tenantId, slug])` allows updates). The temporary column approach is sound.

5. **TIMESLOT bookings have packageId=NULL:** The abort guard (step 5) correctly filters `WHERE "packageId" IS NOT NULL`, so TIMESLOT bookings are excluded. Correct.

6. **Transaction wrapping:** The entire migration runs in `prisma.$transaction()`. This ensures atomicity — if any step fails, all changes roll back.
