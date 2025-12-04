import { useState } from 'react';
import type { TenantFormData, TenantFormErrors } from './types';

export function useTenantForm() {
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    commissionRate: 10,
    stripeAccountId: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<TenantFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = (updates: Partial<TenantFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const validateForm = (): boolean => {
    const newErrors: TenantFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.commissionRate < 0 || formData.commissionRate > 100) {
      newErrors.commissionRate = 'Commission rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateSlug = () => {
    if (formData.name && !formData.slug) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      updateFormData({ slug });
    }
  };

  return {
    formData,
    setFormData,
    updateFormData,
    errors,
    setErrors,
    isLoading,
    setIsLoading,
    isSubmitting,
    setIsSubmitting,
    validateForm,
    generateSlug,
  };
}
