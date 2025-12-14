/**
 * Playwright Global Teardown
 *
 * Cleans up test tenants created during E2E test runs.
 * Runs after all tests complete to prevent test data accumulation.
 *
 * Test tenants are identified by email patterns:
 * - *@example.com
 * - *@test.com
 * - e2e-* prefix in slug
 * - test-* prefix in slug
 */

import { PrismaClient } from '../server/src/generated/prisma';

async function globalTeardown() {
  console.log('\n🧹 E2E Global Teardown: Cleaning up test tenants...');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // Find and delete test tenants
    // ON DELETE CASCADE handles all related data automatically
    const result = await prisma.tenant.deleteMany({
      where: {
        OR: [
          { email: { endsWith: '@example.com' } },
          { email: { endsWith: '@test.com' } },
          { slug: { startsWith: 'e2e-' } },
          { slug: { startsWith: 'test-' } },
          { slug: { contains: '-test-' } },
          { name: { startsWith: 'E2E Test' } },
          { name: { startsWith: 'Test ' } },
        ],
      },
    });

    if (result.count > 0) {
      console.log(`✅ Deleted ${result.count} test tenant(s)`);
    } else {
      console.log('✅ No test tenants to clean up');
    }
  } catch (error) {
    console.error('⚠️ Error during E2E teardown:', error);
    // Don't fail the test run if cleanup fails
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
