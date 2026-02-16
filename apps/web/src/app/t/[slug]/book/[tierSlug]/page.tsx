import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { getTenantBySlug, getTenantTierBySlug, TenantNotFoundError } from '@/lib/tenant';
import { DateBookingWizard } from '@/components/booking/DateBookingWizard';

interface BookingPageProps {
  params: Promise<{ slug: string; tierSlug: string }>;
}

/**
 * Date Booking Page
 *
 * Displays the booking wizard for a specific tier.
 * This page is public (no authentication required) to allow
 * visitors to book appointments on tenant storefronts.
 *
 * Route: /t/[slug]/book/[tierSlug]
 */

// Generate SEO metadata
export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug, tierSlug } = await params;

  try {
    const tenant = await getTenantBySlug(slug);
    const pkg = await getTenantTierBySlug(tenant.apiKeyPublic, tierSlug);

    if (!pkg) {
      return {
        title: 'Service Not Found',
        description: 'The requested service could not be found.',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `Book ${pkg.title} | ${tenant.name}`,
      description: pkg.description || `Book ${pkg.title} with ${tenant.name}`,
      openGraph: {
        title: `Book ${pkg.title}`,
        description: pkg.description || `Book ${pkg.title} with ${tenant.name}`,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Booking',
      description: 'Book your appointment',
      robots: { index: false, follow: false },
    };
  }
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug, tierSlug } = await params;

  // Fetch tenant and tier data
  let tenant;
  let pkg;

  try {
    tenant = await getTenantBySlug(slug);
    pkg = await getTenantTierBySlug(tenant.apiKeyPublic, tierSlug);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Tier not found
  if (!pkg) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Service Not Found</h1>
            <p className="text-neutral-600 mb-6">
              The service you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link
              href={`/t/${slug}`}
              className="inline-flex items-center text-sage hover:underline"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to {tenant.name}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Tier not active (isActive is new, active is legacy)
  if (!(pkg.isActive ?? pkg.active)) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Service Unavailable</h1>
            <p className="text-neutral-600 mb-6">
              This service is currently not available for booking.
            </p>
            <Link
              href={`/t/${slug}`}
              className="inline-flex items-center text-sage hover:underline"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              View Available Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check booking type - this wizard only handles DATE type
  const bookingType = pkg.bookingType || 'DATE';
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
              href={`/t/${slug}/book`}
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
            href={`/t/${slug}`}
            className="inline-flex items-center text-neutral-600 hover:text-sage transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span>Back to {tenant.name}</span>
          </Link>
        </div>
      </div>

      {/* Booking Wizard */}
      <div className="container mx-auto px-4 py-8">
        <DateBookingWizard tier={pkg} tenantApiKey={tenant.apiKeyPublic} tenantSlug={slug} />
      </div>
    </div>
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
