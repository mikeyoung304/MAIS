/**
 * Package Draft Service - Visual Editor Draft Management
 *
 * Manages draft state for packages in the visual editor.
 * Supports autosave, publish all, and discard all workflows.
 *
 * Key Concepts:
 * - Autosave: Changes save to draft fields (1s debounce on client)
 * - Publish: Applies all drafts to live fields atomically
 * - Discard: Clears all draft fields (with confirmation on client)
 * - Draft Count: Number of packages with hasDraft=true
 */

import type {
  CatalogRepository,
  PackageWithDraft,
  UpdatePackageDraftInput,
  CacheServicePort,
} from '../lib/ports';
import type { Package } from '../lib/entities';
import { NotFoundError } from '../lib/errors';
import { invalidateCacheKeys, getCatalogInvalidationKeys } from '../lib/cache-helpers';
import { logger } from '../lib/core/logger';

export class PackageDraftService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly cache?: CacheServicePort
  ) {}

  /**
   * Get all packages with draft fields for the visual editor
   *
   * Returns packages with both live and draft values so the editor
   * can display drafts while showing indicators for changed fields.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of packages with draft fields
   */
  async getAllPackagesWithDrafts(tenantId: string): Promise<PackageWithDraft[]> {
    return this.repository.getAllPackagesWithDrafts(tenantId);
  }

  /**
   * Save a draft for a package (autosave target)
   *
   * Called by the visual editor on field blur with 1s debounce.
   * Only updates the draft fields, not live values.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param packageId - Package ID to update
   * @param draft - Draft field values to save
   * @returns Updated package with draft fields
   * @throws NotFoundError if package doesn't exist for this tenant
   */
  async saveDraft(
    tenantId: string,
    packageId: string,
    draft: UpdatePackageDraftInput
  ): Promise<PackageWithDraft> {
    // Verify package exists and belongs to tenant
    const existing = await this.repository.getPackageById(tenantId, packageId);
    if (!existing) {
      throw new NotFoundError(`Package with id "${packageId}" not found`);
    }

    // Update draft fields
    const result = await this.repository.updateDraft(tenantId, packageId, draft);

    // Audit log for draft save
    logger.info({
      action: 'package_draft_saved',
      tenantId,
      packageId,
      packageSlug: existing.slug,
      changedFields: Object.keys(draft).filter(k => draft[k as keyof UpdatePackageDraftInput] !== undefined),
    }, 'Package draft saved');

    return result;
  }

  /**
   * Publish all drafts to live values
   *
   * Applies draft values to live fields for all packages with hasDraft=true.
   * Uses transaction for atomicity - all or nothing.
   * Clears draft fields after applying.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param packageIds - Optional: specific packages to publish (default: all with drafts)
   * @returns Array of published packages with updated live values
   */
  async publishDrafts(
    tenantId: string,
    packageIds?: string[]
  ): Promise<{ published: number; packages: Package[] }> {
    const packages = await this.repository.publishDrafts(tenantId, packageIds);

    // Targeted cache invalidation - only invalidate affected packages
    // Invalidate each published package's cache individually (no thundering herd)
    const invalidationKeys = packages.map(pkg =>
      getCatalogInvalidationKeys(tenantId, pkg.slug)[0]
    );
    await invalidateCacheKeys(this.cache, invalidationKeys);

    // Audit log for publish operation
    logger.info({
      action: 'package_drafts_published',
      tenantId,
      publishedCount: packages.length,
      packageIds: packages.map(p => p.id),
      packageSlugs: packages.map(p => p.slug),
    }, `Published ${packages.length} package draft(s)`);

    return {
      published: packages.length,
      packages,
    };
  }

  /**
   * Discard all drafts without publishing
   *
   * Clears all draft fields for packages with hasDraft=true.
   * Used when tenant wants to abandon changes and revert to live values.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param packageIds - Optional: specific packages to discard (default: all with drafts)
   * @returns Number of packages that had drafts discarded
   */
  async discardDrafts(
    tenantId: string,
    packageIds?: string[]
  ): Promise<{ discarded: number }> {
    // Log BEFORE discard to capture what will be lost
    const draftCount = await this.repository.countDrafts(tenantId);

    const discarded = await this.repository.discardDrafts(tenantId, packageIds);

    // Audit log for discard operation
    logger.info({
      action: 'package_drafts_discarded',
      tenantId,
      discardedCount: discarded,
      requestedPackageIds: packageIds ?? 'all',
      previousDraftCount: draftCount,
    }, `Discarded ${discarded} package draft(s)`);

    return { discarded };
  }

  /**
   * Count packages with unpublished drafts
   *
   * Used by the visual editor to show "X packages with changes" indicator.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Number of packages with hasDraft=true
   */
  async countDrafts(tenantId: string): Promise<number> {
    return this.repository.countDrafts(tenantId);
  }
}
