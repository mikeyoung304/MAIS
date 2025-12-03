/**
 * Shared types for admin components
 */

import type { PackageDto, AddOnDto } from "@macon/contracts";

export interface PackageFormData {
  slug: string;
  title: string;
  description: string;
  priceCents: string;
  photoUrl: string;
  segmentId: string;
}

export interface AddOnFormData {
  title: string;
  priceCents: string;
  photoUrl: string;
  segmentId: string;
}

export interface SegmentFormData {
  slug: string;
  name: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: string; // Store as string for input, parse on submit
  active: boolean;
}

export interface PackageCardProps {
  package: PackageDto;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (pkg: PackageDto) => void;
  onDelete: (packageId: string) => void;
  onAddOnChange: () => void;
}

export interface PackageFormProps {
  packageForm: PackageFormData;
  editingPackageId: string | null;
  isSaving: boolean;
  segments?: Array<{ id: string; name: string; active: boolean }>;
  onFormChange: (form: PackageFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export interface AddOnManagerProps {
  package: PackageDto;
  isAddingAddOn: boolean;
  editingAddOnId: string | null;
  addOnForm: AddOnFormData;
  isSaving: boolean;
  segments?: Array<{ id: string; name: string; active: boolean }>;
  onFormChange: (form: AddOnFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onEdit: (addOn: AddOnDto) => void;
  onDelete: (addOnId: string) => void;
  onStartAdding: () => void;
}
