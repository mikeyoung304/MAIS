'use client';

import { useState } from 'react';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTime } from '@/lib/format';
import { DAYS_OF_WEEK } from '@/lib/constants';
import type { ServiceDto } from '@macon/contracts';

interface RuleFormData {
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface AvailabilityRuleFormProps {
  services: ServiceDto[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Generate time options for dropdowns in 30-minute increments
 */
function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hours = h.toString().padStart(2, '0');
      const minutes = m.toString().padStart(2, '0');
      times.push(`${hours}:${minutes}`);
    }
  }
  return times;
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * AvailabilityRuleForm Component
 *
 * Form for creating a new availability rule with day, time range, and optional service filter.
 */
export function AvailabilityRuleForm({ services, onSuccess, onCancel }: AvailabilityRuleFormProps) {
  const timeOptions = generateTimeOptions();

  const [formData, setFormData] = useState<RuleFormData>({
    serviceId: null,
    dayOfWeek: 1, // Default to Monday
    startTime: '09:00',
    endTime: '17:00',
    effectiveFrom: getTodayISODate(),
    effectiveTo: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate time range
    if (formData.startTime >= formData.endTime) {
      setError('End time must be after start time');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/tenant-admin/availability-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: formData.serviceId,
          dayOfWeek: formData.dayOfWeek,
          startTime: formData.startTime,
          endTime: formData.endTime,
          effectiveFrom: formData.effectiveFrom,
          effectiveTo: formData.effectiveTo,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create availability rule');
      }
    } catch {
      setError('Failed to create availability rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Add Availability Rule</CardTitle>
        <Button
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={isSaving}
        >
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="serviceId">Service (optional)</Label>
            <Select
              value={formData.serviceId ?? 'all'}
              onValueChange={(value) =>
                setFormData({ ...formData, serviceId: value === 'all' ? null : value })
              }
              disabled={isSaving}
            >
              <SelectTrigger id="serviceId">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-muted">
              Leave as &quot;All Services&quot; to apply this availability to all your services
            </p>
          </div>

          {/* Day of Week */}
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day of Week</Label>
            <Select
              value={formData.dayOfWeek.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, dayOfWeek: parseInt(value, 10) })
              }
              disabled={isSaving}
            >
              <SelectTrigger id="dayOfWeek">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Time */}
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Select
                value={formData.startTime}
                onValueChange={(value) => setFormData({ ...formData, startTime: value })}
                disabled={isSaving}
              >
                <SelectTrigger id="startTime">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Select
                value={formData.endTime}
                onValueChange={(value) => setFormData({ ...formData, endTime: value })}
                disabled={isSaving}
              >
                <SelectTrigger id="endTime">
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Effective Date Range */}
          <div className="grid grid-cols-2 gap-4">
            {/* Effective From */}
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                disabled={isSaving}
                className="rounded-xl"
              />
            </div>

            {/* Effective To */}
            <div className="space-y-2">
              <Label htmlFor="effectiveTo">Effective To (optional)</Label>
              <Input
                id="effectiveTo"
                type="date"
                value={formData.effectiveTo || ''}
                onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value || null })}
                disabled={isSaving}
                className="rounded-xl"
              />
              <p className="text-xs text-text-muted">Leave blank for no end date</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button type="submit" variant="sage" className="rounded-full" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
