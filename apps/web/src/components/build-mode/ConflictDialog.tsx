'use client';

/**
 * ConflictDialog - Conflict resolution dialog for Build Mode
 *
 * Shows when another browser tab/session modified the draft while the user
 * was making changes. Offers two resolution options:
 *
 * 1. "Refresh & Continue" - Fetches the latest version and lets user continue editing
 * 2. "Discard My Changes" - Closes the dialog without saving (user's changes lost)
 *
 * This is part of the optimistic locking system (#620) that prevents silent data loss.
 */

import { useState } from 'react';
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
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface ConflictDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Callback when user clicks "Refresh & Continue" - should refetch draft config */
  onRefresh: () => void | Promise<void>;
  /** Callback when user clicks "Discard My Changes" - closes without saving */
  onDiscard?: () => void;
}

export function ConflictDialog({ open, onOpenChange, onRefresh, onDiscard }: ConflictDialogProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDiscard = () => {
    if (isRefreshing) return;
    onDiscard?.();
    onOpenChange(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      onOpenChange(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={isRefreshing ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            </div>
            <AlertDialogTitle className="text-lg">Draft Modified Elsewhere</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            This draft was modified in another session or browser tab. Your recent changes could not
            be saved because they would overwrite the newer version.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 my-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong>Refresh & Continue:</strong> Load the latest version and continue editing. Your
            unsaved changes will be lost.
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            <strong>Discard My Changes:</strong> Close this dialog. The draft remains at the newer
            version saved by the other session.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDiscard} disabled={isRefreshing}>
            Discard My Changes
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-sage hover:bg-sage/90"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh & Continue
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
