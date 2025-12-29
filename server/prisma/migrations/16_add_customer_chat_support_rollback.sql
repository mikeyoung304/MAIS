-- Rollback: 16_add_customer_chat_support
-- CAUTION: Run this only if you need to undo the customer chat support migration
-- Note: SessionType enum cannot be easily dropped if still referenced in data

-- Drop indexes first
DROP INDEX IF EXISTS "AgentSession_customerId_updatedAt_idx";
DROP INDEX IF EXISTS "AgentProposal_customerId_idx";

-- Remove columns from AgentSession
ALTER TABLE "AgentSession" DROP COLUMN IF EXISTS "sessionType";
ALTER TABLE "AgentSession" DROP COLUMN IF EXISTS "customerId";

-- Remove columns from AgentProposal
ALTER TABLE "AgentProposal" DROP COLUMN IF EXISTS "customerId";

-- Remove column from Tenant
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "chatEnabled";

-- Note: Cannot drop SessionType enum if any data references it
-- To fully remove, ensure no data uses the enum first:
-- DELETE FROM "AgentSession" WHERE "sessionType" IS NOT NULL;
-- Then run: DROP TYPE IF EXISTS "SessionType";
