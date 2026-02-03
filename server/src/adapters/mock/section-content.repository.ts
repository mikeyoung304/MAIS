/**
 * Mock Section Content Repository
 *
 * In-memory implementation of ISectionContentRepository for testing.
 * Provides the same interface as the Prisma implementation.
 *
 * @see server/src/lib/ports.ts - ISectionContentRepository interface
 */

import type { BlockType } from '../../generated/prisma/client';
import type {
  ISectionContentRepository,
  SectionContentEntity,
  UpsertSectionInput,
  VersionEntry,
} from '../../lib/ports';
import { logger } from '../../lib/core/logger';
import { createId } from '@paralleldrive/cuid2';

/**
 * Maximum number of versions to keep in history
 */
const MAX_VERSION_HISTORY = 5;

/**
 * Mock Section Content Repository
 *
 * In-memory implementation for testing without database access.
 */
export class MockSectionContentRepository implements ISectionContentRepository {
  private sections: SectionContentEntity[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  async findById(tenantId: string, sectionId: string): Promise<SectionContentEntity | null> {
    return this.sections.find((s) => s.id === sectionId && s.tenantId === tenantId) ?? null;
  }

  async findByBlockType(
    tenantId: string,
    blockType: BlockType,
    pageName: string = 'home',
    segmentId: string | null = null
  ): Promise<SectionContentEntity | null> {
    return (
      this.sections.find(
        (s) =>
          s.tenantId === tenantId &&
          s.blockType === blockType &&
          s.pageName === pageName &&
          s.segmentId === segmentId
      ) ?? null
    );
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
    let result = this.sections.filter((s) => s.tenantId === tenantId);

    if (options?.publishedOnly) {
      result = result.filter((s) => !s.isDraft);
    } else if (options?.draftsOnly) {
      result = result.filter((s) => s.isDraft);
    }

    if (options?.pageName) {
      result = result.filter((s) => s.pageName === options.pageName);
    }

    if (options?.segmentId !== undefined) {
      result = result.filter((s) => s.segmentId === options.segmentId);
    }

    return result.sort((a, b) => a.order - b.order);
  }

  async hasDrafts(tenantId: string): Promise<boolean> {
    return this.sections.some((s) => s.tenantId === tenantId && s.isDraft);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2)
  // ─────────────────────────────────────────────────────────────────────────

  async upsert(tenantId: string, input: UpsertSectionInput): Promise<SectionContentEntity> {
    const pageName = input.pageName ?? 'home';
    const segmentId = input.segmentId ?? null;

    const existingIndex = this.sections.findIndex(
      (s) =>
        s.tenantId === tenantId &&
        s.blockType === input.blockType &&
        s.pageName === pageName &&
        s.segmentId === segmentId
    );

    if (existingIndex >= 0) {
      const existing = this.sections[existingIndex];
      const versions = this.addToVersionHistory(
        existing.versions as VersionEntry[] | null,
        existing.content,
        'Content updated'
      );

      const updated: SectionContentEntity = {
        ...existing,
        content: input.content,
        order: input.order ?? existing.order,
        isDraft: true,
        versions,
        updatedAt: new Date(),
      };

      this.sections[existingIndex] = updated;
      return updated;
    }

    const section: SectionContentEntity = {
      id: createId(),
      tenantId,
      blockType: input.blockType,
      pageName,
      segmentId,
      content: input.content,
      order: input.order ?? 0,
      isDraft: true,
      publishedAt: null,
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sections.push(section);
    return section;
  }

  async reorder(
    tenantId: string,
    sectionId: string,
    newOrder: number
  ): Promise<SectionContentEntity> {
    const index = this.sections.findIndex((s) => s.id === sectionId && s.tenantId === tenantId);

    if (index < 0) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    const updated: SectionContentEntity = {
      ...this.sections[index],
      order: newOrder,
      isDraft: true,
      updatedAt: new Date(),
    };

    this.sections[index] = updated;
    return updated;
  }

  async delete(tenantId: string, sectionId: string): Promise<void> {
    const index = this.sections.findIndex((s) => s.id === sectionId && s.tenantId === tenantId);

    if (index < 0) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    this.sections.splice(index, 1);
    logger.info({ tenantId, sectionId }, '[MockSectionContentRepo] Section deleted');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  async publishSection(tenantId: string, sectionId: string): Promise<SectionContentEntity> {
    const index = this.sections.findIndex((s) => s.id === sectionId && s.tenantId === tenantId);

    if (index < 0) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    if (!this.sections[index].isDraft) {
      return this.sections[index];
    }

    const published: SectionContentEntity = {
      ...this.sections[index],
      isDraft: false,
      publishedAt: new Date(),
      updatedAt: new Date(),
    };

    this.sections[index] = published;
    return published;
  }

  async publishAll(tenantId: string): Promise<{ count: number }> {
    let count = 0;

    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].tenantId === tenantId && this.sections[i].isDraft) {
        this.sections[i] = {
          ...this.sections[i],
          isDraft: false,
          publishedAt: new Date(),
          updatedAt: new Date(),
        };
        count++;
      }
    }

    return { count };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Discard Operations (T3)
  // ─────────────────────────────────────────────────────────────────────────

  async discardSection(tenantId: string, sectionId: string): Promise<void> {
    const index = this.sections.findIndex((s) => s.id === sectionId && s.tenantId === tenantId);

    if (index < 0) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    const versions = this.sections[index].versions as VersionEntry[] | null;

    if (!versions || versions.length === 0) {
      this.sections.splice(index, 1);
      return;
    }

    const lastVersion = versions[0];
    this.sections[index] = {
      ...this.sections[index],
      content: lastVersion.content,
      isDraft: false,
      versions: versions.slice(1),
      updatedAt: new Date(),
    };
  }

  async discardAll(tenantId: string): Promise<{ count: number }> {
    let count = 0;
    const indicesToRemove: number[] = [];

    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].tenantId === tenantId && this.sections[i].isDraft) {
        const versions = this.sections[i].versions as VersionEntry[] | null;

        if (!versions || versions.length === 0) {
          indicesToRemove.push(i);
        } else {
          const lastVersion = versions[0];
          this.sections[i] = {
            ...this.sections[i],
            content: lastVersion.content,
            isDraft: false,
            versions: versions.slice(1),
            updatedAt: new Date(),
          };
        }
        count++;
      }
    }

    // Remove in reverse order to maintain indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      this.sections.splice(indicesToRemove[i], 1);
    }

    return { count };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Version History
  // ─────────────────────────────────────────────────────────────────────────

  async getVersionHistory(tenantId: string, sectionId: string): Promise<VersionEntry[]> {
    const section = this.sections.find((s) => s.id === sectionId && s.tenantId === tenantId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    return (section.versions as VersionEntry[] | null) ?? [];
  }

  async restoreVersion(
    tenantId: string,
    sectionId: string,
    versionIndex: number
  ): Promise<SectionContentEntity> {
    const index = this.sections.findIndex((s) => s.id === sectionId && s.tenantId === tenantId);

    if (index < 0) {
      throw new Error(`Section ${sectionId} not found for tenant ${tenantId}`);
    }

    const versions = this.sections[index].versions as VersionEntry[] | null;

    if (!versions || versionIndex >= versions.length) {
      throw new Error(`Version ${versionIndex} not found for section ${sectionId}`);
    }

    const targetVersion = versions[versionIndex];
    const newVersions = this.addToVersionHistory(
      versions,
      this.sections[index].content,
      `Restored to version from ${targetVersion.timestamp}`
    );

    newVersions.splice(versionIndex + 1, 1);

    const restored: SectionContentEntity = {
      ...this.sections[index],
      content: targetVersion.content,
      isDraft: true,
      versions: newVersions,
      updatedAt: new Date(),
    };

    this.sections[index] = restored;
    return restored;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clear all sections (for test cleanup)
   */
  clear(): void {
    this.sections = [];
  }

  /**
   * Seed sections for testing
   */
  seed(sections: SectionContentEntity[]): void {
    this.sections = [...sections];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private addToVersionHistory(
    existing: VersionEntry[] | null,
    content: unknown,
    description?: string
  ): VersionEntry[] {
    const versions = existing ? [...existing] : [];

    versions.unshift({
      content,
      timestamp: new Date().toISOString(),
      description,
    });

    return versions.slice(0, MAX_VERSION_HISTORY);
  }
}
