/**
 * Cleanup Jobs
 *
 * Background jobs for cleaning up expired data:
 * - Conversation traces (older than retention period)
 * - Chat sessions (older than 30 days)
 * - Expired proposals (older than 7 days)
 * - Orphaned feedback records
 *
 * These jobs should be run periodically (e.g., daily via cron)
 * to prevent database bloat.
 *
 * @see plans/LEGACY_AGENT_MIGRATION_PLAN.md - removed proposal recovery
 */

import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';

/**
 * Clean up expired conversation traces (P1-584)
 *
 * Traces have a 90-day retention period via expiresAt column.
 * This function deletes traces that have passed their expiration date.
 *
 * Per DHH review: Use CLI command triggered by external cron, not in-process scheduler.
 * Example cron: `0 3 * * * cd /app && npx tsx scripts/cleanup-traces.ts`
 *
 * @param prisma - Prisma client for database operations
 * @returns Number of traces deleted
 */
export async function cleanupExpiredTraces(prisma: PrismaClient): Promise<number> {
  const now = new Date();

  const result = await prisma.conversationTrace.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  logger.info(
    { deletedCount: result.count, cutoff: now },
    'Cleaned up expired conversation traces'
  );
  return result.count;
}

/**
 * ADMIN ONLY: Cleanup expired sessions across ALL tenants.
 *
 * This is intentionally not tenant-scoped as it's a system maintenance operation.
 * SECURITY: Never expose through user-facing API endpoints. Should only be
 * invoked by scheduled cron jobs or admin CLI tools.
 *
 * Uses two-phase cleanup for data safety:
 * 1. Soft delete sessions inactive > maxAgeDays (default 30 days)
 * 2. Hard delete sessions soft-deleted > 7 days ago
 *
 * @param prisma - Prisma client for database operations
 * @param maxAgeDays - Maximum session age in days before soft delete (default: 30)
 * @returns Number of sessions hard-deleted
 */
export async function cleanupExpiredSessions(
  prisma: PrismaClient,
  maxAgeDays: number = 30
): Promise<number> {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - maxAgeMs);

  // Phase 1: Soft delete sessions inactive > maxAgeMs
  const softDeleted = await prisma.agentSession.updateMany({
    where: {
      lastActivityAt: { lt: cutoff },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  if (softDeleted.count > 0) {
    logger.info(
      { softDeletedCount: softDeleted.count, cutoff, maxAgeDays },
      'Soft-deleted expired sessions'
    );
  }

  // Phase 2: Hard delete sessions that were soft-deleted > 7 days ago
  const hardDeleteCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hardDeleted = await prisma.agentSession.deleteMany({
    where: {
      deletedAt: { lt: hardDeleteCutoff },
    },
  });

  if (hardDeleted.count > 0) {
    logger.info(
      { hardDeletedCount: hardDeleted.count, hardDeleteCutoff },
      'Hard-deleted expired sessions after retention period'
    );
  }

  return hardDeleted.count;
}

/**
 * Clean up orphaned user feedback records
 *
 * Feedback without associated traces (traceId = null) older than 30 days
 * can be safely deleted. These occur when traces are deleted but feedback
 * records remain due to ON DELETE SET NULL constraint.
 *
 * @param prisma - Prisma client for database operations
 * @returns Number of feedback records deleted
 */
export async function cleanupOrphanedFeedback(prisma: PrismaClient): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.userFeedback.deleteMany({
    where: {
      traceId: null,
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  logger.info({ deletedCount: result.count }, 'Cleaned up orphaned feedback');
  return result.count;
}

/**
 * Clean up expired and rejected proposals (legacy)
 *
 * Note: Proposals are a legacy feature from the old agent architecture.
 * The new Booking Agent creates bookings directly via Stripe checkout.
 * This cleanup function remains to clear out historical data.
 *
 * @param prisma - Prisma client for database operations
 * @returns Number of proposals deleted
 */
export async function cleanupExpiredProposals(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const result = await prisma.agentProposal.deleteMany({
    where: {
      status: { in: ['EXPIRED', 'REJECTED', 'FAILED'] },
      expiresAt: { lt: cutoff },
    },
  });

  logger.info({ deletedCount: result.count, cutoff }, 'Cleaned up expired proposals');
  return result.count;
}

/**
 * Run all cleanup jobs
 *
 * Convenience function to run all cleanup jobs in sequence.
 *
 * @param prisma - Prisma client for database operations
 * @returns Object with counts of deleted items
 */
export async function runAllCleanupJobs(prisma: PrismaClient): Promise<{
  traces: number;
  sessions: number;
  proposals: number;
  feedback: number;
}> {
  logger.info('Starting cleanup jobs');

  const traces = await cleanupExpiredTraces(prisma);
  const sessions = await cleanupExpiredSessions(prisma);
  const proposals = await cleanupExpiredProposals(prisma);
  const feedback = await cleanupOrphanedFeedback(prisma);

  logger.info({ traces, sessions, proposals, feedback }, 'Cleanup jobs completed');

  return { traces, sessions, proposals, feedback };
}

/**
 * Start a cleanup scheduler using setInterval
 *
 * For production use, consider using a proper job scheduler like node-cron
 * or BullMQ's repeat feature instead.
 *
 * @param prisma - Prisma client for database operations
 * @param intervalMs - Interval between cleanup runs (default: 24 hours)
 * @returns Function to stop the scheduler
 */
export function startCleanupScheduler(
  prisma: PrismaClient,
  intervalMs: number = 24 * 60 * 60 * 1000 // Default: run daily
): () => void {
  logger.info({ intervalMs }, 'Starting cleanup scheduler');

  // Run immediately on startup
  runAllCleanupJobs(prisma).catch((error) => {
    logger.error({ error }, 'Initial cleanup job failed');
  });

  // Schedule periodic runs
  const intervalId = setInterval(() => {
    runAllCleanupJobs(prisma).catch((error) => {
      logger.error({ error }, 'Scheduled cleanup job failed');
    });
  }, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    logger.info('Cleanup scheduler stopped');
  };
}
