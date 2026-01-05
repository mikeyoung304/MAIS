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
 */

import type { PrismaClient, Prisma } from '../../generated/prisma';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import { ResourceNotFoundError, ValidationError } from '../errors/index';
import { getDraftConfig, getTenantSlug } from '../tools/utils';
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
} from '../proposals/executor-schemas';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Save pages config to draft
 */
async function saveDraftConfig(
  prisma: PrismaClient,
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

    // Get current draft config
    const { pages } = await getDraftConfig(prisma, tenantId);

    // Validate page exists
    const page = pages[pageName as keyof PagesConfig];
    if (!page) {
      throw new ValidationError(`Page "${pageName}" not found`);
    }

    // Clone sections array to avoid mutation
    const newSections = [...page.sections];

    // Determine operation: append or update
    if (sectionIndex === -1 || sectionIndex >= newSections.length) {
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

    // Save to draft
    await saveDraftConfig(prisma, tenantId, updatedPages as PagesConfig);

    const slug = await getTenantSlug(prisma, tenantId);
    const resultIndex = sectionIndex === -1 ? newSections.length - 1 : sectionIndex;

    logger.info(
      { tenantId, pageName, sectionIndex: resultIndex, sectionType: sectionData.type },
      'Page section updated via Build Mode'
    );

    return {
      action: sectionIndex === -1 ? 'added' : 'updated',
      pageName,
      sectionIndex: resultIndex,
      sectionType: sectionData.type,
      previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
    };
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

    // Get current draft config
    const { pages } = await getDraftConfig(prisma, tenantId);

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

    // Save to draft
    await saveDraftConfig(prisma, tenantId, updatedPages as PagesConfig);

    const slug = await getTenantSlug(prisma, tenantId);

    logger.info(
      { tenantId, pageName, sectionIndex, sectionType: removedType },
      'Page section removed via Build Mode'
    );

    return {
      action: 'removed',
      pageName,
      sectionIndex,
      removedSectionType: removedType,
      remainingSections: newSections.length,
      previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
    };
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

    // Get current draft config
    const { pages } = await getDraftConfig(prisma, tenantId);

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

    // Save to draft
    await saveDraftConfig(prisma, tenantId, updatedPages as PagesConfig);

    const slug = await getTenantSlug(prisma, tenantId);

    logger.info(
      { tenantId, pageName, fromIndex, toIndex, sectionType: movedSection.type },
      'Page sections reordered via Build Mode'
    );

    return {
      action: 'reordered',
      pageName,
      fromIndex,
      toIndex,
      movedSectionType: movedSection.type,
      previewUrl: slug ? `/t/${slug}?preview=draft&page=${pageName}` : undefined,
    };
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

    // Get current draft config
    const { pages } = await getDraftConfig(prisma, tenantId);

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

    const slug = await getTenantSlug(prisma, tenantId);

    logger.info({ tenantId, pageName, enabled }, 'Page visibility toggled via Build Mode');

    return {
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

    // Font and logo go in branding JSON field
    let brandingUpdates: Prisma.JsonObject | undefined;
    if (fontFamily || logoUrl) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { branding: true },
      });

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

    const slug = await getTenantSlug(prisma, tenantId);

    logger.info({ tenantId, changes }, 'Storefront branding updated via Build Mode');

    return {
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
        landingPageConfig: true,
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

    // Copy draft to live config and clear draft
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: tenant.landingPageConfigDraft,
        landingPageConfigDraft: null, // Clear the draft
      },
    });

    logger.info({ tenantId }, 'Draft published to live storefront via Build Mode');

    return {
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
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfigDraft: null,
      },
    });

    logger.info({ tenantId }, 'Draft discarded via Build Mode');

    return {
      action: 'discarded',
      previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
      note: 'Draft changes have been discarded. Showing live version.',
    };
  });

  logger.info('Storefront Build Mode executors registered');
}
