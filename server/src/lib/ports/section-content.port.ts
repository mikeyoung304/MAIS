/**
 * Section Content Repository Port — Storefront section persistence and draft/publish workflow
 */

import type { BlockType } from '../../generated/prisma/client';

/**
 * Page names for multi-page storefront support
 */
export type PageName =
  | 'home'
  | 'about'
  | 'services'
  | 'faq'
  | 'contact'
  | 'gallery'
  | 'testimonials';

/**
 * BlockType import from Prisma (re-exported for consumers)
 */
export type { BlockType } from '../../generated/prisma/client';

/**
 * Section Content entity for repository operations
 */
export interface SectionContentEntity {
  id: string;
  tenantId: string;
  segmentId: string | null;
  blockType: BlockType;
  pageName: string;
  content: unknown; // JSON content validated by SectionContentSchema
  order: number;
  isDraft: boolean;
  publishedAt: Date | null;
  versions: unknown | null; // JSON array of version history
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for upserting section content
 */
export interface UpsertSectionInput {
  blockType: BlockType;
  pageName?: string;
  segmentId?: string | null;
  content: unknown;
  order?: number;
}

/**
 * Version history entry for undo support
 */
export interface VersionEntry {
  content: unknown;
  timestamp: string; // ISO datetime
  description?: string;
}

/**
 * Section Content Repository Port
 *
 * CRITICAL: All methods require tenantId as first parameter for multi-tenant isolation.
 *
 * This interface enables:
 * - Section-level CRUD operations
 * - Draft/publish workflow
 * - Version history for undo
 * - Multi-page storefront support
 *
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md
 */
export interface ISectionContentRepository {
  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find a section by ID
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to find
   * @returns Section or null
   */
  findById(tenantId: string, sectionId: string): Promise<SectionContentEntity | null>;

  /**
   * Find a specific section by block type
   *
   * @param tenantId - Tenant ID for isolation
   * @param blockType - Block type to find
   * @param pageName - Page name (defaults to 'home')
   * @param segmentId - Optional segment filter
   * @returns Section or null
   */
  findByBlockType(
    tenantId: string,
    blockType: BlockType,
    pageName?: string,
    segmentId?: string | null
  ): Promise<SectionContentEntity | null>;

  /**
   * Find all sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @param options - Filter options
   * @returns Array of sections ordered by `order` field
   */
  findAllForTenant(
    tenantId: string,
    options?: {
      publishedOnly?: boolean;
      draftsOnly?: boolean;
      pageName?: string;
      segmentId?: string | null;
    }
  ): Promise<SectionContentEntity[]>;

  /**
   * Check if tenant has any draft sections
   *
   * @param tenantId - Tenant ID for isolation
   * @returns True if any drafts exist
   */
  hasDrafts(tenantId: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2 - create/update draft)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create or update a section (always creates draft)
   *
   * @param tenantId - Tenant ID for isolation
   * @param input - Section data
   * @returns Created/updated section
   */
  upsert(tenantId: string, input: UpsertSectionInput): Promise<SectionContentEntity>;

  /**
   * Update section order within a page
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to move
   * @param newOrder - New order value
   * @returns Updated section
   */
  reorder(tenantId: string, sectionId: string, newOrder: number): Promise<SectionContentEntity>;

  /**
   * Delete a section
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to delete
   */
  delete(tenantId: string, sectionId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3 - require confirmation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Publish a single section (make live)
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to publish
   * @returns Published section
   */
  publishSection(tenantId: string, sectionId: string): Promise<SectionContentEntity>;

  /**
   * Publish all draft sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Count of published sections
   */
  publishAll(tenantId: string): Promise<{ count: number }>;

  // ─────────────────────────────────────────────────────────────────────────
  // Discard Operations (T3 - require confirmation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Discard changes to a single section (revert to published)
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to discard
   */
  discardSection(tenantId: string, sectionId: string): Promise<void>;

  /**
   * Discard all draft sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Count of discarded sections
   */
  discardAll(tenantId: string): Promise<{ count: number }>;
}
