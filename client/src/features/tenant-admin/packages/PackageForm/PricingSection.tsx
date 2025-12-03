import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { PackageFormData } from "../hooks/usePackageForm";

interface PricingSectionProps {
  form: PackageFormData;
  setForm: (form: PackageFormData) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (errors: Record<string, string>) => void;
  validateField: (field: keyof PackageFormData, value: string | boolean) => void;
  isSaving: boolean;
}

/**
 * PricingSection Component
 *
 * Handles pricing and timing configuration fields:
 * - Price (in cents)
 * - Minimum lead days
 * - Active status
 */
export function PricingSection({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  validateField,
  isSaving
}: PricingSectionProps) {
  return (
    <>
      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Price Field */}
        <div className="space-y-2">
          <Label htmlFor="priceCents" className="text-white/90 text-lg">
            Price (cents) <span className="text-red-400">*</span>
          </Label>
          <Input
            id="priceCents"
            type="number"
            value={form.priceCents}
            onChange={(e) => {
              setForm({ ...form, priceCents: e.target.value });
              if (fieldErrors.priceCents) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { priceCents, ...rest } = fieldErrors;
                setFieldErrors(rest);
              }
            }}
            onBlur={(e) => validateField('priceCents', e.target.value)}
            placeholder="50000"
            min="0"
            disabled={isSaving}
            className={`bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12 ${
              fieldErrors.priceCents ? 'border-danger-600' : ''
            }`}
            aria-invalid={!!fieldErrors.priceCents}
            aria-describedby={fieldErrors.priceCents ? 'priceCents-error' : 'priceCents-help'}
            required
          />
          {fieldErrors.priceCents ? (
            <p id="priceCents-error" className="text-sm text-danger-700 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {fieldErrors.priceCents}
            </p>
          ) : (
            <p id="priceCents-help" className="text-base text-white/70">
              {form.priceCents && !isNaN(parseInt(form.priceCents, 10))
                ? formatCurrency(parseInt(form.priceCents, 10))
                : "Enter price in cents (e.g., 50000 = $500.00)"}
            </p>
          )}
        </div>

        {/* Min Lead Days Field */}
        <div className="space-y-2">
          <Label htmlFor="minLeadDays" className="text-white/90 text-lg">
            Min Lead Days
          </Label>
          <Input
            id="minLeadDays"
            type="number"
            value={form.minLeadDays}
            onChange={(e) => setForm({ ...form, minLeadDays: e.target.value })}
            placeholder="7"
            min="0"
            disabled={isSaving}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          />
          <p className="text-base text-white/70">Days before event date required</p>
        </div>
      </div>

      {/* Active Status Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          disabled={isSaving}
          className="w-5 h-5 rounded border-white/20 bg-macon-navy-900 text-white0 focus:ring-macon-navy-500"
        />
        <Label htmlFor="isActive" className="text-white/90 text-lg cursor-pointer">
          Active (available for booking)
        </Label>
      </div>
    </>
  );
}