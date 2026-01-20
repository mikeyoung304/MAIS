-- Migration: Add missing index for session lookup by tenantId, sessionType, updatedAt
-- This improves query performance for customer session lookups

-- Add composite index for session type queries
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
