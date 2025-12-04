import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantFormData, TenantFormErrors } from './types';

interface ConfigurationFieldsProps {
  formData: TenantFormData;
  errors: TenantFormErrors;
  isSubmitting: boolean;
  onChange: (updates: Partial<TenantFormData>) => void;
}

export function ConfigurationFields({
  formData,
  errors,
  isSubmitting,
  onChange,
}: ConfigurationFieldsProps) {
  return (
    <>
      {/* Commission Rate */}
      <div className="space-y-2">
        <Label htmlFor="commissionRate" className="text-white/90">
          Commission Rate (%) *
        </Label>
        <select
          id="commissionRate"
          value={formData.commissionRate.toString()}
          onChange={(e) => onChange({ commissionRate: parseInt(e.target.value) })}
          disabled={isSubmitting}
          className="w-full px-3 py-2 bg-macon-navy-900 border border-white/20 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-macon-navy-500"
        >
          <option value="10">10%</option>
          <option value="12">12%</option>
          <option value="15">15%</option>
          <option value="20">20%</option>
        </select>
        {errors.commissionRate && <p className="text-red-400 text-sm">{errors.commissionRate}</p>}
      </div>

      {/* Stripe Account ID */}
      <div className="space-y-2">
        <Label htmlFor="stripeAccountId" className="text-white/90">
          Stripe Account ID
        </Label>
        <Input
          id="stripeAccountId"
          value={formData.stripeAccountId}
          onChange={(e) => onChange({ stripeAccountId: e.target.value })}
          className="bg-macon-navy-900 border-white/20 text-white"
          placeholder="acct_1234567890"
          disabled={isSubmitting}
        />
        <p className="text-white/60 text-sm">Leave empty to set up later</p>
      </div>

      {/* Active Status */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="isActive" className="text-white/90">
            Active Status
          </Label>
          <p className="text-sm text-white/60">Active tenants can accept bookings</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="isActive"
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            disabled={isSubmitting}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-macon-navy-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-macon-navy-300 dark:peer-focus:ring-macon-navy-800 rounded-full peer dark:bg-macon-navy-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-lavender-600"></div>
        </label>
      </div>
    </>
  );
}
