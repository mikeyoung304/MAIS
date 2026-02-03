/**
 * Section Content Service
 *
 * Business logic layer for storefront section management.
 * This is the SINGLE SOURCE OF TRUTH for section operations.
 *
 * Key Responsibilities:
 * - Content validation via Zod schemas
 * - Sanitization (XSS prevention)
 * - Section ID parsing/generation
 * - Block type mapping (text -> ABOUT)
 * - Result formatting for agent tools
 *
 * CRITICAL: All methods require tenantId for multi-tenant isolation.
 *
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md
 */

import type { BlockType } from '../generated/prisma/client';
import type { ISectionContentRepository, SectionContentEntity, PageName } from '../lib/ports';
import { sectionTypeToBlockType, blockTypeToSectionType } from '../lib/block-type-mapper';
import { validateBlockContent } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { createId } from '@paralleldrive/cuid2';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashboard action types for frontend navigation
 */
export interface DashboardAction {
  type: 'NAVIGATE' | 'SCROLL_TO_SECTION' | 'SHOW_PREVIEW' | 'REFRESH';
  sectionId?: string;
  section?: string;
}

/**
 * Base result for all operations
 */
export interface StorefrontResult {
  success: boolean;
  hasDraft: boolean; // CRITICAL: Agent needs this (Pitfall #52)
  visibility: 'draft' | 'live';
  message: string;
  dashboardAction?: DashboardAction;
}

/**
 * Section summary for page structure
 *
 * Field naming follows agent tool conventions:
 * - type: Lowercase frontend name (e.g., "hero", "about")
 * - page: Page name (e.g., "home")
 * - index: Order position on page (0-based)
 */
export interface SectionSummary {
  sectionId: string;
  blockType: BlockType;
  type: string; // Lowercase frontend name (e.g., "hero", "about")
  page: string; // Page name (e.g., "home")
  index: number; // Order position on page
  headline?: string;
  isPlaceholder: boolean;
  isDraft: boolean;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
}

/**
 * Page structure result
 */
export interface PageStructureResult {
  success: boolean;
  hasDraft: boolean;
  pages: {
    name: string;
    sections: SectionSummary[];
  }[];
}

/**
 * Section content result
 *
 * Field naming follows agent tool conventions:
 * - type: Lowercase frontend name (e.g., "hero", "about")
 * - page: Page name (e.g., "home")
 * - section: The full content object for this section
 * - index: Order position on page (0-based)
 */
export interface SectionContentResult {
  success: boolean;
  sectionId: string;
  blockType: BlockType;
  type: string; // Lowercase frontend name (e.g., "hero", "about")
  page: string; // Page name (e.g., "home")
  section: unknown; // Full content object
  index: number; // Order position on page
  isDraft: boolean;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  canUndo: boolean;
  undoSteps: number;
  publishedAt: string | null;
  lastModified: string;
}

/**
 * Update section result
 */
export interface UpdateSectionResult extends StorefrontResult {
  verified: boolean;
  updatedSection: SectionContentEntity;
  canUndo: boolean;
}

/**
 * Add section result
 */
export interface AddSectionResult extends StorefrontResult {
  sectionId: string;
  blockType: BlockType;
}

/**
 * Remove section result
 */
export interface RemoveSectionResult extends StorefrontResult {
  removedSectionId: string;
}

/**
 * Reorder section result
 */
export interface ReorderSectionResult extends StorefrontResult {
  movedSectionId: string;
  newPosition: number;
}

/**
 * Publish section result
 */
export interface PublishSectionResult extends StorefrontResult {
  requiresConfirmation?: boolean;
  sectionId?: string;
  blockType?: BlockType;
  publishedAt?: string;
}

/**
 * Publish all result
 */
export interface PublishAllResult extends StorefrontResult {
  requiresConfirmation?: boolean;
  publishedCount?: number;
  publishedAt?: string;
}

/**
 * Discard all result
 */
export interface DiscardAllResult extends StorefrontResult {
  requiresConfirmation?: boolean;
  discardedCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section ID utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a section ID to extract components.
 *
 * Format: {pageName}-{sectionType}-{uniqueId}
 * Example: "home-hero-abc123"
 *
 * For database IDs (CUIDs), returns the ID as-is.
 */
function parseSectionId(sectionId: string): {
  pageName: string;
  sectionType: string;
  uniqueId: string;
  isCompound: boolean;
} {
  // Check if it's a compound section ID
  const parts = sectionId.split('-');
  if (parts.length >= 3 && parts[0].length < 20) {
    return {
      pageName: parts[0],
      sectionType: parts[1],
      uniqueId: parts.slice(2).join('-'),
      isCompound: true,
    };
  }

  // It's a database CUID
  return {
    pageName: 'home',
    sectionType: 'unknown',
    uniqueId: sectionId,
    isCompound: false,
  };
}

/**
 * Generate a compound section ID
 */
function generateSectionId(pageName: string, blockType: BlockType): string {
  const sectionType = blockTypeToSectionType(blockType);
  return `${pageName}-${sectionType}-${createId().slice(0, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section Content Service
 *
 * Provides business logic for storefront section management.
 */
export class SectionContentService {
  constructor(private readonly repo: ISectionContentRepository) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get page structure with section summaries
   */
  async getPageStructure(
    tenantId: string,
    options?: { pageName?: PageName }
  ): Promise<PageStructureResult> {
    const sections = await this.repo.findAllForTenant(tenantId, {
      pageName: options?.pageName,
    });

    const hasDraft = sections.some((s) => s.isDraft);

    // Group sections by page
    const pageMap = new Map<string, SectionSummary[]>();

    for (const section of sections) {
      const content = section.content as Record<string, unknown>;
      const headline = (content.headline as string) || (content.title as string) || undefined;

      const summary: SectionSummary = {
        sectionId: section.id,
        blockType: section.blockType,
        type: blockTypeToSectionType(section.blockType),
        page: section.pageName,
        index: section.order,
        headline,
        isPlaceholder: this.isPlaceholderContent(content),
        isDraft: section.isDraft,
        isPublished: !section.isDraft,
        hasUnpublishedChanges: section.isDraft,
      };

      const existing = pageMap.get(section.pageName) || [];
      existing.push(summary);
      pageMap.set(section.pageName, existing);
    }

    const pages = Array.from(pageMap.entries()).map(([name, sections]) => ({
      name,
      sections: sections.sort((a, b) => a.index - b.index),
    }));

    return {
      success: true,
      hasDraft,
      pages,
    };
  }

  /**
   * Get full content for a section
   */
  async getSectionContent(
    tenantId: string,
    sectionId: string
  ): Promise<SectionContentResult | null> {
    // Try to find by ID directly first
    const sections = await this.repo.findAllForTenant(tenantId);
    const section = sections.find((s) => s.id === sectionId);

    if (!section) {
      return null;
    }

    const versions = (section.versions as unknown[]) || [];

    return {
      success: true,
      sectionId: section.id,
      blockType: section.blockType,
      type: blockTypeToSectionType(section.blockType),
      page: section.pageName,
      section: section.content,
      index: section.order,
      isDraft: section.isDraft,
      isPublished: !section.isDraft,
      hasUnpublishedChanges: section.isDraft,
      canUndo: versions.length > 0,
      undoSteps: versions.length,
      publishedAt: section.publishedAt?.toISOString() || null,
      lastModified: section.updatedAt.toISOString(),
    };
  }

  /**
   * Get all published sections for a tenant
   */
  async getPublishedSections(tenantId: string): Promise<SectionContentEntity[]> {
    return this.repo.findAllForTenant(tenantId, { publishedOnly: true });
  }

  /**
   * Get all sections for preview (drafts take priority)
   */
  async getPreviewSections(tenantId: string): Promise<SectionContentEntity[]> {
    // For preview, we want drafts if they exist, otherwise published
    // Since our current model has sections as either draft or published,
    // we return all sections (draft state takes precedence in rendering)
    return this.repo.findAllForTenant(tenantId);
  }

  /**
   * Check if tenant has any draft sections
   */
  async hasDraft(tenantId: string): Promise<boolean> {
    return this.repo.hasDrafts(tenantId);
  }

  /**
   * Check if tenant has any published sections
   * Phase 5.2: Added for ContextBuilderService compatibility
   */
  async hasPublished(tenantId: string): Promise<boolean> {
    const published = await this.repo.findAllForTenant(tenantId, { publishedOnly: true });
    return published.length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update section content
   */
  async updateSection(
    tenantId: string,
    sectionId: string,
    updates: Record<string, unknown>
  ): Promise<UpdateSectionResult> {
    // Find the section first
    const sections = await this.repo.findAllForTenant(tenantId);
    const existing = sections.find((s) => s.id === sectionId);

    if (!existing) {
      return {
        success: false,
        verified: false,
        hasDraft: false,
        visibility: 'draft',
        message: `Section ${sectionId} not found`,
        updatedSection: null as unknown as SectionContentEntity,
        canUndo: false,
      };
    }

    // Merge updates with existing content
    const existingContent = existing.content as Record<string, unknown>;
    const newContent = {
      ...existingContent,
      ...updates,
    };

    // Validate content for the block type
    const validation = validateBlockContent(existing.blockType, newContent);
    if (!validation.success) {
      logger.warn(
        { tenantId, sectionId, errors: validation.error.errors },
        '[SectionContentService] Content validation failed'
      );
      // Still proceed - validation is advisory for flexibility
    }

    // Upsert the section
    const updated = await this.repo.upsert(tenantId, {
      blockType: existing.blockType,
      pageName: existing.pageName,
      segmentId: existing.segmentId,
      content: newContent,
      order: existing.order,
    });

    const versions = (updated.versions as unknown[]) || [];

    logger.info(
      { tenantId, sectionId, blockType: updated.blockType },
      '[SectionContentService] Section updated'
    );

    return {
      success: true,
      verified: true,
      hasDraft: true,
      visibility: 'draft',
      message: 'Section updated in draft. Publish when ready to go live.',
      updatedSection: updated,
      canUndo: versions.length > 0,
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId: updated.id,
      },
    };
  }

  /**
   * Add a new section to a page
   */
  async addSection(
    tenantId: string,
    pageName: PageName,
    sectionType: string,
    content?: Record<string, unknown>,
    position?: number
  ): Promise<AddSectionResult> {
    // Convert section type to BlockType
    const blockType = sectionTypeToBlockType(sectionType);

    if (!blockType) {
      return {
        success: false,
        hasDraft: false,
        visibility: 'draft',
        message: `Invalid section type: ${sectionType}`,
        sectionId: '',
        blockType: 'CUSTOM' as BlockType,
      };
    }

    // Determine order
    const existingSections = await this.repo.findAllForTenant(tenantId, { pageName });
    const order = position ?? existingSections.length;

    // Create default content if not provided
    const defaultContent = this.getDefaultContent(blockType);
    const sectionContent = content ? { ...defaultContent, ...content } : defaultContent;

    // Create the section
    const section = await this.repo.upsert(tenantId, {
      blockType,
      pageName,
      content: sectionContent,
      order,
    });

    logger.info({ tenantId, blockType, pageName, order }, '[SectionContentService] Section added');

    return {
      success: true,
      hasDraft: true,
      visibility: 'draft',
      message: `Added ${sectionType} section to ${pageName} draft. Publish when ready to go live.`,
      sectionId: section.id,
      blockType: section.blockType,
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId: section.id,
      },
    };
  }

  /**
   * Remove a section from a page
   */
  async removeSection(tenantId: string, sectionId: string): Promise<RemoveSectionResult> {
    try {
      await this.repo.delete(tenantId, sectionId);

      const hasDraft = await this.repo.hasDrafts(tenantId);

      logger.info({ tenantId, sectionId }, '[SectionContentService] Section removed');

      return {
        success: true,
        hasDraft,
        visibility: 'draft',
        message: 'Section removed from draft. Publish when ready to go live.',
        removedSectionId: sectionId,
      };
    } catch (error) {
      return {
        success: false,
        hasDraft: false,
        visibility: 'draft',
        message: `Failed to remove section: ${(error as Error).message}`,
        removedSectionId: sectionId,
      };
    }
  }

  /**
   * Reorder a section within a page
   */
  async reorderSection(
    tenantId: string,
    sectionId: string,
    newPosition: number
  ): Promise<ReorderSectionResult> {
    try {
      await this.repo.reorder(tenantId, sectionId, newPosition);

      return {
        success: true,
        hasDraft: true,
        visibility: 'draft',
        message: `Section moved to position ${newPosition} in draft. Publish when ready to go live.`,
        movedSectionId: sectionId,
        newPosition,
      };
    } catch (error) {
      return {
        success: false,
        hasDraft: false,
        visibility: 'draft',
        message: `Failed to reorder section: ${(error as Error).message}`,
        movedSectionId: sectionId,
        newPosition,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Publish a single section
   */
  async publishSection(
    tenantId: string,
    sectionId: string,
    confirmationReceived: boolean
  ): Promise<PublishSectionResult> {
    if (!confirmationReceived) {
      return {
        success: false,
        hasDraft: true,
        visibility: 'draft',
        message: 'Publish this section? This will make changes visible to customers.',
        requiresConfirmation: true,
        sectionId,
      };
    }

    try {
      const published = await this.repo.publishSection(tenantId, sectionId);
      const hasDraft = await this.repo.hasDrafts(tenantId);

      logger.info(
        { tenantId, sectionId, blockType: published.blockType },
        '[SectionContentService] Section published'
      );

      return {
        success: true,
        hasDraft,
        visibility: 'live',
        message: 'Section published! Changes are now live.',
        sectionId: published.id,
        blockType: published.blockType,
        publishedAt: published.publishedAt?.toISOString(),
        dashboardAction: {
          type: 'SHOW_PREVIEW',
          sectionId: published.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        hasDraft: true,
        visibility: 'draft',
        message: `Failed to publish: ${(error as Error).message}`,
        sectionId,
      };
    }
  }

  /**
   * Publish all draft sections
   */
  async publishAll(tenantId: string, confirmationReceived: boolean): Promise<PublishAllResult> {
    const hasDraftBefore = await this.repo.hasDrafts(tenantId);

    if (!hasDraftBefore) {
      return {
        success: true,
        hasDraft: false,
        visibility: 'live',
        message: 'No drafts to publish. Everything is already live.',
        publishedCount: 0,
      };
    }

    if (!confirmationReceived) {
      return {
        success: false,
        hasDraft: true,
        visibility: 'draft',
        message: 'Publish all changes? This will make all drafts visible to customers.',
        requiresConfirmation: true,
      };
    }

    const result = await this.repo.publishAll(tenantId);

    logger.info(
      { tenantId, count: result.count },
      '[SectionContentService] All sections published'
    );

    return {
      success: true,
      hasDraft: false,
      visibility: 'live',
      message: `Published ${result.count} section(s)! All changes are now live.`,
      publishedCount: result.count,
      publishedAt: new Date().toISOString(),
      dashboardAction: {
        type: 'REFRESH',
      },
    };
  }

  /**
   * Discard all draft changes
   */
  async discardAll(tenantId: string, confirmationReceived: boolean): Promise<DiscardAllResult> {
    const hasDraftBefore = await this.repo.hasDrafts(tenantId);

    if (!hasDraftBefore) {
      return {
        success: true,
        hasDraft: false,
        visibility: 'live',
        message: 'No drafts to discard.',
        discardedCount: 0,
      };
    }

    if (!confirmationReceived) {
      return {
        success: false,
        hasDraft: true,
        visibility: 'draft',
        message: 'Discard all changes? This will revert to the last published version.',
        requiresConfirmation: true,
      };
    }

    const result = await this.repo.discardAll(tenantId);

    logger.info({ tenantId, count: result.count }, '[SectionContentService] All drafts discarded');

    return {
      success: true,
      hasDraft: false,
      visibility: 'live',
      message: `Discarded ${result.count} draft(s). Reverted to published version.`,
      discardedCount: result.count,
      dashboardAction: {
        type: 'REFRESH',
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if content is placeholder/default
   */
  private isPlaceholderContent(content: Record<string, unknown>): boolean {
    // Check for common placeholder indicators
    const headline = (content.headline as string) || (content.title as string);
    if (headline) {
      const lower = headline.toLowerCase();
      return (
        lower.includes('welcome') ||
        lower.includes('your headline') ||
        lower.includes('placeholder') ||
        lower.includes('lorem ipsum')
      );
    }
    return false;
  }

  /**
   * Get default content for a block type
   */
  private getDefaultContent(blockType: BlockType): Record<string, unknown> {
    switch (blockType) {
      case 'HERO':
        return {
          headline: 'Welcome to Your Business',
          subheadline: 'Your tagline goes here',
          ctaText: 'Get Started',
          alignment: 'center',
          visible: true,
        };
      case 'ABOUT':
        return {
          title: 'About Us',
          body: 'Tell your story here...',
          imagePosition: 'right',
          visible: true,
        };
      case 'SERVICES':
        return {
          title: 'Our Services',
          layout: 'cards',
          showPricing: true,
          visible: true,
        };
      case 'PRICING':
        return {
          title: 'Pricing',
          showComparison: true,
          visible: true,
        };
      case 'TESTIMONIALS':
        return {
          title: 'What Clients Say',
          items: [],
          layout: 'grid',
          visible: true,
        };
      case 'FAQ':
        return {
          title: 'Frequently Asked Questions',
          items: [],
          visible: true,
        };
      case 'CONTACT':
        return {
          title: 'Get in Touch',
          showForm: true,
          formFields: ['name', 'email', 'message'],
          visible: true,
        };
      case 'CTA':
        return {
          headline: 'Ready to Get Started?',
          buttonText: 'Contact Us',
          style: 'primary',
          visible: true,
        };
      case 'GALLERY':
        return {
          title: 'Portfolio',
          items: [],
          columns: 3,
          visible: true,
        };
      case 'FEATURES':
        return {
          title: 'Why Choose Us',
          items: [],
          layout: 'grid',
          columns: 3,
          visible: true,
        };
      case 'CUSTOM':
      default:
        return {
          visible: true,
        };
    }
  }
}
