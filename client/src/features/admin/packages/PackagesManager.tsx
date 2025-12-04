import type { PackageDto } from '@macon/contracts';
import { PackageForm } from '../PackageForm';
import { SuccessMessage } from './SuccessMessage';
import { CreatePackageButton } from './CreatePackageButton';
import { PackagesList } from './PackagesList';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSuccessMessage } from './hooks/useSuccessMessage';
import { usePackageManager } from './hooks/usePackageManager';
import { useAddOnManager } from './hooks/useAddOnManager';

interface PackagesManagerProps {
  packages: PackageDto[];
  onPackagesChange: () => void;
}

export function PackagesManager({ packages, onPackagesChange }: PackagesManagerProps) {
  const { successMessage, showSuccess } = useSuccessMessage();

  const {
    isCreatingPackage,
    editingPackageId,
    isSaving: packageSaving,
    packageForm,
    segments,
    setPackageForm,
    handleCreatePackage,
    handleEditPackage,
    handleSavePackage,
    handleDeletePackage,
    handleCancelPackageForm,
  } = usePackageManager({ onPackagesChange, showSuccess });

  const {
    isAddingAddOn,
    editingAddOnId,
    isSaving: addOnSaving,
    addOnForm,
    segments: addOnSegments,
    setAddOnForm,
    handleStartAddingAddOn,
    handleEditAddOn,
    handleSaveAddOn,
    handleDeleteAddOn,
    handleCancelAddOn,
  } = useAddOnManager({ onPackagesChange, showSuccess });

  return (
    <div className="space-y-6">
      {successMessage && <SuccessMessage message={successMessage} />}

      {/* Confirmation Dialogs */}
      {handleDeletePackage.confirmDialog?.dialogState && (
        <ConfirmDialog
          open={handleDeletePackage.confirmDialog.dialogState.isOpen}
          onOpenChange={handleDeletePackage.confirmDialog.handleOpenChange}
          title={handleDeletePackage.confirmDialog.dialogState.title}
          description={handleDeletePackage.confirmDialog.dialogState.description}
          confirmLabel={handleDeletePackage.confirmDialog.dialogState.confirmLabel}
          cancelLabel={handleDeletePackage.confirmDialog.dialogState.cancelLabel}
          onConfirm={handleDeletePackage.confirmDialog.dialogState.onConfirm}
          variant={handleDeletePackage.confirmDialog.dialogState.variant}
        />
      )}
      {handleDeleteAddOn.confirmDialog?.dialogState && (
        <ConfirmDialog
          open={handleDeleteAddOn.confirmDialog.dialogState.isOpen}
          onOpenChange={handleDeleteAddOn.confirmDialog.handleOpenChange}
          title={handleDeleteAddOn.confirmDialog.dialogState.title}
          description={handleDeleteAddOn.confirmDialog.dialogState.description}
          confirmLabel={handleDeleteAddOn.confirmDialog.dialogState.confirmLabel}
          cancelLabel={handleDeleteAddOn.confirmDialog.dialogState.cancelLabel}
          onConfirm={handleDeleteAddOn.confirmDialog.dialogState.onConfirm}
          variant={handleDeleteAddOn.confirmDialog.dialogState.variant}
        />
      )}

      {!isCreatingPackage && <CreatePackageButton onClick={handleCreatePackage} />}

      {isCreatingPackage && (
        <PackageForm
          packageForm={packageForm}
          editingPackageId={editingPackageId}
          isSaving={packageSaving}
          segments={segments}
          onFormChange={setPackageForm}
          onSubmit={handleSavePackage}
          onCancel={handleCancelPackageForm}
        />
      )}

      <PackagesList
        packages={packages}
        onEditPackage={handleEditPackage}
        onDeletePackage={handleDeletePackage}
        onPackagesChange={onPackagesChange}
        isAddingAddOn={isAddingAddOn}
        editingAddOnId={editingAddOnId}
        addOnForm={addOnForm}
        isSaving={addOnSaving}
        segments={addOnSegments}
        onAddOnFormChange={setAddOnForm}
        onSubmitAddOn={handleSaveAddOn}
        onCancelAddOn={handleCancelAddOn}
        onEditAddOn={handleEditAddOn}
        onDeleteAddOn={handleDeleteAddOn}
        onStartAddingAddOn={handleStartAddingAddOn}
      />
    </div>
  );
}
