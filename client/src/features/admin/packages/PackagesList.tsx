import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageCard } from "../PackageCard";
import { AddOnManager } from "../AddOnManager";
import { Package } from "lucide-react";
import type { PackageDto } from "@macon/contracts";
import type { AddOnFormData } from "../types";

interface PackagesListProps {
  packages: PackageDto[];
  onEditPackage: (pkg: PackageDto) => void;
  onDeletePackage: (packageId: string) => void;
  onPackagesChange: () => void;
  isAddingAddOn: string | null;
  editingAddOnId: string | null;
  addOnForm: AddOnFormData;
  isSaving: boolean;
  segments?: Array<{ id: string; name: string; active: boolean }>;
  onAddOnFormChange: (form: AddOnFormData) => void;
  onSubmitAddOn: (e: React.FormEvent, packageId: string) => void;
  onCancelAddOn: () => void;
  onEditAddOn: (addOn: any) => void;
  onDeleteAddOn: (addOnId: string) => void;
  onStartAddingAddOn: (packageId: string) => void;
}

export function PackagesList({
  packages,
  onEditPackage,
  onDeletePackage,
  onPackagesChange,
  isAddingAddOn,
  editingAddOnId,
  addOnForm,
  isSaving,
  segments,
  onAddOnFormChange,
  onSubmitAddOn,
  onCancelAddOn,
  onEditAddOn,
  onDeleteAddOn,
  onStartAddingAddOn,
}: PackagesListProps) {
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <h2 className="text-2xl font-semibold mb-4 text-white">Packages</h2>
      {packages.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Ready to showcase your services"
          description="Create your first package to start accepting bookings. Your packages will appear here."
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div key={pkg.id}>
              <PackageCard
                package={pkg}
                isExpanded={expandedPackageId === pkg.id}
                onToggleExpand={() =>
                  setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id)
                }
                onEdit={onEditPackage}
                onDelete={onDeletePackage}
                onAddOnChange={onPackagesChange}
              />

              {expandedPackageId === pkg.id && (
                <div className="mt-4 ml-4">
                  <AddOnManager
                    package={pkg}
                    isAddingAddOn={isAddingAddOn === pkg.id}
                    editingAddOnId={editingAddOnId}
                    addOnForm={addOnForm}
                    isSaving={isSaving}
                    segments={segments}
                    onFormChange={onAddOnFormChange}
                    onSubmit={(e) => onSubmitAddOn(e, pkg.id)}
                    onCancel={onCancelAddOn}
                    onEdit={onEditAddOn}
                    onDelete={onDeleteAddOn}
                    onStartAdding={() => onStartAddingAddOn(pkg.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
