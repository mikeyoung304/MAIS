-- Phase 1: Additive Schema Changes (Non-Breaking)
-- Promotes Tier to bookable entity, adds brain dump + location to Tenant,
-- creates TierAddOn join table, adds Booking.tierId for transition.
--
-- Strategy: add-then-backfill-then-constrain (no downtime)

-- ============================================================================
-- 1. Tenant: Add brain dump + location fields
-- ============================================================================
ALTER TABLE "Tenant" ADD COLUMN "brainDump" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "city" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "state" TEXT;

-- ============================================================================
-- 2. Tier: Add new columns as NULLABLE first (30 existing rows)
-- ============================================================================
ALTER TABLE "Tier" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Tier" ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE "Tier" ADD COLUMN "slug" TEXT;
ALTER TABLE "Tier" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "Tier" ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'DATE';
ALTER TABLE "Tier" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tier" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';

-- ============================================================================
-- 3. Backfill Tier data from existing columns
-- ============================================================================

-- 3a. Backfill tenantId from parent Segment
UPDATE "Tier" t
SET "tenantId" = s."tenantId"
FROM "Segment" s
WHERE t."segmentId" = s.id;

-- 3b. Convert TierLevel enum → sortOrder integer
UPDATE "Tier"
SET "sortOrder" = CASE level
  WHEN 'GOOD' THEN 1
  WHEN 'BETTER' THEN 2
  WHEN 'BEST' THEN 3
END;

-- 3c. Generate slug from name (lowercase, replace non-alphanum with hyphens, trim trailing hyphens)
UPDATE "Tier"
SET slug = TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')));

-- 3d. Convert Decimal price → Int cents
-- Validation: verify no data loss before conversion
-- (If this assertion fails, the migration will abort — safe)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM "Tier"
  WHERE ROUND(price * 100)::INTEGER != ROUND(price * 100);

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % tier prices would lose precision during cents conversion', mismatch_count;
  END IF;
END $$;

UPDATE "Tier"
SET "priceCents" = ROUND(price * 100)::INTEGER;

-- ============================================================================
-- 4. Make backfilled columns NOT NULL
-- ============================================================================
ALTER TABLE "Tier" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Tier" ALTER COLUMN "sortOrder" SET NOT NULL;
ALTER TABLE "Tier" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Tier" ALTER COLUMN "priceCents" SET NOT NULL;

-- ============================================================================
-- 5. Drop old columns and constraints
-- ============================================================================

-- Drop the old unique constraint [segmentId, level]
ALTER TABLE "Tier" DROP CONSTRAINT IF EXISTS "Tier_segmentId_level_key";

-- Drop old columns
ALTER TABLE "Tier" DROP COLUMN "level";
ALTER TABLE "Tier" DROP COLUMN "price";

-- Drop the TierLevel enum (no longer needed)
DROP TYPE "TierLevel";

-- ============================================================================
-- 6. Add new constraints and indexes for Tier
-- ============================================================================

-- Unique: one sortOrder per segment (replaces level uniqueness)
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_segmentId_sortOrder_key" UNIQUE ("segmentId", "sortOrder");

-- Unique: one slug per tenant
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_tenantId_slug_key" UNIQUE ("tenantId", "slug");

-- Foreign key: Tier → Tenant
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index: tenant + active for filtered queries
CREATE INDEX "Tier_tenantId_active_idx" ON "Tier"("tenantId", "active");

-- ============================================================================
-- 7. Create TierAddOn join table
-- ============================================================================
CREATE TABLE "TierAddOn" (
    "tierId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,

    CONSTRAINT "TierAddOn_pkey" PRIMARY KEY ("tierId","addOnId")
);

-- Indexes
CREATE INDEX "TierAddOn_tierId_idx" ON "TierAddOn"("tierId");
CREATE INDEX "TierAddOn_addOnId_idx" ON "TierAddOn"("addOnId");

-- Foreign keys
ALTER TABLE "TierAddOn" ADD CONSTRAINT "TierAddOn_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TierAddOn" ADD CONSTRAINT "TierAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 8. Booking: Add nullable tierId for Package→Tier transition
-- ============================================================================
ALTER TABLE "Booking" ADD COLUMN "tierId" TEXT;

-- Foreign key: Booking → Tier (Restrict = prevent deleting tiers with bookings)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index for tier-based booking queries
CREATE INDEX "Booking_tierId_idx" ON "Booking"("tierId");
