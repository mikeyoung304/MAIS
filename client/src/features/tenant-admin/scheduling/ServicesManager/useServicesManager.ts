import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ServiceDto, CreateServiceDto, UpdateServiceDto } from "@macon/contracts";
import type { ServiceFormData } from "./types";

interface UseServicesManagerProps {
  showSuccess: (message: string) => void;
  onServicesChange: () => void;
}

export function useServicesManager({ showSuccess, onServicesChange }: UseServicesManagerProps) {
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceDto | null>(null);

  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    slug: "",
    name: "",
    description: "",
    durationMinutes: "60",
    bufferMinutes: "0",
    priceCents: "0",
    timezone: "America/New_York",
    sortOrder: "0",
    active: true,
  });

  // Validate slug format
  const isValidSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug);
  };

  // Auto-generate slug from name (kebab-case)
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen
  };

  // Reset form
  const resetServiceForm = () => {
    setServiceForm({
      slug: "",
      name: "",
      description: "",
      durationMinutes: "60",
      bufferMinutes: "0",
      priceCents: "0",
      timezone: "America/New_York",
      sortOrder: "0",
      active: true,
    });
    setError(null);
  };

  // Service handlers
  const handleCreateService = () => {
    resetServiceForm();
    setIsCreatingService(true);
    setEditingServiceId(null);
  };

  const handleEditService = (service: ServiceDto) => {
    setServiceForm({
      slug: service.slug,
      name: service.name,
      description: service.description || "",
      durationMinutes: service.durationMinutes.toString(),
      bufferMinutes: service.bufferMinutes.toString(),
      priceCents: service.priceCents.toString(),
      timezone: service.timezone,
      sortOrder: service.sortOrder.toString(),
      active: service.active,
    });
    setEditingServiceId(service.id);
    setIsCreatingService(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!serviceForm.slug || !serviceForm.name) {
      setError("Slug and Name are required");
      return;
    }

    // Validate slug format
    if (!isValidSlug(serviceForm.slug)) {
      setError("Slug must be lowercase with hyphens only (no spaces)");
      return;
    }

    // Validate numeric fields
    const durationMinutes = parseInt(serviceForm.durationMinutes, 10);
    const bufferMinutes = parseInt(serviceForm.bufferMinutes, 10);
    const priceCents = parseInt(serviceForm.priceCents, 10);
    const sortOrder = parseInt(serviceForm.sortOrder, 10);

    if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      setError("Duration must be between 5 and 480 minutes");
      return;
    }

    if (isNaN(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) {
      setError("Buffer must be between 0 and 120 minutes");
      return;
    }

    if (isNaN(priceCents) || priceCents < 0) {
      setError("Price must be 0 or greater");
      return;
    }

    if (isNaN(sortOrder) || sortOrder < 0) {
      setError("Sort Order must be a number >= 0");
      return;
    }

    setIsSaving(true);

    try {
      if (editingServiceId) {
        // Update existing service
        const updateData: UpdateServiceDto = {
          slug: serviceForm.slug,
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          durationMinutes,
          bufferMinutes,
          priceCents,
          timezone: serviceForm.timezone,
          sortOrder,
          active: serviceForm.active,
        };

        const result = await api.tenantAdminUpdateService({
          params: { id: editingServiceId },
          body: updateData,
        });

        if (result.status === 200) {
          showSuccess("Service updated successfully");
          setIsCreatingService(false);
          resetServiceForm();
          onServicesChange();
        } else {
          setError("Failed to update service");
          toast.error("Failed to update service", {
            description: "Please try again or contact support.",
          });
        }
      } else {
        // Create new service
        const createData: CreateServiceDto = {
          slug: serviceForm.slug,
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          durationMinutes,
          bufferMinutes,
          priceCents,
          timezone: serviceForm.timezone,
          sortOrder,
          segmentId: null,
        };

        const result = await api.tenantAdminCreateService({
          body: createData,
        });

        if (result.status === 201) {
          showSuccess("Service created successfully");
          setIsCreatingService(false);
          resetServiceForm();
          onServicesChange();
        } else {
          setError("Failed to create service");
          toast.error("Failed to create service", {
            description: "Please try again or contact support.",
          });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[useServicesManager] Failed to save service:", err);
      }
      setError("An error occurred while saving the service");
      toast.error("An error occurred while saving the service", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (service: ServiceDto) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      const result = await api.tenantAdminDeleteService({
        params: { id: serviceToDelete.id },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess("Service deleted successfully");
        onServicesChange();
        setDeleteDialogOpen(false);
        setServiceToDelete(null);
      } else {
        toast.error("Failed to delete service", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[useServicesManager] Failed to delete service:", err);
      }
      toast.error("An error occurred while deleting the service", {
        description: "Please try again or contact support.",
      });
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setServiceToDelete(null);
  };

  const handleToggleActive = async (service: ServiceDto) => {
    try {
      const result = await api.tenantAdminUpdateService({
        params: { id: service.id },
        body: { active: !service.active },
      });

      if (result.status === 200) {
        showSuccess(`Service ${!service.active ? 'activated' : 'deactivated'} successfully`);
        onServicesChange();
      } else {
        toast.error("Failed to toggle service status", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[useServicesManager] Failed to toggle service status:", err);
      }
      toast.error("An error occurred while toggling service status", {
        description: "Please try again or contact support.",
      });
    }
  };

  const handleCancelServiceForm = () => {
    setIsCreatingService(false);
    resetServiceForm();
  };

  // Auto-generate slug from name when creating (not editing)
  const handleNameChange = (name: string) => {
    setServiceForm(prev => {
      const newForm = { ...prev, name };
      // Only auto-generate slug when creating (not editing)
      if (!editingServiceId) {
        newForm.slug = generateSlug(name);
      }
      return newForm;
    });
  };

  return {
    // State
    isCreatingService,
    editingServiceId,
    isSaving,
    error,
    serviceForm,

    // Delete dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    serviceToDelete,

    // Actions
    setServiceForm,
    handleCreateService,
    handleEditService,
    handleSaveService,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
    handleToggleActive,
    handleCancelServiceForm,
    handleNameChange,
  };
}
