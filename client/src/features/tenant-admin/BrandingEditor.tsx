import { Loader2 } from "lucide-react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { BrandingForm } from "./branding/components/BrandingForm";
import { BrandingPreview } from "./branding/components/BrandingPreview";
import { useBrandingManager } from "./branding/hooks/useBrandingManager";
import type { TenantBrandingDto } from "@macon/contracts";

interface BrandingEditorProps {
  branding: TenantBrandingDto | null;
  isLoading: boolean;
  onBrandingChange: () => void;
}

/**
 * BrandingEditor Component
 *
 * Main coordinator for tenant branding management.
 * Delegates form state and business logic to useBrandingManager hook.
 */

export function BrandingEditor({ branding, isLoading, onBrandingChange }: BrandingEditorProps) {
  const manager = useBrandingManager({ branding, onBrandingChange });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">Brand Customization</h2>
          <p className="text-text-muted text-sm mt-1">
            Customize colors and fonts for your booking widget
          </p>
        </div>
      </div>

      {/* Success Message */}
      <SuccessMessage message={manager.successMessage} />

      {isLoading ? (
        <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" />
          <p className="text-text-muted mt-3">Loading branding settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branding Form */}
          <BrandingForm
            form={manager.form}
            isSaving={manager.isSaving}
            error={manager.error}
            onFieldChange={manager.updateField}
            onSubmit={manager.handleSave}
          />

          {/* Live Preview */}
          <BrandingPreview
            primaryColor={manager.form.primaryColor}
            secondaryColor={manager.form.secondaryColor}
            accentColor={manager.form.accentColor}
            backgroundColor={manager.form.backgroundColor}
            fontFamily={manager.form.fontFamily}
            logoUrl={manager.form.logoUrl}
          />
        </div>
      )}
    </div>
  );
}
