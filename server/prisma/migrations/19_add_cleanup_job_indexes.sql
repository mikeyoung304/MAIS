-- Migration: Add indexes for cleanup job queries
-- P1 fix: Ensure cleanup jobs have efficient index support
-- Date: 2025-12-29

-- Index for cleanup job: DELETE FROM AgentSession WHERE sessionType = 'CUSTOMER' AND updatedAt < cutoff
-- Without this, query would scan all sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AgentSession_sessionType_updatedAt_idx"
ON "AgentSession"("sessionType", "updatedAt");

-- Index for cleanup job: DELETE FROM AgentProposal WHERE status IN ('EXPIRED', 'REJECTED') AND expiresAt < cutoff
-- The existing @@index([expiresAt]) is insufficient for compound filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AgentProposal_status_expiresAt_idx"
ON "AgentProposal"("status", "expiresAt");
