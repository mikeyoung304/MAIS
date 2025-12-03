/**
 * BrandingForm Component
 *
 * Form for editing branding settings with modular sub-components
 * Design: Matches landing page aesthetic with sage accents
 *
 * Refactored to accept form object instead of 11 individual props (TODO 106)
 */

import { Save, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ColorInput } from "./ColorInput";
import { FontSelector } from "./FontSelector";
import { LogoSection } from "./LogoSection";
import { ErrorMessage } from "./ErrorMessage";
import type { BrandingForm as BrandingFormData } from "../../hooks/useBrandingManager";

interface BrandingFormProps {
  form: BrandingFormData;
  isSaving: boolean;
  error: string | null;
  onFieldChange: <K extends keyof BrandingFormData>(field: K, value: BrandingFormData[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function BrandingForm({
  form,
  isSaving,
  error,
  onFieldChange,
  onSubmit,
}: BrandingFormProps) {
  return (
    <TooltipProvider>
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6">
        <SectionHeader
          icon={Palette}
          title="Colors & Typography"
          description="Define your brand palette"
        />

        <ErrorMessage error={error} />

        <form onSubmit={onSubmit} className="space-y-5">
          <ColorInput
            id="primaryColor"
            label="Primary Color"
            value={form.primaryColor}
            placeholder="#9b87f5"
            helpText="Main brand color used for buttons, links, and primary accents"
            disabled={isSaving}
            onChange={(value) => onFieldChange('primaryColor', value)}
          />

          <ColorInput
            id="secondaryColor"
            label="Secondary Color"
            value={form.secondaryColor}
            placeholder="#d97706"
            helpText="Supporting color for highlights and secondary actions"
            disabled={isSaving}
            onChange={(value) => onFieldChange('secondaryColor', value)}
          />

          <ColorInput
            id="accentColor"
            label="Accent Color"
            value={form.accentColor}
            placeholder="#0d9488"
            helpText="Accent color for success states, highlights, and special elements"
            disabled={isSaving}
            onChange={(value) => onFieldChange('accentColor', value)}
          />

          <ColorInput
            id="backgroundColor"
            label="Background Color"
            value={form.backgroundColor}
            placeholder="#ffffff"
            helpText="Main background color used throughout your booking widget"
            disabled={isSaving}
            onChange={(value) => onFieldChange('backgroundColor', value)}
          />

          <FontSelector
            value={form.fontFamily}
            disabled={isSaving}
            onChange={(value) => onFieldChange('fontFamily', value)}
          />

          <LogoSection
            logoUrl={form.logoUrl}
            disabled={isSaving}
            onLogoUrlChange={(value) => onFieldChange('logoUrl', value)}
          />

          {/* Save Button */}
          <div className="pt-4">
            <Button
              type="submit"
              isLoading={isSaving}
              loadingText="Saving..."
              className="w-full bg-sage hover:bg-sage-hover text-white h-11 rounded-full shadow-soft hover:shadow-medium transition-all duration-300"
            >
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Branding
            </Button>
          </div>
        </form>
      </div>
    </TooltipProvider>
  );
}