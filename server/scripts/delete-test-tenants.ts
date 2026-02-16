#!/usr/bin/env tsx

/**
 * CLI tool for deleting test tenants from the admin dashboard
 *
 * Usage:
 *   npm run delete-test-tenants [options]
 *
 * Options:
 *   --dry-run           Show what would be deleted without actually deleting
 *   --marked-only       Only delete tenants with isTestTenant=true
 *   --empty-only        Only delete tenants with no bookings/customers
 *   --pattern=<pattern> Custom slug pattern to match
 *   --confirm           Skip confirmation prompt (DANGEROUS)
 *   --keep-slugs=<list> Comma-separated slugs to keep (e.g., "handled,plate")
 *
 * Examples:
 *   npm run delete-test-tenants --dry-run
 *   npm run delete-test-tenants --marked-only
 *   npm run delete-test-tenants --empty-only --dry-run
 *   npm run delete-test-tenants --pattern=test --confirm
 *   npm run delete-test-tenants --keep-slugs=handled,plate,little-bit-farm
 *
 * Safety: Tenants with bookings/customers require --force-with-data to delete
 */

// Load environment variables before any other imports
import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma';
import * as readline from 'readline';

const prisma = createPrismaClient();

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  dryRun: boolean;
  markedOnly: boolean;
  emptyOnly: boolean;
  pattern?: string;
  confirm: boolean;
  forceWithData: boolean;
  keepSlugs: string[];
} {
  const result = {
    dryRun: args.includes('--dry-run'),
    markedOnly: args.includes('--marked-only'),
    emptyOnly: args.includes('--empty-only'),
    confirm: args.includes('--confirm'),
    forceWithData: args.includes('--force-with-data'),
    pattern: undefined as string | undefined,
    keepSlugs: [] as string[],
  };

  for (const arg of args) {
    if (arg.startsWith('--pattern=')) {
      result.pattern = arg.split('=')[1];
    } else if (arg.startsWith('--keep-slugs=')) {
      result.keepSlugs = arg
        .split('=')[1]
        .split(',')
        .map((s) => s.trim());
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
 * Get test tenants based on filters
 */
async function getTestTenants(
  markedOnly: boolean,
  emptyOnly: boolean,
  pattern?: string,
  keepSlugs: string[] = []
) {
  // Build where clause based on filters
  const conditions: any[] = [];

  if (markedOnly) {
    conditions.push({ isTestTenant: true });
  }

  if (pattern) {
    conditions.push({
      slug: {
        contains: pattern,
        mode: 'insensitive' as const,
      },
    });
  }

  // Exclude kept slugs
  if (keepSlugs.length > 0) {
    conditions.push({
      slug: {
        notIn: keepSlugs,
      },
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      _count: {
        select: {
          users: true,
          customers: true,
          bookings: true,
          tiers: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Filter by emptyOnly if specified
  if (emptyOnly) {
    return tenants.filter((t) => t._count.bookings === 0 && t._count.customers === 0);
  }

  return tenants;
}

/**
 * Main function
 */
async function main() {
  console.log('🧹 Test Tenant Cleanup Tool\n');

  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run delete-test-tenants [options]

Options:
  --dry-run           Show what would be deleted without actually deleting
  --marked-only       Only delete tenants with isTestTenant=true
  --empty-only        Only delete tenants with no bookings/customers
  --pattern=<pattern> Custom slug pattern to match
  --keep-slugs=<list> Comma-separated slugs to keep
  --confirm           Skip confirmation prompt (DANGEROUS)
  --force-with-data   Allow deletion of tenants with data (DANGEROUS)

Examples:
  npm run delete-test-tenants --dry-run
  npm run delete-test-tenants --marked-only
  npm run delete-test-tenants --empty-only --dry-run
  npm run delete-test-tenants --pattern=test
  npm run delete-test-tenants --keep-slugs=handled,plate,little-bit-farm

Safety:
  - By default, only deletes tenants marked as test (isTestTenant=true)
  - Use --empty-only to only delete tenants with no customer data
  - Use --keep-slugs to protect specific tenants
  - Cascade deletion removes all related data (bookings, customers, etc.)
`);
    process.exit(0);
  }

  const { dryRun, markedOnly, emptyOnly, pattern, confirm, forceWithData, keepSlugs } =
    parseArgs(args);

  try {
    console.log('🔍 Searching for test tenants...');
    if (keepSlugs.length > 0) {
      console.log(`   Protected slugs: ${keepSlugs.join(', ')}`);
    }
    console.log('');

    const testTenants = await getTestTenants(markedOnly, emptyOnly, pattern, keepSlugs);

    if (testTenants.length === 0) {
      console.log('✅ No test tenants found!');
      if (markedOnly) console.log('   Filter: isTestTenant=true only');
      if (emptyOnly) console.log('   Filter: Empty tenants only');
      if (pattern) console.log(`   Filter: Pattern "${pattern}"`);
      process.exit(0);
    }

    console.log(`Found ${testTenants.length} tenant(s):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let tenantsWithData = 0;

    testTenants.forEach((tenant, index) => {
      const hasData = tenant._count.bookings > 0 || tenant._count.customers > 0;
      if (hasData) tenantsWithData++;

      console.log(`\n${index + 1}. ${tenant.name} (${tenant.slug})`);
      console.log(`   ID:        ${tenant.id}`);
      console.log(`   Test:      ${tenant.isTestTenant ? 'YES' : 'NO'}`);
      console.log(`   Users:     ${tenant._count.users}`);
      console.log(`   Customers: ${tenant._count.customers}`);
      console.log(`   Bookings:  ${tenant._count.bookings}`);
      console.log(`   Tiers:     ${tenant._count.tiers}`);
      console.log(`   Created:   ${tenant.createdAt.toISOString()}`);
      if (hasData) {
        console.log(`   ⚠️  HAS CUSTOMER DATA`);
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (tenantsWithData > 0 && !forceWithData) {
      console.log(`⚠️  ${tenantsWithData} tenant(s) have customer data (bookings/customers)`);
      console.log('   Add --force-with-data to delete them, or use --empty-only to skip them\n');
      process.exit(1);
    }

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log(`   Would delete ${testTenants.length} tenant(s) listed above`);
      console.log(
        '   This will CASCADE DELETE all related data (bookings, customers, tiers, etc.)\n'
      );
      process.exit(0);
    }

    // Ask for confirmation unless --confirm flag is present
    if (!confirm) {
      console.log('⚠️  WARNING: This will CASCADE DELETE all related data!');
      console.log('   - All bookings, customers, tiers, venues, etc. for these tenants\n');

      const confirmed = await askConfirmation(
        `Are you sure you want to DELETE ${testTenants.length} tenant(s) and ALL their data?`
      );

      if (!confirmed) {
        console.log('\n❌ Deletion cancelled by user\n');
        process.exit(0);
      }
    }

    console.log('\n🗑️  Deleting test tenants...\n');

    // Delete tenants one by one to show progress
    let deletedCount = 0;
    const errors: Array<{ tenant: (typeof testTenants)[0]; error: string }> = [];

    for (const tenant of testTenants) {
      try {
        await prisma.tenant.delete({
          where: { id: tenant.id },
        });
        console.log(
          `✅ Deleted: ${tenant.slug} (${tenant._count.bookings} bookings, ${tenant._count.customers} customers)`
        );
        deletedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Failed to delete ${tenant.slug}: ${errorMessage}`);
        errors.push({ tenant, error: errorMessage });
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DELETION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Successfully deleted: ${deletedCount} tenant(s)`);

    if (errors.length > 0) {
      console.log(`❌ Failed to delete:     ${errors.length} tenant(s)\n`);
      console.log('Failed deletions:');
      errors.forEach(({ tenant, error }) => {
        console.log(`  - ${tenant.slug}: ${error}`);
      });
    }

    console.log('\n💡 Tip: Use --keep-slugs to protect production tenants from deletion');
    console.log('   Example: --keep-slugs=handled,plate,little-bit-farm\n');

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
