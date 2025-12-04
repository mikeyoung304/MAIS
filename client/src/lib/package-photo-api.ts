/**
 * Package Photo Upload API Service
 *
 * Handles authenticated photo upload requests to the backend for package management.
 * Supports multipart/form-data uploads with proper error handling and type safety.
 *
 * @example
 * ```typescript
 * import { packagePhotoApi } from '@/lib/package-photo-api';
 *
 * // Upload a photo
 * const photo = await packagePhotoApi.uploadPhoto('pkg_123', file);
 * console.log(photo.url); // "http://localhost:3001/uploads/packages/package-1234567890-abc123.jpg"
 *
 * // Delete a photo
 * await packagePhotoApi.deletePhoto('pkg_123', 'package-1234567890-abc123.jpg');
 *
 * // Get package with photos
 * const pkg = await packagePhotoApi.getPackageWithPhotos('pkg_123');
 * console.log(pkg.photos); // Array of PackagePhoto objects
 * ```
 */

import { baseUrl } from './api';
import { ApiError } from './api-helpers';
import { getAuthToken } from './auth';

/**
 * Package Photo structure
 * Matches backend PackagePhoto schema
 */
export interface PackagePhoto {
  /** Public URL to access the photo */
  url: string;
  /** Unique filename on server (used for deletion) */
  filename: string;
  /** File size in bytes */
  size: number;
  /** Display order (0-4, max 5 photos per package) */
  order: number;
}

/**
 * Package response with photos
 * Extended from PackageResponseDto with photos array
 */
export interface PackageWithPhotos {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  photos?: PackagePhoto[];
}

/**
 * Error response structure from backend
 */
interface ErrorResponse {
  error: string;
  details?: unknown;
}

/**
 * Map HTTP status codes to user-friendly error messages
 * @param status - HTTP status code
 * @param defaultMessage - Default error message if no specific mapping exists
 * @returns User-friendly error message
 */
function getErrorMessage(status: number, defaultMessage: string): string {
  const errorMessages: Record<number, string> = {
    401: 'Authentication required. Please log in again.',
    403: "You don't have permission to perform this action.",
    404: 'Package not found.',
    413: 'File too large (maximum 5MB allowed).',
    400: defaultMessage,
  };

  return errorMessages[status] || defaultMessage;
}

/**
 * Handle API error responses
 * Parses error response and throws ApiError with appropriate message
 *
 * @param response - Fetch Response object
 * @throws {ApiError} With parsed error message and status code
 */
async function handleErrorResponse(response: Response): Promise<never> {
  let errorMessage = 'An unexpected error occurred';

  try {
    const errorData: ErrorResponse = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    // If JSON parsing fails, use default message
  }

  // Map to user-friendly message
  const userMessage = getErrorMessage(response.status, errorMessage);

  throw new ApiError(userMessage, response.status, errorMessage);
}

/**
 * Package Photo API Service
 * Provides methods for uploading, deleting, and retrieving package photos
 */
export const packagePhotoApi = {
  /**
   * Upload a photo to a package
   *
   * Maximum file size: 5MB
   * Maximum photos per package: 5
   * Allowed formats: JPG, PNG, WebP, SVG
   *
   * @param packageId - Package ID to upload photo for
   * @param file - File object from input[type="file"]
   * @returns Uploaded photo metadata including URL
   * @throws {ApiError} If upload fails (authentication, file size, format, etc.)
   *
   * @example
   * ```typescript
   * const fileInput = document.querySelector('input[type="file"]');
   * const file = fileInput.files[0];
   *
   * try {
   *   const photo = await packagePhotoApi.uploadPhoto('pkg_123', file);
   *   console.log('Uploaded:', photo.url);
   * } catch (error) {
   *   if (error instanceof ApiError) {
   *     console.error('Upload failed:', error.message);
   *     // error.statusCode: 413 (file too large)
   *     // error.message: "File too large (maximum 5MB allowed)"
   *   }
   * }
   * ```
   */
  async uploadPhoto(packageId: string, file: File): Promise<PackagePhoto> {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    // Create FormData and append file
    // IMPORTANT: Field name must be 'photo' to match backend multer config
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`, {
        method: 'POST',
        headers: {
          // DO NOT set Content-Type header - browser sets it automatically
          // with correct boundary for multipart/form-data
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        return handleErrorResponse(response);
      }

      const photo: PackagePhoto = await response.json();
      return photo;
    } catch (error) {
      // Network errors, JSON parsing errors, etc.
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error: Unable to upload photo', undefined, String(error));
    }
  },

  /**
   * Delete a photo from a package
   *
   * @param packageId - Package ID containing the photo
   * @param filename - Filename to delete (from PackagePhoto.filename)
   * @throws {ApiError} If deletion fails
   *
   * @example
   * ```typescript
   * try {
   *   await packagePhotoApi.deletePhoto('pkg_123', 'package-1234567890-abc123.jpg');
   *   console.log('Photo deleted successfully');
   * } catch (error) {
   *   if (error instanceof ApiError && error.statusCode === 404) {
   *     console.error('Photo not found');
   *   }
   * }
   * ```
   */
  async deletePhoto(packageId: string, filename: string): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    try {
      const response = await fetch(
        `${baseUrl}/v1/tenant-admin/packages/${packageId}/photos/${filename}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return handleErrorResponse(response);
      }

      // 204 No Content - success
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error: Unable to delete photo', undefined, String(error));
    }
  },

  /**
   * Get package details including photos array
   *
   * @param packageId - Package ID to retrieve
   * @returns Package with photos array
   * @throws {ApiError} If package not found or authentication fails
   *
   * @example
   * ```typescript
   * const pkg = await packagePhotoApi.getPackageWithPhotos('pkg_123');
   * console.log(`Package has ${pkg.photos?.length || 0} photos`);
   *
   * pkg.photos?.forEach(photo => {
   *   console.log(`Photo ${photo.order}: ${photo.url}`);
   * });
   * ```
   */
  async getPackageWithPhotos(packageId: string): Promise<PackageWithPhotos> {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    try {
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return handleErrorResponse(response);
      }

      const pkg: PackageWithPhotos = await response.json();
      return pkg;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error: Unable to fetch package', undefined, String(error));
    }
  },

  /**
   * Get all packages for tenant (with photos)
   *
   * @returns Array of packages with photos
   * @throws {ApiError} If authentication fails
   *
   * @example
   * ```typescript
   * const packages = await packagePhotoApi.getAllPackages();
   * packages.forEach(pkg => {
   *   console.log(`${pkg.title}: ${pkg.photos?.length || 0} photos`);
   * });
   * ```
   */
  async getAllPackages(): Promise<PackageWithPhotos[]> {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    try {
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return handleErrorResponse(response);
      }

      const packages: PackageWithPhotos[] = await response.json();
      return packages;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error: Unable to fetch packages', undefined, String(error));
    }
  },
};

/**
 * Validation utilities for client-side file validation
 * Run these before calling uploadPhoto to provide immediate feedback
 */
export const photoValidation = {
  /** Maximum file size in bytes (5MB) */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /** Maximum number of photos per package */
  MAX_PHOTOS_PER_PACKAGE: 5,

  /** Allowed MIME types */
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ] as const,

  /**
   * Validate file before upload
   * @param file - File to validate
   * @returns Error message if invalid, null if valid
   *
   * @example
   * ```typescript
   * const error = photoValidation.validateFile(file);
   * if (error) {
   *   alert(error);
   *   return;
   * }
   * await packagePhotoApi.uploadPhoto(packageId, file);
   * ```
   */
  validateFile(file: File): string | null {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `File too large (${sizeMB}MB). Maximum size is 5MB.`;
    }

    // Check MIME type - type assertion is safe because we're checking against known MIME types
    if (!this.ALLOWED_MIME_TYPES.includes(file.type as (typeof this.ALLOWED_MIME_TYPES)[number])) {
      return `Invalid file type (${file.type}). Allowed types: JPG, PNG, WebP, SVG.`;
    }

    return null;
  },

  /**
   * Validate photo count
   * @param currentPhotoCount - Current number of photos in package
   * @returns Error message if at max, null if can add more
   */
  validatePhotoCount(currentPhotoCount: number): string | null {
    if (currentPhotoCount >= this.MAX_PHOTOS_PER_PACKAGE) {
      return `Maximum ${this.MAX_PHOTOS_PER_PACKAGE} photos per package. Please delete a photo first.`;
    }
    return null;
  },
};
