/**
 * ServicesManager Component
 *
 * Main orchestrator for tenant admin service management.
 * Allows tenant admins to create, edit, delete, and manage their scheduling services.
 *
 * Features:
 * - List all services in a table
 * - Create new service with auto-slug generation
 * - Edit existing services inline
 * - Delete services with confirmation dialog
 * - Toggle active/inactive status
 * - Success/error message display
 *
 * API Endpoints:
 * - GET /v1/tenant-admin/services - List all services
 * - POST /v1/tenant-admin/services - Create service
 * - PUT /v1/tenant-admin/services/:id - Update service
 * - DELETE /v1/tenant-admin/services/:id - Delete service
 */

import { useState, useEffect } from "react";
import type { ServiceDto } from "@macon/contracts";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useSuccessMessage } from "@/hooks/useSuccessMessage";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { ServiceForm } from "./ServiceForm";
import { ServicesList } from "./ServicesList";
import { CreateServiceButton } from "./CreateServiceButton";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { useServicesManager } from "./useServicesManager";

export function ServicesManager() {
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { message: successMessage, showSuccess } = useSuccessMessage();

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetServices();
      if (result.status === 200) {
        // Sort services by sortOrder ascending
        const sortedServices = [...result.body].sort((a, b) => a.sortOrder - b.sortOrder);
        setServices(sortedServices);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[ServicesManager] Failed to fetch services:", error);
      }
      toast.error("Failed to load services", {
        description: "Please refresh the page or contact support.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isCreatingService,
    editingServiceId,
    isSaving,
    error,
    serviceForm,
    setServiceForm,
    deleteDialogOpen,
    setDeleteDialogOpen,
    serviceToDelete,
    handleCreateService,
    handleEditService,
    handleSaveService,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
    handleToggleActive,
    handleCancelServiceForm,
    handleNameChange,
  } = useServicesManager({ onServicesChange: fetchServices, showSuccess });

  // Wrap handleNameChange to work with ServiceForm
  const handleFormChange = (form: typeof serviceForm) => {
    // If name changed, use handleNameChange for auto-slug (it will update both name and slug)
    if (form.name !== serviceForm.name) {
      handleNameChange(form.name);
      // Then update other fields (excluding name and slug which handleNameChange already set)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, slug, ...otherFields } = form;
      setServiceForm(prev => ({ ...prev, ...otherFields }));
    } else {
      setServiceForm(form);
    }
  };

  return (
    <div className="space-y-6">
      <SuccessMessage message={successMessage} />

      {!isCreatingService && <CreateServiceButton onClick={handleCreateService} />}

      {isCreatingService && (
        <ServiceForm
          serviceForm={serviceForm}
          editingServiceId={editingServiceId}
          isSaving={isSaving}
          error={error}
          onFormChange={handleFormChange}
          onSubmit={handleSaveService}
          onCancel={handleCancelServiceForm}
        />
      )}

      <ServicesList
        services={services}
        onEdit={handleEditService}
        onDelete={handleDeleteClick}
        onToggleActive={handleToggleActive}
        isLoading={isLoading}
      />

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        serviceToDelete={serviceToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
