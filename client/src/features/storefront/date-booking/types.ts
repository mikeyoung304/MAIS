/**
 * Shared types for DateBookingWizard step components
 */

import type { PackageDto } from '@macon/contracts';

/**
 * Customer details form data
 */
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

/**
 * Props for ConfirmationStep (Step 0)
 */
export interface ConfirmationStepProps {
  /** The package being booked */
  package: PackageDto;
}

/**
 * Props for DateSelectionStep (Step 1)
 */
export interface DateSelectionStepProps {
  /** Currently selected date */
  selectedDate: Date | null;
  /** Callback when date is selected */
  onDateSelect: (date: Date | undefined) => void;
  /** List of unavailable dates */
  unavailableDates: Date[];
  /** Whether dates are loading */
  isLoadingDates: boolean;
}

/**
 * Props for CustomerDetailsStep (Step 2)
 */
export interface CustomerDetailsStepProps {
  /** Current customer details */
  customerDetails: CustomerDetails;
  /** Callback to update a field */
  onUpdateField: (field: keyof CustomerDetails, value: string) => void;
  /** Validation errors by field name */
  validationErrors: Record<string, string>;
}

/**
 * Props for ReviewStep (Step 3)
 */
export interface ReviewStepProps {
  /** The package being booked */
  package: PackageDto;
  /** Selected date for the event */
  selectedDate: Date;
  /** Customer details */
  customerDetails: CustomerDetails;
}
