'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { AppointmentTypeFormData } from '@/app/(protected)/tenant/scheduling/appointment-types/page';

interface AppointmentTypeFormProps {
  formData: AppointmentTypeFormData;
  editingId: string | null;
  isSaving: boolean;
  error: string | null;
  onFormChange: (updates: Partial<AppointmentTypeFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
];

/**
 * Appointment Type Form Component
 *
 * Form for creating and editing appointment types.
 * Handles validation and submission.
 */
export function AppointmentTypeForm({
  formData,
  editingId,
  isSaving,
  error,
  onFormChange,
  onSubmit,
  onCancel,
}: AppointmentTypeFormProps) {
  /**
   * Convert cents to dollars for display
   */
  const centsToDisplay = (cents: string): string => {
    const numCents = parseInt(cents, 10) || 0;
    return (numCents / 100).toFixed(2);
  };

  /**
   * Convert dollars input to cents
   */
  const handlePriceChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');
    // Parse as float and convert to cents
    const dollars = parseFloat(cleaned) || 0;
    const cents = Math.round(dollars * 100);
    onFormChange({ priceCents: cents.toString() });
  };

  return (
    <Card className="border-sage/20 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl">
          {editingId ? 'Edit Appointment Type' : 'Create Appointment Type'}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Name and Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
                placeholder="e.g., Strategy Session"
                required
                maxLength={100}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                type="text"
                value={formData.slug}
                onChange={(e) => onFormChange({ slug: e.target.value })}
                placeholder="e.g., strategy-session"
                required
                maxLength={100}
                className="rounded-lg font-mono"
              />
              <p className="text-xs text-text-muted">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
              placeholder="Optional description of this appointment type"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-sage focus:outline-none focus:ring-4 focus:ring-sage/30 transition-all duration-200"
            />
          </div>

          {/* Duration and Buffer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration (minutes) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="duration"
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => onFormChange({ durationMinutes: e.target.value })}
                placeholder="60"
                required
                min={5}
                max={480}
                className="rounded-lg"
              />
              <p className="text-xs text-text-muted">5-480 minutes (5 min to 8 hours)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buffer">Buffer (minutes)</Label>
              <Input
                id="buffer"
                type="number"
                value={formData.bufferMinutes}
                onChange={(e) => onFormChange({ bufferMinutes: e.target.value })}
                placeholder="0"
                min={0}
                max={120}
                className="rounded-lg"
              />
              <p className="text-xs text-text-muted">0-120 minutes buffer after appointment</p>
            </div>
          </div>

          {/* Price and Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="price">
                Price ($) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <Input
                  id="price"
                  type="text"
                  value={centsToDisplay(formData.priceCents)}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="100.00"
                  required
                  className="rounded-lg pl-7"
                />
              </div>
              <p className="text-xs text-text-muted">Enter the price in dollars</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => onFormChange({ timezone: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 focus:border-sage focus:outline-none focus:ring-4 focus:ring-sage/30 transition-all duration-200"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Order and Active Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => onFormChange({ sortOrder: e.target.value })}
                placeholder="0"
                min={0}
                className="rounded-lg"
              />
              <p className="text-xs text-text-muted">Lower numbers appear first</p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3 h-11">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => onFormChange({ active: checked })}
                />
                <Label htmlFor="active" className="cursor-pointer font-normal">
                  {formData.active ? 'Active' : 'Inactive'}
                </Label>
              </div>
              <p className="text-xs text-text-muted">
                {formData.active
                  ? 'This appointment type is visible to customers'
                  : 'This appointment type is hidden from customers'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-neutral-200">
            <Button type="submit" variant="sage" className="rounded-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                'Update Appointment Type'
              ) : (
                'Create Appointment Type'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
