/**
 * Migration Script: Fix Orphaned Packages (SQL version)
 *
 * Uses raw SQL to avoid connection pool issues.
 * Run with: npx tsx scripts/fix-orphaned-packages-sql.ts
 * Dry run:  npx tsx scripts/fix-orphaned-packages-sql.ts --dry-run
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Get DATABASE_URL without query params (psql doesn't like them)
const fullUrl = process.env.DATABASE_URL || '';
const databaseUrl = fullUrl.split('?')[0];

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

function sql(query: string): string {
  try {
    return execSync(`psql "${databaseUrl}" -t -A -F'|' -c "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    console.error('SQL Error:', err);
    throw err;
  }
}

function sqlExec(query: string): void {
  execSync(`psql "${databaseUrl}" -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
}

const isDryRun = process.argv.includes('--dry-run');

console.log('='.repeat(60));
console.log('Fix Orphaned Packages Migration (SQL)');
console.log(isDryRun ? '(DRY RUN - no changes will be made)' : '(LIVE RUN)');
console.log('='.repeat(60));
console.log('');

// Step 1: Find orphaned packages grouped by tenant
const orphanedQuery = `
  SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    p.id as package_id,
    p.name as package_name,
    (SELECT s.id FROM "Segment" s WHERE s."tenantId" = t.id AND s.slug = 'general' LIMIT 1) as existing_segment_id
  FROM "Package" p
  JOIN "Tenant" t ON p."tenantId" = t.id
  WHERE p."segmentId" IS NULL
  ORDER BY t.name, p."groupingOrder" NULLS LAST
`;

const result = sql(orphanedQuery);

if (!result) {
  console.log('No orphaned packages found. Nothing to do.');
  process.exit(0);
}

// Parse results
interface PackageRow {
  tenantId: string;
  tenantName: string;
  packageId: string;
  packageName: string;
  existingSegmentId: string | null;
}

const rows: PackageRow[] = result
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [tenantId, tenantName, packageId, packageName, existingSegmentId] = line.split('|');
    return {
      tenantId,
      tenantName,
      packageId,
      packageName,
      existingSegmentId: existingSegmentId || null,
    };
  });

// Group by tenant
const tenantGroups = new Map<
  string,
  {
    tenantId: string;
    tenantName: string;
    packages: { id: string; name: string }[];
    existingSegmentId: string | null;
  }
>();

for (const row of rows) {
  if (!tenantGroups.has(row.tenantId)) {
    tenantGroups.set(row.tenantId, {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      packages: [],
      existingSegmentId: row.existingSegmentId,
    });
  }
  tenantGroups.get(row.tenantId)!.packages.push({
    id: row.packageId,
    name: row.packageName,
  });
}

console.log(`Found ${rows.length} orphaned packages across ${tenantGroups.size} tenants:\n`);

// Display plan
for (const group of tenantGroups.values()) {
  console.log(`Tenant: ${group.tenantName}`);
  console.log(`  Orphaned packages: ${group.packages.length}`);
  group.packages.forEach((pkg) => console.log(`    - ${pkg.name}`));

  if (group.existingSegmentId) {
    console.log(`  Action: Assign to existing "General" segment`);
  } else {
    console.log(`  Action: Create "General" segment, then assign`);
  }
  console.log('');
}

if (isDryRun) {
  console.log('DRY RUN complete. Run without --dry-run to apply changes.');
  process.exit(0);
}

// Step 2: Apply fixes
console.log('Applying fixes...\n');

let segmentsCreated = 0;
let packagesFixed = 0;

for (const group of tenantGroups.values()) {
  let segmentId = group.existingSegmentId;

  // Create segment if needed
  if (!segmentId) {
    const newId = 'seg_' + Math.random().toString(36).substring(2, 15);
    sqlExec(`
      INSERT INTO "Segment" (id, "tenantId", slug, name, "heroTitle", description, "sortOrder", active, "createdAt", "updatedAt")
      VALUES ('${newId}', '${group.tenantId}', 'general', 'General', 'Our Services', 'Your main service offerings', 0, true, NOW(), NOW())
    `);
    segmentId = newId;
    segmentsCreated++;
    console.log(`  Created "General" segment for ${group.tenantName}`);
  }

  // Assign packages to segment
  const packageIds = group.packages.map((p) => `'${p.id}'`).join(', ');
  sqlExec(
    `UPDATE "Package" SET "segmentId" = '${segmentId}', "updatedAt" = NOW() WHERE id IN (${packageIds})`
  );

  packagesFixed += group.packages.length;
  console.log(`  Assigned ${group.packages.length} packages to segment for ${group.tenantName}`);
}

console.log('\n' + '='.repeat(60));
console.log('Migration complete!');
console.log(`  Segments created: ${segmentsCreated}`);
console.log(`  Packages fixed: ${packagesFixed}`);
console.log('='.repeat(60));
