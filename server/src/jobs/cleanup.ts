/**
 * Cleanup Jobs
 *
 * Background jobs for cleaning up expired data and recovering stuck proposals:
 * - Customer chat sessions (older than 24 hours)
 * - Expired proposals (older than 7 days)
 * - Orphaned CONFIRMED proposals (stuck due to server crash)
 *
 * These jobs should be run periodically (e.g., daily via cron)
 * to prevent database bloat and recover from crashes.
 */

import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { getProposalExecutor } from '../agent/proposals/executor-registry';

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
 * Recover orphaned CONFIRMED proposals
 *
 * If the server crashes after a proposal is marked CONFIRMED but before
 * execution completes, the proposal will be stuck forever. This function
 * finds such orphaned proposals and either retries execution or marks them
 * as FAILED.
 *
 * Orphan detection criteria:
 * - Status is CONFIRMED (not yet executed)
 * - updatedAt is older than 5 minutes (gives time for normal execution)
 *
 * @param prisma - Prisma client for database operations
 * @returns Object with counts of recovered and failed proposals
 */
export async function recoverOrphanedProposals(
  prisma: PrismaClient
): Promise<{ retried: number; failed: number }> {
  const orphanCutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  // Find CONFIRMED proposals that are older than 5 minutes
  // These are likely stuck due to server crash or timeout
  const orphaned = await prisma.agentProposal.findMany({
    where: {
      status: 'CONFIRMED',
      updatedAt: { lt: orphanCutoff },
    },
  });

  if (orphaned.length === 0) {
    return { retried: 0, failed: 0 };
  }

  logger.warn(
    { count: orphaned.length },
    'Found orphaned CONFIRMED proposals - attempting recovery'
  );

  let retried = 0;
  let failed = 0;

  for (const proposal of orphaned) {
    const { id: proposalId, toolName, tenantId, payload } = proposal;

    try {
      const executor = getProposalExecutor(toolName);

      if (!executor) {
        // No executor registered for this tool - mark as failed
        logger.error(
          { proposalId, toolName },
          'Orphaned proposal recovery failed: no executor registered'
        );

        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'FAILED',
            error: `Orphaned - no executor registered for tool "${toolName}"`,
          },
        });

        failed++;
        continue;
      }

      // Attempt to execute the proposal
      logger.info(
        { proposalId, toolName, tenantId },
        'Recovering orphaned proposal - attempting execution'
      );

      const payloadObj = (payload as Record<string, unknown>) || {};
      const result = await executor(tenantId, payloadObj);

      // Mark as executed
      await prisma.agentProposal.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
          result: result as any,
        },
      });

      logger.info({ proposalId, toolName, tenantId }, 'Orphaned proposal recovered successfully');

      retried++;
    } catch (error) {
      // Execution failed - mark as failed
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        { proposalId, toolName, tenantId, error: errorMessage },
        'Orphaned proposal recovery execution failed'
      );

      await prisma.agentProposal.update({
        where: { id: proposalId },
        data: {
          status: 'FAILED',
          error: `Orphaned recovery failed: ${errorMessage}`,
        },
      });

      failed++;
    }
  }

  logger.info({ total: orphaned.length, retried, failed }, 'Orphaned proposal recovery completed');

  return { retried, failed };
}

/**
 * Run all cleanup jobs
 *
 * Convenience function to run all cleanup jobs in sequence.
 *
 * @param prisma - Prisma client for database operations
 * @returns Object with counts of deleted and recovered items
 */
export async function runAllCleanupJobs(prisma: PrismaClient): Promise<{
  sessions: number;
  proposals: number;
  orphansRecovered: { retried: number; failed: number };
}> {
  logger.info('Starting cleanup jobs');

  const sessions = await cleanupExpiredSessions(prisma);
  const proposals = await cleanupExpiredProposals(prisma);
  const orphansRecovered = await recoverOrphanedProposals(prisma);

  logger.info({ sessions, proposals, orphansRecovered }, 'Cleanup jobs completed');

  return { sessions, proposals, orphansRecovered };
}

/**
 * Recover orphaned proposals on server startup
 *
 * This should be called AFTER executor registration but BEFORE the server
 * starts accepting traffic. It ensures any proposals stuck from a previous
 * crash are recovered immediately.
 *
 * @param prisma - Prisma client for database operations
 * @returns Object with counts of recovered and failed proposals
 */
export async function recoverOrphanedProposalsOnStartup(
  prisma: PrismaClient
): Promise<{ retried: number; failed: number }> {
  logger.info('Running startup orphan recovery check');

  try {
    const result = await recoverOrphanedProposals(prisma);

    if (result.retried > 0 || result.failed > 0) {
      logger.info(
        { retried: result.retried, failed: result.failed },
        'Startup orphan recovery completed'
      );
    } else {
      logger.info('No orphaned proposals found during startup');
    }

    return result;
  } catch (error) {
    // Log but don't throw - we don't want orphan recovery failure to prevent startup
    logger.error({ error }, 'Startup orphan recovery failed (non-fatal)');
    return { retried: 0, failed: 0 };
  }
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
