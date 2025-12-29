/**
 * Cleanup Jobs
 *
 * Background jobs for cleaning up expired data:
 * - Customer chat sessions (older than 24 hours)
 * - Expired proposals (older than 7 days)
 *
 * These jobs should be run periodically (e.g., daily via cron)
 * to prevent database bloat.
 */

import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

/**
 * Clean up expired customer chat sessions
 *
 * Customer sessions are typically short-lived and can be cleaned up
 * after 24 hours of inactivity.
 *
 * @param prisma - Prisma client for database operations
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const result = await prisma.agentSession.deleteMany({
    where: {
      sessionType: 'CUSTOMER',
      updatedAt: { lt: cutoff },
    },
  });

  logger.info({ deletedCount: result.count, cutoff }, 'Cleaned up expired customer sessions');
  return result.count;
}

/**
 * Clean up expired and rejected proposals
 *
 * Proposals that have expired or been rejected can be deleted after 7 days.
 * This keeps the proposal table lean while retaining recent data for debugging.
 *
 * @param prisma - Prisma client for database operations
 * @returns Number of proposals deleted
 */
export async function cleanupExpiredProposals(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const result = await prisma.agentProposal.deleteMany({
    where: {
      status: { in: ['EXPIRED', 'REJECTED'] },
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
export async function runAllCleanupJobs(
  prisma: PrismaClient
): Promise<{ sessions: number; proposals: number }> {
  logger.info('Starting cleanup jobs');

  const sessions = await cleanupExpiredSessions(prisma);
  const proposals = await cleanupExpiredProposals(prisma);

  logger.info({ sessions, proposals }, 'Cleanup jobs completed');

  return { sessions, proposals };
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
