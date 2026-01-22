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

import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { getProposalExecutor } from '../agent/proposals/executor-registry';
import { validateExecutorPayload } from '../agent/proposals/executor-schemas';

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
 *
 * @see plans/agent-eval-remediation-plan.md Phase 4.1
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
 * This approach ensures:
 * - Session data can be recovered within 7 days of soft deletion
 * - Database doesn't grow unbounded
 * - Both ADMIN and CUSTOMER sessions are cleaned up across all tenants
 *
 * @param prisma - Prisma client for database operations
 * @param maxAgeDays - Maximum session age in days before soft delete (default: 30)
 * @returns Number of sessions hard-deleted
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 5
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
  // Limit to 100 per batch to avoid memory exhaustion after crashes
  const orphaned = await prisma.agentProposal.findMany({
    where: {
      status: 'CONFIRMED',
      updatedAt: { lt: orphanCutoff },
    },
    take: 100, // Process in batches to avoid memory exhaustion
    orderBy: { updatedAt: 'asc' }, // Oldest first for fairness
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
          where: { id: proposalId, tenantId },
          data: {
            status: 'FAILED',
            error: `Orphaned - no executor registered for tool "${toolName}"`,
          },
        });

        failed++;
        continue;
      }

      // Validate payload before execution to prevent runtime errors
      const payloadObj = (payload as Record<string, unknown>) || {};
      let validatedPayload: Record<string, unknown>;
      try {
        validatedPayload = validateExecutorPayload(toolName, payloadObj);
      } catch (validationError) {
        const validationMessage =
          validationError instanceof Error ? validationError.message : String(validationError);
        logger.error(
          { proposalId, toolName, error: validationMessage },
          'Orphaned proposal recovery failed: payload validation error'
        );

        await prisma.agentProposal.update({
          where: { id: proposalId, tenantId },
          data: {
            status: 'FAILED',
            error: `Orphaned - payload validation failed: ${validationMessage}`,
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

      const result = await executor(tenantId, validatedPayload);

      // Mark as executed
      await prisma.agentProposal.update({
        where: { id: proposalId, tenantId },
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
        where: { id: proposalId, tenantId },
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
  traces: number;
  sessions: number;
  proposals: number;
  feedback: number;
  orphansRecovered: { retried: number; failed: number };
}> {
  logger.info('Starting cleanup jobs');

  const traces = await cleanupExpiredTraces(prisma);
  const sessions = await cleanupExpiredSessions(prisma);
  const proposals = await cleanupExpiredProposals(prisma);
  const feedback = await cleanupOrphanedFeedback(prisma);
  const orphansRecovered = await recoverOrphanedProposals(prisma);

  logger.info(
    { traces, sessions, proposals, feedback, orphansRecovered },
    'Cleanup jobs completed'
  );

  return { traces, sessions, proposals, feedback, orphansRecovered };
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
