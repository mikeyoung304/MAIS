import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantByDomain, getTenantTierBySlug, TenantNotFoundError } from '@/lib/tenant';
import { BookingPageContent } from '@/components/booking/BookingPageContent';

interface BookingPageProps {
  params: Promise<{ tierSlug: string }>;
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: BookingPageProps): Promise<Metadata> {
  const { tierSlug } = await params;
  const { domain } = await searchParams;

  if (!domain) {
    return { title: 'Invalid Request', robots: { index: false, follow: false } };
  }

  try {
    const tenant = await getTenantByDomain(domain);
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

export default async function DomainBookingPage({ params, searchParams }: BookingPageProps) {
  const { tierSlug } = await params;
  const { domain } = await searchParams;

  if (!domain) {
    notFound();
  }

  let tenant;
  let tier;

  try {
    tenant = await getTenantByDomain(domain);
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
      tenantSlug={tenant.slug}
      homeUrl="/"
      appointmentBookingUrl="/book"
    />
  );
}

export const revalidate = 60;
