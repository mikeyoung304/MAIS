import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Loader2 } from 'lucide-react';
import type { ServiceFormProps } from './types';

export function ServiceForm({
  serviceForm,
  editingServiceId,
  isSaving,
  error,
  onFormChange,
  onSubmit,
  onCancel,
}: ServiceFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 p-6 border border-white/20 bg-macon-navy-700 rounded-lg"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-white">
          {editingServiceId ? 'Edit Service' : 'Create New Service'}
        </h3>
      </div>

      {error && (
        <div className="p-4 border border-red-500/50 bg-red-900/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <InputEnhanced
            type="text"
            value={serviceForm.name}
            onChange={(e) => onFormChange({ ...serviceForm, name: e.target.value })}
            placeholder="e.g., Strategy Session"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Slug <span className="text-red-500">*</span>
          </label>
          <InputEnhanced
            type="text"
            value={serviceForm.slug}
            onChange={(e) => onFormChange({ ...serviceForm, slug: e.target.value })}
            placeholder="e.g., strategy-session"
            required
            maxLength={100}
            helperText="Lowercase alphanumeric + hyphens only"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-white/90 mb-2">Description</label>
        <textarea
          value={serviceForm.description}
          onChange={(e) => onFormChange({ ...serviceForm, description: e.target.value })}
          placeholder="Optional description of the service"
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-macon-orange focus:outline-none focus:ring-2 focus:ring-macon-orange/30"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Duration (minutes) <span className="text-red-500">*</span>
          </label>
          <InputEnhanced
            type="number"
            value={serviceForm.durationMinutes}
            onChange={(e) => onFormChange({ ...serviceForm, durationMinutes: e.target.value })}
            placeholder="60"
            required
            min={5}
            max={480}
            helperText="5-480 minutes (5 min to 8 hours)"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">Buffer (minutes)</label>
          <InputEnhanced
            type="number"
            value={serviceForm.bufferMinutes}
            onChange={(e) => onFormChange({ ...serviceForm, bufferMinutes: e.target.value })}
            placeholder="0"
            min={0}
            max={120}
            helperText="0-120 minutes buffer time after service"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Price <span className="text-red-500">*</span>
          </label>
          <CurrencyInput
            value={serviceForm.priceCents}
            onChange={(centsValue) => onFormChange({ ...serviceForm, priceCents: centsValue })}
            placeholder="100.00"
            required
            className="h-14 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:border-macon-orange focus:outline-none focus:ring-2 focus:ring-macon-orange/30"
          />
          <p className="mt-1.5 text-sm text-neutral-500">Enter the service price in dollars</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">Timezone</label>
          <select
            value={serviceForm.timezone}
            onChange={(e) => onFormChange({ ...serviceForm, timezone: e.target.value })}
            className="w-full h-14 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white focus:border-macon-orange focus:outline-none focus:ring-2 focus:ring-macon-orange/30"
          >
            <option value="America/New_York">Eastern (America/New_York)</option>
            <option value="America/Chicago">Central (America/Chicago)</option>
            <option value="America/Denver">Mountain (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
            <option value="America/Phoenix">Arizona (America/Phoenix)</option>
            <option value="America/Anchorage">Alaska (America/Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">Sort Order</label>
          <InputEnhanced
            type="number"
            value={serviceForm.sortOrder}
            onChange={(e) => onFormChange({ ...serviceForm, sortOrder: e.target.value })}
            placeholder="0"
            min={0}
            helperText="Lower numbers appear first"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-white/90 mt-8">
            <input
              type="checkbox"
              checked={serviceForm.active}
              onChange={(e) => onFormChange({ ...serviceForm, active: e.target.checked })}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-macon-orange focus:ring-2 focus:ring-macon-orange/30"
            />
            Active
          </label>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-macon-orange hover:bg-macon-orange/90 text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>{editingServiceId ? 'Update Service' : 'Create Service'}</>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="border-white/20 text-white/70 hover:bg-macon-navy-700"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
