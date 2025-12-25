/**
 * DateBookingWizard Component
 *
 * Multi-step booking flow for DATE type packages (e.g., weddings, events).
 * Steps:
 * 1. Confirm - Review package details
 * 2. Date - Select event date
 * 3. Details - Enter customer information
 * 4. Pay - Review and proceed to checkout
 */

import React, { useState, useMemo, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Stepper, type Step } from '@/components/ui/Stepper';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { User, Mail, Phone, ArrowLeft, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import type { PackageDto } from '@macon/contracts';
import { formatCurrency, formatDate } from '@/lib/utils';
import 'react-day-picker/style.css';

// Phase 3.2 (#323): Zod schema for customer form validation
// Matches server-side validation for consistency
const customerDetailsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
});

interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface DateBookingWizardProps {
  /** The package to book */
  package: PackageDto;
  /** Optional callback when booking starts */
  onBookingStart?: () => void;
}

// Step labels for the booking wizard - defined outside component to avoid recreation
const STEP_LABELS = ['Confirm', 'Date', 'Details', 'Pay'] as const;

// P2-350 FIX: DayPicker styles extracted to module-level constant to prevent recreation
const DAY_PICKER_MODIFIERS_STYLES = {
  selected: {
    backgroundColor: '#F97316', // macon-orange
    color: 'white',
  },
} as const;

// =============================================================================
// Memoized Step Components (#320: React.memo optimization)
// These prevent unnecessary re-renders when parent state changes
// =============================================================================

interface ConfirmStepProps {
  pkg: PackageDto;
}

const ConfirmStep = React.memo(({ pkg }: ConfirmStepProps) => (
  <Card className="border-neutral-200 shadow-elevation-1">
    <CardHeader>
      <CardTitle className="text-2xl font-heading">Confirm Your Selection</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Package Hero */}
      {pkg.photoUrl && (
        <div className="relative h-48 rounded-xl overflow-hidden">
          <img src={pkg.photoUrl} alt={pkg.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Package Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-heading font-bold text-neutral-900">{pkg.title}</h3>
          <p className="text-3xl font-heading font-bold text-macon-orange mt-2">
            {formatCurrency(pkg.priceCents)}
          </p>
        </div>

        <p className="text-neutral-600 whitespace-pre-wrap">{pkg.description}</p>
      </div>

      {/* Confirmation Message */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-green-900">Great choice!</p>
          <p className="text-sm text-green-700">Click "Continue" to select your event date.</p>
        </div>
      </div>
    </CardContent>
  </Card>
));
ConfirmStep.displayName = 'ConfirmStep';

interface DateSelectionStepProps {
  selectedDate: Date | null;
  isLoadingDates: boolean;
  unavailableDates: Date[];
  onDateSelect: (date: Date | undefined) => void;
}

const DateSelectionStep = React.memo(
  ({ selectedDate, isLoadingDates, unavailableDates, onDateSelect }: DateSelectionStepProps) => (
    <Card className="border-neutral-200 shadow-elevation-1">
      <CardHeader>
        <CardTitle className="text-2xl font-heading">
          <Calendar className="inline-block w-6 h-6 mr-2 text-macon-orange" />
          Choose Your Date
        </CardTitle>
        <p className="text-neutral-500 text-base mt-1">Select the date for your event</p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          {isLoadingDates ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-macon-orange animate-spin" />
              <p className="mt-2 text-neutral-500">Loading available dates...</p>
            </div>
          ) : (
            <DayPicker
              mode="single"
              selected={selectedDate || undefined}
              onSelect={onDateSelect}
              disabled={[{ before: new Date() }, ...unavailableDates]}
              className="border border-neutral-300 rounded-xl p-4 bg-white"
              modifiersStyles={DAY_PICKER_MODIFIERS_STYLES}
            />
          )}
        </div>
        {selectedDate && (
          <p className="text-center mt-4 text-lg font-medium text-neutral-900">
            Selected: {formatDate(selectedDate)}
          </p>
        )}
      </CardContent>
    </Card>
  )
);
DateSelectionStep.displayName = 'DateSelectionStep';

interface DetailsStepProps {
  customerDetails: CustomerDetails;
  formValidation: { errors: Record<string, string> };
  onUpdateField: (field: keyof CustomerDetails, value: string) => void;
  honeypot: string;
  onHoneypotChange: (value: string) => void;
}

const DetailsStep = React.memo(
  ({
    customerDetails,
    formValidation,
    onUpdateField,
    honeypot,
    onHoneypotChange,
  }: DetailsStepProps) => (
    <Card className="border-neutral-200 shadow-elevation-1">
      <CardHeader>
        <CardTitle className="text-2xl font-heading">Your Information</CardTitle>
        <p className="text-neutral-500 text-base mt-1">
          We'll use this to send your confirmation
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <InputEnhanced
            id="name"
            type="text"
            value={customerDetails.name}
            onChange={(e) => onUpdateField('name', e.target.value)}
            placeholder="Jane & John Smith"
            label="Name(s)"
            floatingLabel
            leftIcon={<User className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('name', '')}
            required
            error={customerDetails.name && formValidation.errors.name}
          />
          <InputEnhanced
            id="email"
            type="email"
            value={customerDetails.email}
            onChange={(e) => onUpdateField('email', e.target.value)}
            placeholder="your.email@example.com"
            label="Email Address"
            floatingLabel
            leftIcon={<Mail className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('email', '')}
            required
            error={customerDetails.email && formValidation.errors.email}
          />
          <InputEnhanced
            id="phone"
            type="tel"
            value={customerDetails.phone}
            onChange={(e) => onUpdateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
            label="Phone Number (optional)"
            floatingLabel
            leftIcon={<Phone className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('phone', '')}
          />
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-neutral-800 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={customerDetails.notes}
              onChange={(e) => onUpdateField('notes', e.target.value)}
              placeholder="Any special requests or information..."
              className="w-full h-24 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-base text-neutral-900 placeholder:text-neutral-500 focus:border-macon-orange focus:outline-none focus:ring-4 focus:ring-macon-orange/30 transition-all"
              maxLength={500}
            />
          </div>
          {/* Honeypot field for bot protection - hidden from real users */}
          {/* Bots often auto-fill fields named "website" or "url" */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => onHoneypotChange(e.target.value)}
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
        </div>
      </CardContent>
    </Card>
  )
);
DetailsStep.displayName = 'DetailsStep';

interface ReviewStepProps {
  pkg: PackageDto;
  selectedDate: Date;
  customerDetails: CustomerDetails;
}

const ReviewStep = React.memo(({ pkg, selectedDate, customerDetails }: ReviewStepProps) => (
  <Card className="border-neutral-200 shadow-elevation-1">
    <CardHeader>
      <CardTitle className="text-2xl font-heading">Review & Pay</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-6">
        {/* Package Summary */}
        <div className="border-b border-neutral-200 pb-4">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Package</h3>
          <p className="text-lg font-semibold text-neutral-900">{pkg.title}</p>
        </div>

        {/* Date Summary */}
        <div className="border-b border-neutral-200 pb-4">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Event Date</h3>
          <p className="text-lg font-semibold text-neutral-900">{formatDate(selectedDate)}</p>
        </div>

        {/* Customer Info Summary */}
        <div className="border-b border-neutral-200 pb-4">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
            Contact Information
          </h3>
          <p className="text-neutral-900 font-medium">{customerDetails.name}</p>
          <p className="text-neutral-600">{customerDetails.email}</p>
          {customerDetails.phone && <p className="text-neutral-600">{customerDetails.phone}</p>}
          {customerDetails.notes && (
            <p className="text-neutral-600 mt-2 text-sm italic">"{customerDetails.notes}"</p>
          )}
        </div>

        {/* Total */}
        <div className="pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-lg text-neutral-600">Total:</span>
            <span className="text-3xl font-heading font-bold text-macon-orange">
              {formatCurrency(pkg.priceCents)}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-2">Secure payment powered by Stripe</p>
        </div>
      </div>
    </CardContent>
  </Card>
));
ReviewStep.displayName = 'ReviewStep';

// =============================================================================
// Main Component
// =============================================================================

export function DateBookingWizard({ package: pkg, onBookingStart }: DateBookingWizardProps) {
  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Honeypot field for bot protection - should never be filled by real users
  const [honeypot, setHoneypot] = useState('');

  // Fetch unavailable dates for the calendar
  // Phase 3.1 (#307): Query unavailable dates to prevent booking conflicts
  const today = new Date();
  const sixMonthsFromNow = new Date(today);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  // P3-354 FIX: Memoize localStorage read to avoid repeated access on every render
  const tenantKey = useMemo(
    () => localStorage.getItem('impersonationTenantKey') || 'default',
    []
  );

  const { data: unavailableDatesData, isLoading: isLoadingDates } = useQuery({
    queryKey: ['unavailable-dates', tenantKey, today.toISOString().split('T')[0]],
    queryFn: async () => {
      const startDate = today.toISOString().split('T')[0];
      const endDate = sixMonthsFromNow.toISOString().split('T')[0];

      const response = await api.getUnavailableDates({
        query: { startDate, endDate },
      });

      if (response.status === 200) {
        return response.body.dates;
      }
      return [];
    },
    staleTime: 30 * 1000, // 30 seconds - dates can change as other users book
  });

  // Convert date strings to Date objects for DayPicker
  // Use UTC suffix to ensure consistent timezone handling across client/server
  const unavailableDates = useMemo(() => {
    if (!unavailableDatesData) return [];
    return unavailableDatesData.map((dateStr) => new Date(dateStr + 'T00:00:00Z'));
  }, [unavailableDatesData]);

  // P3-353 FIX: Memoize steps array to prevent recreation on every render
  // Only recalculates when currentStepIndex changes (not on every keystroke)
  const steps: Step[] = useMemo(
    () =>
      STEP_LABELS.map((label, index) => ({
        label,
        status:
          index < currentStepIndex
            ? ('complete' as const)
            : index === currentStepIndex
              ? ('current' as const)
              : ('upcoming' as const),
      })),
    [currentStepIndex]
  );

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStepIndex < 3) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Step 1: Package confirmed, proceed
  const canProceedFromStep0 = true;

  // Step 2: Date Selection - memoized to prevent re-renders of DateSelectionStep
  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date || null);
  }, []);

  const canProceedFromStep1 = selectedDate !== null;

  // Step 3: Customer Details - memoized to prevent re-renders of DetailsStep
  const updateCustomerDetails = useCallback((field: keyof CustomerDetails, value: string) => {
    setCustomerDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Memoized honeypot handler for DetailsStep
  const handleHoneypotChange = useCallback((value: string) => {
    setHoneypot(value);
  }, []);

  // Phase 3.2 (#323): Use Zod for form validation
  const formValidation = useMemo(() => {
    const result = customerDetailsSchema.safeParse(customerDetails);
    if (result.success) {
      return { isValid: true, errors: {} as Record<string, string> };
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { isValid: false, errors };
  }, [customerDetails]);

  const canProceedFromStep2 = formValidation.isValid;

  // Step 4: Submit to Checkout
  const handleCheckout = async () => {
    if (!selectedDate) {
      toast.error('Please select an event date');
      return;
    }

    setIsSubmitting(true);
    onBookingStart?.();

    try {
      // Format date as YYYY-MM-DD
      const dateStr = selectedDate.toISOString().split('T')[0];

      // P1 fix: Use typed ts-rest API client for type safety
      // The api client automatically handles X-Tenant-Key header injection
      const response = await api.createDateBooking({
        body: {
          packageId: pkg.id,
          date: dateStr,
          customerName: customerDetails.name.trim(),
          customerEmail: customerDetails.email.trim(),
          customerPhone: customerDetails.phone.trim() || undefined,
          notes: customerDetails.notes.trim() || undefined,
          // Honeypot field for bot protection - only send if filled (indicates bot)
          website: honeypot || undefined,
        },
      });

      if (response.status === 409) {
        toast.error('Date unavailable', {
          description: 'This date is already booked. Please select a different date.',
        });
        setCurrentStepIndex(1); // Go back to date selection
        setIsSubmitting(false);
        return;
      }

      if (response.status !== 201) {
        const errorBody = response.body as { error?: string } | null;
        throw new Error(errorBody?.error || 'Failed to create checkout session');
      }

      const data = response.body;

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      toast.error('Unable to create checkout session', {
        description:
          error instanceof Error ? error.message : 'Please try again or contact support.',
      });
      setIsSubmitting(false);
    }
  };

  // Render current step content using memoized components (#320)
  const renderStepContent = () => {
    switch (currentStepIndex) {
      case 0:
        return <ConfirmStep pkg={pkg} />;

      case 1:
        return (
          <DateSelectionStep
            selectedDate={selectedDate}
            isLoadingDates={isLoadingDates}
            unavailableDates={unavailableDates}
            onDateSelect={handleDateSelect}
          />
        );

      case 2:
        return (
          <DetailsStep
            customerDetails={customerDetails}
            formValidation={formValidation}
            onUpdateField={updateCustomerDetails}
            honeypot={honeypot}
            onHoneypotChange={handleHoneypotChange}
          />
        );

      case 3:
        if (!selectedDate) {
          return null;
        }
        return (
          <ReviewStep
            pkg={pkg}
            selectedDate={selectedDate}
            customerDetails={customerDetails}
          />
        );

      default:
        return null;
    }
  };

  // Determine if can proceed from current step
  const canProceed = () => {
    switch (currentStepIndex) {
      case 0:
        return canProceedFromStep0;
      case 1:
        return canProceedFromStep1;
      case 2:
        return canProceedFromStep2;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Progress Stepper */}
      <Stepper steps={steps} currentStep={currentStepIndex} />

      {/* Step Content */}
      <div className="min-h-[400px]">{renderStepContent()}</div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStepIndex < 3 ? (
          <Button
            onClick={goToNextStep}
            disabled={!canProceed() || isSubmitting}
            size="lg"
            className="bg-macon-orange hover:bg-macon-orange/90"
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleCheckout}
            disabled={!canProceed() || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Creating checkout..."
            size="lg"
            className="min-w-[200px] bg-macon-orange hover:bg-macon-orange/90"
          >
            Proceed to Payment
          </Button>
        )}
      </div>
    </div>
  );
}
