/**
 * EditableImage Component
 *
 * Simple image upload component for landing page editor.
 * Uses existing photo upload infrastructure with lazy loading optimization.
 *
 * Features:
 * - Native file input with drag-drop support
 * - Loading indicator during upload
 * - Lazy loading for preview images
 * - Aspect ratio support
 * - Change/Remove actions on hover
 *
 * Implementation: Option A from TODO-234 (Simple Input + Existing Upload)
 */

import { useState, useRef, memo } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { packagePhotoApi, photoValidation, type PackagePhoto } from '@/lib/package-photo-api';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

export interface EditableImageProps {
  /** Current image URL (if any) */
  currentUrl: string | undefined;
  /** Callback when image is uploaded successfully */
  onUpload: (url: string) => void;
  /** Callback when image is removed */
  onRemove: () => void;
  /** Aspect ratio for the container */
  aspectRatio?: 'auto' | '16/9' | '1/1' | '4/3';
  /** Placeholder text when no image */
  placeholder?: string;
  /** Disable upload/remove actions */
  disabled?: boolean;
  /** Package ID for upload endpoint */
  packageId: string;
  /** Optional CSS class name */
  className?: string;
  /** Alternative text for image (accessibility) */
  alt?: string;
}

/**
 * EditableImage Component
 *
 * @example
 * ```tsx
 * <EditableImage
 *   currentUrl={config.backgroundImageUrl}
 *   onUpload={(url) => onUpdate({ backgroundImageUrl: url })}
 *   onRemove={() => onUpdate({ backgroundImageUrl: undefined })}
 *   packageId="pkg_123"
 *   aspectRatio="16/9"
 *   placeholder="Upload hero background"
 * />
 * ```
 */
export const EditableImage = memo(function EditableImage({
  currentUrl,
  onUpload,
  onRemove,
  aspectRatio = 'auto',
  placeholder = 'Click or drag to upload image',
  disabled = false,
  packageId,
  className,
  alt = '',
}: EditableImageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert aspect ratio to CSS value
  const aspectRatioValue = {
    auto: 'auto',
    '16/9': '16 / 9',
    '1/1': '1 / 1',
    '4/3': '4 / 3',
  }[aspectRatio];

  /**
   * Handle file selection and upload
   */
  const handleFileSelect = async (file: File) => {
    setError(null);

    // Client-side validation
    const validationError = photoValidation.validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);

    try {
      // Upload using existing infrastructure
      const photo: PackagePhoto = await packagePhotoApi.uploadPhoto(packageId, file);
      onUpload(photo.url);
    } catch (err) {
      logger.error('Image upload failed', { error: err, packageId });
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to upload image. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle file input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    } else {
      setError('Please drop a valid image file');
    }
  };

  /**
   * Trigger file input click
   */
  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  /**
   * Handle remove action
   */
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isUploading) {
      onRemove();
      setError(null);
    }
  };

  return (
    <div className={cn('relative group', className)}>
      {/* Container with aspect ratio */}
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border-2 transition-colors',
          isDragging
            ? 'border-macon-orange bg-macon-orange/10'
            : currentUrl
              ? 'border-white/20'
              : 'border-dashed border-white/30 bg-white/5',
          !disabled && !isUploading && 'cursor-pointer hover:border-white/40'
        )}
        style={{ aspectRatio: aspectRatioValue }}
        onClick={currentUrl ? undefined : handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="hidden"
          aria-label="Upload image"
        />

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-medium">Uploading...</p>
            </div>
          </div>
        )}

        {/* Image preview with lazy loading */}
        {currentUrl && !isUploading ? (
          <>
            <img src={currentUrl} alt={alt} loading="lazy" className="w-full h-full object-cover" />

            {/* Hover overlay with actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
              <Button
                onClick={handleClick}
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                className="bg-white/90 hover:bg-white border-white/20"
              >
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                Change
              </Button>
              <Button
                onClick={handleRemove}
                variant="destructive"
                size="sm"
                disabled={disabled || isUploading}
              >
                <X className="w-4 h-4 mr-2" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </>
        ) : (
          !isUploading && (
            // Empty state placeholder
            <div className="flex flex-col items-center justify-center h-full p-8 text-white/60">
              <Upload className="w-12 h-12 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-center">{placeholder}</p>
              <p className="text-xs text-white/40 mt-1">JPG, PNG, WebP, SVG (max 5MB)</p>
            </div>
          )
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mt-2 p-3 bg-red-900/50 border border-red-600/50 rounded-lg text-sm text-red-200"
        >
          {error}
        </div>
      )}
    </div>
  );
});
