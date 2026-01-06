'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, Plus, Loader2, AlertCircle } from 'lucide-react';
import { AppointmentTypesList } from '@/components/scheduling/AppointmentTypesList';
import { AppointmentTypeForm } from '@/components/scheduling/AppointmentTypeForm';
import { DeleteAppointmentTypeDialog } from '@/components/scheduling/DeleteAppointmentTypeDialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys, queryOptions } from '@/lib/query-client';
import type { ServiceDto } from '@macon/contracts';

/**
 * Appointment Type DTO
 *
 * Uses ServiceDto from contracts - UI uses "Appointment Type" terminology.
 */
export type AppointmentTypeDto = ServiceDto;

/**
 * Form data for creating/editing appointment types
 */
export interface AppointmentTypeFormData {
  slug: string;
  name: string;
  description: string;
  durationMinutes: string;
  bufferMinutes: string;
  priceCents: string;
  timezone: string;
  sortOrder: string;
  active: boolean;
}

const initialFormData: AppointmentTypeFormData = {
  slug: '',
  name: '',
  description: '',
  durationMinutes: '60',
  bufferMinutes: '0',
  priceCents: '0',
  timezone: 'America/New_York',
  sortOrder: '0',
  active: true,
};

/**
 * Appointment Types Manager Page
 *
 * Allows tenant admins to manage their appointment types (services).
 * Uses "Appointment Type" in the UI for clarity.
 */
export default function AppointmentTypesPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Fetch appointment types with React Query
  const {
    data: appointmentTypes = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.services,
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/services');
      if (!response.ok) throw new Error('Failed to load appointment types');
      const data = await response.json();
      return Array.isArray(data) ? (data as AppointmentTypeDto[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.catalog, // Services change less frequently
  });

  const error = queryError ? (queryError as Error).message : null;

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AppointmentTypeFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<AppointmentTypeDto | null>(null);

  /**
   * Invalidate and refetch appointment types after mutations
   */
  const invalidateAppointmentTypes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.services });
  }, [queryClient]);

  /**
   * Generate slug from name (kebab-case)
   */
  const generateSlug = (name: string): string => {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-') || 'untitled'
    );
  };

  /**
   * Validate slug format
   */
  const isValidSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug);
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setFormError(null);
  };

  /**
   * Handle creating a new appointment type
   */
  const handleCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  /**
   * Handle editing an existing appointment type
   */
  const handleEdit = (type: AppointmentTypeDto) => {
    setFormData({
      slug: type.slug,
      name: type.name,
      description: type.description || '',
      durationMinutes: type.durationMinutes.toString(),
      bufferMinutes: type.bufferMinutes.toString(),
      priceCents: type.priceCents.toString(),
      timezone: type.timezone,
      sortOrder: type.sortOrder.toString(),
      active: type.active,
    });
    setEditingId(type.id);
    setIsFormOpen(true);
  };

  /**
   * Handle form field changes
   */
  const handleFormChange = (updates: Partial<AppointmentTypeFormData>) => {
    setFormData((prev) => {
      const newData = { ...prev, ...updates };
      // Auto-generate slug from name when creating (not editing)
      if ('name' in updates && !editingId) {
        newData.slug = generateSlug(updates.name || '');
      }
      return newData;
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate required fields
    if (!formData.slug || !formData.name) {
      toast.error('Missing Required Fields', {
        description: 'Name and slug are required',
      });
      return;
    }

    // Validate slug format
    if (!isValidSlug(formData.slug)) {
      toast.error('Invalid Slug Format', {
        description: 'Slug must be lowercase with hyphens only (no spaces)',
      });
      return;
    }

    // Validate numeric fields
    const durationMinutes = parseInt(formData.durationMinutes, 10);
    const bufferMinutes = parseInt(formData.bufferMinutes, 10);
    const priceCents = parseInt(formData.priceCents, 10);
    const sortOrder = parseInt(formData.sortOrder, 10);

    if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      toast.error('Invalid Duration', {
        description: 'Duration must be between 5 and 480 minutes',
      });
      return;
    }

    if (isNaN(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) {
      toast.error('Invalid Buffer Time', {
        description: 'Buffer must be between 0 and 120 minutes',
      });
      return;
    }

    if (isNaN(priceCents) || priceCents < 0) {
      toast.error('Invalid Price', {
        description: 'Price must be 0 or greater',
      });
      return;
    }

    if (isNaN(sortOrder) || sortOrder < 0) {
      toast.error('Invalid Sort Order', {
        description: 'Sort order must be a number >= 0',
      });
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId
        ? `/api/tenant-admin/services/${editingId}`
        : '/api/tenant-admin/services';
      const method = editingId ? 'PUT' : 'POST';

      const body = editingId
        ? {
            slug: formData.slug,
            name: formData.name,
            description: formData.description || undefined,
            durationMinutes,
            bufferMinutes,
            priceCents,
            timezone: formData.timezone,
            sortOrder,
            active: formData.active,
          }
        : {
            slug: formData.slug,
            name: formData.name,
            description: formData.description || undefined,
            durationMinutes,
            bufferMinutes,
            priceCents,
            timezone: formData.timezone,
            sortOrder,
            segmentId: null,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingId ? 'Appointment type updated' : 'Appointment type created');
        setIsFormOpen(false);
        resetForm();
        invalidateAppointmentTypes();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Failed to save appointment type', {
          description: errorData.message || 'Please try again',
        });
      }
    } catch (err) {
      logger.error('Failed to save appointment type', { error: err, editingId });
      toast.error('An error occurred', {
        description: 'Please try again or contact support',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel form
   */
  const handleCancel = () => {
    setIsFormOpen(false);
    resetForm();
  };

  /**
   * Handle delete click
   */
  const handleDeleteClick = (type: AppointmentTypeDto) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  /**
   * Confirm delete
   */
  const confirmDelete = async () => {
    if (!typeToDelete) return;

    try {
      const response = await fetch(`/api/tenant-admin/services/${typeToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        toast.success('Appointment type deleted');
        setDeleteDialogOpen(false);
        setTypeToDelete(null);
        invalidateAppointmentTypes();
      } else {
        toast.error('Failed to delete appointment type', {
          description: 'Please try again',
        });
      }
    } catch (err) {
      logger.error('Failed to delete appointment type', { error: err, typeId: typeToDelete.id });
      toast.error('An error occurred', {
        description: 'Please try again or contact support',
      });
    }
  };

  /**
   * Cancel delete
   */
  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  /**
   * Toggle active status
   */
  const handleToggleActive = async (type: AppointmentTypeDto) => {
    try {
      const response = await fetch(`/api/tenant-admin/services/${type.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !type.active }),
      });

      if (response.ok) {
        toast.success(`Appointment type ${!type.active ? 'activated' : 'deactivated'}`);
        invalidateAppointmentTypes();
      } else {
        toast.error('Failed to update status', {
          description: 'Please try again',
        });
      }
    } catch (err) {
      logger.error('Failed to toggle appointment type status', { error: err, typeId: type.id });
      toast.error('An error occurred', {
        description: 'Please try again or contact support',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Appointment Types</h1>
            <p className="mt-2 text-text-muted">Manage your bookable services</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Appointment Types</h1>
            <p className="mt-2 text-text-muted">Manage your bookable services</p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Appointment Types</h1>
          <p className="mt-2 text-text-muted">
            {appointmentTypes.length === 0
              ? 'Create your first appointment type to get started'
              : `${appointmentTypes.length} appointment type${appointmentTypes.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
        {!isFormOpen && (
          <Button variant="sage" className="rounded-full" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Appointment Type
          </Button>
        )}
      </div>

      {/* Form (shown when creating or editing) */}
      {isFormOpen && (
        <AppointmentTypeForm
          formData={formData}
          editingId={editingId}
          isSaving={isSaving}
          error={formError}
          onFormChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {/* Empty State */}
      {!isFormOpen && appointmentTypes.length === 0 && (
        <Card className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-sage/10 p-4">
              <CalendarClock className="h-8 w-8 text-sage" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No appointment types yet</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Appointment types define the services you offer to customers. Create your first
              appointment type to start accepting bookings.
            </p>
            <Button variant="sage" className="rounded-full" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Appointment Type
            </Button>
          </CardContent>
        </Card>
      )}

      {/* List of appointment types */}
      {!isFormOpen && appointmentTypes.length > 0 && (
        <AppointmentTypesList
          appointmentTypes={appointmentTypes}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onToggleActive={handleToggleActive}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteAppointmentTypeDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        typeToDelete={typeToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
