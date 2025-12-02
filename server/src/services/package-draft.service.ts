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
    return this.repository.updateDraft(tenantId, packageId, draft);
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

    // Invalidate catalog cache after publishing
    await this.invalidateCatalogCache(tenantId);

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
    const discarded = await this.repository.discardDrafts(tenantId, packageIds);
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

  /**
   * Invalidate catalog cache after publishing
   * @private
   */
  private async invalidateCatalogCache(tenantId: string): Promise<void> {
    await invalidateCacheKeys(this.cache, getCatalogInvalidationKeys(tenantId));
  }
}
