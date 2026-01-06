'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

interface BlackoutFormProps {
  onSubmit: (data: { startDate: string; endDate: string; reason?: string }) => Promise<void>;
  onCancel: () => void;
}

/**
 * BlackoutForm Component
 *
 * Form for creating new blackout dates.
 * Supports single day or date range selection.
 */
export function BlackoutForm({ onSubmit, onCancel }: BlackoutFormProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isDateRange, setIsDateRange] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get today's date in YYYY-MM-DD format for min date validation
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate) {
      setError('Please select a start date');
      return;
    }

    const effectiveEndDate = isDateRange && endDate ? endDate : startDate;

    if (isDateRange && endDate && new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        startDate,
        endDate: effectiveEndDate,
        reason: reason.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blackout');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Date Type Toggle */}
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="dateType"
            checked={!isDateRange}
            onChange={() => setIsDateRange(false)}
            className="h-4 w-4 border-neutral-300 text-sage focus:ring-sage"
          />
          <span className="text-sm font-medium text-text-primary">Single Day</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="dateType"
            checked={isDateRange}
            onChange={() => setIsDateRange(true)}
            className="h-4 w-4 border-neutral-300 text-sage focus:ring-sage"
          />
          <span className="text-sm font-medium text-text-primary">Date Range</span>
        </label>
      </div>

      {/* Date Inputs */}
      <div className={`grid gap-4 ${isDateRange ? 'sm:grid-cols-2' : ''}`}>
        <div className="space-y-2">
          <Label htmlFor="startDate">{isDateRange ? 'Start Date' : 'Date'}</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={today}
            required
            className="rounded-lg"
          />
        </div>

        {isDateRange && (
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              required={isDateRange}
              className="rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Reason Input */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason <span className="text-text-muted font-normal">(optional)</span>
        </Label>
        <Input
          id="reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Vacation, Conference, Personal day"
          maxLength={200}
          className="rounded-lg"
        />
        <p className="text-xs text-text-muted">
          Add a note to help you remember why this date is blocked
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-full"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="sage"
          disabled={isSubmitting || !startDate}
          className="rounded-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Blackout'
          )}
        </Button>
      </div>
    </form>
  );
}
