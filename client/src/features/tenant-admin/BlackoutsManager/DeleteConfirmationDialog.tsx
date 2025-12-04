import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { BlackoutDto } from './types';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blackoutToDelete: BlackoutDto | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DeleteConfirmationDialog Component
 *
 * Confirmation dialog for deleting blackout dates
 */
export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  blackoutToDelete,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-macon-navy-800 border-white/20">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-danger-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger-700" />
            </div>
            <AlertDialogTitle className="text-2xl">Delete Blackout Date?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-macon-navy-600 dark:text-white/60">
            Are you sure you want to delete the blackout date for{' '}
            <strong className="font-semibold text-macon-navy-900 dark:text-white">
              {blackoutToDelete &&
                new Date(blackoutToDelete.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
            </strong>
            {blackoutToDelete?.reason && ` (${blackoutToDelete.reason})`}?
          </AlertDialogDescription>
          <div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-sm text-danger-800 dark:text-danger-300 font-medium">
              ⚠️ This action cannot be undone
            </p>
            <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 space-y-1 list-disc list-inside">
              <li>This date will become available for bookings again</li>
              <li>The blackout will be permanently removed</li>
            </ul>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={onCancel}
            className="bg-macon-navy-100 hover:bg-macon-navy-200 text-macon-navy-900 border-macon-navy-300"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Blackout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
