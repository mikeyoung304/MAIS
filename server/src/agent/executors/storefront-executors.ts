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
import {
  ResourceNotFoundError,
  ValidationError,
  ConcurrentModificationError,
} from '../errors/index';
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
// Optimistic Locking Types (#620)
// ============================================================================

/**
 * Result of version-checked draft save operation
 * Used by all executors to handle concurrent modification conflicts
 */
type SaveDraftResult =
  | { success: true; newVersion: number }
  | { success: false; error: 'CONCURRENT_MODIFICATION'; currentVersion: number };

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
 * Save pages config to draft with optimistic locking (#620)
 *
 * Uses updateMany with version check to detect concurrent modifications.
 * If another tab/session modified the draft, returns CONCURRENT_MODIFICATION error.
 *
 * Advisory locks (P1-659) protect against race conditions within a single request.
 * Optimistic locking (#620) protects against conflicts across browser tabs/sessions.
 * Both protections are complementary and should be used together.
 *
 * @param tx - Prisma transaction client
 * @param tenantId - Tenant ID
 * @param pages - Updated pages configuration
 * @param expectedVersion - Version from getDraftConfigWithSlug (must match DB)
 * @returns Success with new version, or CONCURRENT_MODIFICATION error
 */
async function saveDraftConfigWithVersion(
  tx: PrismaTransactionClient,
  tenantId: string,
  pages: PagesConfig,
  expectedVersion: number
): Promise<SaveDraftResult> {
  const draftConfig: LandingPageConfig = { pages };

  // Atomic update: only succeeds if version matches expected
  // This is the core of optimistic locking - if someone else modified
  // the draft since we read it, this WHERE clause won't match
  const result = await tx.tenant.updateMany({
    where: {
      id: tenantId,
      landingPageConfigDraftVersion: expectedVersion,
    },
    data: {
      landingPageConfigDraft: draftConfig as unknown as Prisma.JsonObject,
      landingPageConfigDraftVersion: expectedVersion + 1,
    },
  });

  // If no rows updated, version mismatch - concurrent modification detected
  if (result.count === 0) {
    // Fetch current version for error reporting
    const current = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfigDraftVersion: true },
    });
    return {
      success: false,
      error: 'CONCURRENT_MODIFICATION',
      currentVersion: current?.landingPageConfigDraftVersion ?? 0,
    };
  }

  return { success: true, newVersion: expectedVersion + 1 };
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
  // #620 FIX: Uses optimistic locking to detect cross-tab conflicts
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

        // Get current draft config, slug, and version within the transaction
        const { pages, slug, version } = await getDraftConfigWithSlug(tx, tenantId);

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

        // Save to draft with version check (#620 optimistic locking)
        const saveResult = await saveDraftConfigWithVersion(
          tx,
          tenantId,
          updatedPages as PagesConfig,
          version
        );

        // Handle concurrent modification conflict
        if (!saveResult.success) {
          throw new ConcurrentModificationError(version, saveResult.currentVersion);
        }

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
            newVersion: saveResult.newVersion,
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
          version: saveResult.newVersion,
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
  // #620 FIX: Uses optimistic locking to detect cross-tab conflicts
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

        // Get current draft config, slug, and version within the transaction
        const { pages, slug, version } = await getDraftConfigWithSlug(tx, tenantId);

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

        // Save to draft with version check (#620 optimistic locking)
        const saveResult = await saveDraftConfigWithVersion(
          tx,
          tenantId,
          updatedPages as PagesConfig,
          version
        );

        // Handle concurrent modification conflict
        if (!saveResult.success) {
          throw new ConcurrentModificationError(version, saveResult.currentVersion);
        }

        // Audit logging with section ID for traceability
        logger.info(
          {
            tenantId,
            pageName,
            sectionIndex,
            sectionType: removedType,
            sectionId: removedId,
            action: 'DELETE',
            newVersion: saveResult.newVersion,
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
          version: saveResult.newVersion,
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
  // #620 FIX: Uses optimistic locking to detect cross-tab conflicts
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

        // Get current draft config, slug, and version within the transaction
        const { pages, slug, version } = await getDraftConfigWithSlug(tx, tenantId);

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

        // Save to draft with version check (#620 optimistic locking)
        const saveResult = await saveDraftConfigWithVersion(
          tx,
          tenantId,
          updatedPages as PagesConfig,
          version
        );

        // Handle concurrent modification conflict
        if (!saveResult.success) {
          throw new ConcurrentModificationError(version, saveResult.currentVersion);
        }

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
            newVersion: saveResult.newVersion,
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
          version: saveResult.newVersion,
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
  // P1-659 FIX: Uses advisory locks to prevent TOCTOU race conditions
  // #620 FIX: Uses optimistic locking to detect cross-tab conflicts
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

    // P1-659 FIX: Wrap read-validate-write in transaction with advisory lock
    // Prevents TOCTOU race condition where concurrent toggles could read stale state
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get current draft config, slug, and version within the transaction
        const { pages, slug, version } = await getDraftConfigWithSlug(tx, tenantId);

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

        // Save to draft with version check (#620 optimistic locking)
        const saveResult = await saveDraftConfigWithVersion(
          tx,
          tenantId,
          updatedPages as PagesConfig,
          version
        );

        // Handle concurrent modification conflict
        if (!saveResult.success) {
          throw new ConcurrentModificationError(version, saveResult.currentVersion);
        }

        logger.info(
          { tenantId, pageName, enabled, newVersion: saveResult.newVersion },
          'Page visibility toggled via Build Mode'
        );

        // Phase 1.4: Return updated config for optimistic frontend updates
        return {
          success: true,
          updatedConfig: { pages: updatedPages } as LandingPageConfig,
          message: `Page ${enabled ? 'enabled' : 'disabled'} successfully`,
          action: enabled ? 'enabled' : 'disabled',
          pageName,
          enabled,
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
          version: saveResult.newVersion,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // update_storefront_branding - Update brand colors, fonts, logo
  // P2-741 FIX: Now uses advisory lock (correcting previous rationale)
  // The branding JSON field DOES require read-modify-write, creating TOCTOU risk.
  // NOTE: Branding updates don't modify landingPageConfigDraft - no version check needed
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

    // P2-741 FIX: Wrap read-modify-write in transaction with advisory lock
    // Prevents TOCTOU race condition where concurrent branding updates could
    // both read the same branding JSON, merge separately, and clobber each other
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Build update data for direct tenant fields (colors)
        const tenantUpdates: Record<string, string> = {};
        if (primaryColor) tenantUpdates.primaryColor = primaryColor;
        if (secondaryColor) tenantUpdates.secondaryColor = secondaryColor;
        if (accentColor) tenantUpdates.accentColor = accentColor;
        if (backgroundColor) tenantUpdates.backgroundColor = backgroundColor;

        // Font and logo go in branding JSON field (#627 N+1 fix - combine queries)
        // Get tenant once for both branding and slug within transaction
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            branding: true,
            slug: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            backgroundColor: true,
          },
        });

        // P1-FIX: Store previous branding state for revert_branding tool
        // Only store if we're actually changing something
        const previousBranding = {
          primaryColor: tenant?.primaryColor,
          secondaryColor: tenant?.secondaryColor,
          accentColor: tenant?.accentColor,
          backgroundColor: tenant?.backgroundColor,
          fontFamily: (tenant?.branding as Record<string, unknown>)?.fontFamily,
          logoUrl: (tenant?.branding as Record<string, unknown>)?.logo,
          timestamp: Date.now(),
        };

        let brandingUpdates: Prisma.JsonObject | undefined;
        const existingBranding = (tenant?.branding as Record<string, unknown>) || {};

        // Merge previous branding history with existing history (keep last 5)
        const previousHistory = Array.isArray(existingBranding._previousBranding)
          ? (existingBranding._previousBranding as unknown[]).slice(0, 4)
          : [];

        // Always update branding JSON to include _previousBranding
        brandingUpdates = {
          ...existingBranding,
          ...(fontFamily && { fontFamily }),
          ...(logoUrl && { logo: logoUrl }),
          _previousBranding: [previousBranding, ...previousHistory],
        } as Prisma.JsonObject;

        // Apply updates within same transaction
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            ...tenantUpdates,
            branding: brandingUpdates,
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
        const { pages } = await getDraftConfigWithSlug(tx, tenantId);

        return {
          success: true,
          updatedConfig: { pages } as LandingPageConfig,
          message: 'Branding updated successfully. Say "undo" within 24h to revert.',
          action: 'updated',
          changes,
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
          canRevert: true,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // revert_branding - Undo the last branding change (T1)
  // P1-FIX: Provides undo capability for branding changes (24h window)
  // ============================================================================

  registerProposalExecutor('revert_branding', async (tenantId, _payload) => {
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get current branding with history
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { branding: true, slug: true },
        });

        const branding = (tenant?.branding as Record<string, unknown>) || {};
        const history = branding._previousBranding as Array<{
          primaryColor?: string;
          secondaryColor?: string;
          accentColor?: string;
          backgroundColor?: string;
          fontFamily?: string;
          logoUrl?: string;
          timestamp: number;
        }>;

        if (!history || history.length === 0) {
          return {
            success: false,
            error: 'No previous branding to revert to. No changes have been made.',
          };
        }

        const previous = history[0];
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

        if (Date.now() - previous.timestamp > TWENTY_FOUR_HOURS_MS) {
          return {
            success: false,
            error: 'Previous branding state has expired. Revert is only available for 24 hours.',
          };
        }

        // Build updates from previous state
        const tenantUpdates: Record<string, string | null> = {};
        if (previous.primaryColor !== undefined)
          tenantUpdates.primaryColor = previous.primaryColor ?? null;
        if (previous.secondaryColor !== undefined)
          tenantUpdates.secondaryColor = previous.secondaryColor ?? null;
        if (previous.accentColor !== undefined)
          tenantUpdates.accentColor = previous.accentColor ?? null;
        if (previous.backgroundColor !== undefined)
          tenantUpdates.backgroundColor = previous.backgroundColor ?? null;

        // Update branding JSON (font and logo) and remove reverted entry from history
        const brandingUpdates: Prisma.JsonObject = {
          ...branding,
          ...(previous.fontFamily !== undefined && { fontFamily: previous.fontFamily }),
          ...(previous.logoUrl !== undefined && { logo: previous.logoUrl }),
          _previousBranding: history.slice(1), // Remove the entry we're reverting to
        };

        // Apply updates
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            ...tenantUpdates,
            branding: brandingUpdates,
          },
        });

        const slug = tenant?.slug;
        logger.info({ tenantId }, 'Storefront branding reverted via Build Mode');

        // Fetch and return current draft config for consistency
        const { pages } = await getDraftConfigWithSlug(tx, tenantId);

        return {
          success: true,
          updatedConfig: { pages } as LandingPageConfig,
          message: 'Branding reverted to previous state.',
          action: 'reverted',
          previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // publish_draft - Publish draft changes to live storefront
  // P1-659 FIX: Uses advisory locks to prevent TOCTOU race conditions
  // #620 FIX: Resets version to 0 on publish (fresh start for next draft)
  // ============================================================================

  registerProposalExecutor('publish_draft', async (tenantId, payload) => {
    // P0: Validate payload (empty object expected)
    const validationResult = PublishDraftPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    // P1-659 FIX: Wrap read-validate-write in transaction with advisory lock
    // Prevents TOCTOU race condition where concurrent publishes could both succeed
    // or publish could race with draft modifications
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get the current draft within transaction
        const tenant = await tx.tenant.findUnique({
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
        // #620: Reset version to 0 on publish - next draft starts fresh
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            landingPageConfig: publishedWrapper as unknown as Prisma.InputJsonValue,
            landingPageConfigDraft: Prisma.DbNull, // Clear the draft (Prisma 7 pattern)
            landingPageConfigDraftVersion: 0, // Reset version for next draft cycle
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
          version: 0, // Fresh version for next draft cycle
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  // ============================================================================
  // discard_draft - Discard all draft changes
  // P1-659 FIX: Uses advisory locks to prevent TOCTOU race conditions
  // #620 FIX: Resets version to 0 on discard (fresh start for next draft)
  // ============================================================================

  registerProposalExecutor('discard_draft', async (tenantId, payload) => {
    // P0: Validate payload (empty object expected)
    const validationResult = DiscardDraftPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    // P1-659 FIX: Wrap read-validate-write in transaction with advisory lock
    // Prevents TOCTOU race condition where concurrent discards could both succeed
    // or discard could race with draft modifications
    return await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock for this tenant's storefront edits
        // Lock is automatically released when transaction commits/aborts
        const lockId = hashTenantStorefront(tenantId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Get the current draft status within transaction
        const tenant = await tx.tenant.findUnique({
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

        // Clear the draft and reset version
        // Note: Use Prisma.DbNull for explicit null in JSON fields (Prisma 7 breaking change)
        // #620: Reset version to 0 on discard - next draft starts fresh
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            landingPageConfigDraft: Prisma.DbNull, // Prisma 7 pattern for clearing JSON field
            landingPageConfigDraftVersion: 0, // Reset version for next draft cycle
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
          version: 0, // Fresh version for next draft cycle
        };
      },
      {
        timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
        isolationLevel: STOREFRONT_ISOLATION_LEVEL,
      }
    );
  });

  logger.info('Storefront Build Mode executors registered');
}
