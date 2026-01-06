'use client';

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
import type { ServiceDto } from '@macon/contracts';

/**
 * Appointment Type DTO - alias for ServiceDto from contracts
 * UI uses "Appointment Type" terminology.
 */
type AppointmentTypeDto = ServiceDto;

interface DeleteAppointmentTypeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  typeToDelete: AppointmentTypeDto | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Delete Appointment Type Confirmation Dialog
 *
 * Displays a confirmation dialog before deleting an appointment type.
 * Warns about potential impacts on availability rules and appointments.
 */
export function DeleteAppointmentTypeDialog({
  isOpen,
  onOpenChange,
  typeToDelete,
  onConfirm,
  onCancel,
}: DeleteAppointmentTypeDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Appointment Type</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>
              Are you sure you want to delete the appointment type{' '}
              <span className="font-semibold text-text-primary">{typeToDelete?.name}</span>?
            </span>
            <br />
            <br />
            <span className="text-red-600">
              This action cannot be undone. Any availability rules or appointments associated with
              this appointment type may be affected.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="rounded-full">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-full bg-red-600 text-white hover:bg-red-700"
          >
            Delete Appointment Type
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
