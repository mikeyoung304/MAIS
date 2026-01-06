'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PackagePhoto } from '@/hooks/usePhotoUpload';

interface PhotoDeleteDialogProps {
  photo: PackagePhoto | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * PhotoDeleteDialog Component
 *
 * Confirmation dialog for deleting a photo.
 * Shows a preview of the photo to be deleted and warns
 * the user that the action cannot be undone.
 */
export function PhotoDeleteDialog({
  photo,
  isDeleting,
  onConfirm,
  onCancel,
}: PhotoDeleteDialogProps) {
  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle>Delete Photo</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this photo? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {photo && (
          <div className="my-4">
            <div className="relative w-full h-48 rounded-xl overflow-hidden border border-neutral-200">
              <Image
                src={photo.url}
                alt="Photo to delete"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 500px"
              />
            </div>
            <p className="text-sm text-text-muted mt-2 truncate">{photo.filename}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={onCancel} variant="outline" disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            variant="destructive"
            isLoading={isDeleting}
            loadingText="Deleting..."
          >
            Delete Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
