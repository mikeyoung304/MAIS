-- Migration: Canonical Tier Names
-- Purpose: Standardize all package grouping values to tier_1/tier_2/tier_3
-- This enables consistent URL routing and simplifies frontend logic
--
-- Naming convention mapping:
--   tier_1 = Essential/Good/Budget tier (lowest price)
--   tier_2 = Popular/Better/Middle tier (recommended)
--   tier_3 = Premium/Best/Luxury tier (highest price)

-- Idempotent migration using DO $$ block
DO $$
BEGIN
  -- Budget tier aliases → tier_1
  UPDATE "Package" SET grouping = 'tier_1'
  WHERE LOWER(TRIM(grouping)) IN ('budget', 'good', 'essential', 'basic', 'starter')
    AND grouping != 'tier_1';

  -- Middle tier aliases → tier_2
  UPDATE "Package" SET grouping = 'tier_2'
  WHERE LOWER(TRIM(grouping)) IN ('middle', 'better', 'popular', 'standard', 'recommended')
    AND grouping != 'tier_2';

  -- Luxury tier aliases → tier_3
  UPDATE "Package" SET grouping = 'tier_3'
  WHERE LOWER(TRIM(grouping)) IN ('luxury', 'best', 'premium', 'deluxe', 'ultimate')
    AND grouping != 'tier_3';
END $$;

-- Report any unmapped grouping values (for debugging)
-- SELECT DISTINCT grouping, COUNT(*) as count
-- FROM "Package"
-- WHERE grouping IS NOT NULL
--   AND grouping NOT IN ('tier_1', 'tier_2', 'tier_3')
-- GROUP BY grouping;
