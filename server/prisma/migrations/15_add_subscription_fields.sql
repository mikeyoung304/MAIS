-- Migration: Add subscription fields to Tenant
-- Purpose: Fix schema drift - subscriptionStatus, trialEndsAt, stripeCustomerId
-- Pattern: Manual SQL (Pattern B) - required for enum creation
-- Idempotent: Yes - safe to run multiple times

-- Step 1: Create SubscriptionStatus enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'EXPIRED');
  END IF;
END$$;

-- Step 2: Add subscription fields to Tenant table
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Step 3: Add unique constraint on stripeCustomerId (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Tenant_stripeCustomerId_key'
  ) THEN
    CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
  END IF;
END$$;
