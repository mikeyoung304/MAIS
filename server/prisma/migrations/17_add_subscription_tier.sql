-- Migration: Add subscription tier fields to Tenant
-- Purpose: Fix schema drift - tier, aiMessagesUsed, aiMessagesResetAt
-- Pattern: Manual SQL (Pattern B) - required for enum creation
-- Idempotent: Yes - safe to run multiple times

-- Step 1: Create SubscriptionTier enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionTier') THEN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
  END IF;
END$$;

-- Step 2: Add tier column to Tenant table (default FREE)
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';

-- Step 3: Add AI usage tracking columns
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "aiMessagesUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiMessagesResetAt" TIMESTAMP(3);

-- Verification: Confirm columns exist
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant' AND column_name = 'tier'
  ), 'tier column not created';
END$$;
