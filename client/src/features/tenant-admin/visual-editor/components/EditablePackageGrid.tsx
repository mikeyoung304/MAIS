/**
 * EditablePackageGrid - Grid layout for editable package cards
 *
 * Responsive grid that displays all packages for visual editing.
 */

import { EditablePackageCard } from "./EditablePackageCard";
import type { PackageWithDraft, PackagePhoto, DraftUpdate } from "../hooks/useVisualEditor";

interface EditablePackageGridProps {
  packages: PackageWithDraft[];
  onUpdatePackage: (packageId: string, update: DraftUpdate) => void;
  onPhotosChange: (packageId: string, photos: PackagePhoto[]) => void;
  disabled?: boolean;
}

export function EditablePackageGrid({
  packages,
  onUpdatePackage,
  onPhotosChange,
  disabled = false,
}: EditablePackageGridProps) {
  if (packages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No packages to display.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first package to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {packages.map((pkg) => (
        <EditablePackageCard
          key={pkg.id}
          package={pkg}
          onUpdate={(update) => onUpdatePackage(pkg.id, update)}
          onPhotosChange={(photos) => onPhotosChange(pkg.id, photos)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
