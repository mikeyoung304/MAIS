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
import type { PrismaClient } from '@generated/prisma';
import { logger } from './core/logger';

export interface ShutdownManager {
  server: Server;
  prisma?: PrismaClient;
  cleanup?: () => Promise<void>; // DI container cleanup method
  onShutdown?: () => Promise<void> | void;
  timeoutMs?: number; // Shutdown timeout in milliseconds (default: 30000)
}

/**
 * Registers graceful shutdown handlers for SIGTERM and SIGINT signals
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
  const { server, prisma, cleanup, onShutdown, timeoutMs = 30000 } = manager;

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, forcing exit`);
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info(`${signal} signal received: starting graceful shutdown (timeout: ${timeoutMs}ms)`);

    // Set shutdown timeout (configurable, default 30 seconds)
    const shutdownTimeout = setTimeout(() => {
      logger.error(`Graceful shutdown timeout exceeded (${timeoutMs}ms), forcing exit`);
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

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception, exiting');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection, exiting');
    process.exit(1);
  });
}
