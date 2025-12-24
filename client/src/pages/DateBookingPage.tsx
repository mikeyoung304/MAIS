/**
 * DateBookingPage
 *
 * Page wrapper for DATE type package bookings.
 * Loads the package by slug and renders the DateBookingWizard.
 */

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DateBookingWizard } from '@/features/storefront/DateBookingWizard';
import { Loading } from '@/ui/Loading';
import { Container } from '@/ui/Container';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PackageDto } from '@macon/contracts';

export function DateBookingPage() {
  const { packageSlug } = useParams<{ packageSlug: string }>();

  // Fetch package data
  const {
    data: packageData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['package', packageSlug],
    queryFn: async () => {
      if (!packageSlug) throw new Error('No package slug provided');
      const response = await api.getPackageBySlug({ params: { slug: packageSlug } });
      if (response.status !== 200 || !response.body) {
        throw new Error('Package not found');
      }
      return response.body as PackageDto;
    },
    enabled: !!packageSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes - package data is relatively static
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for navigation
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <Container>
          <Loading label="Loading package..." />
        </Container>
      </div>
    );
  }

  if (error || !packageData) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <Container className="max-w-2xl">
          <div className="bg-white rounded-2xl shadow-elevation-1 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
              Package Not Found
            </h1>
            <p className="text-neutral-600 mb-6">
              The package you're looking for doesn't exist or has been removed.
            </p>
            <Link to="../tiers">
              <Button variant="outline" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Packages
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  // Check if package supports DATE booking
  const bookingType = packageData.bookingType || 'DATE';
  if (bookingType !== 'DATE') {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <Container className="max-w-2xl">
          <div className="bg-white rounded-2xl shadow-elevation-1 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
              Different Booking Type
            </h1>
            <p className="text-neutral-600 mb-6">
              This package requires appointment scheduling. Please use the appointment booking flow.
            </p>
            <Link to="../book">
              <Button className="gap-2 bg-macon-orange hover:bg-macon-orange/90">
                Go to Appointment Booking
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 py-4">
        <Container>
          <Link
            to={`../tiers`}
            className="inline-flex items-center text-neutral-600 hover:text-macon-orange transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span>Back to packages</span>
          </Link>
        </Container>
      </div>

      {/* Wizard */}
      <Container className="py-8">
        <DateBookingWizard package={packageData} />
      </Container>
    </div>
  );
}
