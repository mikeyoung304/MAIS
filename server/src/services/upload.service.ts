/**
 * File Upload Service (Backward Compatibility Wrapper)
 *
 * TODO 065: This singleton pattern breaks the DI pattern.
 * DO NOT USE THIS MODULE IN NEW CODE.
 *
 * Instead, access storageProvider from the DI container:
 * ```typescript
 * import { container } from '../di';
 * const storageProvider = container.storageProvider;
 * ```
 *
 * This module is kept ONLY for backward compatibility with existing routes
 * that import uploadService directly. It will be removed once all routes
 * are updated to use dependency injection.
 *
 * @deprecated Use container.storageProvider from DI container instead
 */

import path from 'path';
import { UploadAdapter, type UploadAdapterConfig } from '../adapters/upload.adapter';
import { NodeFileSystemAdapter } from '../adapters/filesystem.adapter';
import type { StorageProvider, UploadedFile, UploadResult } from '../lib/ports';

// Re-export types for backward compatibility
export type { UploadedFile, UploadResult } from '../lib/ports';

// Re-export concurrency helpers for backward compatibility
export { checkUploadConcurrency, releaseUploadConcurrency } from '../adapters/upload.adapter';

/**
 * Create upload adapter configuration from environment
 * @deprecated Configuration should be done in di.ts
 */
function createUploadConfig(): UploadAdapterConfig {
  // Use Supabase storage only when:
  // 1. ADAPTERS_PRESET=real AND SUPABASE_URL is configured, OR
  // 2. STORAGE_MODE=supabase is explicitly set
  // This allows integration tests to use real DB with local storage by not setting STORAGE_MODE
  const isRealMode = process.env.STORAGE_MODE === 'supabase' ||
    (process.env.ADAPTERS_PRESET === 'real' && !!process.env.SUPABASE_URL && process.env.STORAGE_MODE !== 'local');

  let supabaseClient;
  if (isRealMode) {
    // Dynamic import to avoid requiring Supabase config in mock mode
    try {
      const { getSupabaseClient } = require('../config/database');
      supabaseClient = getSupabaseClient();
    } catch (error) {
      // Supabase not configured - will use local storage
    }
  }

  return {
    logoUploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'logos'),
    packagePhotoUploadDir: path.join(process.cwd(), 'uploads', 'packages'),
    segmentImageUploadDir: path.join(process.cwd(), 'uploads', 'segments'),
    maxFileSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2', 10),
    maxPackagePhotoSizeMB: 5, // 5MB for package photos and segment images
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/svg+xml',
      'image/webp',
    ],
    baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
    isRealMode,
    supabaseClient,
  };
}

/**
 * Legacy UploadService class for backward compatibility
 * @deprecated Use container.storageProvider (UploadAdapter) with dependency injection instead
 */
export class UploadService implements StorageProvider {
  private adapter: UploadAdapter;

  constructor() {
    const config = createUploadConfig();
    const fileSystem = new NodeFileSystemAdapter();
    this.adapter = new UploadAdapter(config, fileSystem);
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    return this.adapter.uploadLogo(file, tenantId);
  }

  async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string): Promise<UploadResult> {
    return this.adapter.uploadPackagePhoto(file, packageId, tenantId);
  }

  async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    return this.adapter.uploadSegmentImage(file, tenantId);
  }

  async deleteLogo(filename: string): Promise<void> {
    return this.adapter.deleteLogo(filename);
  }

  async deletePackagePhoto(filename: string): Promise<void> {
    return this.adapter.deletePackagePhoto(filename);
  }

  async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
    return this.adapter.deleteSegmentImage(url, tenantId);
  }

  getLogoUploadDir(): string {
    return this.adapter.getLogoUploadDir();
  }

  getPackagePhotoUploadDir(): string {
    return this.adapter.getPackagePhotoUploadDir();
  }

  getSegmentImageUploadDir(): string {
    return this.adapter.getSegmentImageUploadDir();
  }
}

/**
 * Singleton instance for backward compatibility
 * @deprecated Import container.storageProvider from DI instead
 *
 * This will be removed once all routes are updated to receive
 * storageProvider via dependency injection.
 */
export const uploadService = new UploadService();
