'use client';

import Image from 'next/image';
import { Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TierPhoto } from '@/hooks/usePhotoUpload';

interface PhotoGridProps {
  photos: TierPhoto[];
  onDeleteClick: (photo: TierPhoto) => void;
  onTriggerUpload: () => void;
  isUploading: boolean;
  maxPhotos: number;
}

/**
 * PhotoGrid Component
 *
 * Displays a grid of uploaded photos or an empty state.
 * Each photo shows a delete button on hover and displays
 * photo info (filename, size) in an overlay.
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
      <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-sage/30 rounded-2xl bg-sage/5">
        <div className="mb-4 rounded-full bg-sage/10 p-4">
          <ImageIcon className="h-10 w-10 text-sage" />
        </div>
        <p className="text-lg font-medium text-text-primary text-center mb-2">
          Showcase your services
        </p>
        <p className="text-sm text-text-muted text-center mb-6 max-w-sm">
          Add up to {maxPhotos} photos to help clients visualize what you offer (max 5MB each)
        </p>
        <Button
          onClick={onTriggerUpload}
          disabled={isUploading}
          variant="sage"
          className="rounded-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose Photo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.filename}
            className="relative group aspect-video bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
          >
            {/* Photo order badge */}
            <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm text-text-primary text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
              #{index + 1}
            </div>

            {/* Delete button */}
            <button
              onClick={() => onDeleteClick(photo)}
              className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-105"
              aria-label={`Delete photo ${index + 1}: ${photo.filename}`}
              title="Delete photo"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Photo image */}
            <div className="relative w-full h-full">
              <Image
                src={photo.url}
                alt={`Service photo ${index + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>

            {/* Photo info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-xs text-white/90 truncate font-medium">{photo.filename}</p>
              <p className="text-xs text-white/70">{formatFileSize(photo.size)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upload hint */}
      {photos.length < maxPhotos && (
        <p className="text-sm text-text-muted">
          You can upload {maxPhotos - photos.length} more{' '}
          {maxPhotos - photos.length === 1 ? 'photo' : 'photos'}
        </p>
      )}
    </div>
  );
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
