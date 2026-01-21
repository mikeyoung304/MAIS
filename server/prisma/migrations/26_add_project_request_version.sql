-- Add version column to ProjectRequest for optimistic locking
-- Idempotent: Uses IF NOT EXISTS pattern

DO $$ BEGIN
    ALTER TABLE "ProjectRequest" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
