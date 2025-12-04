import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PackagePhoto } from './hooks/usePhotoUpload';

interface PhotoDeleteDialogProps {
  photo: PackagePhoto | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * PhotoDeleteDialog Component
 *
 * Confirmation dialog for deleting a photo
 */
export function PhotoDeleteDialog({
  photo,
  isDeleting,
  onConfirm,
  onCancel,
}: PhotoDeleteDialogProps) {
  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-macon-navy-800 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">Delete Photo</DialogTitle>
          <DialogDescription className="text-white/70">
            Are you sure you want to delete this photo? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {photo && (
          <div className="my-4">
            <img
              src={photo.url}
              alt="Photo to delete"
              className="w-full h-48 object-cover rounded border border-white/20"
            />
            <p className="text-sm text-white/70 mt-2 truncate">{photo.filename}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isDeleting}
            className="border-white/20 text-white/90 hover:bg-macon-navy-700"
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Photo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
