'use client';

/**
 * DateBookingWizard Component
 *
 * Multi-step booking flow for DATE type tiers (e.g., weddings, events).
 * Steps:
 * 1. Confirm - Review tier details
 * 2. Date - Select event date
 * 3. Details - Enter customer information
 * 4. Pay - Review and proceed to checkout
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { DayPicker } from 'react-day-picker';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Stepper, type Step } from '@/components/ui/stepper';
import {
  User,
  Mail,
  Phone,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
  Users,
  Minus,
  Plus,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import {
  getUnavailableDates,
  checkDateAvailability,
  createDateBooking,
  type TierData,
} from '@/lib/tenant.client';
import { hasScalingPricing, calculateClientPrice, formatPerPersonRate } from '@/lib/pricing';
import 'react-day-picker/style.css';

// Zod schema for customer form validation
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
  /** The tier to book */
  tier: TierData;
  /** Tenant's public API key */
  tenantApiKey: string;
  /** Tenant slug for redirect */
  tenantSlug: string;
  /** Optional callback when booking starts */
  onBookingStart?: () => void;
}

// Step labels — conditional Guests step for tiers with per-person pricing
const STEP_LABELS_WITH_GUESTS = ['Confirm', 'Guests', 'Date', 'Details', 'Pay'] as const;
const STEP_LABELS_FLAT = ['Confirm', 'Date', 'Details', 'Pay'] as const;

// DayPicker styles — uses tenant accent color via CSS var
const DAY_PICKER_MODIFIERS_STYLES = {
  selected: {
    backgroundColor: 'var(--color-accent, #5A7C65)',
    color: 'white',
  },
} as const;

// DayPicker custom CSS for WCAG 2.2 AAA touch targets (44x44px minimum)
const DAY_PICKER_STYLE = {
  '--rdp-cell-size': '44px',
  '--rdp-accent-color': 'var(--color-accent, #5A7C65)',
  '--rdp-accent-background-color':
    'color-mix(in srgb, var(--color-accent, #5A7C65) 12%, transparent)',
} as React.CSSProperties;

// =============================================================================
// Memoized Step Components
// =============================================================================

interface ConfirmStepProps {
  pkg: TierData;
}

const ConfirmStep = React.memo(({ pkg }: ConfirmStepProps) => (
  <Card className="border-neutral-200">
    <CardHeader>
      <CardTitle className="text-2xl">Confirm Your Selection</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Tier Hero */}
      {pkg.photoUrl && (
        <div className="relative h-48 rounded-xl overflow-hidden">
          <Image
            src={pkg.photoUrl}
            alt={pkg.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>
      )}

      {/* Tier Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900">{pkg.title}</h3>
          <p className="text-3xl font-bold text-accent mt-2">{formatCurrency(pkg.priceCents)}</p>
        </div>

        {pkg.description && (
          <p className="text-neutral-600 whitespace-pre-wrap">{pkg.description}</p>
        )}
      </div>

      {/* Confirmation Message */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-green-900">Great choice!</p>
          <p className="text-sm text-green-700">
            Click &quot;Continue&quot; to select your event date.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
));
ConfirmStep.displayName = 'ConfirmStep';

interface GuestCountStepProps {
  tier: TierData;
  guestCount: number;
  onGuestCountChange: (count: number) => void;
}

const GuestCountStep = React.memo(
  ({ tier, guestCount, onGuestCountChange }: GuestCountStepProps) => {
    const minGuests = 1;
    const maxGuests = tier.maxGuests ?? 100;
    const breakdown = calculateClientPrice(tier, guestCount);

    return (
      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle className="text-2xl">
            <Users className="inline-block w-6 h-6 mr-2 text-accent" />
            How Many Guests?
          </CardTitle>
          <p className="text-neutral-500 text-base mt-1">
            Select your guest count for accurate pricing
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Guest Count Stepper */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => onGuestCountChange(Math.max(minGuests, guestCount - 1))}
              disabled={guestCount <= minGuests}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-neutral-300 text-neutral-600 transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Decrease guest count"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-5xl font-bold text-neutral-900">{guestCount}</span>
              <p className="text-sm text-neutral-500 mt-1">
                {guestCount === 1 ? 'guest' : 'guests'}
              </p>
            </div>
            <button
              onClick={() => onGuestCountChange(Math.min(maxGuests, guestCount + 1))}
              disabled={guestCount >= maxGuests}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-neutral-300 text-neutral-600 transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Increase guest count"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {tier.maxGuests && (
            <p className="text-center text-sm text-neutral-500">Maximum {tier.maxGuests} guests</p>
          )}

          {/* Price Breakdown */}
          {breakdown.components.length > 0 && (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-6 space-y-4">
              {/* Base price */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Base price</span>
                <span className="font-medium text-neutral-900">
                  {formatPrice(breakdown.basePriceCents)}
                </span>
              </div>

              {/* Per-person components */}
              {breakdown.components.map((comp) => (
                <div key={comp.name} className="flex items-center justify-between">
                  <span className="text-neutral-600">
                    {comp.name}
                    {comp.additionalGuests > 0 && (
                      <span className="text-neutral-400 text-sm ml-1">
                        ({comp.additionalGuests} extra ×{' '}
                        {formatPerPersonRate(comp.perPersonCents).replace('+', '')})
                      </span>
                    )}
                    {comp.additionalGuests === 0 && (
                      <span className="text-neutral-400 text-sm ml-1">
                        ({comp.includedGuests} included)
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-neutral-900">
                    {comp.subtotalCents > 0 ? `+${formatPrice(comp.subtotalCents)}` : 'Included'}
                  </span>
                </div>
              ))}

              {/* Divider + Total */}
              <div className="border-t border-neutral-200 pt-4 flex items-center justify-between">
                <span className="font-semibold text-neutral-900">Estimated Total</span>
                <span className="text-2xl font-bold text-accent">
                  {formatPrice(breakdown.totalCents)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
GuestCountStep.displayName = 'GuestCountStep';

interface DateSelectionStepProps {
  selectedDate: Date | null;
  isLoadingDates: boolean;
  unavailableDates: Date[];
  onDateSelect: (date: Date | undefined) => void;
}

const DateSelectionStep = React.memo(
  ({ selectedDate, isLoadingDates, unavailableDates, onDateSelect }: DateSelectionStepProps) => (
    <Card className="border-neutral-200">
      <CardHeader>
        <CardTitle className="text-2xl">
          <Calendar className="inline-block w-6 h-6 mr-2 text-accent" />
          Choose Your Date
        </CardTitle>
        <p className="text-neutral-500 text-base mt-1">Select the date for your event</p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          {isLoadingDates ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
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
              style={DAY_PICKER_STYLE}
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
}

const DetailsStep = React.memo(
  ({ customerDetails, formValidation, onUpdateField }: DetailsStepProps) => (
    <Card className="border-neutral-200">
      <CardHeader>
        <CardTitle className="text-2xl">Your Information</CardTitle>
        <p className="text-neutral-500 text-base mt-1">
          We&apos;ll use this to send your confirmation
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
            error={customerDetails.name ? formValidation.errors.name : undefined}
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
            error={customerDetails.email ? formValidation.errors.email : undefined}
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
              className="w-full h-24 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-base text-neutral-900 placeholder:text-neutral-500 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30 transition-all"
              maxLength={500}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
);
DetailsStep.displayName = 'DetailsStep';

interface ReviewStepProps {
  pkg: TierData;
  selectedDate: Date;
  customerDetails: CustomerDetails;
  guestCount?: number;
  effectiveTotal?: number;
}

const ReviewStep = React.memo(
  ({ pkg, selectedDate, customerDetails, guestCount, effectiveTotal }: ReviewStepProps) => {
    const displayTotal = effectiveTotal ?? pkg.priceCents;

    return (
      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle className="text-2xl">Review & Pay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Service Summary */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Service</h3>
              <p className="text-lg font-semibold text-neutral-900">{pkg.title}</p>
            </div>

            {/* Guest Count (if applicable) */}
            {guestCount && guestCount > 0 && (
              <div className="border-b border-neutral-200 pb-4">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Guests</h3>
                <p className="text-lg font-semibold text-neutral-900">
                  {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                </p>
              </div>
            )}

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
                <p className="text-neutral-600 mt-2 text-sm italic">
                  &quot;{customerDetails.notes}&quot;
                </p>
              )}
            </div>

            {/* Total */}
            <div className="pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-neutral-600">Total:</span>
                <span className="text-3xl font-bold text-accent">
                  {formatCurrency(displayTotal)}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-2">Secure payment powered by Stripe</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ReviewStep.displayName = 'ReviewStep';

// =============================================================================
// Main Component
// =============================================================================

export function DateBookingWizard({
  tier: pkg,
  tenantApiKey,
  tenantSlug: _tenantSlug,
  onBookingStart,
}: DateBookingWizardProps) {
  // Determine if this tier needs a Guests step
  const needsGuestsStep = hasScalingPricing(pkg) || Boolean(pkg.maxGuests);
  const stepLabels = needsGuestsStep ? STEP_LABELS_WITH_GUESTS : STEP_LABELS_FLAT;
  const lastStepIndex = stepLabels.length - 1;

  // Map logical step names to indices (shifts based on Guests step presence)
  const stepIndices = useMemo(() => {
    if (needsGuestsStep) {
      return { confirm: 0, guests: 1, date: 2, details: 3, pay: 4 };
    }
    return { confirm: 0, guests: -1, date: 1, details: 2, pay: 3 };
  }, [needsGuestsStep]);

  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(needsGuestsStep ? 2 : 1); // Default 2 for scaling tiers
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [unavailableDatesData, setUnavailableDatesData] = useState<string[]>([]);
  const [isLoadingDates, setIsLoadingDates] = useState(true);

  // Fetch unavailable dates on mount
  useEffect(() => {
    async function fetchUnavailableDates() {
      const today = new Date();
      const sixMonthsFromNow = new Date(today);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      const startDate = today.toISOString().split('T')[0];
      const endDate = sixMonthsFromNow.toISOString().split('T')[0];

      try {
        const dates = await getUnavailableDates(tenantApiKey, startDate, endDate);
        setUnavailableDatesData(dates);
      } catch {
        // Continue without unavailable dates - will validate on submit
      } finally {
        setIsLoadingDates(false);
      }
    }

    fetchUnavailableDates();
  }, [tenantApiKey]);

  // Convert date strings to Date objects for DayPicker
  const unavailableDates = useMemo(() => {
    return unavailableDatesData.map((dateStr) => new Date(dateStr + 'T00:00:00Z'));
  }, [unavailableDatesData]);

  // Steps for stepper
  const steps: Step[] = useMemo(
    () =>
      stepLabels.map((label, index) => ({
        label,
        status:
          index < currentStepIndex
            ? ('complete' as const)
            : index === currentStepIndex
              ? ('current' as const)
              : ('upcoming' as const),
      })),
    [currentStepIndex, stepLabels]
  );

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStepIndex < lastStepIndex) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Guest count handler
  const handleGuestCountChange = useCallback((count: number) => {
    setGuestCount(count);
  }, []);

  // Date Selection
  const handleDateSelect = useCallback(
    async (date: Date | undefined) => {
      if (!date) {
        setSelectedDate(null);
        return;
      }

      const dateStr = date.toISOString().split('T')[0];

      try {
        // Double-check availability with API
        const isAvailable = await checkDateAvailability(tenantApiKey, dateStr);
        if (isAvailable) {
          setSelectedDate(date);
          setSubmitError(null);
        } else {
          setSubmitError('This date is no longer available. Please select another date.');
          setSelectedDate(null);
        }
      } catch {
        // Network error - show user-friendly message
        setSubmitError('Unable to check date availability. Please try again.');
        setSelectedDate(null);
      }
    },
    [tenantApiKey]
  );

  const canProceedFromDate = selectedDate !== null;
  const canProceedFromGuests = guestCount >= 1;

  // Customer Details
  const updateCustomerDetails = useCallback((field: keyof CustomerDetails, value: string) => {
    setCustomerDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Form validation
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

  const canProceedFromDetails = formValidation.isValid;

  // Submit to Checkout
  const handleCheckout = async () => {
    if (!selectedDate) {
      setSubmitError('Please select an event date');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    onBookingStart?.();

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      const result = await createDateBooking(tenantApiKey, {
        tierId: pkg.id,
        date: dateStr,
        customerName: customerDetails.name.trim(),
        customerEmail: customerDetails.email.trim(),
        customerPhone: customerDetails.phone.trim() || undefined,
        notes: customerDetails.notes.trim() || undefined,
        ...(needsGuestsStep ? { guestCount } : {}),
      });

      if ('error' in result) {
        if (result.status === 409) {
          setSubmitError('This date is already booked. Please select a different date.');
          setCurrentStepIndex(stepIndices.date); // Go back to date selection
        } else {
          setSubmitError(result.error);
        }
        setIsSubmitting(false);
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = result.checkoutUrl;
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to create checkout session. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  // Compute effective total for review step (display only — backend recalculates)
  const effectiveTotal = useMemo(() => {
    if (needsGuestsStep) {
      return calculateClientPrice(pkg, guestCount).totalCents;
    }
    return pkg.priceCents;
  }, [needsGuestsStep, pkg, guestCount]);

  // Render current step content using logical step names
  const renderStepContent = () => {
    if (currentStepIndex === stepIndices.confirm) {
      return <ConfirmStep pkg={pkg} />;
    }
    if (currentStepIndex === stepIndices.guests && needsGuestsStep) {
      return (
        <GuestCountStep
          tier={pkg}
          guestCount={guestCount}
          onGuestCountChange={handleGuestCountChange}
        />
      );
    }
    if (currentStepIndex === stepIndices.date) {
      return (
        <DateSelectionStep
          selectedDate={selectedDate}
          isLoadingDates={isLoadingDates}
          unavailableDates={unavailableDates}
          onDateSelect={handleDateSelect}
        />
      );
    }
    if (currentStepIndex === stepIndices.details) {
      return (
        <DetailsStep
          customerDetails={customerDetails}
          formValidation={formValidation}
          onUpdateField={updateCustomerDetails}
        />
      );
    }
    if (currentStepIndex === stepIndices.pay) {
      if (!selectedDate) return null;
      return (
        <ReviewStep
          pkg={pkg}
          selectedDate={selectedDate}
          customerDetails={customerDetails}
          guestCount={needsGuestsStep ? guestCount : undefined}
          effectiveTotal={effectiveTotal}
        />
      );
    }
    return null;
  };

  // Determine if can proceed from current step
  const canProceed = () => {
    if (currentStepIndex === stepIndices.confirm) return true;
    if (currentStepIndex === stepIndices.guests) return canProceedFromGuests;
    if (currentStepIndex === stepIndices.date) return canProceedFromDate;
    if (currentStepIndex === stepIndices.details) return canProceedFromDetails;
    if (currentStepIndex === stepIndices.pay) return true;
    return false;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Progress Stepper */}
      <Stepper steps={steps} currentStep={currentStepIndex} />

      {/* Error Message */}
      {submitError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        </div>
      )}

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

        {currentStepIndex < lastStepIndex ? (
          <Button
            onClick={goToNextStep}
            disabled={!canProceed() || isSubmitting}
            size="lg"
            variant="secondary"
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
            variant="secondary"
            className="min-w-[200px]"
          >
            Proceed to Payment
          </Button>
        )}
      </div>
    </div>
  );
}
