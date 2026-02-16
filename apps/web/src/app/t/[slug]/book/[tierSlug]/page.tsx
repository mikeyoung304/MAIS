import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantBySlug, getTenantTierBySlug, TenantNotFoundError } from '@/lib/tenant';
import { BookingPageContent } from '@/components/booking/BookingPageContent';

interface BookingPageProps {
  params: Promise<{ slug: string; tierSlug: string }>;
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug, tierSlug } = await params;

  try {
    const tenant = await getTenantBySlug(slug);
    const tier = await getTenantTierBySlug(tenant.apiKeyPublic, tierSlug);

    if (!tier) {
      return {
        title: 'Service Not Found',
        description: 'The requested service could not be found.',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `Book ${tier.title} | ${tenant.name}`,
      description: tier.description || `Book ${tier.title} with ${tenant.name}`,
      openGraph: {
        title: `Book ${tier.title}`,
        description: tier.description || `Book ${tier.title} with ${tenant.name}`,
      },
      robots: { index: true, follow: true },
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

  let tenant;
  let tier;

  try {
    tenant = await getTenantBySlug(slug);
    tier = await getTenantTierBySlug(tenant.apiKeyPublic, tierSlug);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <BookingPageContent
      tenant={tenant}
      tier={tier}
      tenantSlug={slug}
      homeUrl={`/t/${slug}`}
      appointmentBookingUrl={`/t/${slug}/book`}
    />
  );
}

export const revalidate = 60;
