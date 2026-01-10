#!/usr/bin/env tsx

/**
 * CLI tool for deleting test users from the admin dashboard
 *
 * Usage:
 *   npm run delete-test-users [--dry-run] [--pattern=<pattern>]
 *
 * Options:
 *   --dry-run     Show what would be deleted without actually deleting
 *   --pattern     Custom email pattern to match (default: test users)
 *   --confirm     Skip confirmation prompt (DANGEROUS)
 *
 * Examples:
 *   npm run delete-test-users --dry-run
 *   npm run delete-test-users --pattern=demo
 *   npm run delete-test-users --confirm
 *
 * Default patterns matched:
 *   - Emails containing "test" (test@, @test., testing@, etc.)
 *   - Emails containing "demo"
 *   - Emails containing "fake"
 *   - Users linked to test tenants (isTestTenant=true)
 */

// Load environment variables before any other imports
import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma';
import * as readline from 'readline';

// Prisma 7: Use centralized factory with driver adapter
const prisma = createPrismaClient();

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  dryRun: boolean;
  pattern?: string;
  confirm: boolean;
} {
  const result = {
    dryRun: args.includes('--dry-run'),
    confirm: args.includes('--confirm'),
    pattern: undefined as string | undefined,
  };

  for (const arg of args) {
    if (arg.startsWith('--pattern=')) {
      result.pattern = arg.split('=')[1];
    }
  }

  return result;
}

/**
 * Ask user for confirmation
 */
function askConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Get test users based on patterns
 */
async function getTestUsers(customPattern?: string) {
  const where = customPattern
    ? {
        email: {
          contains: customPattern,
          mode: 'insensitive' as const,
        },
      }
    : {
        OR: [
          {
            email: {
              contains: 'test',
              mode: 'insensitive' as const,
            },
          },
          {
            email: {
              contains: 'demo',
              mode: 'insensitive' as const,
            },
          },
          {
            email: {
              contains: 'fake',
              mode: 'insensitive' as const,
            },
          },
          {
            tenant: {
              isTestTenant: true,
            },
          },
        ],
      };

  return await prisma.user.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          isTestTenant: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🧹 Test User Cleanup Tool\n');

  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run delete-test-users [--dry-run] [--pattern=<pattern>] [--confirm]

Options:
  --dry-run     Show what would be deleted without actually deleting
  --pattern     Custom email pattern to match (default: test/demo/fake)
  --confirm     Skip confirmation prompt (DANGEROUS)

Examples:
  npm run delete-test-users --dry-run
  npm run delete-test-users --pattern=staging
  npm run delete-test-users --confirm

Default patterns matched:
  - Emails containing "test" (test@example.com, user@test.com, etc.)
  - Emails containing "demo"
  - Emails containing "fake"
  - Users linked to test tenants (isTestTenant=true)
`);
    process.exit(0);
  }

  const { dryRun, pattern, confirm } = parseArgs(args);

  try {
    console.log('🔍 Searching for test users...\n');

    const testUsers = await getTestUsers(pattern);

    if (testUsers.length === 0) {
      console.log('✅ No test users found!');
      console.log(
        pattern
          ? `   Pattern: "${pattern}"`
          : '   Patterns: test, demo, fake, or linked to test tenants'
      );
      process.exit(0);
    }

    console.log(`Found ${testUsers.length} test user(s):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    testUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Email:    ${user.email}`);
      console.log(`   Name:     ${user.name || '(no name)'}`);
      console.log(`   Role:     ${user.role}`);
      if (user.tenant) {
        console.log(`   Tenant:   ${user.tenant.name} (${user.tenant.slug})`);
        console.log(`   Test:     ${user.tenant.isTestTenant ? 'YES' : 'NO'}`);
      }
      console.log(`   Created:  ${user.createdAt.toISOString()}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log(`   Would delete ${testUsers.length} user(s) listed above\n`);
      process.exit(0);
    }

    // Ask for confirmation unless --confirm flag is present
    if (!confirm) {
      const confirmed = await askConfirmation(
        `⚠️  Are you sure you want to DELETE ${testUsers.length} user(s)?`
      );

      if (!confirmed) {
        console.log('\n❌ Deletion cancelled by user\n');
        process.exit(0);
      }
    }

    console.log('\n🗑️  Deleting test users...\n');

    // Delete users one by one to handle potential foreign key constraints
    let deletedCount = 0;
    const errors: Array<{ user: (typeof testUsers)[0]; error: string }> = [];

    for (const user of testUsers) {
      try {
        await prisma.user.delete({
          where: { id: user.id },
        });
        console.log(`✅ Deleted: ${user.email}`);
        deletedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Failed to delete ${user.email}: ${errorMessage}`);
        errors.push({ user, error: errorMessage });
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DELETION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Successfully deleted: ${deletedCount} user(s)`);

    if (errors.length > 0) {
      console.log(`❌ Failed to delete:     ${errors.length} user(s)\n`);
      console.log('Failed deletions:');
      errors.forEach(({ user, error }) => {
        console.log(`  - ${user.email}: ${error}`);
      });
      console.log('\n💡 Tip: Users with related data may require cascade deletion.');
      console.log('   Check foreign key constraints in the schema.prisma file.\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:\n');

    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

// Run main function
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
