-- Migration: add_customer_chat_support
-- Adds support for customer-facing AI chatbot with session types and customer ownership

-- 1. Create SessionType enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionType') THEN
        CREATE TYPE "SessionType" AS ENUM ('ADMIN', 'CUSTOMER');
    END IF;
END
$$;

-- 2. Add sessionType column to AgentSession (defaults to ADMIN for existing sessions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AgentSession' AND column_name = 'sessionType'
    ) THEN
        ALTER TABLE "AgentSession" ADD COLUMN "sessionType" "SessionType" NOT NULL DEFAULT 'ADMIN';
    END IF;
END
$$;

-- 3. Add customerId column to AgentSession (nullable - null for admin sessions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AgentSession' AND column_name = 'customerId'
    ) THEN
        ALTER TABLE "AgentSession" ADD COLUMN "customerId" TEXT;
    END IF;
END
$$;

-- 4. Add foreign key for AgentSession.customerId -> Customer.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AgentSession_customerId_fkey'
    ) THEN
        ALTER TABLE "AgentSession"
        ADD CONSTRAINT "AgentSession_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
    END IF;
END
$$;

-- 5. Add index for customer session queries
CREATE INDEX IF NOT EXISTS "AgentSession_customerId_updatedAt_idx"
ON "AgentSession"("customerId", "updatedAt");

-- 6. Add customerId column to AgentProposal (CRITICAL: for ownership verification)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AgentProposal' AND column_name = 'customerId'
    ) THEN
        ALTER TABLE "AgentProposal" ADD COLUMN "customerId" TEXT;
    END IF;
END
$$;

-- 7. Add foreign key for AgentProposal.customerId -> Customer.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AgentProposal_customerId_fkey'
    ) THEN
        ALTER TABLE "AgentProposal"
        ADD CONSTRAINT "AgentProposal_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
    END IF;
END
$$;

-- 8. Add index for proposal customer queries
CREATE INDEX IF NOT EXISTS "AgentProposal_customerId_idx"
ON "AgentProposal"("customerId");

-- 9. Add chatEnabled field to Tenant (defaults to true)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Tenant' AND column_name = 'chatEnabled'
    ) THEN
        ALTER TABLE "Tenant" ADD COLUMN "chatEnabled" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END
$$;

-- Done: Customer chat support schema changes applied
