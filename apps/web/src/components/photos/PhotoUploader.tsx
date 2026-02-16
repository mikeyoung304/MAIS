'use client';

import { useState, useRef, useCallback } from 'react';
import { CheckCircle, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePhotoUpload, type TierPhoto } from '@/hooks/usePhotoUpload';
import { PhotoGrid } from './PhotoGrid';
import { PhotoDeleteDialog } from './PhotoDeleteDialog';
import { cn } from '@/lib/utils';

/**
 * Props for PhotoUploader component
 */
export interface PhotoUploaderProps {
  tierId: string;
  initialPhotos?: TierPhoto[];
  onPhotosChange?: (photos: TierPhoto[]) => void;
}

/**
 * PhotoUploader Component
 *
 * Main component for managing tier photos.
 * Allows tenant admins to upload, view, and delete service photos (max 5).
 * Supports both drag & drop and file input selection.
 */
export function PhotoUploader({ tierId, initialPhotos = [], onPhotosChange }: PhotoUploaderProps) {
  const [deleteTarget, setDeleteTarget] = useState<TierPhoto | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    photos,
    isUploading,
    isDeleting,
    error,
    successMessage,
    uploadProgress,
    MAX_PHOTOS,
    ALLOWED_TYPES,
    ALLOWED_EXTENSIONS,
    uploadPhoto,
    deletePhoto,
    setError,
    validateFile,
  } = usePhotoUpload({
    tierId,
    initialPhotos,
    onPhotosChange,
  });

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setError(null);
        await uploadPhoto(file);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadPhoto, setError]
  );

  /**
   * Trigger file input click
   */
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        // Validate before upload
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
        setError(null);
        await uploadPhoto(file);
      }
    },
    [uploadPhoto, validateFile, setError]
  );

  /**
   * Handle delete button click
   */
  const handleDeleteClick = useCallback((photo: TierPhoto) => {
    setDeleteTarget(photo);
  }, []);

  /**
   * Confirm deletion
   */
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deletePhoto(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, deletePhoto]);

  /**
   * Cancel deletion
   */
  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const canUpload = photos.length < MAX_PHOTOS && !isUploading;

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 border border-sage/30 bg-sage/10 rounded-xl">
          <CheckCircle className="h-5 w-5 text-sage flex-shrink-0" />
          <span className="text-sm font-medium text-sage">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 border border-red-200 bg-red-50 rounded-xl"
        >
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Service Photos ({photos.length}/{MAX_PHOTOS})
            </CardTitle>
            {canUpload && (
              <Button
                onClick={triggerFileInput}
                disabled={!canUpload}
                variant="sage"
                size="sm"
                className="rounded-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload photo"
          />

          {/* Drag & Drop Zone */}
          {canUpload && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={cn(
                'mb-6 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200',
                isDragOver
                  ? 'border-sage bg-sage/10 scale-[1.01]'
                  : 'border-neutral-200 hover:border-sage/50 hover:bg-sage/5',
                isUploading && 'pointer-events-none opacity-60'
              )}
              role="button"
              tabIndex={0}
              aria-label="Drop zone for uploading photos"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  triggerFileInput();
                }
              }}
            >
              <div className="flex flex-col items-center justify-center text-center">
                {isUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-sage animate-spin mb-3" />
                    <p className="text-sm font-medium text-text-primary mb-1">Uploading...</p>
                    {uploadProgress && (
                      <div className="w-full max-w-xs">
                        <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sage transition-all duration-300"
                            style={{ width: `${uploadProgress.percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          {uploadProgress.percentage}% complete
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Upload
                      className={cn(
                        'h-8 w-8 mb-3 transition-colors',
                        isDragOver ? 'text-sage' : 'text-text-muted'
                      )}
                    />
                    <p className="text-sm font-medium text-text-primary mb-1">
                      {isDragOver ? 'Drop your photo here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} up to 5MB
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Photo Grid */}
          <PhotoGrid
            photos={photos}
            onDeleteClick={handleDeleteClick}
            onTriggerUpload={triggerFileInput}
            isUploading={isUploading}
            maxPhotos={MAX_PHOTOS}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <PhotoDeleteDialog
        photo={deleteTarget}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
