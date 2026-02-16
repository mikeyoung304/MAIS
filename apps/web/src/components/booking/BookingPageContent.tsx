import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { DateBookingWizard } from '@/components/booking/DateBookingWizard';
import type { TierData } from '@/lib/tenant.client';

interface BookingPageContentProps {
  tenant: { name: string; apiKeyPublic: string };
  tier: TierData | null;
  tenantSlug: string;
  homeUrl: string;
  appointmentBookingUrl: string;
}

/**
 * Shared booking page content used by both [slug] and _domain routes.
 *
 * Each route page resolves the tenant (by slug or domain), then delegates
 * all UI rendering to this component. This eliminates ~140 lines of
 * duplication between the two route trees.
 */
export function BookingPageContent({
  tenant,
  tier,
  tenantSlug,
  homeUrl,
  appointmentBookingUrl,
}: BookingPageContentProps) {
  // Tier not found
  if (!tier) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Service Not Found</h1>
            <p className="text-neutral-600 mb-6">
              The service you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link href={homeUrl} className="inline-flex items-center text-sage hover:underline">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to {tenant.name}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Tier not active
  if (!(tier.isActive ?? tier.active)) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Service Unavailable</h1>
            <p className="text-neutral-600 mb-6">
              This service is currently not available for booking.
            </p>
            <Link href={homeUrl} className="inline-flex items-center text-sage hover:underline">
              <ChevronLeft className="w-4 h-4 mr-1" />
              View Available Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Wrong booking type
  const bookingType = tier.bookingType || 'DATE';
  if (bookingType !== 'DATE') {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Different Booking Type</h1>
            <p className="text-neutral-600 mb-6">
              This service requires appointment scheduling. Please use the appointment booking flow.
            </p>
            <Link
              href={appointmentBookingUrl}
              className="inline-flex items-center px-6 py-3 bg-sage text-white rounded-lg hover:bg-sage-hover transition-colors"
            >
              Go to Appointment Booking
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 py-4">
        <div className="container mx-auto px-4">
          <Link
            href={homeUrl}
            className="inline-flex items-center text-neutral-600 hover:text-sage transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span>Back to {tenant.name}</span>
          </Link>
        </div>
      </div>

      {/* Booking Wizard */}
      <div className="container mx-auto px-4 py-8">
        <DateBookingWizard tier={tier} tenantApiKey={tenant.apiKeyPublic} tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}
