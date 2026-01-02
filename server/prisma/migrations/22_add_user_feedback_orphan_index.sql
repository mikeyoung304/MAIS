-- 22_add_user_feedback_orphan_index.sql
-- Migration: Add composite index for orphan feedback cleanup
--
-- The cleanupOrphanedFeedback query filters on traceId = NULL AND createdAt < date.
-- This composite index allows efficient index-only scans for the cleanup job.
--
-- @see todos/610-pending-p2-cleanup-missing-index-orphan-feedback.md
-- @see server/src/jobs/cleanup.ts::cleanupOrphanedFeedback()

-- Create composite index for orphan feedback cleanup query (idempotent)
CREATE INDEX IF NOT EXISTS "UserFeedback_traceId_createdAt_idx"
ON "UserFeedback" ("traceId", "createdAt");
