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
import type { AvailabilityRuleDto } from './types';
import { DAYS_OF_WEEK } from './types';
import { formatTime } from './utils';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ruleToDelete: AvailabilityRuleDto | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DeleteConfirmationDialog Component
 *
 * Confirmation dialog for deleting availability rules
 */
export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  ruleToDelete,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  if (!ruleToDelete) return null;

  const dayName = DAYS_OF_WEEK[ruleToDelete.dayOfWeek];
  const timeRange = `${formatTime(ruleToDelete.startTime)} - ${formatTime(ruleToDelete.endTime)}`;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-macon-navy-800 border-white/20">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-danger-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger-700" />
            </div>
            <AlertDialogTitle className="text-2xl">Delete Availability Rule?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-macon-navy-600 dark:text-white/60">
            Are you sure you want to delete the availability rule for{' '}
            <strong className="font-semibold text-macon-navy-900 dark:text-white">{dayName}</strong>{' '}
            from{' '}
            <strong className="font-semibold text-macon-navy-900 dark:text-white">
              {timeRange}
            </strong>
            ?
          </AlertDialogDescription>
          <div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-sm text-danger-800 dark:text-danger-300 font-medium">
              This action cannot be undone
            </p>
            <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 space-y-1 list-disc list-inside">
              <li>This time slot will no longer be available for bookings</li>
              <li>Existing appointments during this time will not be affected</li>
              <li>The rule will be permanently removed</li>
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
            Delete Rule
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
