/**
 * Migration Script: Convert Public URLs to Signed URLs
 *
 * This script migrates existing Supabase Storage public URLs to signed URLs.
 * Run this AFTER changing the Supabase bucket from public to private.
 *
 * Usage:
 *   cd server
 *   npx tsx scripts/migrate-to-signed-urls.ts
 *
 * Prerequisites:
 *   1. Change Supabase bucket from "Public" to "Private" in Dashboard
 *   2. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env
 */

import { PrismaClient } from '../src/generated/prisma';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
// Support both naming conventions for the service role key
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY)
    console.error('   - SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Extract storage path from a Supabase public URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/images/tenant-123/segments/photo.jpg
 * Returns: tenant-123/segments/photo.jpg
 */
function extractStoragePath(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf('images');
    if (bucketIndex === -1) {
      throw new Error(`Invalid storage URL format: ${url}`);
    }
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    throw new Error(`Failed to parse URL: ${url}`);
  }
}

/**
 * Check if URL is already a signed URL (contains ?token= query param)
 */
function isSignedUrl(url: string): boolean {
  return url.includes('?token=') || url.includes('&token=');
}

/**
 * Check if URL is a Supabase URL
 */
function isSupabaseUrl(url: string): boolean {
  return url.includes('supabase');
}

async function migrateSegmentHeroImages(): Promise<{
  success: number;
  failed: number;
  skipped: number;
}> {
  console.log('\n📸 Migrating Segment Hero Images...\n');

  const segments = await prisma.segment.findMany({
    where: { heroImage: { not: null } },
    select: { id: true, tenantId: true, heroImage: true, name: true },
  });

  console.log(`Found ${segments.length} segments with hero images`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const segment of segments) {
    if (!segment.heroImage) continue;

    // Skip if already a signed URL or not a Supabase URL
    if (isSignedUrl(segment.heroImage)) {
      console.log(`  ⏭️  ${segment.name} (${segment.id}): Already signed URL - skipping`);
      skipped++;
      continue;
    }

    if (!isSupabaseUrl(segment.heroImage)) {
      console.log(`  ⏭️  ${segment.name} (${segment.id}): Local URL - skipping`);
      skipped++;
      continue;
    }

    try {
      const storagePath = extractStoragePath(segment.heroImage);

      const { data, error } = await supabase.storage
        .from('images')
        .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

      if (error || !data) {
        console.error(`  ❌ ${segment.name} (${segment.id}): ${error?.message || 'Unknown error'}`);
        failed++;
        continue;
      }

      await prisma.segment.update({
        where: { id: segment.id },
        data: { heroImage: data.signedUrl },
      });

      console.log(`  ✅ ${segment.name} (${segment.id}): Migrated successfully`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${segment.name} (${segment.id}): ${(err as Error).message}`);
      failed++;
    }
  }

  return { success, failed, skipped };
}

async function migratePackagePhotos(): Promise<{
  success: number;
  failed: number;
  skipped: number;
}> {
  console.log('\n📦 Migrating Package Photos...\n');

  const packages = await prisma.package.findMany({
    where: { photo: { not: null } },
    select: { id: true, tenantId: true, photo: true, name: true },
  });

  console.log(`Found ${packages.length} packages with photos`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const pkg of packages) {
    if (!pkg.photo) continue;

    // Skip if already a signed URL or not a Supabase URL
    if (isSignedUrl(pkg.photo)) {
      console.log(`  ⏭️  ${pkg.name} (${pkg.id}): Already signed URL - skipping`);
      skipped++;
      continue;
    }

    if (!isSupabaseUrl(pkg.photo)) {
      console.log(`  ⏭️  ${pkg.name} (${pkg.id}): Local URL - skipping`);
      skipped++;
      continue;
    }

    try {
      const storagePath = extractStoragePath(pkg.photo);

      const { data, error } = await supabase.storage
        .from('images')
        .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

      if (error || !data) {
        console.error(`  ❌ ${pkg.name} (${pkg.id}): ${error?.message || 'Unknown error'}`);
        failed++;
        continue;
      }

      await prisma.package.update({
        where: { id: pkg.id },
        data: { photo: data.signedUrl },
      });

      console.log(`  ✅ ${pkg.name} (${pkg.id}): Migrated successfully`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${pkg.name} (${pkg.id}): ${(err as Error).message}`);
      failed++;
    }
  }

  return { success, failed, skipped };
}

async function migrateTenantLogos(): Promise<{ success: number; failed: number; skipped: number }> {
  console.log('\n🏢 Migrating Tenant Logos...\n');

  const tenants = await prisma.tenant.findMany({
    where: { logoUrl: { not: null } },
    select: { id: true, name: true, logoUrl: true },
  });

  console.log(`Found ${tenants.length} tenants with logos`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    if (!tenant.logoUrl) continue;

    // Skip if already a signed URL or not a Supabase URL
    if (isSignedUrl(tenant.logoUrl)) {
      console.log(`  ⏭️  ${tenant.name} (${tenant.id}): Already signed URL - skipping`);
      skipped++;
      continue;
    }

    if (!isSupabaseUrl(tenant.logoUrl)) {
      console.log(`  ⏭️  ${tenant.name} (${tenant.id}): Local URL - skipping`);
      skipped++;
      continue;
    }

    try {
      const storagePath = extractStoragePath(tenant.logoUrl);

      const { data, error } = await supabase.storage
        .from('images')
        .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

      if (error || !data) {
        console.error(`  ❌ ${tenant.name} (${tenant.id}): ${error?.message || 'Unknown error'}`);
        failed++;
        continue;
      }

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { logoUrl: data.signedUrl },
      });

      console.log(`  ✅ ${tenant.name} (${tenant.id}): Migrated successfully`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${tenant.name} (${tenant.id}): ${(err as Error).message}`);
      failed++;
    }
  }

  return { success, failed, skipped };
}

async function main() {
  console.log('🔄 Supabase Storage URL Migration');
  console.log('================================\n');
  console.log('This script converts public URLs to signed URLs.');
  console.log('Make sure the Supabase bucket is set to PRIVATE before running.\n');

  try {
    // Test Supabase connection
    console.log('🔗 Testing Supabase connection...');
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      process.exit(1);
    }
    console.log(`✅ Connected to Supabase (${data.length} buckets found)\n`);

    // Run migrations
    const segmentResults = await migrateSegmentHeroImages();
    const packageResults = await migratePackagePhotos();
    const tenantResults = await migrateTenantLogos();

    // Summary
    console.log('\n================================');
    console.log('📊 Migration Summary\n');

    const totalSuccess = segmentResults.success + packageResults.success + tenantResults.success;
    const totalFailed = segmentResults.failed + packageResults.failed + tenantResults.failed;
    const totalSkipped = segmentResults.skipped + packageResults.skipped + tenantResults.skipped;

    console.log(
      `Segments:  ${segmentResults.success} ✅  ${segmentResults.failed} ❌  ${segmentResults.skipped} ⏭️`
    );
    console.log(
      `Packages:  ${packageResults.success} ✅  ${packageResults.failed} ❌  ${packageResults.skipped} ⏭️`
    );
    console.log(
      `Tenants:   ${tenantResults.success} ✅  ${tenantResults.failed} ❌  ${tenantResults.skipped} ⏭️`
    );
    console.log('--------------------------------');
    console.log(`Total:     ${totalSuccess} ✅  ${totalFailed} ❌  ${totalSkipped} ⏭️`);
    console.log('\n================================\n');

    if (totalFailed > 0) {
      console.log('⚠️  Some migrations failed. Review errors above and re-run if needed.');
      process.exit(1);
    } else {
      console.log('✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
