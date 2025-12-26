/**
 * Vitest Global Teardown
 *
 * Runs once after ALL test files have completed.
 * Disconnects the singleton PrismaClient to release database connections.
 */

import { disconnectTestPrisma } from './global-prisma';

export default async function globalTeardown() {
  console.log('[vitest] Global teardown: disconnecting Prisma...');
  await disconnectTestPrisma();
  console.log('[vitest] Global teardown complete');
}
