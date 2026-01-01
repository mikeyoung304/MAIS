-- Migration 21: Add composite index on AgentSession for getOrCreateSession queries
-- Issue: #530 - Missing Composite Index on AgentSession
-- The getOrCreateSession method queries with (tenantId, sessionType, updatedAt)
-- but no composite index covers all three fields.

-- Add composite index (idempotent)
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt");
