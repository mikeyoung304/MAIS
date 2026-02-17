/**
 * Vitest Global Setup
 *
 * Runs ONCE before ALL test files start.
 * Cleans up orphaned test tenants from previous interrupted test runs.
 *
 * This prevents test data accumulation that slows down:
 * - The reminder scheduler (processes all tenants)
 * - Test isolation (conflicting test data)
 * - Database performance (bloated tables)
 */

// Load .env before anything else - global setup runs before vitest config's env is applied
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from server directory (handles running from any cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { getTestPrisma, disconnectTestPrisma } from './global-prisma';

/**
 * Patterns that identify test-created tenants
 * These are safe to delete during global setup
 */
const TEST_TENANT_PATTERNS = [
  'hash-test-business-%',
  'test-business-%',
  'first-business-%',
  'no-match-test-%',
  '%-tenant-a',
  '%-tenant-b',
  'test-tenant-%',
  'pk_test_%', // API key patterns in slug
];

/**
 * Clean up orphaned test tenants
 */
async function cleanupOrphanedTestTenants(): Promise<number> {
  const prisma = getTestPrisma();

  try {
    // Build OR conditions for all patterns
    const whereConditions = TEST_TENANT_PATTERNS.map((pattern) => ({
      slug: { contains: pattern.replace(/%/g, '') },
    }));

    // First, find all matching tenants
    const testTenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { slug: { startsWith: 'hash-test-business-' } },
          { slug: { startsWith: 'test-business-' } },
          { slug: { startsWith: 'first-business-' } },
          { slug: { startsWith: 'no-match-test-' } },
          { slug: { endsWith: '-tenant-a' } },
          { slug: { endsWith: '-tenant-b' } },
          { slug: { startsWith: 'test-tenant-' } },
          { slug: { startsWith: 'auth-prevention-' } },
        ],
        // Never delete real tenants - extra safety check
        slug: {
          not: {
            in: ['mais', 'little-bit-farm', 'littlebit-farm', 'demo-business', 'demo'],
          },
        },
      },
      select: { id: true, slug: true },
    });

    if (testTenants.length === 0) {
      return 0;
    }

    const tenantIds = testTenants.map((t) => t.id);

    // Delete in correct order to respect foreign key constraints
    // 1. BookingAddOns (has Restrict on addOnId)
    await prisma.bookingAddOn.deleteMany({
      where: {
        booking: {
          tenantId: { in: tenantIds },
        },
      },
    });

    // 2. Delete tenants (cascades to bookings, packages, etc.)
    const result = await prisma.tenant.deleteMany({
      where: {
        id: { in: tenantIds },
      },
    });

    return result.count;
  } catch (error) {
    console.error('[vitest] Error during test tenant cleanup:', error);
    return 0;
  }
}

export default async function globalSetup(): Promise<void> {
  // Skip cleanup in CI or when DATABASE_URL is not set (mock mode)
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_TEST) {
    console.log('[vitest] Global setup: Skipping cleanup (no database URL)');
    return;
  }

  console.log('[vitest] Global setup: Cleaning orphaned test tenants...');
  const startTime = Date.now();

  try {
    const deletedCount = await cleanupOrphanedTestTenants();
    const duration = Date.now() - startTime;

    if (deletedCount > 0) {
      console.log(
        `[vitest] Global setup: Cleaned ${deletedCount} orphaned test tenants (${duration}ms)`
      );
    } else {
      console.log(`[vitest] Global setup: No orphaned test tenants found (${duration}ms)`);
    }
  } catch (error) {
    console.error('[vitest] Global setup error:', error);
    // Don't fail the test run - just log the error
  } finally {
    // Disconnect to release the connection for test files
    await disconnectTestPrisma();
  }
}
