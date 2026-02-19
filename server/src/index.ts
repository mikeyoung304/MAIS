/**
 * API server entry point
 */

import { loadConfig } from './lib/core/config';
import { logger } from './lib/core/logger';
import { initSentry } from './lib/errors/sentry';
import { createApp } from './app';
import { registerGracefulShutdown } from './lib/shutdown';
import { buildContainer } from './di';
import { validateEnv } from './config/env.schema';
import { closeSupabaseConnections } from './config/database';
import { initializeScheduler } from './scheduler';
import { initializeWebhookQueue } from './jobs/webhook-queue';
import { startCleanupScheduler } from './jobs/cleanup';
import type { PrismaClient } from './generated/prisma/client';

/**
 * Verify database connection using Prisma
 * Tests connection by running a simple query on the Tenant table
 */
async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🔍 Verifying database connection via Prisma...');

    // Simple query to verify connection - use raw query for fastest execution
    const result = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) as count FROM "Tenant" LIMIT 1`;
    const tenantCount = Number(result[0]?.count ?? 0);

    logger.info('✅ Database connection verified successfully');
    logger.info(`📊 Database contains ${tenantCount} tenant(s)`);
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error(
      {
        errorName: err.name,
        errorMessage: err.message,
        errorCode: err.code,
        errorStack: err.stack,
      },
      '❌ Database connection verification failed'
    );
    throw error;
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate environment variables first (fail-fast)
    validateEnv();

    const config = loadConfig();
    logger.info('Configuration loaded');

    // Initialize Sentry error tracking (optional - gracefully degrades if no DSN)
    initSentry();

    // Build DI container (creates Prisma client in real mode)
    const container = buildContainer(config);

    // Verify database connection using Prisma (real mode only)
    if (config.ADAPTERS_PRESET === 'real' && container.prisma) {
      await verifyDatabaseWithPrisma(container.prisma);
    } else {
      logger.info('⏭️  Skipping database verification (mock mode)');
    }

    // Create Express app with health checks
    const app = createApp(config, container, startTime);

    const server = app.listen(config.API_PORT, () => {
      logger.info(`🚀 API listening on :${config.API_PORT}`);
      logger.info(`📝 ADAPTERS_PRESET: ${config.ADAPTERS_PRESET}`);
      logger.info(`🔒 CORS_ORIGIN: ${config.CORS_ORIGIN}`);
      logger.info(`✅ Health checks: /health/live, /health/ready`);
    });

    // Initialize scheduled tasks (only in real mode with database)
    if (config.ADAPTERS_PRESET === 'real' && container.prisma) {
      const cronSchedule = config.REMINDER_CRON_SCHEDULE;
      initializeScheduler(container, cronSchedule);
      logger.info('⏰ Scheduled tasks initialized');

      // Start cleanup scheduler for expired customer chat sessions/proposals
      startCleanupScheduler(container.prisma);
      logger.info('🧹 Cleanup scheduler started');
    }

    // Initialize webhook queue for async processing (only in real mode)
    if (config.ADAPTERS_PRESET === 'real' && container.webhookQueue) {
      const processor = container.controllers.webhooks.getProcessor();
      await initializeWebhookQueue(container.webhookQueue, processor, config.REDIS_URL);

      if (container.webhookQueue.isAsyncAvailable()) {
        logger.info('📨 Webhook queue initialized (async mode)');
      } else {
        logger.info('📨 Webhook queue fallback (sync mode - Redis not available)');
      }
    }

    // Set server timeouts
    server.keepAliveTimeout = 65000; // > ALB idle timeout (60s)
    server.headersTimeout = 66000; // > keepAliveTimeout

    // Register graceful shutdown handlers
    registerGracefulShutdown({
      server,
      cleanup: container.cleanup, // Use DI container cleanup (handles Prisma, cache, event emitter)
      timeoutMs: config.SHUTDOWN_TIMEOUT_MS,
      onShutdown: async () => {
        // Custom cleanup: close Supabase connections, flush logs, etc.
        logger.info('Running custom shutdown tasks');
        await closeSupabaseConnections();
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
