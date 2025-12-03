/**
 * BlackoutsManager Component (Refactored)
 *
 * Main orchestrator for blackout dates management.
 * Coordinates between smaller specialized components.
 * Manages blackout dates that prevent bookings on specific days.
 */

import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { BlackoutForm } from "./BlackoutForm";
import { BlackoutsList } from "./BlackoutsList";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { useBlackoutsManager } from "./useBlackoutsManager";
import type { BlackoutsManagerProps } from "./types";

export function BlackoutsManager({ blackouts, isLoading, onBlackoutsChange }: BlackoutsManagerProps) {
  const {
    // Form state
    newBlackoutDate,
    setNewBlackoutDate,
    newBlackoutReason,
    setNewBlackoutReason,
    isAdding,
    isDirty,

    // Dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    blackoutToDelete,

    // Messages
    successMessage,

    // Actions
    handleAddBlackout,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
  } = useBlackoutsManager(onBlackoutsChange);

  // Setup confirmation dialog for unsaved changes
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  // Enable unsaved changes warning with ConfirmDialog
  useUnsavedChanges({
    isDirty,
    message: "You have unsaved blackout date information. Are you sure you want to leave?",
    enabled: true,
    confirmFn: (msg) => confirm({
      title: "Unsaved Changes",
      description: msg,
      confirmLabel: "Leave",
      cancelLabel: "Stay",
      variant: "destructive"
    })
  });

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog for Unsaved Changes */}
      {dialogState && (
        <ConfirmDialog
          open={dialogState.isOpen}
          onOpenChange={handleOpenChange}
          title={dialogState.title}
          description={dialogState.description}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          variant={dialogState.variant}
          onConfirm={dialogState.onConfirm}
        />
      )}

      {/* Success Message */}
      <SuccessMessage message={successMessage} />

      {/* Add Blackout Form */}
      <BlackoutForm
        newBlackoutDate={newBlackoutDate}
        setNewBlackoutDate={setNewBlackoutDate}
        newBlackoutReason={newBlackoutReason}
        setNewBlackoutReason={setNewBlackoutReason}
        isAdding={isAdding}
        onSubmit={handleAddBlackout}
      />

      {/* Blackouts List */}
      <BlackoutsList
        blackouts={blackouts}
        isLoading={isLoading}
        onDeleteClick={handleDeleteClick}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        blackoutToDelete={blackoutToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}