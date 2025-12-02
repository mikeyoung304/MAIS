/**
 * PhotoDropZone - Drag & drop photo upload/management component
 *
 * Features:
 * - Drag & drop file upload
 * - Click to select file
 * - Photo preview with delete button
 * - Drag to reorder photos
 * - Max 5 photos limit
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Image, X, Upload, GripVertical } from "lucide-react";
import { packagePhotoApi } from "@/lib/package-photo-api";
import { logger } from "@/lib/logger";
import type { PackagePhoto } from "../hooks/useVisualEditor";

interface PhotoDropZoneProps {
  packageId: string;
  photos: PackagePhoto[];
  onPhotosChange: (photos: PackagePhoto[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoDropZone({
  packageId,
  photos,
  onPhotosChange,
  maxPhotos = 5,
  disabled = false,
}: PhotoDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // Track intended drop position for visual feedback (only reorder on drop)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropTargetTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced drop target setter to prevent excessive re-renders (dragOver fires 50-100+/sec)
  const setDropTargetDebounced = useMemo(
    () => (index: number | null) => {
      if (dropTargetTimeout.current) {
        clearTimeout(dropTargetTimeout.current);
      }
      dropTargetTimeout.current = setTimeout(() => {
        setDropTargetIndex(index);
        dropTargetTimeout.current = null;
      }, 50);
    },
    []
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dropTargetTimeout.current) {
        clearTimeout(dropTargetTimeout.current);
      }
    };
  }, []);

  const canAddMore = photos.length < maxPhotos;

  /**
   * Validate file before upload
   */
  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Please use JPEG, PNG, or WebP.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 5MB.";
    }
    return null;
  }, []);

  /**
   * Upload a single photo
   */
  const uploadPhoto = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return null;
    }

    try {
      const result = await packagePhotoApi.uploadPhoto(packageId, file);
      return {
        url: result.url,
        filename: result.filename,
        size: result.size,
        order: photos.length,
      };
    } catch (err) {
      logger.error("Failed to upload photo", {
        component: "PhotoDropZone",
        packageId,
        error: err,
      });
      toast.error("Failed to upload photo", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      return null;
    }
  }, [packageId, photos.length, validateFile]);

  /**
   * Handle file selection (from input or drop)
   * Note: Calculate canAddMore inside callback to avoid stale closure during async uploads
   */
  const handleFiles = useCallback(async (files: FileList) => {
    // Calculate fresh value to avoid stale closure (photos may change during async uploads)
    const currentCanAddMore = photos.length < maxPhotos;
    if (disabled || !currentCanAddMore) return;

    const remainingSlots = maxPhotos - photos.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setIsUploading(true);

    try {
      const uploadedPhotos: PackagePhoto[] = [];

      for (const file of filesToUpload) {
        const uploaded = await uploadPhoto(file);
        if (uploaded) {
          uploadedPhotos.push(uploaded);
        }
      }

      if (uploadedPhotos.length > 0) {
        onPhotosChange([...photos, ...uploadedPhotos]);
        toast.success(`Uploaded ${uploadedPhotos.length} photo${uploadedPhotos.length !== 1 ? "s" : ""}`);
      }
    } finally {
      setIsUploading(false);
    }
  }, [disabled, maxPhotos, photos, uploadPhoto, onPhotosChange]);

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  }, [handleFiles]);

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && canAddMore) {
      setIsDragging(true);
    }
  }, [disabled, canAddMore]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  /**
   * Handle delete photo
   */
  const handleDelete = useCallback(async (index: number) => {
    const photo = photos[index];
    if (!photo?.filename) return;

    try {
      await packagePhotoApi.deletePhoto(packageId, photo.filename);
      const newPhotos = photos.filter((_, i) => i !== index);
      onPhotosChange(newPhotos);
      toast.success("Photo deleted");
    } catch (err) {
      logger.error("Failed to delete photo", {
        component: "PhotoDropZone",
        packageId,
        filename: photo.filename,
        error: err,
      });
      toast.error("Failed to delete photo");
    }
  }, [packageId, photos, onPhotosChange]);

  /**
   * Handle photo reordering via drag
   */
  const handlePhotoReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, removed);

    // Update order values
    const reorderedPhotos = newPhotos.map((photo, i) => ({
      ...photo,
      order: i,
    }));

    onPhotosChange(reorderedPhotos);
  }, [photos, onPhotosChange]);

  return (
    <div className="space-y-3">
      {/* Existing photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {photos.map((photo, index) => (
            <div
              key={photo.filename || `temp-${index}`}
              draggable={!disabled}
              onDragStart={() => {
                setDraggedIndex(index);
                setDropTargetIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropTargetIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                // Only update drop target position, don't reorder yet
                // Use debounced setter to prevent excessive re-renders (dragOver fires 50-100+/sec)
                if (draggedIndex !== null && draggedIndex !== index) {
                  setDropTargetDebounced(index);
                }
              }}
              onDragLeave={() => {
                // Clear drop target when leaving this element
                if (dropTargetIndex === index) {
                  setDropTargetIndex(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only reorder once on drop - prevents 50-100+ reorders per drag
                if (draggedIndex !== null && draggedIndex !== index) {
                  handlePhotoReorder(draggedIndex, index);
                }
                setDraggedIndex(null);
                setDropTargetIndex(null);
              }}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border",
                "group cursor-move transition-transform",
                draggedIndex === index && "opacity-50 scale-95",
                // Visual indicator for drop target
                dropTargetIndex === index && draggedIndex !== index && "ring-2 ring-primary ring-offset-2"
              )}
            >
              <img
                src={photo.url}
                alt={`Package photo ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Drag handle overlay */}
              {!disabled && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                  <GripVertical
                    className={cn(
                      "absolute top-1 left-1 h-4 w-4 text-white opacity-0",
                      "group-hover:opacity-100 transition-opacity drop-shadow-md"
                    )}
                  />
                </div>
              )}

              {/* Delete button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className={cn(
                    "absolute top-1 right-1 p-1 rounded-full",
                    "bg-red-500 text-white opacity-0 group-hover:opacity-100",
                    "hover:bg-red-600 transition-all"
                  )}
                  aria-label={`Delete photo ${index + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone / upload button */}
      {canAddMore && !disabled && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer",
            "transition-colors hover:border-primary hover:bg-primary/5",
            isDragging && "border-primary bg-primary/10",
            isUploading && "opacity-50 cursor-wait"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            multiple
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />

          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span>
                  {isDragging
                    ? "Drop photos here"
                    : `Drag & drop or click to upload (${photos.length}/${maxPhotos})`}
                </span>
                <span className="text-xs">JPEG, PNG, WebP up to 5MB</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Max photos reached message */}
      {!canAddMore && !disabled && (
        <p className="text-sm text-muted-foreground text-center">
          Maximum {maxPhotos} photos reached
        </p>
      )}
    </div>
  );
}
