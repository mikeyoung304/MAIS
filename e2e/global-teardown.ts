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

/**
 * Global teardown to clean up test tenants after E2E test runs.
 *
 * Note: Due to Prisma 7 ESM/CJS module conflicts, we dynamically import
 * PrismaClient and gracefully handle initialization failures.
 */

async function globalTeardown() {
  console.log('\n🧹 E2E Global Teardown: Cleaning up test tenants...');

  // Skip cleanup if no DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping cleanup');
    return;
  }

  let PrismaClient;
  try {
    // Dynamic import to avoid ESM/CJS conflicts
    const prismaModule = await import('@prisma/client');
    PrismaClient = prismaModule.PrismaClient;
  } catch (importError) {
    console.log('⚠️ Could not import Prisma client, skipping cleanup');
    console.log('   Run "npx prisma generate" if you need cleanup');
    return;
  }

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
