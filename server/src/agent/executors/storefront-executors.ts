/**
 * Storefront Build Mode Executors
 *
 * Implements execution logic for Build Mode write tool proposals.
 * All operations target the draft config (`landingPageConfigDraft`).
 * Changes become live only when user explicitly publishes.
 *
 * Security:
 * - Validates all payloads against Zod schemas (P0 requirement)
 * - Verifies tenant ownership before all operations
 * - Uses defense-in-depth with tenantId in all queries
 *
 * Concurrency:
 * - P1-659 FIX: Uses PostgreSQL advisory locks for TOCTOU prevention
 * - All section ID uniqueness checks wrapped in transactions
 */

import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import { ResourceNotFoundError, ValidationError } from '../errors/index';
import { getDraftConfigWithSlug } from '../tools/utils';
import { hashTenantStorefront } from '../../lib/advisory-locks';
import { createPublishedWrapper, countSectionsInConfig } from '../../lib/landing-page-utils';
import {
  // Validation schemas (DRY - shared with tools)
  UpdatePageSectionPayloadSchema,
  RemovePageSectionPayloadSchema,
  ReorderPageSectionsPayloadSchema,
  TogglePageEnabledPayloadSchema,
  UpdateStorefrontBrandingPayloadSchema,
  PublishDraftPayloadSchema,
  DiscardDraftPayloadSchema,
  // Types
  type Section,
  type LandingPageConfig,
  type PagesConfig,
  type PageConfig,
  type WriteExecutorResult,
} from '../proposals/executor-schemas';
import {
  generateSectionId,
  type PageName,
  type SectionTypeName,
  SECTION_TYPES,
} from '@macon/contracts';

// Transaction configuration for storefront edits
const STOREFRONT_TRANSACTION_TIMEOUT_MS = 5000; // 5 seconds
const STOREFRONT_ISOLATION_LEVEL = 'ReadCommitted' as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Collect all existing section IDs from pages config.
 * Used for uniqueness checks and monotonic ID generation.
 *
 * @param pages - The pages configuration to scan
 * @returns Set of all section IDs found across all pages
 */
function collectAllSectionIds(pages: PagesConfig): Set<string> {
  const ids = new Set<string>();
  for (const pageConfig of Object.values(pages)) {
    for (const section of pageConfig.sections || []) {
      if ('id' in section && typeof section.id === 'string') {
        ids.add(section.id);
      }
    }
  }
  return ids;
}

/**
 * Check if a section type is valid for ID generation.
 * Type guard to satisfy TypeScript for generateSectionId call.
 */
function isValidSectionType(type: string): type is SectionTypeName {
  return SECTION_TYPES.includes(type as SectionTypeName);
}

/**
 * Prisma transaction client type (subset of PrismaClient with tenant methods)
 * P1-659 FIX: Enables advisory lock pattern for TOCTOU prevention
 */
type PrismaTransactionClient = Pick<PrismaClient, 'tenant' | '$executeRaw'>;

/**
 * Save pages config to draft
 * P1-659 FIX: Accepts transaction client for atomic operations
 */
async function saveDraftConfig(
  prisma: PrismaClient | PrismaTransactionClient,
  tenantId: string,
  pages: PagesConfig
): Promise<void> {
  const draftConfig: LandingPageConfig = { pages };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfigDraft: draftConfig as unknown as Prisma.JsonObject,
    },
  });
}

// ============================================================================
// Executor Registration
// ============================================================================

/**
 * Register all storefront-related executors
 * Call this from registerAllExecutors() during server initialization
 */
export function registerStorefrontExecutors(prisma: PrismaClient): void {
  // ============================================================================
  // update_page_section - Update or add a section on a landing page
  // P1-659 FIX: Uses advisory locks to prevent TOCTOU race conditions
  // ============================================================================

  registerProposalExecutor('update_page_section', async (tenantId, payload) => {
    // P0: Validate payload against strict schema
    const validationResult = UpdatePageSectionPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { pageName, sectionIndex, sectionData } = validationResult.data;

    // P1-659 FIX: Wrap read-validate-write in transaction with advisory lock
    // This prevents TOCTOU race conditions where two concurrent requests could
    // both pass uniqueness checks against stale data
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get current draft config and slug within the transaction
        const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);

        // Validate page exists
        const page = pages[pageName as keyof PagesConfig];
        if (!page) {
          throw new ValidationError(`Page "${pageName}" not found`);
        }

        // =========================================================================
        // Section ID Uniqueness Validation (now protected by advisory lock)
        // =========================================================================
        const incomingId =
          'id' in sectionData && typeof sectionData.id === 'string' ? sectionData.id : null;

        if (incomingId) {
          // Collect all existing IDs across all pages
          for (const [pName, pConfig] of Object.entries(pages)) {
            for (let i = 0; i < pConfig.sections.length; i++) {
              const section = pConfig.sections[i];
              if ('id' in section && section.id === incomingId) {
                // If updating the same section at the same position, allow it
                const isUpdatingSameSection = pName === pageName && i === sectionIndex;
                if (!isUpdatingSameSection) {
                  throw new ValidationError(
                    `Section ID '${incomingId}' already exists on page '${pName}'. IDs must be unique.`
                  );
                }
              }
            }
          }
        }

        // Clone sections array to avoid mutation
        const newSections = [...page.sections];

        // Determine operation: append or update
        if (sectionIndex === -1 || sectionIndex >= newSections.length) {
          // Defense-in-depth: Ensure section has ID before appending
          // If tool bug passed section without ID, generate one server-side
          if (!('id' in sectionData) || !sectionData.id) {
            if (isValidSectionType(sectionData.type)) {
              const existingIds = collectAllSectionIds(pages);
              const generatedId = generateSectionId(
                pageName as PageName,
                sectionData.type,
                existingIds
              );
              (sectionData as Section & { id: string }).id = generatedId;
              logger.warn(
                { tenantId, pageName, generatedId, sectionType: sectionData.type },
                'Executor generated missing section ID - tool bug detected'
              );
            }
          }
          // Append new section
          newSections.push(sectionData as Section);
        } else {
          // Update existing section
          newSections[sectionIndex] = sectionData as Section;
        }

        // Update page with new sections
        const updatedPage: PageConfig = {
          ...page,
          sections: newSections,
        };

        // Update pages config
        const updatedPages = {
          ...pages,
          [pageName]: updatedPage,
        };

        // Save to draft within same transaction
        await saveDraftConfig(tx, tenantId, updatedPages as PagesConfig);

        const resultIndex = sectionIndex === -1 ? newSections.length - 1 : sectionIndex;
        const sectionId =
          'id' in sectionData && typeof sectionData.id === 'string' ? sectionData.id : undefined;

        // Audit logging with section ID for traceability
        logger.info(
          {
            tenantId,
            pageName,
            sectionIndex: resultIndex,
            sectionType: sectionData.type,
            sectionId,
            action: sectionIndex === -1 ? 'CREATE' : 'UPDATE',
          },
          'Page section modified via Build Mode'
        );

        // Phase 1.4: Return updated config for optimistic frontend updates
        return {
          success: true,
          updatedConfig: { pages: updatedPages } as LandingPageConfig,
          message: `Section ${sectionIndex === -1 ? 'added' : 'updated'} successfully`,
          action: sectionIndex === -1 ? 'added' : 'updated',
          pageName,
          sectionIndex: resultIndex,
          sectionType: sectionData.type,
          sectionId,
          previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // remove_page_section - Remove a section from a landing page
  // ============================================================================

  registerProposalExecutor('remove_page_section', async (tenantId, payload) => {
    // P0: Validate payload
    const validationResult = RemovePageSectionPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { pageName, sectionIndex } = validationResult.data;

    // P0 Security Fix: Wrap read-validate-write in transaction with advisory lock
    // Prevents TOCTOU race condition where two concurrent deletes could both succeed
    // against stale data, corrupting the sections array
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get current draft config and slug within the transaction
        const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);

        // Validate page exists
        const page = pages[pageName as keyof PagesConfig];
        if (!page) {
          throw new ValidationError(`Page "${pageName}" not found`);
        }

        // Validate section exists
        if (sectionIndex < 0 || sectionIndex >= page.sections.length) {
          throw new ValidationError(
            `Section index ${sectionIndex} is out of bounds. Page has ${page.sections.length} sections.`
          );
        }

        const removedSection = page.sections[sectionIndex];
        const removedType = removedSection.type;
        const removedId =
          'id' in removedSection && typeof removedSection.id === 'string'
            ? removedSection.id
            : undefined;

        // Clone and remove section
        const newSections = [...page.sections];
        newSections.splice(sectionIndex, 1);

        // Update page
        const updatedPage: PageConfig = {
          ...page,
          sections: newSections,
        };

        // Update pages config
        const updatedPages = {
          ...pages,
          [pageName]: updatedPage,
        };

        // Save to draft within same transaction
        await saveDraftConfig(tx, tenantId, updatedPages as PagesConfig);

        // Audit logging with section ID for traceability
        logger.info(
          {
            tenantId,
            pageName,
            sectionIndex,
            sectionType: removedType,
            sectionId: removedId,
            action: 'DELETE',
          },
          'Page section removed via Build Mode'
        );

        // Phase 1.4: Return updated config for optimistic frontend updates
        return {
          success: true,
          updatedConfig: { pages: updatedPages } as LandingPageConfig,
          message: 'Section removed successfully',
          action: 'removed',
          pageName,
          sectionIndex,
          removedSectionType: removedType,
          removedSectionId: removedId,
          remainingSections: newSections.length,
          previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // reorder_page_sections - Move a section to a new position
  // ============================================================================

  registerProposalExecutor('reorder_page_sections', async (tenantId, payload) => {
    // P0: Validate payload
    const validationResult = ReorderPageSectionsPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { pageName, fromIndex, toIndex } = validationResult.data;

    // P0 Security Fix: Wrap read-validate-write in transaction with advisory lock
    // Prevents TOCTOU race condition where concurrent reorders could read stale indices
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get current draft config and slug within the transaction
        const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);

        // Validate page exists
        const page = pages[pageName as keyof PagesConfig];
        if (!page) {
          throw new ValidationError(`Page "${pageName}" not found`);
        }

        // Validate indices
        const maxIndex = page.sections.length - 1;
        if (fromIndex < 0 || fromIndex > maxIndex || toIndex < 0 || toIndex > maxIndex) {
          throw new ValidationError(
            `Invalid indices. Page has ${page.sections.length} sections (indices 0-${maxIndex}).`
          );
        }

        // Clone sections array
        const newSections = [...page.sections];

        // Remove from old position and insert at new position
        const [movedSection] = newSections.splice(fromIndex, 1);
        newSections.splice(toIndex, 0, movedSection);

        // Update page
        const updatedPage: PageConfig = {
          ...page,
          sections: newSections,
        };

        // Update pages config
        const updatedPages = {
          ...pages,
          [pageName]: updatedPage,
        };

        // Save to draft within same transaction
        await saveDraftConfig(tx, tenantId, updatedPages as PagesConfig);

        const movedSectionId =
          'id' in movedSection && typeof movedSection.id === 'string' ? movedSection.id : undefined;

        logger.info(
          {
            tenantId,
            pageName,
            fromIndex,
            toIndex,
            sectionType: movedSection.type,
            sectionId: movedSectionId,
          },
          'Page sections reordered via Build Mode'
        );

        // Phase 1.4: Return updated config for optimistic frontend updates
        return {
          success: true,
          updatedConfig: { pages: updatedPages } as LandingPageConfig,
          message: 'Sections reordered successfully',
          action: 'reordered',
          pageName,
          fromIndex,
          toIndex,
          movedSectionType: movedSection.type,
          movedSectionId,
          previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // toggle_page_enabled - Enable or disable entire pages
  // ============================================================================

  registerProposalExecutor('toggle_page_enabled', async (tenantId, payload) => {
    // P0: Validate payload
    const validationResult = TogglePageEnabledPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { pageName, enabled } = validationResult.data;

    // Cannot disable home page
    if (pageName === 'home' && !enabled) {
      throw new ValidationError('Home page cannot be disabled.');
    }

    // Get current draft config and slug in single query (#627 N+1 fix)
    const { pages, slug } = await getDraftConfigWithSlug(prisma, tenantId);

    // Validate page exists
    const page = pages[pageName as keyof PagesConfig];
    if (!page) {
      throw new ValidationError(`Page "${pageName}" not found`);
    }

    // Update page enabled state
    const updatedPage: PageConfig = {
      ...page,
      enabled,
    };

    // Update pages config
    const updatedPages = {
      ...pages,
      [pageName]: updatedPage,
    };

    // Save to draft
    await saveDraftConfig(prisma, tenantId, updatedPages as PagesConfig);

    logger.info({ tenantId, pageName, enabled }, 'Page visibility toggled via Build Mode');

    // Phase 1.4: Return updated config for optimistic frontend updates
    return {
      success: true,
      updatedConfig: { pages: updatedPages } as LandingPageConfig,
      message: `Page ${enabled ? 'enabled' : 'disabled'} successfully`,
      action: enabled ? 'enabled' : 'disabled',
      pageName,
      enabled,
      previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
    };
  });

  // ============================================================================
  // update_storefront_branding - Update brand colors, fonts, logo
  // ============================================================================

  registerProposalExecutor('update_storefront_branding', async (tenantId, payload) => {
    // P0: Validate payload
    const validationResult = UpdateStorefrontBrandingPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { primaryColor, secondaryColor, accentColor, backgroundColor, fontFamily, logoUrl } =
      validationResult.data;

    // Build update data for direct tenant fields (colors)
    const tenantUpdates: Record<string, string> = {};
    if (primaryColor) tenantUpdates.primaryColor = primaryColor;
    if (secondaryColor) tenantUpdates.secondaryColor = secondaryColor;
    if (accentColor) tenantUpdates.accentColor = accentColor;
    if (backgroundColor) tenantUpdates.backgroundColor = backgroundColor;

    // Font and logo go in branding JSON field (#627 N+1 fix - combine queries)
    // Get tenant once for both branding and slug
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { branding: true, slug: true },
    });

    let brandingUpdates: Prisma.JsonObject | undefined;
    if (fontFamily || logoUrl) {
      brandingUpdates = {
        ...((tenant?.branding as Record<string, unknown>) || {}),
        ...(fontFamily && { fontFamily }),
        ...(logoUrl && { logo: logoUrl }),
      } as Prisma.JsonObject;
    }

    // Apply updates
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...tenantUpdates,
        ...(brandingUpdates && { branding: brandingUpdates }),
      },
    });

    const changes = [
      ...Object.keys(tenantUpdates),
      ...(fontFamily ? ['fontFamily'] : []),
      ...(logoUrl ? ['logo'] : []),
    ];

    const slug = tenant?.slug;

    logger.info({ tenantId, changes }, 'Storefront branding updated via Build Mode');

    // Phase 1.4: Fetch and return current draft config for consistency
    // (Branding updates don't modify draft, but frontend expects updatedConfig)
    const { pages } = await getDraftConfigWithSlug(prisma, tenantId);

    return {
      success: true,
      updatedConfig: { pages } as LandingPageConfig,
      message: 'Branding updated successfully',
      action: 'updated',
      changes,
      previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
    };
  });

  // ============================================================================
  // publish_draft - Publish draft changes to live storefront
  // ============================================================================

  registerProposalExecutor('publish_draft', async (tenantId, payload) => {
    // P0: Validate payload (empty object expected)
    const validationResult = PublishDraftPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Get the current draft
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        landingPageConfigDraft: true,
        slug: true,
      },
    });

    if (!tenant) {
      throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
    }

    if (!tenant.landingPageConfigDraft) {
      throw new ValidationError('No draft changes to publish.');
    }

    // Count sections for audit log (shared utility from lib/landing-page-utils.ts)
    const { totalSections, pageCount } = countSectionsInConfig(tenant.landingPageConfigDraft);

    // Create wrapper format (shared utility from lib/landing-page-utils.ts)
    // The public API's extractPublishedLandingPage() looks for landingPageConfig.published
    // See: #697 - Dual draft system publish mismatch fix, #725 - DRY refactor
    const publishedWrapper = createPublishedWrapper(tenant.landingPageConfigDraft);

    // Note: Use Prisma.DbNull for explicit null in JSON fields (Prisma 7 breaking change)
    // Cast wrapper for Prisma 7 JSON field type compatibility
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: publishedWrapper as unknown as Prisma.InputJsonValue,
        landingPageConfigDraft: Prisma.DbNull, // Clear the draft (Prisma 7 pattern)
      },
    });

    // Audit logging with publish details
    logger.info(
      {
        tenantId,
        action: 'PUBLISH',
        pageCount,
        totalSections,
      },
      'Draft published to live storefront via Build Mode'
    );

    // Phase 1.4: After publish, draft is cleared so return empty config
    return {
      success: true,
      updatedConfig: { pages: {} } as unknown as LandingPageConfig,
      message: 'Draft published successfully. Changes are now live.',
      action: 'published',
      previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
      note: 'Changes are now live.',
    };
  });

  // ============================================================================
  // discard_draft - Discard all draft changes
  // ============================================================================

  registerProposalExecutor('discard_draft', async (tenantId, payload) => {
    // P0: Validate payload (empty object expected)
    const validationResult = DiscardDraftPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Get the current draft status
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        landingPageConfigDraft: true,
        slug: true,
      },
    });

    if (!tenant) {
      throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
    }

    if (!tenant.landingPageConfigDraft) {
      throw new ValidationError('No draft changes to discard.');
    }

    // Clear the draft
    // Note: Use Prisma.DbNull for explicit null in JSON fields (Prisma 7 breaking change)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfigDraft: Prisma.DbNull, // Prisma 7 pattern for clearing JSON field
      },
    });

    logger.info({ tenantId }, 'Draft discarded via Build Mode');

    // Phase 1.4: After discard, draft is cleared so return empty config
    return {
      success: true,
      updatedConfig: { pages: {} } as unknown as LandingPageConfig,
      message: 'Draft discarded successfully. Showing live version.',
      action: 'discarded',
      previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
      note: 'Draft changes have been discarded. Showing live version.',
    };
  });

  logger.info('Storefront Build Mode executors registered');
}
