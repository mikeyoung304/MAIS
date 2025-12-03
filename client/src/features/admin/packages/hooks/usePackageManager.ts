import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type {
  PackageDto,
  CreatePackageDto,
  UpdatePackageDto,
} from "@macon/contracts";
import type { PackageFormData } from "../../types";

interface UsePackageManagerProps {
  onPackagesChange: () => void;
  showSuccess: (message: string) => void;
}

export function usePackageManager({ onPackagesChange, showSuccess }: UsePackageManagerProps) {
  const [isCreatingPackage, setIsCreatingPackage] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [segments, setSegments] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  const [packageForm, setPackageForm] = useState<PackageFormData>({
    slug: "",
    title: "",
    description: "",
    priceCents: "",
    photoUrl: "",
    segmentId: "",
  });

  // Fetch segments
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const result = await api.tenantAdminGetSegments();
        if (result.status === 200) {
          setSegments(result.body);
        }
      } catch (err) {
        // Silent fail - segments are optional
      }
    };
    fetchSegments();
  }, []);

  // Validate slug format
  const isValidSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug);
  };

  // Reset form
  const resetPackageForm = () => {
    setPackageForm({
      slug: "",
      title: "",
      description: "",
      priceCents: "",
      photoUrl: "",
      segmentId: "",
    });
  };

  // Package handlers
  const handleCreatePackage = () => {
    resetPackageForm();
    setIsCreatingPackage(true);
    setEditingPackageId(null);
  };

  const handleEditPackage = (pkg: PackageDto) => {
    setPackageForm({
      slug: pkg.slug,
      title: pkg.title,
      description: pkg.description,
      priceCents: pkg.priceCents.toString(),
      photoUrl: pkg.photoUrl || "",
      segmentId: pkg.segmentId || "",
    });
    setEditingPackageId(pkg.id);
    setIsCreatingPackage(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!packageForm.slug || !packageForm.title || !packageForm.description || !packageForm.priceCents) {
      toast.error("Missing Required Fields", {
        description: "All fields except Photo URL are required",
      });
      return;
    }

    if (!isValidSlug(packageForm.slug)) {
      toast.error("Invalid Slug Format", {
        description: "Slug must be lowercase with hyphens only (no spaces)",
      });
      return;
    }

    const priceCents = parseInt(packageForm.priceCents, 10);
    if (isNaN(priceCents) || priceCents <= 0) {
      toast.error("Invalid Price", {
        description: "Price must be a positive number",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingPackageId) {
        const updateData: UpdatePackageDto = {
          slug: packageForm.slug,
          title: packageForm.title,
          description: packageForm.description,
          priceCents,
          photoUrl: packageForm.photoUrl || undefined,
          segmentId: packageForm.segmentId || undefined,
        };

        const result = await api.adminUpdatePackage({
          params: { id: editingPackageId },
          body: updateData,
        });

        if (result.status === 200) {
          showSuccess("Package updated successfully");
          setIsCreatingPackage(false);
          resetPackageForm();
          onPackagesChange();
        } else {
          toast.error("Failed to update package", {
            description: "Please try again or contact support.",
          });
        }
      } else {
        const createData: CreatePackageDto = {
          slug: packageForm.slug,
          title: packageForm.title,
          description: packageForm.description,
          priceCents,
          photoUrl: packageForm.photoUrl || undefined,
          segmentId: packageForm.segmentId || undefined,
        };

        const result = await api.adminCreatePackage({
          body: createData,
        });

        if (result.status === 200) {
          showSuccess("Package created successfully");
          setIsCreatingPackage(false);
          resetPackageForm();
          onPackagesChange();
        } else {
          toast.error("Failed to create package", {
            description: "Please try again or contact support.",
          });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to save package:", err);
      }
      toast.error("An error occurred while saving the package", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    const confirmed = await confirm({
      title: "Delete Package",
      description: "Are you sure you want to delete this package? This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await api.adminDeletePackage({
        params: { id: packageId },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess("Package deleted successfully");
        onPackagesChange();
      } else {
        toast.error("Failed to delete package", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to delete package:", err);
      }
      toast.error("An error occurred while deleting the package", {
        description: "Please try again or contact support.",
      });
    }
  };

  const handleCancelPackageForm = () => {
    setIsCreatingPackage(false);
    resetPackageForm();
  };

  return {
    // State
    isCreatingPackage,
    editingPackageId,
    isSaving,
    packageForm,
    segments,

    // Actions
    setPackageForm,
    handleCreatePackage,
    handleEditPackage,
    handleSavePackage,
    handleDeletePackage,
    handleCancelPackageForm,
    confirmDialog: { dialogState, handleOpenChange },
  };
}
