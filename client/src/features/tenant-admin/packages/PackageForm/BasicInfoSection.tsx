import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PackageFormData } from "../hooks/usePackageForm";

interface BasicInfoSectionProps {
  form: PackageFormData;
  setForm: (form: PackageFormData) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (errors: Record<string, string>) => void;
  validateField: (field: keyof PackageFormData, value: string | boolean) => void;
  isSaving: boolean;
}

/**
 * BasicInfoSection Component
 *
 * Handles the basic information fields for the package form:
 * - Title
 * - Description
 */
export function BasicInfoSection({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  validateField,
  isSaving
}: BasicInfoSectionProps) {
  return (
    <>
      {/* Title Field */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-white/90 text-lg">
          Title <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          type="text"
          value={form.title}
          onChange={(e) => {
            setForm({ ...form, title: e.target.value });
            // Clear error when user starts typing
            if (fieldErrors.title) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { title, ...rest } = fieldErrors;
              setFieldErrors(rest);
            }
          }}
          onBlur={(e) => validateField('title', e.target.value)}
          placeholder="Premium Consulting Package"
          disabled={isSaving}
          className={`bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12 ${
            fieldErrors.title ? 'border-danger-600' : ''
          }`}
          aria-invalid={!!fieldErrors.title}
          aria-describedby={fieldErrors.title ? 'title-error' : undefined}
          required
        />
        {fieldErrors.title && (
          <p id="title-error" className="text-sm text-danger-700 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {fieldErrors.title}
          </p>
        )}
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-white/90 text-lg">
          Description <span className="text-red-400">*</span>
        </Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => {
            setForm({ ...form, description: e.target.value });
            if (fieldErrors.description) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { description, ...rest } = fieldErrors;
              setFieldErrors(rest);
            }
          }}
          onBlur={(e) => validateField('description', e.target.value)}
          rows={3}
          placeholder="A premium service that transforms your clients' experience..."
          disabled={isSaving}
          className={`bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg ${
            fieldErrors.description ? 'border-danger-600' : ''
          }`}
          aria-invalid={!!fieldErrors.description}
          aria-describedby={fieldErrors.description ? 'description-error' : undefined}
          required
        />
        {fieldErrors.description && (
          <p id="description-error" className="text-sm text-danger-700 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {fieldErrors.description}
          </p>
        )}
      </div>
    </>
  );
}