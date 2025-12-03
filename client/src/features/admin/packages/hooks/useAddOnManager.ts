import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type {
  AddOnDto,
  CreateAddOnDto,
  UpdateAddOnDto,
} from "@macon/contracts";
import type { AddOnFormData } from "../../types";

interface UseAddOnManagerProps {
  onPackagesChange: () => void;
  showSuccess: (message: string) => void;
}

export function useAddOnManager({ onPackagesChange, showSuccess }: UseAddOnManagerProps) {
  const [isAddingAddOn, setIsAddingAddOn] = useState<string | null>(null);
  const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  const [addOnForm, setAddOnForm] = useState<AddOnFormData>({
    title: "",
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

  // Reset form
  const resetAddOnForm = () => {
    setAddOnForm({
      title: "",
      priceCents: "",
      photoUrl: "",
      segmentId: "",
    });
    setError(null);
  };

  // Add-on handlers
  const handleStartAddingAddOn = (packageId: string) => {
    resetAddOnForm();
    setIsAddingAddOn(packageId);
    setEditingAddOnId(null);
  };

  const handleEditAddOn = (addOn: AddOnDto) => {
    setAddOnForm({
      title: addOn.title,
      priceCents: addOn.priceCents.toString(),
      photoUrl: addOn.photoUrl || "",
      segmentId: addOn.segmentId || "",
    });
    setEditingAddOnId(addOn.id);
    setIsAddingAddOn(addOn.packageId);
  };

  const handleSaveAddOn = async (e: React.FormEvent, packageId: string) => {
    e.preventDefault();
    setError(null);

    if (!addOnForm.title || !addOnForm.priceCents) {
      setError("Title and price are required");
      return;
    }

    const priceCents = parseInt(addOnForm.priceCents, 10);
    if (isNaN(priceCents) || priceCents <= 0) {
      setError("Price must be a positive number");
      return;
    }

    setIsSaving(true);

    try {
      if (editingAddOnId) {
        const updateData: UpdateAddOnDto = {
          title: addOnForm.title,
          priceCents,
          photoUrl: addOnForm.photoUrl || undefined,
          segmentId: addOnForm.segmentId || undefined,
        };

        const result = await api.adminUpdateAddOn({
          params: { id: editingAddOnId },
          body: updateData,
        });

        if (result.status === 200) {
          showSuccess("Add-on updated successfully");
          setIsAddingAddOn(null);
          setEditingAddOnId(null);
          resetAddOnForm();
          onPackagesChange();
        } else {
          toast.error("Failed to update add-on", {
            description: "Please try again or contact support.",
          });
        }
      } else {
        const createData: CreateAddOnDto = {
          packageId,
          title: addOnForm.title,
          priceCents,
          photoUrl: addOnForm.photoUrl || undefined,
          segmentId: addOnForm.segmentId || undefined,
        };

        const result = await api.adminCreateAddOn({
          params: { packageId },
          body: createData,
        });

        if (result.status === 200) {
          showSuccess("Add-on created successfully");
          setIsAddingAddOn(null);
          resetAddOnForm();
          onPackagesChange();
        } else {
          toast.error("Failed to create add-on", {
            description: "Please try again or contact support.",
          });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to save add-on:", err);
      }
      toast.error("An error occurred while saving the add-on", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddOn = async (addOnId: string) => {
    const confirmed = await confirm({
      title: "Delete Add-on",
      description: "Are you sure you want to delete this add-on?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await api.adminDeleteAddOn({
        params: { id: addOnId },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess("Add-on deleted successfully");
        onPackagesChange();
      } else {
        toast.error("Failed to delete add-on", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to delete add-on:", err);
      }
      toast.error("An error occurred while deleting the add-on", {
        description: "Please try again or contact support.",
      });
    }
  };

  const handleCancelAddOn = () => {
    setIsAddingAddOn(null);
    setEditingAddOnId(null);
    resetAddOnForm();
  };

  return {
    // State
    isAddingAddOn,
    editingAddOnId,
    isSaving,
    error,
    addOnForm,
    segments,

    // Actions
    setAddOnForm,
    handleStartAddingAddOn,
    handleEditAddOn,
    handleSaveAddOn,
    handleDeleteAddOn,
    handleCancelAddOn,
    confirmDialog: { dialogState, handleOpenChange },
  };
}
