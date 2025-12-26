import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicesPageContent } from '@/components/tenant';
import { getTenantStorefrontData, TenantNotFoundError, isPageEnabled } from '@/lib/tenant';
import type { LandingPageConfig } from '@macon/contracts';

interface ServicesPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Services Page - Full package listing with details
 *
 * Displays all active packages grouped by segment (if segments exist).
 * Shows package details including add-ons and pricing.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // If page is disabled, return noindex metadata
    if (!isPageEnabled(config, 'services')) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `Services | ${tenant.name}`,
      description: `Explore our services and packages at ${tenant.name}. Find the perfect option for your needs.`,
      openGraph: {
        title: `Services | ${tenant.name}`,
        description: `Explore our services and packages at ${tenant.name}. Find the perfect option for your needs.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Services | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { slug } = await params;

  try {
    const data = await getTenantStorefrontData(slug);
    const config = data.tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Check if services page is enabled
    if (!isPageEnabled(config, 'services')) {
      notFound();
    }

    const basePath = `/t/${slug}`;

    return <ServicesPageContent data={data} basePath={basePath} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
