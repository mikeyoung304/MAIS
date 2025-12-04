/**
 * BACKWARD COMPATIBILITY WRAPPER
 *
 * This file has been refactored into smaller, focused components.
 * New location: client/src/features/photos/
 *
 * This wrapper maintains backward compatibility for existing imports.
 * Please update your imports to use the new location:
 *
 * Old: import { PackagePhotoUploader } from "@/components/PackagePhotoUploader"
 * New: import { PhotoUploader } from "@/features/photos"
 */

export { PhotoUploader as PackagePhotoUploader } from '@/features/photos/PhotoUploader';
export type { PackagePhoto } from '@/features/photos/hooks/usePhotoUpload';
export type { PhotoUploaderProps as PackagePhotoUploaderProps } from '@/features/photos/PhotoUploader';
