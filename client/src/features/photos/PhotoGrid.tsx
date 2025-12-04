import { Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PackagePhoto } from './hooks/usePhotoUpload';

interface PhotoGridProps {
  photos: PackagePhoto[];
  onDeleteClick: (photo: PackagePhoto) => void;
  onTriggerUpload: () => void;
  isUploading: boolean;
  maxPhotos: number;
}

/**
 * PhotoGrid Component
 *
 * Displays a grid of uploaded photos or an empty state
 */
export function PhotoGrid({
  photos,
  onDeleteClick,
  onTriggerUpload,
  isUploading,
  maxPhotos,
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-white/20 rounded-lg">
        <ImageIcon className="w-16 h-16 text-white0 mb-4" />
        <p className="text-lg text-white/90 text-center mb-2">Showcase your venue</p>
        <p className="text-base text-white/70 text-center mb-4">
          Add up to {maxPhotos} photos to help clients visualize their big day (max 5MB each)
        </p>
        <Button
          onClick={onTriggerUpload}
          disabled={isUploading}
          variant="outline"
          className="border-white/20 text-white/90 hover:bg-macon-navy-700"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Choose Photo
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.filename}
            className="relative group aspect-video bg-macon-navy-700 border border-white/20 rounded-lg overflow-hidden"
          >
            {/* Photo order badge */}
            <div className="absolute top-2 left-2 z-10 bg-macon-navy-900/80 text-white/90 text-sm font-semibold px-2 py-1 rounded">
              #{index + 1}
            </div>

            {/* Delete button */}
            <button
              onClick={() => onDeleteClick(photo)}
              className="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Delete photo ${index + 1}: ${photo.filename}`}
              title="Delete photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Photo image */}
            <img
              src={photo.url}
              alt={`Package photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />

            {/* Photo info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-900/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white/70 truncate">{photo.filename}</p>
              <p className="text-xs text-white/60">{(photo.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upload hint */}
      {photos.length < maxPhotos && (
        <p className="text-base text-white/70 mt-4">
          You can upload {maxPhotos - photos.length} more{' '}
          {photos.length === maxPhotos - 1 ? 'photo' : 'photos'}
        </p>
      )}
    </>
  );
}
