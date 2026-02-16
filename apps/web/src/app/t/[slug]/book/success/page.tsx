import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  getTenantBySlug,
  getBookingById,
  getTenantTierBySlug,
  getProjectBySessionId,
  TenantNotFoundError,
} from '@/lib/tenant';
import { BookingSuccessContent } from '@/components/booking/BookingSuccessContent';

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}

export async function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const tenant = await getTenantBySlug(slug);
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

export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
  const { slug } = await params;
  const { booking_id: bookingId, session_id: sessionId } = await searchParams;

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Stripe redirects with session_id — check for project hub redirect
  if (sessionId) {
    const projectData = await getProjectBySessionId(tenant.apiKeyPublic, sessionId);
    if (projectData) {
      redirect(`/t/${slug}/project/${projectData.projectId}?token=${projectData.accessToken}`);
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
      homeUrl={`/t/${slug}`}
      contactUrl={`/t/${slug}/contact`}
    />
  );
}

export const dynamic = 'force-dynamic';
