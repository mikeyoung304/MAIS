/**
 * Migration Script: Fix Orphaned Packages
 *
 * This script finds all packages with null segmentId and assigns them
 * to a "General" segment (creating one if necessary).
 *
 * Run with: npx tsx scripts/fix-orphaned-packages.ts
 * Dry run:  npx tsx scripts/fix-orphaned-packages.ts --dry-run
 */

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Prisma 7 requires a driver adapter
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

interface OrphanedPackage {
  id: string;
  name: string;
  tenantId: string;
  tenantName?: string;
}

interface TenantGroup {
  tenantId: string;
  tenantName: string;
  packages: OrphanedPackage[];
  existingGeneralSegmentId: string | null;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Fix Orphaned Packages Migration');
  console.log(isDryRun ? '(DRY RUN - no changes will be made)' : '(LIVE RUN)');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Find all packages with null segmentId
  const orphanedPackages = await prisma.package.findMany({
    where: { segmentId: null },
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: [{ tenantId: 'asc' }, { groupingOrder: 'asc' }],
  });

  if (orphanedPackages.length === 0) {
    console.log('No orphaned packages found. Nothing to do.');
    return;
  }

  console.log(`Found ${orphanedPackages.length} orphaned packages across tenants:\n`);

  // Step 2: Group by tenant
  const tenantGroups = new Map<string, TenantGroup>();

  for (const pkg of orphanedPackages) {
    if (!tenantGroups.has(pkg.tenantId)) {
      // Check if tenant already has a "General" segment
      const existingSegment = await prisma.segment.findFirst({
        where: { tenantId: pkg.tenantId, slug: 'general' },
        select: { id: true },
      });

      tenantGroups.set(pkg.tenantId, {
        tenantId: pkg.tenantId,
        tenantName: pkg.tenant.name,
        packages: [],
        existingGeneralSegmentId: existingSegment?.id ?? null,
      });
    }

    tenantGroups.get(pkg.tenantId)!.packages.push({
      id: pkg.id,
      name: pkg.name,
      tenantId: pkg.tenantId,
    });
  }

  // Step 3: Display what we'll do
  for (const [_tenantId, group] of tenantGroups) {
    console.log(`Tenant: ${group.tenantName}`);
    console.log(`  Orphaned packages: ${group.packages.length}`);
    group.packages.forEach((pkg) => console.log(`    - ${pkg.name}`));

    if (group.existingGeneralSegmentId) {
      console.log(`  Action: Assign to existing "General" segment`);
    } else {
      console.log(`  Action: Create "General" segment, then assign`);
    }
    console.log('');
  }

  if (isDryRun) {
    console.log('DRY RUN complete. Run without --dry-run to apply changes.');
    return;
  }

  // Step 4: Apply fixes
  console.log('Applying fixes...\n');

  let segmentsCreated = 0;
  let packagesFixed = 0;

  for (const [_tenantId, group] of tenantGroups) {
    let segmentId = group.existingGeneralSegmentId;

    // Create segment if needed
    if (!segmentId) {
      const newSegment = await prisma.segment.create({
        data: {
          tenantId: group.tenantId,
          slug: 'general',
          name: 'General',
          heroTitle: 'Our Services',
          description: 'Your main service offerings',
          sortOrder: 0,
          active: true,
        },
      });
      segmentId = newSegment.id;
      segmentsCreated++;
      console.log(`  Created "General" segment for ${group.tenantName}`);
    }

    // Assign packages to segment
    const packageIds = group.packages.map((p) => p.id);
    await prisma.package.updateMany({
      where: { id: { in: packageIds } },
      data: { segmentId },
    });

    packagesFixed += packageIds.length;
    console.log(`  Assigned ${packageIds.length} packages to segment for ${group.tenantName}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
  console.log(`  Segments created: ${segmentsCreated}`);
  console.log(`  Packages fixed: ${packagesFixed}`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
