-- Migration: Add tierDisplayNames to Tenant
-- Purpose: Allow tenants to customize tier display names in their storefront
--
-- Structure: {"tier_1": "Custom Name 1", "tier_2": "Custom Name 2", "tier_3": "Custom Name 3"}
-- Default display names (Essential/Popular/Premium) are used if not specified

-- Add tierDisplayNames column
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tierDisplayNames" JSONB DEFAULT '{}';

-- Backfill Little Bit Horse Farm with their package names as tier display names
UPDATE "Tenant"
SET "tierDisplayNames" = '{
  "tier_1": "The Grounding Reset",
  "tier_2": "The Team Recharge",
  "tier_3": "The Executive Reset"
}'::jsonb
WHERE slug = 'little-bit-farm';
