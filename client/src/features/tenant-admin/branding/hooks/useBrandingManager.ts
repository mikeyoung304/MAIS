/**
 * useBrandingManager Hook
 *
 * Extracted from BrandingEditor to follow Single Responsibility Principle.
 * Manages form state, validation, and API calls for branding customization.
 *
 * Responsibilities:
 * - Form state management (colors, fonts, logo)
 * - Hex color validation
 * - API calls for saving branding
 * - Success/error message handling
 * - Syncing form with branding prop changes
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useSuccessMessage } from '@/hooks/useSuccessMessage';
import type { TenantBrandingDto } from '@macon/contracts';

export interface BrandingForm {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  logoUrl: string;
}

interface UseBrandingManagerProps {
  branding: TenantBrandingDto | null;
  onBrandingChange: () => void;
}

interface UseBrandingManagerReturn {
  form: BrandingForm;
  updateField: <K extends keyof BrandingForm>(field: K, value: BrandingForm[K]) => void;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  handleSave: (e: React.FormEvent) => Promise<void>;
}

const DEFAULT_BRANDING: BrandingForm = {
  primaryColor: '#1a365d',
  secondaryColor: '#d97706',
  accentColor: '#0d9488',
  backgroundColor: '#ffffff',
  fontFamily: 'Inter',
  logoUrl: '',
};

/**
 * Hook for managing branding form state and business logic
 */
export function useBrandingManager({
  branding,
  onBrandingChange,
}: UseBrandingManagerProps): UseBrandingManagerReturn {
  const [form, setForm] = useState<BrandingForm>(DEFAULT_BRANDING);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message: successMessage, showSuccess } = useSuccessMessage();

  // Sync form state with branding prop changes
  useEffect(() => {
    if (branding) {
      setForm({
        primaryColor: branding.primaryColor || DEFAULT_BRANDING.primaryColor,
        secondaryColor: branding.secondaryColor || DEFAULT_BRANDING.secondaryColor,
        accentColor: branding.accentColor || DEFAULT_BRANDING.accentColor,
        backgroundColor: branding.backgroundColor || DEFAULT_BRANDING.backgroundColor,
        fontFamily: branding.fontFamily || DEFAULT_BRANDING.fontFamily,
        logoUrl: branding.logo || DEFAULT_BRANDING.logoUrl,
      });
    }
  }, [branding]);

  // Update a single form field
  const updateField = useCallback(<K extends keyof BrandingForm>(field: K, value: BrandingForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Validate hex color format
  const validateHexColor = (color: string, fieldName: string): boolean => {
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    if (!hexColorRegex.test(color)) {
      setError(`${fieldName} must be a valid hex color (e.g., #1a365d)`);
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate all hex colors
      if (!validateHexColor(form.primaryColor, 'Primary color')) return;
      if (!validateHexColor(form.secondaryColor, 'Secondary color')) return;
      if (!validateHexColor(form.accentColor, 'Accent color')) return;
      if (!validateHexColor(form.backgroundColor, 'Background color')) return;

      setIsSaving(true);

      try {
        const result = await api.tenantAdminUpdateBranding({
          body: {
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            accentColor: form.accentColor,
            backgroundColor: form.backgroundColor,
            fontFamily: form.fontFamily,
          },
        });

        if (result.status === 200) {
          showSuccess('Branding updated successfully');
          onBrandingChange();
        } else {
          setError('Failed to update branding');
        }
      } catch (err) {
        logger.error('Failed to save branding:', { error: err, component: 'useBrandingManager' });
        setError('An error occurred while saving branding');
      } finally {
        setIsSaving(false);
      }
    },
    [form, onBrandingChange, showSuccess]
  );

  return {
    form,
    updateField,
    isSaving,
    error,
    successMessage,
    handleSave,
  };
}
