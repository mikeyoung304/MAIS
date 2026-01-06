/**
 * Global Singleton PrismaClient for Integration Tests
 *
 * CRITICAL: All integration tests MUST use this singleton to prevent
 * connection pool exhaustion with Supabase pgbouncer.
 *
 * Supabase Session/Transaction pooler has limited connections (~60).
 * Creating a new PrismaClient per test file would exhaust the pool.
 *
 * Usage:
 * ```typescript
 * import { getTestPrisma, disconnectTestPrisma } from '../helpers/global-prisma';
 *
 * const prisma = getTestPrisma();
 * // Use prisma for all operations
 *
 * // In afterAll() of your test file:
 * // Do NOT disconnect - the singleton manages its own lifecycle
 * ```
 */

// Ensure .env is loaded for test files (vitest config env doesn't apply to imports)
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from server directory (handles running from any cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton instance
let globalPrisma: PrismaClient | null = null;
let connectionCount = 0;

/**
 * Get the global PrismaClient singleton for tests
 *
 * Uses aggressive connection limits and timeouts to prevent pool exhaustion:
 * - connection_limit=3: Keep connections minimal
 * - pool_timeout=5: Fail fast if no connection available
 * - connect_timeout=5: Don't wait forever to connect
 */
export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
    }

    // Strip existing connection params and add our own
    const urlBase = baseUrl.split('?')[0];
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    // Prisma 7: Use driver adapter for PostgreSQL connections
    const adapter = new PrismaPg({ connectionString: urlWithPool });
    globalPrisma = new PrismaClient({
      adapter,
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    // Register cleanup on process exit
    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
    });
  }

  connectionCount++;
  return globalPrisma;
}

/**
 * Disconnect the global PrismaClient
 *
 * Call this in global teardown or when explicitly needed.
 * Individual test files should NOT call this.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    try {
      await globalPrisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors during shutdown
      console.error('Error disconnecting test Prisma:', err);
    }
    globalPrisma = null;
    connectionCount = 0;
  }
}

/**
 * Get current connection count (for debugging)
 */
export function getConnectionCount(): number {
  return connectionCount;
}
