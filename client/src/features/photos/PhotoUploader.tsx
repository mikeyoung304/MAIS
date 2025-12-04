import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePhotoUpload, type PackagePhoto } from './hooks/usePhotoUpload';
import { PhotoGrid } from './PhotoGrid';
import { PhotoUploadButton } from './PhotoUploadButton';
import { PhotoDeleteDialog } from './PhotoDeleteDialog';

/**
 * Props for PhotoUploader component
 */
export interface PhotoUploaderProps {
  packageId: string;
  initialPhotos?: PackagePhoto[];
  onPhotosChange?: (photos: PackagePhoto[]) => void;
  tenantToken?: string;
}

/**
 * PhotoUploader Component
 *
 * Main component for managing package photos
 * Allows tenant admins to upload, view, and delete package photos (max 5)
 */
export function PhotoUploader({
  packageId,
  initialPhotos = [],
  onPhotosChange,
  tenantToken,
}: PhotoUploaderProps) {
  const [deleteTarget, setDeleteTarget] = useState<PackagePhoto | null>(null);

  const {
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
  } = usePhotoUpload({
    packageId,
    tenantToken,
    initialPhotos,
    onPhotosChange,
  });

  const handleFileSelect = async (file: File) => {
    setError(null);
    await uploadPhoto(file);
  };

  const handleDeleteClick = (photo: PackagePhoto) => {
    setDeleteTarget(photo);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deletePhoto(deleteTarget);
    setDeleteTarget(null);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 border border-white/20 bg-macon-navy-700 rounded-lg">
          <CheckCircle className="w-5 h-5 text-white/60 flex-shrink-0" />
          <span className="text-lg font-medium text-white/90">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 border border-red-600 bg-macon-navy-700 rounded-lg"
        >
          <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
          <span className="text-base text-white/90">{error}</span>
        </div>
      )}

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            Package Photos ({photos.length}/{MAX_PHOTOS})
          </h3>

          <PhotoUploadButton
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            disabled={photos.length >= MAX_PHOTOS}
            allowedTypes={ALLOWED_TYPES}
          />
        </div>

        <PhotoGrid
          photos={photos}
          onDeleteClick={handleDeleteClick}
          onTriggerUpload={() => {}}
          isUploading={isUploading}
          maxPhotos={MAX_PHOTOS}
        />
      </Card>

      <PhotoDeleteDialog
        photo={deleteTarget}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
