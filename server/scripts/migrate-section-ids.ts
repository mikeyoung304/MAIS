/**
 * Migration Script: Backfill Section IDs
 *
 * This script adds stable section IDs to existing tenant configurations
 * that were created before the section ID feature was implemented.
 *
 * Features:
 * - Preserves existing IDs (idempotent)
 * - Generates new IDs following {page}-{type}-{qualifier} pattern
 * - Processes both landingPageConfig (live) and landingPageConfigDraft
 * - Fresh existingIds Set per tenant (tenant isolation)
 * - Dry-run mode for safety
 *
 * Usage:
 *   npx tsx scripts/migrate-section-ids.ts [--dry-run] [--tenant-id=xxx]
 *
 * Options:
 *   --dry-run     Preview changes without applying them
 *   --tenant-id   Process a single tenant instead of all
 */

import '@dotenvx/dotenvx/config';
import { getPrismaClient } from '../src/generated/prisma/client';
import {
  generateSectionId,
  SECTION_TYPES,
  type PageName,
  type SectionTypeName,
  type LandingPageConfig,
  type PagesConfig,
} from '@macon/contracts';

// Section type validation - using canonical list from contracts
const VALID_SECTION_TYPES: ReadonlySet<string> = new Set(SECTION_TYPES);

interface MigrationStats {
  tenantsProcessed: number;
  sectionsWithExistingIds: number;
  sectionsAssignedIds: number;
  liveConfigsUpdated: number;
  draftConfigsUpdated: number;
  errors: string[];
}

interface Section {
  id?: string;
  type: string;
  [key: string]: unknown;
}

interface PageConfig {
  enabled: boolean;
  sections: Section[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): { dryRun: boolean; tenantId?: string } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    tenantId: args.find((arg) => arg.startsWith('--tenant-id='))?.split('=')[1],
  };
}

/**
 * Backfill IDs for a single pages config
 * Returns updated config and count of new IDs assigned
 */
function backfillConfigIds(
  config: LandingPageConfig | null,
  existingIds: Set<string>
): { updatedConfig: LandingPageConfig | null; newIdsAssigned: number; preservedIds: number } {
  if (!config?.pages) {
    return { updatedConfig: null, newIdsAssigned: 0, preservedIds: 0 };
  }

  let newIdsAssigned = 0;
  let preservedIds = 0;

  const updatedPages: PagesConfig = {} as PagesConfig;

  for (const [pageName, pageConfig] of Object.entries(config.pages)) {
    const page = pageConfig as PageConfig;
    const updatedSections: Section[] = [];

    for (const section of page.sections || []) {
      // Skip invalid section types
      if (!VALID_SECTION_TYPES.has(section.type)) {
        updatedSections.push(section);
        continue;
      }

      // Preserve existing valid IDs
      if (section.id && typeof section.id === 'string') {
        existingIds.add(section.id);
        preservedIds++;
        updatedSections.push(section);
        continue;
      }

      // Generate new ID
      const newId = generateSectionId(
        pageName as PageName,
        section.type as SectionTypeName,
        existingIds
      );

      existingIds.add(newId);
      newIdsAssigned++;

      updatedSections.push({
        ...section,
        id: newId,
      });
    }

    updatedPages[pageName as keyof PagesConfig] = {
      ...page,
      sections: updatedSections,
    } as PageConfig;
  }

  return {
    updatedConfig: { pages: updatedPages },
    newIdsAssigned,
    preservedIds,
  };
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  const { dryRun, tenantId } = parseArgs();
  const prisma = getPrismaClient();

  console.log('\n🔧 Section ID Migration');
  console.log('='.repeat(50));
  console.log(`Mode: ${dryRun ? '🏃 DRY RUN (no changes)' : '✏️ LIVE (applying changes)'}`);
  if (tenantId) {
    console.log(`Target: Single tenant (${tenantId})`);
  } else {
    console.log('Target: All tenants');
  }
  console.log('='.repeat(50));

  const stats: MigrationStats = {
    tenantsProcessed: 0,
    sectionsWithExistingIds: 0,
    sectionsAssignedIds: 0,
    liveConfigsUpdated: 0,
    draftConfigsUpdated: 0,
    errors: [],
  };

  try {
    // Query tenants
    const tenants = await prisma.tenant.findMany({
      where: tenantId ? { id: tenantId } : undefined,
      select: {
        id: true,
        businessName: true,
        slug: true,
        landingPageConfig: true,
        landingPageConfigDraft: true,
      },
    });

    console.log(`\nFound ${tenants.length} tenant(s) to process\n`);

    for (const tenant of tenants) {
      stats.tenantsProcessed++;

      // CRITICAL: Fresh existingIds Set per tenant (tenant isolation)
      const existingIds = new Set<string>();

      const liveConfig = tenant.landingPageConfig as unknown as LandingPageConfig | null;
      const draftConfig = tenant.landingPageConfigDraft as unknown as LandingPageConfig | null;

      // Process live config first (to collect existing IDs)
      const liveResult = backfillConfigIds(liveConfig, existingIds);

      // Process draft config (uses shared existingIds to avoid collisions)
      const draftResult = backfillConfigIds(draftConfig, existingIds);

      stats.sectionsWithExistingIds += liveResult.preservedIds + draftResult.preservedIds;
      stats.sectionsAssignedIds += liveResult.newIdsAssigned + draftResult.newIdsAssigned;

      const hasLiveChanges = liveResult.newIdsAssigned > 0;
      const hasDraftChanges = draftResult.newIdsAssigned > 0;

      if (hasLiveChanges || hasDraftChanges) {
        const name = tenant.businessName || tenant.slug || tenant.id;
        console.log(`📦 Tenant: ${name}`);
        if (hasLiveChanges) {
          console.log(
            `   Live: +${liveResult.newIdsAssigned} new IDs (${liveResult.preservedIds} preserved)`
          );
        }
        if (hasDraftChanges) {
          console.log(
            `   Draft: +${draftResult.newIdsAssigned} new IDs (${draftResult.preservedIds} preserved)`
          );
        }

        if (!dryRun) {
          try {
            const updateData: Record<string, unknown> = {};

            if (hasLiveChanges && liveResult.updatedConfig) {
              updateData.landingPageConfig = liveResult.updatedConfig;
              stats.liveConfigsUpdated++;
            }
            if (hasDraftChanges && draftResult.updatedConfig) {
              updateData.landingPageConfigDraft = draftResult.updatedConfig;
              stats.draftConfigsUpdated++;
            }

            await prisma.tenant.update({
              where: { id: tenant.id },
              data: updateData,
            });

            console.log(`   ✅ Updated successfully`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            stats.errors.push(`${tenant.id}: ${message}`);
            console.log(`   ❌ Error: ${message}`);
          }
        } else {
          console.log(`   ⏭️ Skipped (dry run)`);
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Tenants processed: ${stats.tenantsProcessed}`);
    console.log(`Sections with existing IDs: ${stats.sectionsWithExistingIds}`);
    console.log(`Sections assigned new IDs: ${stats.sectionsAssignedIds}`);
    if (!dryRun) {
      console.log(`Live configs updated: ${stats.liveConfigsUpdated}`);
      console.log(`Draft configs updated: ${stats.draftConfigsUpdated}`);
    }
    if (stats.errors.length > 0) {
      console.log(`\n⚠️ Errors (${stats.errors.length}):`);
      stats.errors.forEach((err) => console.log(`   - ${err}`));
    }

    if (dryRun && stats.sectionsAssignedIds > 0) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

    if (stats.sectionsAssignedIds === 0) {
      console.log('\n✨ All sections already have IDs - nothing to migrate!');
    }

    console.log('\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
