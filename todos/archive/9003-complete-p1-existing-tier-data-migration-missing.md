---
status: pending
priority: p1
issue_id: 9003
tags: [code-review, data-integrity, migration]
dependencies: []
---

# Existing Tier Data Migration Missing from Plan

## Problem Statement

The current Prisma schema has a Tier model with EXISTING rows:

- `level TierLevel` (GOOD/BETTER/BEST enum)
- `price Decimal @db.Decimal(10,2)` (dollars, not cents)
- NO `tenantId` column
- NO `slug` column
- NO `bookingType` column
- NO `active` flag
- NO `photos` JSON
- Uses `@@unique([segmentId, level])` constraint

Phase 1 replaces this with a radically different schema:

- `sortOrder Int` (replaces level)
- `priceCents Int` (replaces Decimal price)
- `tenantId String` (NEW required field)
- `slug String` (NEW)
- `bookingType BookingType` (NEW)
- `active Boolean` (NEW)
- `photos Json` (NEW)
- `@@unique([segmentId, sortOrder])` (replaces level constraint)

Phase 1's acceptance criteria says "Existing Tier data migrated (level GOOD→1, BETTER→2, BEST→3)" but the plan has NO migration script for existing Tier rows. Phase 7's TypeScript migration script ONLY handles Package→Tier creation.

**Why it matters:** Adding `tenantId String` as required will fail the migration if existing rows have no tenantId. The Prisma migrate will abort.

## Findings

### Evidence

- Current schema `server/prisma/schema.prisma:264-291` — Tier model with TierLevel, Decimal price, no tenantId
- Plan Phase 1 lines 120-156 — New Tier schema with all new columns
- Plan Phase 1 line 200 — "Existing Tier data migrated" acceptance criterion
- Plan Phase 7 lines 670-785 — Migration script only handles Package→Tier, not existing Tier conversion

### Key Gap

Existing Tier rows need:

1. `tenantId` backfilled from `Segment.tenantId` (JOIN on segmentId)
2. `sortOrder` computed from `level` (GOOD=1, BETTER=2, BEST=3)
3. `priceCents` computed as `CAST(price * 100 AS INT)` (Decimal dollars → Int cents)
4. `slug` generated from `name` (slugify)
5. `bookingType` defaulted to `DATE`
6. `active` defaulted to `true`
7. `photos` defaulted to `'[]'::jsonb`
8. Old `@@unique([segmentId, level])` constraint dropped, new `@@unique([segmentId, sortOrder])` added
9. `TierLevel` enum dropped

## Proposed Solutions

### Option A: Phase 1 Prisma migration with SQL data migration (Recommended)

```sql
-- Step 1: Add new columns as nullable
ALTER TABLE "Tier" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Tier" ADD COLUMN "sortOrder" INT;
-- ... etc

-- Step 2: Backfill from Segment
UPDATE "Tier" t SET "tenantId" = s."tenantId"
FROM "Segment" s WHERE t."segmentId" = s.id;

UPDATE "Tier" SET "sortOrder" = CASE level
  WHEN 'GOOD' THEN 1 WHEN 'BETTER' THEN 2 WHEN 'BEST' THEN 3 END;

UPDATE "Tier" SET "priceCents" = CAST(price * 100 AS INT);

-- Step 3: Make columns required
ALTER TABLE "Tier" ALTER COLUMN "tenantId" SET NOT NULL;
```

- **Effort:** Medium
- **Risk:** Low — standard Prisma `--create-only` + custom SQL

### Option B: TypeScript migration script in Phase 1

- Same as Phase 7's approach but for existing Tiers
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected files:**

- `server/prisma/schema.prisma` — Tier model changes
- Phase 1 migration SQL (to be created)
- `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md` — Add migration steps

**Affected phases:** Phase 1

## Acceptance Criteria

- [ ] Existing Tier rows have tenantId populated (from Segment)
- [ ] Existing Tier rows have sortOrder (GOOD=1, BETTER=2, BEST=3)
- [ ] Existing Tier rows have priceCents (Decimal→Int cents conversion)
- [ ] Existing Tier rows have slug, bookingType, active, photos
- [ ] TierLevel enum dropped
- [ ] Old unique constraint replaced
- [ ] Migration tested on staging

## Work Log

| Date       | Action                        | Learnings                                                    |
| ---------- | ----------------------------- | ------------------------------------------------------------ |
| 2026-02-12 | Discovered during plan review | Plan addresses Package→Tier but not existing Tier conversion |

## Resources

- Current schema: `server/prisma/schema.prisma:264-291`
- Plan Phase 1: `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
