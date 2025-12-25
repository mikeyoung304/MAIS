import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import {
  getTenantByDomain,
  getTenantPackageBySlug,
  TenantNotFoundError,
} from '@/lib/tenant';
import { DateBookingWizard } from '@/components/booking/DateBookingWizard';

interface BookingPageProps {
  params: Promise<{ packageSlug: string }>;
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Custom Domain Date Booking Page
 *
 * Handles booking for custom domain requests.
 * The domain is passed via searchParams from middleware rewrite.
 *
 * Route: /t/_domain/book/[packageSlug]?domain=customdomain.com
 */

export async function generateMetadata({
  params,
  searchParams,
}: BookingPageProps): Promise<Metadata> {
  const { packageSlug } = await params;
  const { domain } = await searchParams;

  if (!domain) {
    return {
      title: 'Invalid Request',
      robots: { index: false, follow: false },
    };
  }

  try {
    const tenant = await getTenantByDomain(domain);
    const pkg = await getTenantPackageBySlug(tenant.apiKeyPublic, packageSlug);

    if (!pkg) {
      return {
        title: 'Package Not Found',
        description: 'The requested package could not be found.',
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

export default async function DomainBookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { packageSlug } = await params;
  const { domain } = await searchParams;

  if (!domain) {
    notFound();
  }

  let tenant;
  let pkg;

  try {
    tenant = await getTenantByDomain(domain);
    pkg = await getTenantPackageBySlug(tenant.apiKeyPublic, packageSlug);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Package Not Found
            </h1>
            <p className="text-neutral-600 mb-6">
              The package you&apos;re looking for doesn&apos;t exist or has been
              removed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-macon-orange hover:underline"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to {tenant.name}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!pkg.active) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Package Unavailable
            </h1>
            <p className="text-neutral-600 mb-6">
              This package is currently not available for booking.
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-macon-orange hover:underline"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              View Available Packages
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const bookingType = pkg.bookingType || 'DATE';
  if (bookingType !== 'DATE') {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Different Booking Type
            </h1>
            <p className="text-neutral-600 mb-6">
              This package requires appointment scheduling. Please use the
              appointment booking flow.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center px-6 py-3 bg-macon-orange text-white rounded-lg hover:bg-macon-orange/90 transition-colors"
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
      <div className="bg-white border-b border-neutral-200 py-4">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="inline-flex items-center text-neutral-600 hover:text-macon-orange transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span>Back to {tenant.name}</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <DateBookingWizard
          package={pkg}
          tenantApiKey={tenant.apiKeyPublic}
          tenantSlug={tenant.slug}
        />
      </div>
    </div>
  );
}

export const revalidate = 60;
