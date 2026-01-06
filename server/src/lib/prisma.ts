/**
 * Prisma Client Factory
 *
 * Creates a PrismaClient instance with the Prisma 7 driver adapter pattern.
 * Used by seed scripts and other standalone processes that need database access.
 *
 * For the main application, use the DI container in di.ts instead.
 */

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Creates a new PrismaClient instance with PostgreSQL driver adapter
 *
 * @param connectionString - Optional custom connection string. Defaults to DATABASE_URL env var.
 * @returns Configured PrismaClient instance
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const databaseUrl = connectionString || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'], // Quiet logs for seeding
  });
}
