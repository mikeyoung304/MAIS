import { useCallback } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Layers, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PackageDto, SegmentDto } from "@macon/contracts";
import { PackagePhotoUploader } from "@/components/PackagePhotoUploader";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { usePackageForm } from "./packages/hooks/usePackageForm";
import { usePackageManager } from "./packages/hooks/usePackageManager";
import { PackageForm } from "./packages/PackageForm";
import { PackageList } from "./packages/PackageList";
import { SegmentForm } from "../admin/segments/SegmentForm";
import { useSegmentManager } from "../admin/segments/hooks/useSegmentManager";
import { useSuccessMessage } from "../admin/packages/hooks/useSuccessMessage";
import type { SegmentWithPackages } from "./TenantDashboard/useDashboardData";

interface TenantPackagesManagerProps {
  packages: PackageDto[];
  segments: SegmentDto[];
  grouped: SegmentWithPackages[];
  orphanedPackages: PackageDto[];
  showGroupedView: boolean;
  onPackagesChange: () => void;
}

/**
 * TenantPackagesManager Component
 *
 * Main coordinator for tenant package management.
 * Supports two views:
 * - Flat list: 0-1 segments (unchanged UX)
 * - Grouped view: 2+ segments with native <details> accordion
 *
 * Design: Matches landing page aesthetic with sage accents
 */
export function TenantPackagesManager({
  packages,
  segments,
  grouped,
  orphanedPackages,
  showGroupedView,
  onPackagesChange,
}: TenantPackagesManagerProps) {
  // Package management state and handlers
  const packageManager = usePackageManager(onPackagesChange);

  // Form state and handlers
  const packageForm = usePackageForm({
    onSuccess: packageManager.handleFormSuccess,
    onPackagesChange,
  });

  // Segment management
  const { successMessage: segmentSuccessMessage, showSuccess: showSegmentSuccess } = useSuccessMessage();
  const segmentManager = useSegmentManager({
    onSegmentsChange: onPackagesChange,
    showSuccess: showSegmentSuccess,
  });

  // Handle edit - load package into form and fetch photos
  const handleEdit = useCallback(async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  }, [packageForm, packageManager]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await packageForm.submitForm(packageManager.editingPackageId);
  }, [packageForm, packageManager]);

  // Render segment form if creating/editing segment
  if (segmentManager.isCreatingSegment) {
    return (
      <div className="space-y-6">
        <SuccessMessage message={segmentSuccessMessage} />
        <SegmentForm
          segmentForm={segmentManager.segmentForm}
          editingSegmentId={segmentManager.editingSegmentId}
          isSaving={segmentManager.isSaving}
          error={segmentManager.error}
          onFormChange={segmentManager.setSegmentForm}
          onSubmit={segmentManager.handleSaveSegment}
          onCancel={segmentManager.handleCancelSegmentForm}
        />
      </div>
    );
  }

  // Render package form if creating/editing package
  if (packageManager.isCreating) {
    return (
      <div className="space-y-6">
        <SuccessMessage message={packageManager.successMessage} />
        <PackageForm
          form={packageForm.form}
          setForm={packageForm.setForm}
          isSaving={packageForm.isSaving}
          error={packageForm.error}
          editingPackageId={packageManager.editingPackageId}
          onSubmit={handleSubmit}
          onCancel={packageManager.handleCancel}
          segments={segments}
          isLoadingSegments={false}
          requireSegment={showGroupedView}
        />

        {/* Package Photo Uploader - Only show when editing existing package */}
        {packageManager.editingPackageId && (
          <PackagePhotoUploader
            packageId={packageManager.editingPackageId}
            initialPhotos={packageManager.packagePhotos}
            onPhotosChange={packageManager.setPackagePhotos}
          />
        )}
      </div>
    );
  }

  // 0-1 segments: Flat list view
  if (!showGroupedView) {
    return (
      <div className="space-y-6">
        <SuccessMessage message={packageManager.successMessage || segmentSuccessMessage} />

        {/* Confirmation Dialogs */}
        {packageManager.confirmDialog.dialogState && (
          <ConfirmDialog
            open={packageManager.confirmDialog.dialogState.isOpen}
            onOpenChange={packageManager.confirmDialog.handleOpenChange}
            title={packageManager.confirmDialog.dialogState.title}
            description={packageManager.confirmDialog.dialogState.description}
            confirmLabel={packageManager.confirmDialog.dialogState.confirmLabel}
            cancelLabel={packageManager.confirmDialog.dialogState.cancelLabel}
            onConfirm={packageManager.confirmDialog.dialogState.onConfirm}
            variant={packageManager.confirmDialog.dialogState.variant}
          />
        )}
        {segmentManager.confirmDialog.dialogState && (
          <ConfirmDialog
            open={segmentManager.confirmDialog.dialogState.isOpen}
            onOpenChange={segmentManager.confirmDialog.handleOpenChange}
            title={segmentManager.confirmDialog.dialogState.title}
            description={segmentManager.confirmDialog.dialogState.description}
            confirmLabel={segmentManager.confirmDialog.dialogState.confirmLabel}
            cancelLabel={segmentManager.confirmDialog.dialogState.cancelLabel}
            onConfirm={segmentManager.confirmDialog.dialogState.onConfirm}
            variant={segmentManager.confirmDialog.dialogState.variant}
          />
        )}

        {/* Header with Create Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">Your Packages</h2>
            <p className="text-text-muted text-sm mt-1">
              {packages.length === 0
                ? "Create your first package to get started"
                : `${packages.length} package${packages.length !== 1 ? "s" : ""} available`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={segmentManager.handleCreateSegment}
              variant="outline"
              className="rounded-full px-6 h-11 border-sage-light/30 text-text-primary hover:bg-sage-light/10"
            >
              <Layers className="w-4 h-4 mr-2" />
              Create Segment
            </Button>
            <Button
              onClick={packageManager.handleCreate}
              className="bg-sage hover:bg-sage-hover text-white rounded-full px-6 h-11 shadow-soft hover:shadow-medium transition-all duration-300 group"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              Create Package
            </Button>
          </div>
        </div>

        {/* Packages List */}
        <PackageList
          packages={packages}
          onEdit={handleEdit}
          onDelete={packageManager.handleDelete}
        />
      </div>
    );
  }

  // 2+ segments: Grouped view with native <details> accordion
  return (
    <div className="space-y-6">
      <SuccessMessage message={packageManager.successMessage || segmentSuccessMessage} />

      {/* Confirmation Dialogs */}
      {packageManager.confirmDialog.dialogState && (
        <ConfirmDialog
          open={packageManager.confirmDialog.dialogState.isOpen}
          onOpenChange={packageManager.confirmDialog.handleOpenChange}
          title={packageManager.confirmDialog.dialogState.title}
          description={packageManager.confirmDialog.dialogState.description}
          confirmLabel={packageManager.confirmDialog.dialogState.confirmLabel}
          cancelLabel={packageManager.confirmDialog.dialogState.cancelLabel}
          onConfirm={packageManager.confirmDialog.dialogState.onConfirm}
          variant={packageManager.confirmDialog.dialogState.variant}
        />
      )}
      {segmentManager.confirmDialog.dialogState && (
        <ConfirmDialog
          open={segmentManager.confirmDialog.dialogState.isOpen}
          onOpenChange={segmentManager.confirmDialog.handleOpenChange}
          title={segmentManager.confirmDialog.dialogState.title}
          description={segmentManager.confirmDialog.dialogState.description}
          confirmLabel={segmentManager.confirmDialog.dialogState.confirmLabel}
          cancelLabel={segmentManager.confirmDialog.dialogState.cancelLabel}
          onConfirm={segmentManager.confirmDialog.dialogState.onConfirm}
          variant={segmentManager.confirmDialog.dialogState.variant}
        />
      )}

      {/* Header with Create Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">
            {segments.length} Segments, {packages.length} Packages
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Packages organized by customer segment
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={segmentManager.handleCreateSegment}
            variant="outline"
            className="rounded-full px-6 h-11 border-sage-light/30 text-text-primary hover:bg-sage-light/10"
          >
            <Layers className="w-4 h-4 mr-2" />
            New Segment
          </Button>
          <Button
            onClick={packageManager.handleCreate}
            className="bg-sage hover:bg-sage-hover text-white rounded-full px-6 h-11 shadow-soft hover:shadow-medium transition-all duration-300 group"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            New Package
          </Button>
        </div>
      </div>

      {/* Grouped by segment */}
      <div className="space-y-4">
        {grouped.map(segment => (
          <details
            key={segment.id}
            open
            className="border border-sage-light/20 rounded-2xl overflow-hidden group"
          >
            <summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-macon-orange focus-visible:outline-offset-2 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <ChevronDown className="h-5 w-5 text-sage transition-transform duration-200 group-open:rotate-180" />
                <span className="text-text-primary">
                  {segment.name} <span className="font-normal text-text-muted">({segment.packages.length})</span>
                </span>
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    segmentManager.handleEditSegment(segment);
                  }}
                  className="text-text-muted hover:text-sage hover:bg-sage/10"
                  aria-label={`Edit segment: ${segment.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    segmentManager.handleDeleteSegment(segment.id);
                  }}
                  className="text-text-muted hover:text-danger-600 hover:bg-danger-50"
                  aria-label={`Delete segment: ${segment.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </summary>
            <div className="px-6 pb-6">
              {segment.packages.length === 0 ? (
                <p className="text-text-muted py-4">No packages in this segment yet.</p>
              ) : (
                <PackageList
                  packages={segment.packages}
                  onEdit={handleEdit}
                  onDelete={packageManager.handleDelete}
                />
              )}
            </div>
          </details>
        ))}
      </div>

      {/* Orphaned packages (legacy) */}
      {orphanedPackages.length > 0 && (
        <div className="border border-yellow-200 rounded-2xl p-6 bg-yellow-50">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-700" />
            <h3 className="font-semibold text-yellow-800">
              Ungrouped Packages ({orphanedPackages.length})
            </h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            These packages need to be assigned to a segment. Edit each package to select a segment.
          </p>
          <PackageList
            packages={orphanedPackages}
            onEdit={handleEdit}
            onDelete={packageManager.handleDelete}
          />
        </div>
      )}
    </div>
  );
}
