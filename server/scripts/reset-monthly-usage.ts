#!/usr/bin/env npx ts-node
/**
 * Monthly AI Usage Reset Script
 *
 * Resets aiMessagesUsed counter to 0 for all active tenants.
 * Should be run monthly via cron: `0 0 1 * * cd /app/server && npx ts-node scripts/reset-monthly-usage.ts`
 *
 * Usage:
 *   npx ts-node scripts/reset-monthly-usage.ts           # Reset all active tenants
 *   npx ts-node scripts/reset-monthly-usage.ts --dry-run # Preview without changes
 */

import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function resetMonthlyUsage(dryRun: boolean = false): Promise<void> {
  console.log('='.repeat(60));
  console.log('AI Usage Monthly Reset');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Find all tenants that need reset
  const tenantsToReset = await prisma.tenant.findMany({
    where: {
      // Only reset tenants with active subscriptions or trials
      subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
      // Skip tenants that have never used AI (optimization)
      aiMessagesUsed: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      tier: true,
      aiMessagesUsed: true,
      subscriptionStatus: true,
    },
  });

  console.log(`Found ${tenantsToReset.length} tenants to reset`);
  console.log('');

  if (tenantsToReset.length === 0) {
    console.log('No tenants need reset. Exiting.');
    return;
  }

  // Preview tenants
  console.log('Tenants to reset:');
  console.log('-'.repeat(60));
  for (const tenant of tenantsToReset) {
    console.log(`  - ${tenant.name} (${tenant.id})`);
    console.log(`    Tier: ${tenant.tier}, Status: ${tenant.subscriptionStatus}`);
    console.log(`    Usage: ${tenant.aiMessagesUsed} messages -> 0`);
  }
  console.log('-'.repeat(60));
  console.log('');

  if (dryRun) {
    console.log('DRY RUN: No changes made.');
    return;
  }

  // Execute reset
  console.log('Resetting usage counters...');
  const result = await prisma.tenant.updateMany({
    where: {
      subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
    },
    data: {
      aiMessagesUsed: 0,
      aiMessagesResetAt: new Date(),
    },
  });

  console.log('');
  console.log('='.repeat(60));
  console.log(`SUCCESS: Reset AI usage for ${result.count} tenants`);
  console.log('='.repeat(60));
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run script
resetMonthlyUsage(dryRun)
  .catch((error) => {
    console.error('ERROR:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
