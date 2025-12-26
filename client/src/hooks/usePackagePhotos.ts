/**
 * React hook for package photo management
 *
 * Provides state management and utilities for uploading/deleting package photos
 * with loading states, error handling, and optimistic updates.
 *
 * @example
 * ```typescript
 * function PackagePhotoManager({ packageId }: { packageId: string }) {
 *   const {
 *     photos,
 *     loading,
 *     error,
 *     uploadPhoto,
 *     deletePhoto,
 *     uploading,
 *     deleting,
 *   } = usePackagePhotos(packageId);
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (!file) return;
 *
 *     await uploadPhoto(file);
 *   };
 *
 *   return (
 *     <div>
 *       {loading && <p>Loading photos...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *
 *       <input type="file" onChange={handleFileChange} disabled={uploading} />
 *
 *       <div className="photo-grid">
 *         {photos?.map((photo) => (
 *           <div key={photo.filename}>
 *             <img src={photo.url} alt={`Photo ${photo.order}`} />
 *             <button
 *               onClick={() => deletePhoto(photo.filename)}
 *               disabled={deleting === photo.filename}
 *             >
 *               {deleting === photo.filename ? 'Deleting...' : 'Delete'}
 *             </button>
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import {
  packagePhotoApi,
  photoValidation,
  type PackagePhoto,
  type PackageWithPhotos,
} from '@/lib/package-photo-api';

export interface UsePackagePhotosResult {
  /** Package data including photos array */
  package: PackageWithPhotos | null;
  /** Array of photos (shortcut to package.photos) */
  photos: PackagePhoto[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error from fetch/upload/delete operations */
  error: Error | null;
  /** Upload a new photo */
  uploadPhoto: (file: File) => Promise<PackagePhoto | null>;
  /** Delete a photo by filename */
  deletePhoto: (filename: string) => Promise<boolean>;
  /** Refetch package data */
  refetch: () => Promise<void>;
  /** Currently uploading state */
  uploading: boolean;
  /** Currently deleting filename (null if not deleting) */
  deleting: string | null;
}

/**
 * Hook for managing package photos
 *
 * @param packageId - Package ID to manage photos for
 * @param autoFetch - Whether to automatically fetch on mount (default: true)
 * @returns Package photos state and management functions
 */
export function usePackagePhotos(
  packageId: string,
  autoFetch: boolean = true
): UsePackagePhotosResult {
  const [packageData, setPackageData] = useState<PackageWithPhotos | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  /**
   * Fetch package with photos
   */
  const fetchPackage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await packagePhotoApi.getPackageWithPhotos(packageId);
      setPackageData(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  /**
   * Auto-fetch on mount
   */
  useEffect(() => {
    if (autoFetch) {
      fetchPackage();
    }
  }, [autoFetch, fetchPackage]);

  /**
   * Upload photo to package
   *
   * @param file - File to upload
   * @returns Uploaded photo metadata or null if failed
   */
  const uploadPhoto = useCallback(
    async (file: File): Promise<PackagePhoto | null> => {
      try {
        setError(null);

        // Client-side validation
        const fileError = photoValidation.validateFile(file);
        if (fileError) {
          throw new Error(fileError);
        }

        const photoCountError = photoValidation.validatePhotoCount(
          packageData?.photos?.length || 0
        );
        if (photoCountError) {
          throw new Error(photoCountError);
        }

        setUploading(true);

        // Upload to backend
        const photo = await packagePhotoApi.uploadPhoto(packageId, file);

        // Optimistic update: add photo to local state
        setPackageData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            photos: [...(prev.photos || []), photo],
          };
        });

        return photo;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [packageId, packageData?.photos?.length]
  );

  /**
   * Delete photo from package
   *
   * @param filename - Filename to delete
   * @returns True if successful, false if failed
   */
  const deletePhoto = useCallback(
    async (filename: string): Promise<boolean> => {
      try {
        setError(null);
        setDeleting(filename);

        // Delete from backend
        await packagePhotoApi.deletePhoto(packageId, filename);

        // Optimistic update: remove photo from local state
        setPackageData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            photos: (prev.photos || []).filter((p) => p.filename !== filename),
          };
        });

        return true;
      } catch (err) {
        setError(err as Error);
        return false;
      } finally {
        setDeleting(null);
      }
    },
    [packageId]
  );

  return {
    package: packageData,
    photos: packageData?.photos || [],
    loading,
    error,
    uploadPhoto,
    deletePhoto,
    refetch: fetchPackage,
    uploading,
    deleting,
  };
}

/**
 * Lightweight hook for validating files before upload
 * Use this when you only need validation without full photo management
 *
 * @example
 * ```typescript
 * function PhotoUploadButton() {
 *   const { validateFile, validatePhotoCount } = usePhotoValidation();
 *   const [currentPhotoCount, setCurrentPhotoCount] = useState(3);
 *
 *   const handleFile = (file: File) => {
 *     const fileError = validateFile(file);
 *     const countError = validatePhotoCount(currentPhotoCount);
 *
 *     if (fileError) {
 *       alert(fileError);
 *       return;
 *     }
 *     if (countError) {
 *       alert(countError);
 *       return;
 *     }
 *
 *     // Proceed with upload
 *   };
 * }
 * ```
 */
export function usePhotoValidation() {
  return {
    validateFile: photoValidation.validateFile.bind(photoValidation),
    validatePhotoCount: photoValidation.validatePhotoCount.bind(photoValidation),
    MAX_FILE_SIZE: photoValidation.MAX_FILE_SIZE,
    MAX_PHOTOS_PER_PACKAGE: photoValidation.MAX_PHOTOS_PER_PACKAGE,
    ALLOWED_MIME_TYPES: photoValidation.ALLOWED_MIME_TYPES,
  };
}
