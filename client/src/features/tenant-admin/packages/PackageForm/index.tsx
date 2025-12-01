import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { FormError } from "@/components/ui/ErrorSummary";
import type { PackageFormData } from "../hooks/usePackageForm";
import type { SegmentDto } from "@macon/contracts";
import { ValidationService } from "./ValidationService";
import { FormHeader } from "./FormHeader";
import { BasicInfoSection } from "./BasicInfoSection";
import { PricingSection } from "./PricingSection";
import { OrganizationSection } from "./OrganizationSection";
import { FormActions } from "./FormActions";

interface PackageFormProps {
  form: PackageFormData;
  setForm: (form: PackageFormData) => void;
  isSaving: boolean;
  error: string | null;
  editingPackageId: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  // Segment data for organization section
  segments?: SegmentDto[];
  isLoadingSegments?: boolean;
  /** When true, segment selection is required (2+ segments exist) */
  requireSegment?: boolean;
}

/**
 * PackageForm Component (Refactored)
 *
 * Main orchestrator for the package form.
 * Coordinates between smaller specialized components.
 * Handles form state, validation, and unsaved changes detection.
 */
export function PackageForm({
  form,
  setForm,
  isSaving,
  error,
  editingPackageId,
  onSubmit,
  onCancel,
  segments = [],
  isLoadingSegments = false,
  requireSegment = false,
}: PackageFormProps) {
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [initialForm, setInitialForm] = useState<PackageFormData>(form);

  // Calculate if form has unsaved changes
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  // Enable unsaved changes warning
  useUnsavedChanges({
    isDirty,
    message: "You have unsaved package changes. Leave anyway?",
    enabled: true
  });

  // Validate field on blur
  const validateField = (field: keyof PackageFormData, value: string | boolean) => {
    const { fieldError } = ValidationService.validateField(field, value);
    const newFieldErrors = { ...fieldErrors };

    if (fieldError) {
      newFieldErrors[field] = fieldError;
    } else {
      delete newFieldErrors[field];
    }

    setFieldErrors(newFieldErrors);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = ValidationService.validateForm(form);

    // Validate segment selection when required
    if (requireSegment && !form.segmentId) {
      errors.push({ field: 'segmentId', message: 'Please select a segment for this package' });
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onSubmit(e);
  };

  // Show success message after save
  useEffect(() => {
    if (!isSaving && !error && validationErrors.length === 0) {
      setShowSuccess(true);
      setInitialForm(form);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, error, validationErrors.length, form]);

  // Update initial form when editing a different package
  useEffect(() => {
    setInitialForm(form);
  }, [editingPackageId]);

  return (
    <>
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <FormHeader
          editingPackageId={editingPackageId}
          showSuccess={showSuccess}
          validationErrors={validationErrors}
          error={error}
          onCancel={onCancel}
          onDismissValidation={() => setValidationErrors([])}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <BasicInfoSection
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            validateField={validateField}
            isSaving={isSaving}
          />

          <PricingSection
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            validateField={validateField}
            isSaving={isSaving}
          />

          <OrganizationSection
            form={form}
            setForm={setForm}
            segments={segments}
            isLoadingSegments={isLoadingSegments}
            isSaving={isSaving}
            requireSegment={requireSegment}
          />

          <FormActions
            isSaving={isSaving}
            editingPackageId={editingPackageId}
            onCancel={onCancel}
          />
        </form>
      </Card>
    </>
  );
}