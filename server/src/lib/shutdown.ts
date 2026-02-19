/**
 * Graceful Shutdown Handler
 *
 * Handles SIGTERM/SIGINT signals and ensures clean shutdown:
 * 1. Stop accepting new connections
 * 2. Wait for existing requests to complete (with timeout)
 * 3. Close database connections
 * 4. Run custom cleanup tasks
 * 5. Exit process
 */

import type { Server } from 'http';
import type { PrismaClient } from '../generated/prisma/client';
import { logger } from './core/logger';
import { getConfig } from './core/config';
import { captureException, flushSentry } from './errors/sentry';

export interface ShutdownManager {
  server: Server;
  prisma?: PrismaClient;
  cleanup?: () => Promise<void>; // DI container cleanup method
  onShutdown?: () => Promise<void> | void;
  timeoutMs?: number; // Shutdown timeout in milliseconds (default: 60000, configurable via GRACEFUL_SHUTDOWN_TIMEOUT_MS)
}

/**
 * Registers graceful shutdown handlers for SIGTERM and SIGINT signals
 *
 * Timeout is configurable via:
 * 1. GRACEFUL_SHUTDOWN_TIMEOUT_MS environment variable (recommended)
 * 2. timeoutMs parameter in ShutdownManager
 * 3. Default: 60000ms (60 seconds)
 *
 * Longer timeouts are recommended for:
 * - Long-running requests (file uploads, report generation)
 * - Slow database connections
 * - Multiple microservices needing coordination
 *
 * @example
 * ```typescript
 * const server = app.listen(3001);
 * registerGracefulShutdown({
 *   server,
 *   cleanup: container.cleanup, // Use DI container cleanup (recommended)
 *   onShutdown: async () => {
 *     // Custom cleanup
 *   },
 * });
 * ```
 */
export function registerGracefulShutdown(manager: ShutdownManager): void {
  // Priority: 1. Explicit parameter, 2. Config (env var), 3. Default 60s
  const defaultTimeout = getConfig().GRACEFUL_SHUTDOWN_TIMEOUT_MS ?? 60000;
  const { server, prisma, cleanup, onShutdown, timeoutMs = defaultTimeout } = manager;

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, forcing exit`);
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info(`${signal} signal received: starting graceful shutdown (timeout: ${timeoutMs}ms)`);

    // Set shutdown timeout (configurable via GRACEFUL_SHUTDOWN_TIMEOUT_MS, default 60 seconds)
    const shutdownTimeout = setTimeout(() => {
      logger.warn({ timeout: timeoutMs }, 'Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);

    try {
      // 1. Stop accepting new connections
      logger.info('Closing HTTP server (stop accepting new requests)');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error({ err }, 'Error closing HTTP server');
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });

      // 2. Run DI container cleanup (preferred - cleans up Prisma, cache, event emitter)
      if (cleanup) {
        logger.info('Running DI container cleanup');
        await cleanup();
        logger.info('DI container cleanup completed');
      } else if (prisma) {
        // Fallback: disconnect Prisma directly if no cleanup method
        logger.info('Disconnecting Prisma Client (fallback)');
        await prisma.$disconnect();
        logger.info('Prisma Client disconnected');
      }

      // 3. Run custom cleanup tasks
      if (onShutdown) {
        logger.info('Running custom cleanup tasks');
        await onShutdown();
        logger.info('Custom cleanup completed');
      }

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      logger.error({ error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  }

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors — capture to Sentry and flush before exit
  // so no events are lost when the process terminates abruptly.
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception, exiting');
    captureException(error, { fatal: true, source: 'uncaughtException' });
    void flushSentry(2000).finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection, exiting');
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureException(error, { fatal: true, source: 'unhandledRejection' });
    void flushSentry(2000).finally(() => process.exit(1));
  });
}
