/**
 * Section Content Repository Implementation
 *
 * Prisma-based implementation of ISectionContentRepository.
 * Handles all database operations for storefront sections.
 *
 * CRITICAL: All methods enforce tenant isolation - every query filters by tenantId.
 *
 * @see server/src/lib/ports.ts - ISectionContentRepository interface
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md
 */

import type { PrismaClient, BlockType, SectionContent } from '../../generated/prisma/client';
import type {
  ISectionContentRepository,
  SectionContentEntity,
  UpsertSectionInput,
  VersionEntry,
} from '../../lib/ports';
import { logger } from '../../lib/core/logger';

/**
 * Maximum number of versions to keep in history
 */
const MAX_VERSION_HISTORY = 5;

/**
 * Prisma Section Content Repository
 *
 * Implements section-level CRUD with:
 * - Multi-tenant isolation (tenantId on all queries)
 * - Draft/publish workflow
 * - Version history for undo (last 5 versions)
 * - Multi-page support (pageName field)
 */
export class PrismaSectionContentRepository implements ISectionContentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  async findById(tenantId: string, sectionId: string): Promise<SectionContentEntity | null> {
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    return section ? this.toEntity(section) : null;
  }

  async findByBlockType(
    tenantId: string,
    blockType: BlockType,
    pageName: string = 'home',
    segmentId: string | null = null
  ): Promise<SectionContentEntity | null> {
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        tenantId,
        blockType,
        pageName,
        segmentId: segmentId ?? null,
      },
    });

    return section ? this.toEntity(section) : null;
  }

  async findAllForTenant(
    tenantId: string,
    options?: {
      publishedOnly?: boolean;
      draftsOnly?: boolean;
      pageName?: string;
      segmentId?: string | null;
    }
  ): Promise<SectionContentEntity[]> {
    const where: {
      tenantId: string;
      isDraft?: boolean;
      pageName?: string;
      segmentId?: string | null;
    } = {
      tenantId,
    };

    if (options?.publishedOnly) {
      where.isDraft = false;
    } else if (options?.draftsOnly) {
      where.isDraft = true;
    }

    if (options?.pageName) {
      where.pageName = options.pageName;
    }

    if (options?.segmentId !== undefined) {
      where.segmentId = options.segmentId;
    }

    const sections = await this.prisma.sectionContent.findMany({
      where,
      orderBy: { order: 'asc' },
      take: 100, // Safety net: sections per tenant are bounded by page structure
    });

    return sections.map(this.toEntity);
  }

  async hasDrafts(tenantId: string): Promise<boolean> {
    const count = await this.prisma.sectionContent.count({
      where: {
        tenantId,
        isDraft: true,
      },
    });

    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2)
  // ─────────────────────────────────────────────────────────────────────────

  async upsert(tenantId: string, input: UpsertSectionInput): Promise<SectionContentEntity> {
    const pageName = input.pageName ?? 'home';
    const segmentId = input.segmentId ?? null;

    logger.debug(
      { tenantId, blockType: input.blockType, pageName },
      '[SectionContentRepo] Upserting section'
    );

    // Check if section already exists
    const existing = await this.prisma.sectionContent.findFirst({
      where: {
        tenantId,
        blockType: input.blockType,
        pageName,
        segmentId,
      },
    });

    if (existing) {
      // Update existing - save current content to version history
      const versions = this.addToVersionHistory(
        existing.versions as VersionEntry[] | null,
        existing.content,
        'Content updated'
      );

      const updated = await this.prisma.sectionContent.update({
        where: { id: existing.id },
        data: {
          content: input.content as object,
          order: input.order ?? existing.order,
          isDraft: true, // Always create draft
          versions: versions as object[],
        },
      });

      return this.toEntity(updated);
    }

    // Create new section
    const section = await this.prisma.sectionContent.create({
      data: {
        tenantId,
        blockType: input.blockType,
        pageName,
        segmentId,
        content: input.content as object,
        order: input.order ?? 0,
        isDraft: true, // Always start as draft
        versions: [],
      },
    });

    return this.toEntity(section);
  }

  async reorder(
    tenantId: string,
    sectionId: string,
    newOrder: number
  ): Promise<SectionContentEntity> {
    // Verify tenant owns the section
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    const updated = await this.prisma.sectionContent.update({
      where: { id: sectionId },
      data: {
        order: newOrder,
        isDraft: true, // Reordering creates draft
      },
    });

    return this.toEntity(updated);
  }

  async delete(tenantId: string, sectionId: string): Promise<void> {
    // Verify tenant owns the section before deleting
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    await this.prisma.sectionContent.delete({
      where: { id: sectionId },
    });

    logger.info({ tenantId, sectionId }, '[SectionContentRepo] Section deleted');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  async publishSection(tenantId: string, sectionId: string): Promise<SectionContentEntity> {
    // Verify tenant owns the section
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    if (!section.isDraft) {
      // Already published
      return this.toEntity(section);
    }

    const published = await this.prisma.sectionContent.update({
      where: { id: sectionId },
      data: {
        isDraft: false,
        publishedAt: new Date(),
      },
    });

    logger.info(
      { tenantId, sectionId, blockType: section.blockType },
      '[SectionContentRepo] Section published'
    );

    return this.toEntity(published);
  }

  async publishAll(tenantId: string): Promise<{ count: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Get all drafts for this tenant
      const drafts = await tx.sectionContent.findMany({
        where: {
          tenantId,
          isDraft: true,
        },
        take: 500, // Safety net: drafts per tenant bounded by page structure
      });

      if (drafts.length === 0) {
        return { count: 0 };
      }

      // Publish all at once
      await tx.sectionContent.updateMany({
        where: {
          tenantId,
          isDraft: true,
        },
        data: {
          isDraft: false,
          publishedAt: new Date(),
        },
      });

      return { count: drafts.length };
    });

    logger.info({ tenantId, count: result.count }, '[SectionContentRepo] All sections published');

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Discard Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  async discardSection(tenantId: string, sectionId: string): Promise<void> {
    // Verify tenant owns the section
    const section = await this.prisma.sectionContent.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    const versions = section.versions as VersionEntry[] | null;

    if (!versions || versions.length === 0) {
      // No history - this was a new section, delete it
      await this.prisma.sectionContent.delete({
        where: { id: sectionId },
      });
      logger.info({ tenantId, sectionId }, '[SectionContentRepo] New section discarded (deleted)');
      return;
    }

    // Restore the most recent version
    const lastVersion = versions[0];
    await this.prisma.sectionContent.update({
      where: { id: sectionId },
      data: {
        content: lastVersion.content as object,
        isDraft: false, // Revert to published state
        versions: versions.slice(1) as object[], // Remove the restored version
      },
    });

    logger.info({ tenantId, sectionId }, '[SectionContentRepo] Section changes discarded');
  }

  async discardAll(tenantId: string): Promise<{ count: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Get all drafts for this tenant
      const drafts = await tx.sectionContent.findMany({
        where: {
          tenantId,
          isDraft: true,
        },
        take: 500, // Safety net: drafts per tenant bounded by page structure
      });

      if (drafts.length === 0) {
        return { count: 0 };
      }

      // Separate new sections (no history) from modified sections (has history)
      const newSectionIds: string[] = [];
      const sectionsToRestore: Array<{
        id: string;
        content: object;
        versions: object[];
      }> = [];

      for (const draft of drafts) {
        const versions = draft.versions as VersionEntry[] | null;

        if (!versions || versions.length === 0) {
          newSectionIds.push(draft.id);
        } else {
          sectionsToRestore.push({
            id: draft.id,
            content: versions[0].content as object,
            versions: versions.slice(1) as object[],
          });
        }
      }

      // Bulk delete new sections (O(1) instead of O(n))
      if (newSectionIds.length > 0) {
        await tx.sectionContent.deleteMany({
          where: {
            tenantId,
            id: { in: newSectionIds },
          },
        });
      }

      // Restore modified sections - each needs different content, so use Promise.all
      // for parallelization instead of sequential loop
      if (sectionsToRestore.length > 0) {
        await Promise.all(
          sectionsToRestore.map((section) =>
            tx.sectionContent.update({
              where: { id: section.id },
              data: {
                content: section.content,
                isDraft: false,
                versions: section.versions,
              },
            })
          )
        );
      }

      return { count: drafts.length };
    });

    logger.info({ tenantId, count: result.count }, '[SectionContentRepo] All drafts discarded');

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert Prisma model to entity
   */
  private toEntity(section: SectionContent): SectionContentEntity {
    return {
      id: section.id,
      tenantId: section.tenantId,
      segmentId: section.segmentId,
      blockType: section.blockType,
      pageName: section.pageName,
      content: section.content,
      order: section.order,
      isDraft: section.isDraft,
      publishedAt: section.publishedAt,
      versions: section.versions,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }

  /**
   * Add content to version history, maintaining max size
   */
  private addToVersionHistory(
    existing: VersionEntry[] | null,
    content: unknown,
    description?: string
  ): VersionEntry[] {
    const versions = existing ? [...existing] : [];

    // Add new version at the beginning (most recent first)
    versions.unshift({
      content,
      timestamp: new Date().toISOString(),
      description,
    });

    // Keep only the last MAX_VERSION_HISTORY versions
    return versions.slice(0, MAX_VERSION_HISTORY);
  }
}
