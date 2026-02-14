-- ============================================
-- Phase 1: Package → Tier Data Backfill
--
-- This migration creates Tiers for Packages that have bookings but no
-- corresponding Tier, copies PackageAddOn links to TierAddOn, and
-- backfills Booking.tierId from packageId.
--
-- IMPORTANT: Does NOT drop Package model or packageId column.
-- That happens in Phase 5 after all code references are removed.
-- ============================================

-- ============================================
-- STEP 1: Create Tiers for orphan Packages
-- (Packages that have bookings but no corresponding Tier by slug)
-- ============================================

INSERT INTO "Tier" ("id", "tenantId", "segmentId", "sortOrder", "slug", "name", "description", "priceCents", "currency", "features", "bookingType", "active", "photos", "createdAt", "updatedAt")
SELECT
  'tier_migrated_' || p.id,
  p."tenantId",
  COALESCE(p."segmentId", (
    -- If Package has no segment, use the tenant's first segment
    SELECT s.id FROM "Segment" s WHERE s."tenantId" = p."tenantId" ORDER BY s."createdAt" ASC LIMIT 1
  )),
  COALESCE(p."groupingOrder", 1),
  p.slug,
  p.name,
  p.description,
  p."basePrice", -- Package.basePrice maps to Tier.priceCents (both in cents)
  'USD',
  '[]'::jsonb, -- Empty features array
  p."bookingType",
  p.active,
  p.photos,
  p."createdAt",
  NOW()
FROM "Package" p
LEFT JOIN "Tier" t ON t."tenantId" = p."tenantId" AND t.slug = p.slug
WHERE t.id IS NULL
-- Only create for Packages that have bookings (others can be dropped later)
AND EXISTS (SELECT 1 FROM "Booking" b WHERE b."packageId" = p.id);

-- ============================================
-- STEP 2: Copy PackageAddOn → TierAddOn for migrated Tiers
-- ============================================

INSERT INTO "TierAddOn" ("tierId", "addOnId")
SELECT t.id, pa."addOnId"
FROM "PackageAddOn" pa
JOIN "Package" p ON p.id = pa."packageId"
JOIN "Tier" t ON t."tenantId" = p."tenantId" AND t.slug = p.slug
LEFT JOIN "TierAddOn" ta ON ta."tierId" = t.id AND ta."addOnId" = pa."addOnId"
WHERE ta."tierId" IS NULL;

-- ============================================
-- STEP 3: Backfill Booking.tierId from packageId
-- ============================================

UPDATE "Booking" b
SET "tierId" = t.id
FROM "Package" p
JOIN "Tier" t ON t."tenantId" = p."tenantId" AND t.slug = p.slug
WHERE b."packageId" = p.id
AND b."tierId" IS NULL;

-- ============================================
-- STEP 4: Verify no orphan bookings remain
-- ============================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "Booking"
  WHERE "packageId" IS NOT NULL AND "tierId" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % bookings still have packageId without tierId', orphan_count;
  END IF;
END $$;
