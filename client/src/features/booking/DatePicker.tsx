import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DayPicker } from "react-day-picker";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUtcMidnight } from "@macon/shared";
import { api } from "../../lib/api";
import { cn } from "@/lib/utils";
import { queryKeys, queryOptions } from "@/lib/queryClient";
import "react-day-picker/style.css";
import styles from "./DatePicker.module.css";

interface DatePickerProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

// Helper to calculate date range (60 days from today)
function getDateRange() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 60);

  return {
    startDate: toUtcMidnight(today),
    endDate: toUtcMidnight(endDate),
  };
}

export function DatePicker({ selected, onSelect }: DatePickerProps) {
  const today = new Date();
  const [localUnavailable, setLocalUnavailable] = useState<Date[]>([]);

  // Calculate date range for batch query
  const { startDate, endDate } = useMemo(() => getDateRange(), []);

  // Batch fetch unavailable dates using React Query
  const { data: unavailableData, isLoading, error: fetchError } = useQuery({
    queryKey: queryKeys.availability.dateRange(startDate, endDate),
    queryFn: async () => {
      const response = await api.getUnavailableDates?.({
        query: { startDate, endDate },
      });
      return response?.status === 200 ? response.body : { dates: [] };
    },
    staleTime: queryOptions.availability.staleTime,
    gcTime: queryOptions.availability.gcTime,
    retry: 2, // Retry failed requests twice before giving up
  });

  // Convert string dates to Date objects
  const unavailableDates = useMemo(() => {
    const dates: Date[] = [];

    // Add fetched unavailable dates
    if (unavailableData?.dates) {
      unavailableData.dates.forEach((dateStr) => {
        const date = new Date(dateStr);
        dates.push(date);
      });
    }

    // Add locally marked unavailable dates
    localUnavailable.forEach((date) => {
      dates.push(date);
    });

    return dates;
  }, [unavailableData, localUnavailable]);

  // Handle date selection with real-time availability check
  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) {
      onSelect(undefined);
      return;
    }

    // Check if date is in our unavailable list
    const dateStr = toUtcMidnight(date);
    const isUnavailable = unavailableDates.some(
      (unavailableDate) => toUtcMidnight(unavailableDate) === dateStr
    );

    if (isUnavailable) {
      toast.error("Date Unavailable", {
        description: `Sorry, ${dateStr} is not available. Please choose another date.`,
        duration: 5000,
      });
      onSelect(undefined);
      return;
    }

    // Double-check with API for edge cases (date just booked, etc.)
    try {
      const response = await api.getAvailability?.({ query: { date: dateStr } });

      if (response?.status === 200 && response.body.available) {
        onSelect(date);
      } else {
        // Add to local unavailable list
        setLocalUnavailable((prev) => [...prev, date]);
        toast.error("Date Unavailable", {
          description: `Sorry, ${dateStr} is not available. Please choose another date.`,
          duration: 5000,
        });
        onSelect(undefined);
      }
    } catch (error) {
      // FAIL CLOSED: On error, reject selection to prevent double-bookings
      toast.error("Unable to Verify Availability", {
        description: "We couldn't verify availability for this date. Please try again or contact support.",
        duration: 5000,
      });
      onSelect(undefined);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-2">
        <Calendar className="h-5 w-5 mt-0.5 text-neutral-600" />
        <p className="text-lg text-neutral-700">
          Select a date for your appointment. Unavailable dates are pre-loaded for your
          convenience.
        </p>
      </div>

      {fetchError ? (
        <div className="border border-red-300 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-1">
                Unable to Load Availability
              </h3>
              <p className="text-red-700 mb-4">
                We're having trouble loading available dates. Please refresh the page to try again.
                If the problem persists, contact support.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-macon-orange" />
          <span className="ml-3 text-lg text-neutral-700">Loading availability...</span>
        </div>
      ) : (
        <>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleDateSelect}
            disabled={[{ before: today }, ...unavailableDates]}
            className={cn(
              "border border-neutral-300 rounded-lg p-4 bg-neutral-50",
              styles.datePicker
            )}
          />

          <div className="mt-6 flex flex-wrap items-center gap-4 text-base">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-macon-orange rounded border border-neutral-300" />
              <span className="text-neutral-700">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-white rounded border border-neutral-300" />
              <span className="text-neutral-700">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-neutral-200 rounded border border-neutral-300" />
              <span className="text-neutral-700">Unavailable</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
