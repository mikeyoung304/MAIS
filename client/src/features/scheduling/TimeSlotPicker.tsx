import { useQuery } from '@tanstack/react-query';
import { Loader2, Clock } from 'lucide-react';
import { api } from '@/lib/api';

// Type definition for time slot
interface TimeSlotDto {
  startTime: string; // ISO datetime (UTC)
  endTime: string; // ISO datetime (UTC)
  available: boolean;
}

interface TimeSlotPickerProps {
  serviceId: string;
  selectedDate: Date;
  onSelect: (slot: { startTime: Date; endTime: Date }) => void;
  selectedSlot?: { startTime: Date; endTime: Date };
}

/**
 * TimeSlotPicker component for customer-facing scheduling
 *
 * Displays available time slots for a selected service on a specific date.
 * Fetches slots from the public API and allows customers to pick a time.
 *
 * Features:
 * - React Query integration with automatic refetch on serviceId/date change
 * - Loading states with spinner
 * - Empty state for no available slots
 * - Visual highlighting of selected slot
 * - 12-hour time formatting
 * - Responsive grid layout
 * - Disabled state for unavailable slots
 */
export function TimeSlotPicker({
  serviceId,
  selectedDate,
  onSelect,
  selectedSlot,
}: TimeSlotPickerProps) {
  // Format date to YYYY-MM-DD for API query
  const dateStr = selectedDate.toISOString().split('T')[0];

  // Fetch available slots using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['scheduling', 'slots', serviceId, dateStr],
    queryFn: async () => {
      const response = await api.getAvailableSlots?.({
        query: {
          serviceId,
          date: dateStr,
        },
      });

      if (response?.status === 200) {
        return response.body;
      }

      throw new Error('Failed to fetch available slots');
    },
    enabled: !!serviceId && !!selectedDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  /**
   * Format ISO datetime string to 12-hour time format
   * @example "2025-11-27T09:00:00Z" -> "9:00 AM"
   */
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Check if two time slots are the same
   */
  const isSameSlot = (slot1: { startTime: Date; endTime: Date }, slot2: TimeSlotDto) => {
    return (
      slot1.startTime.toISOString() === slot2.startTime &&
      slot1.endTime.toISOString() === slot2.endTime
    );
  };

  /**
   * Handle slot selection
   */
  const handleSlotClick = (slot: TimeSlotDto) => {
    if (!slot.available) return;

    onSelect({
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-macon-orange" />
        <span className="ml-3 text-lg text-neutral-700">Loading available times...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-red-600">
          Failed to load available time slots. Please try again.
        </p>
      </div>
    );
  }

  // No slots available
  if (!data?.slots || data.slots.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <p className="text-lg text-neutral-700">No time slots available for this date.</p>
        <p className="text-base text-neutral-500 mt-2">Please select a different date.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-2">
        <Clock className="h-5 w-5 mt-0.5 text-neutral-600" />
        <p className="text-lg text-neutral-700">
          Select a time slot for your appointment on{' '}
          <strong>{selectedDate.toLocaleDateString('en-US')}</strong>.
        </p>
      </div>

      {/* Time slots grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {data.slots.map((slot: TimeSlotDto) => {
          const isSelected = selectedSlot && isSameSlot(selectedSlot, slot);
          const isAvailable = slot.available;

          return (
            <button
              key={slot.startTime} // Use startTime as stable unique identifier (ISO datetime string)
              onClick={() => handleSlotClick(slot)}
              disabled={!isAvailable}
              className={`
                px-4 py-3 rounded-lg border text-base font-medium
                transition-all duration-200
                ${
                  isSelected
                    ? 'bg-macon-orange text-white border-macon-orange shadow-md'
                    : isAvailable
                      ? 'bg-white text-neutral-700 border-neutral-300 hover:border-macon-orange hover:shadow-sm'
                      : 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                }
              `}
            >
              {formatTime(slot.startTime)}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-base">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-macon-orange rounded border border-macon-orange" />
          <span className="text-neutral-700">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-white rounded border border-neutral-300" />
          <span className="text-neutral-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-neutral-100 rounded border border-neutral-200" />
          <span className="text-neutral-700">Unavailable</span>
        </div>
      </div>
    </div>
  );
}
