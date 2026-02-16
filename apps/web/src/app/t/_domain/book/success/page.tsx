import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  getTenantByDomain,
  getBookingById,
  getTenantTierBySlug,
  getProjectBySessionId,
  TenantNotFoundError,
} from '@/lib/tenant';
import { BookingSuccessContent } from '@/components/booking/BookingSuccessContent';

interface SuccessPageProps {
  searchParams: Promise<{
    domain?: string;
    booking_id?: string;
    session_id?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SuccessPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  if (!domain) {
    return {
      title: 'Booking Confirmed',
      robots: { index: false, follow: false },
    };
  }

  try {
    const tenant = await getTenantByDomain(domain);
    return {
      title: `Booking Confirmed | ${tenant.name}`,
      description: `Your booking with ${tenant.name} has been confirmed.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Booking Confirmed',
      description: 'Your booking has been confirmed.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function DomainSuccessPage({ searchParams }: SuccessPageProps) {
  const { domain, booking_id: bookingId, session_id: sessionId } = await searchParams;

  if (!domain) {
    notFound();
  }

  let tenant;
  try {
    tenant = await getTenantByDomain(domain);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Stripe redirects with session_id — check for project hub redirect (was missing from _domain)
  if (sessionId) {
    const projectData = await getProjectBySessionId(tenant.apiKeyPublic, sessionId);
    if (projectData) {
      redirect(`/project/${projectData.projectId}?token=${projectData.accessToken}`);
    }
  }

  // Fetch booking details if available
  let booking = null;
  let tierTitle = null;

  if (bookingId) {
    booking = await getBookingById(tenant.apiKeyPublic, bookingId);
    if (booking) {
      const tierData = await getTenantTierBySlug(tenant.apiKeyPublic, booking.tierId);
      tierTitle = tierData?.title ?? null;
    }
  }

  return (
    <BookingSuccessContent
      tenant={tenant}
      booking={booking}
      tierTitle={tierTitle}
      homeUrl="/"
      contactUrl="/contact"
    />
  );
}

export const dynamic = 'force-dynamic';
