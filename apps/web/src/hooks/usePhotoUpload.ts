'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

/**
 * Tier photo data structure
 */
export interface TierPhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Error response from API
 */
interface ApiErrorResponse {
  error: string;
  details?: unknown;
}

/**
 * Hook configuration
 */
interface UsePhotoUploadProps {
  tierId: string;
  initialPhotos?: TierPhoto[];
  onPhotosChange?: (photos: TierPhoto[]) => void;
}

/**
 * Upload progress state
 */
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Photo upload state and operations hook
 *
 * Handles file validation, upload progress, and photo management
 * for tier photos via the tenant-admin API proxy.
 */
export function usePhotoUpload({
  tierId,
  initialPhotos = [],
  onPhotosChange,
}: UsePhotoUploadProps) {
  const [photos, setPhotos] = useState<TierPhoto[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Constants
  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

  /**
   * Show success message temporarily
   */
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  /**
   * Update photos state and notify parent
   */
  const updatePhotos = useCallback(
    (newPhotos: TierPhoto[]) => {
      setPhotos(newPhotos);
      onPhotosChange?.(newPhotos);
    },
    [onPhotosChange]
  );

  /**
   * Validate file before upload
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return `File size exceeds maximum of 5MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
      }

      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return `Invalid file type. Allowed types: JPG, PNG, WebP`;
      }

      // Check photo count
      if (photos.length >= MAX_PHOTOS) {
        return `Maximum ${MAX_PHOTOS} photos per tier`;
      }

      return null;
    },
    [photos.length]
  );

  /**
   * Upload photo to server via Next.js API proxy
   */
  const uploadPhoto = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        // Validate file
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          setIsUploading(false);
          setUploadProgress(null);
          return;
        }

        // Create form data
        const formData = new FormData();
        formData.append('photo', file);

        // Upload via Next.js API proxy (handles auth automatically)
        const response = await fetch(`/api/tenant-admin/tiers/${tierId}/photos`, {
          method: 'POST',
          body: formData,
        });

        // Simulate progress since fetch doesn't support progress events
        setUploadProgress({ loaded: file.size, total: file.size, percentage: 100 });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response
            .json()
            .catch(() => ({ error: 'Upload failed' }));

          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in again');
          } else if (response.status === 403) {
            throw new Error('Forbidden: You do not have permission to upload photos to this tier');
          } else if (response.status === 404) {
            throw new Error('Tier not found');
          } else if (response.status === 413) {
            throw new Error('File too large (maximum 5MB)');
          } else if (response.status === 400) {
            throw new Error(errorData.error || 'Upload failed');
          } else {
            throw new Error(errorData.error || 'Upload failed');
          }
        }

        const uploadResult: TierPhoto = await response.json();
        const newPhotos = [...photos, uploadResult];
        updatePhotos(newPhotos);
        showSuccess('Photo uploaded successfully');
      } catch (err) {
        logger.error('Upload error', {
          message: err instanceof Error ? err.message : 'Unknown error',
          tierId,
          component: 'usePhotoUpload',
        });
        setError(err instanceof Error ? err.message : 'An error occurred while uploading');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [tierId, photos, validateFile, updatePhotos, showSuccess]
  );

  /**
   * Delete photo from server
   */
  const deletePhoto = useCallback(
    async (photo: TierPhoto) => {
      setIsDeleting(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/tenant-admin/tiers/${tierId}/photos/${encodeURIComponent(photo.filename)}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response
            .json()
            .catch(() => ({ error: 'Delete failed' }));

          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in again');
          } else if (response.status === 403) {
            throw new Error(
              'Forbidden: You do not have permission to delete photos from this tier'
            );
          } else if (response.status === 404) {
            throw new Error('Photo not found');
          } else {
            throw new Error(errorData.error || 'Delete failed');
          }
        }

        const newPhotos = photos.filter((p) => p.filename !== photo.filename);
        updatePhotos(newPhotos);
        showSuccess('Photo deleted successfully');
      } catch (err) {
        logger.error('Delete error', {
          message: err instanceof Error ? err.message : 'Unknown error',
          tierId,
          filename: photo.filename,
          component: 'usePhotoUpload',
        });
        setError(err instanceof Error ? err.message : 'An error occurred while deleting');
      } finally {
        setIsDeleting(false);
      }
    },
    [tierId, photos, updatePhotos, showSuccess]
  );

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear success message
   */
  const clearSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  return {
    photos,
    isUploading,
    isDeleting,
    error,
    successMessage,
    uploadProgress,
    MAX_PHOTOS,
    MAX_FILE_SIZE,
    ALLOWED_TYPES,
    ALLOWED_EXTENSIONS,
    uploadPhoto,
    deletePhoto,
    setError,
    clearError,
    clearSuccess,
    validateFile,
  };
}
