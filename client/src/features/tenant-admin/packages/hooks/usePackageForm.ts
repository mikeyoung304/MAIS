import { useState } from 'react';
import { api } from '@/lib/api';
import type { PackageDto } from '@macon/contracts';

export interface PackageFormData {
  title: string;
  description: string;
  priceCents: string;
  minLeadDays: string;
  isActive: boolean;
  // Tier/segment organization fields
  segmentId: string; // Empty string = no segment
  grouping: string; // Free-form tier label (e.g., "Solo", "Couple", "Group")
  groupingOrder: string; // Number as string for input field
}

interface UsePackageFormProps {
  onSuccess: (message: string) => void;
  onPackagesChange: () => void;
}

export function usePackageForm({ onSuccess, onPackagesChange }: UsePackageFormProps) {
  const [form, setForm] = useState<PackageFormData>({
    title: '',
    description: '',
    priceCents: '',
    minLeadDays: '7',
    isActive: true,
    segmentId: '',
    grouping: '',
    groupingOrder: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      priceCents: '',
      minLeadDays: '7',
      isActive: true,
      segmentId: '',
      grouping: '',
      groupingOrder: '',
    });
    setError(null);
  };

  const loadPackage = (pkg: PackageDto) => {
    setForm({
      title: pkg.title,
      description: pkg.description,
      priceCents: pkg.priceCents.toString(),
      minLeadDays: '7', // Frontend-only field, not persisted to backend
      isActive: pkg.isActive !== false,
      segmentId: pkg.segmentId ?? '',
      grouping: pkg.grouping ?? '',
      groupingOrder: pkg.groupingOrder?.toString() ?? '',
    });
  };

  const validateForm = (): boolean => {
    if (!form.title || !form.description || !form.priceCents) {
      setError('Title, description, and price are required');
      return false;
    }

    const priceCents = parseInt(form.priceCents, 10);
    const minLeadDays = parseInt(form.minLeadDays, 10);

    if (isNaN(priceCents) || priceCents <= 0) {
      setError('Price must be a positive number');
      return false;
    }

    if (isNaN(minLeadDays) || minLeadDays < 0) {
      setError('Min lead days must be a non-negative number');
      return false;
    }

    return true;
  };

  const submitForm = async (editingPackageId: string | null) => {
    setError(null);

    if (!validateForm()) {
      return false;
    }

    setIsSaving(true);

    try {
      // Generate slug from title (lowercase, replace spaces with hyphens)
      const slug = form.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Parse groupingOrder - convert to number or null
      const groupingOrder = form.groupingOrder ? parseInt(form.groupingOrder, 10) : null;

      const data = {
        slug,
        title: form.title,
        description: form.description,
        priceCents: parseInt(form.priceCents, 10),
        // Tier/segment organization fields - null if empty
        segmentId: form.segmentId || null,
        grouping: form.grouping || null,
        groupingOrder: isNaN(groupingOrder as number) ? null : groupingOrder,
      };

      if (editingPackageId) {
        const result = await api.tenantAdminUpdatePackage({
          params: { id: editingPackageId },
          body: data,
        });

        if (result.status === 200) {
          onSuccess('Package updated successfully');
          resetForm();
          onPackagesChange();
          return true;
        } else {
          setError('Failed to update package');
          return false;
        }
      } else {
        const result = await api.tenantAdminCreatePackage({
          body: data,
        });

        if (result.status === 201) {
          onSuccess('Package created successfully');
          resetForm();
          onPackagesChange();
          return true;
        } else {
          setError('Failed to create package');
          return false;
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to save package:', err);
      }
      setError('An error occurred while saving the package');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    form,
    setForm,
    isSaving,
    error,
    resetForm,
    loadPackage,
    submitForm,
  };
}
