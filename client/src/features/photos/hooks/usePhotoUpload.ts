import { useState } from 'react';
import { baseUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Package photo data structure
 */
export interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Photo upload result from API
 */
interface UploadResult {
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
  packageId: string;
  tenantToken?: string;
  initialPhotos?: PackagePhoto[];
  onPhotosChange?: (photos: PackagePhoto[]) => void;
}

/**
 * Photo upload state and operations hook
 */
export function usePhotoUpload({
  packageId,
  tenantToken,
  initialPhotos = [],
  onPhotosChange,
}: UsePhotoUploadProps) {
  const [photos, setPhotos] = useState<PackagePhoto[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Constants
  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

  /**
   * Show success message temporarily
   */
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  /**
   * Update photos state and notify parent
   */
  const updatePhotos = (newPhotos: PackagePhoto[]) => {
    setPhotos(newPhotos);
    if (onPhotosChange) {
      onPhotosChange(newPhotos);
    }
  };

  /**
   * Validate file before upload
   */
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum of 5MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed types: JPG, PNG, WebP, SVG`;
    }

    return null;
  };

  /**
   * Upload photo to server
   */
  const uploadPhoto = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsUploading(false);
        return;
      }

      // Check photo count
      if (photos.length >= MAX_PHOTOS) {
        setError(`Maximum ${MAX_PHOTOS} photos per package`);
        setIsUploading(false);
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('photo', file);

      // Get token from prop or localStorage (handles impersonation)
      const token = getAuthToken(tenantToken);
      if (!token) {
        throw new Error('Authentication required');
      }

      // Upload to API
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response
          .json()
          .catch(() => ({ error: 'Upload failed' }));

        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to upload photos to this package');
        } else if (response.status === 404) {
          throw new Error('Package not found');
        } else if (response.status === 413) {
          throw new Error('File too large (maximum 5MB)');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Upload failed');
        } else {
          throw new Error(errorData.error || 'Upload failed');
        }
      }

      const uploadResult: UploadResult = await response.json();
      const newPhotos = [...photos, uploadResult];
      updatePhotos(newPhotos);
      showSuccess('Photo uploaded successfully');
    } catch (err) {
      logger.error('Upload error', { error: err, packageId, component: 'usePhotoUpload' });
      setError(err instanceof Error ? err.message : 'An error occurred while uploading');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete photo from server
   */
  const deletePhoto = async (photo: PackagePhoto) => {
    setIsDeleting(true);
    setError(null);

    try {
      const token = getAuthToken(tenantToken);
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${baseUrl}/v1/tenant-admin/packages/${packageId}/photos/${photo.filename}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
            'Forbidden: You do not have permission to delete photos from this package'
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
        error: err,
        packageId,
        filename: photo.filename,
        component: 'usePhotoUpload',
      });
      setError(err instanceof Error ? err.message : 'An error occurred while deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    photos,
    isUploading,
    isDeleting,
    error,
    successMessage,
    MAX_PHOTOS,
    ALLOWED_TYPES,
    uploadPhoto,
    deletePhoto,
    setError,
  };
}
