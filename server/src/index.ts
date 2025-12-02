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
import { verifyDatabaseConnection, closeSupabaseConnections } from './config/database';

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate environment variables first (fail-fast)
    validateEnv();

    const config = loadConfig();
    logger.info('Configuration loaded');

    // Verify Supabase database connection (real mode only)
    if (config.ADAPTERS_PRESET === 'real') {
      await verifyDatabaseConnection();
    } else {
      logger.info('⏭️  Skipping database verification (mock mode)');
    }

    // Initialize Sentry error tracking (optional - gracefully degrades if no DSN)
    initSentry();

    // Build DI container (creates Prisma client in real mode)
    const container = buildContainer(config);

    // Create Express app with health checks
    const app = createApp(config, container, startTime);

    const server = app.listen(config.API_PORT, () => {
      logger.info(`🚀 API listening on :${config.API_PORT}`);
      logger.info(`📝 ADAPTERS_PRESET: ${config.ADAPTERS_PRESET}`);
      logger.info(`🔒 CORS_ORIGIN: ${config.CORS_ORIGIN}`);
      logger.info(`✅ Health checks: /health/live, /health/ready`);
    });

    // Set server timeouts
    server.keepAliveTimeout = 65000; // > ALB idle timeout (60s)
    server.headersTimeout = 66000; // > keepAliveTimeout

    // Register graceful shutdown handlers
    registerGracefulShutdown({
      server,
      cleanup: container.cleanup, // Use DI container cleanup (handles Prisma, cache, event emitter)
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
