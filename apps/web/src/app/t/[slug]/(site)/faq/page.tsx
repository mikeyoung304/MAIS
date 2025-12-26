import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FAQPageContent } from '@/components/tenant';
import { getTenantStorefrontData, TenantNotFoundError, isPageEnabled } from '@/lib/tenant';
import type { LandingPageConfig } from '@macon/contracts';

interface FAQPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * FAQ Page - Server component for SSR and metadata
 *
 * Fetches FAQ data and renders the accessible accordion.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // If page is disabled, return noindex metadata
    if (!isPageEnabled(config, 'faq')) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `FAQ | ${tenant.name}`,
      description: `Frequently asked questions about ${tenant.name}. Find answers to common questions about our services.`,
      openGraph: {
        title: `FAQ | ${tenant.name}`,
        description: `Frequently asked questions about ${tenant.name}. Find answers to common questions about our services.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'FAQ | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function FAQPage({ params }: FAQPageProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Check if FAQ page is enabled
    if (!isPageEnabled(config, 'faq')) {
      notFound();
    }

    const faqItems = config?.faq?.items || [];
    const basePath = `/t/${slug}`;

    return <FAQPageContent faqItems={faqItems} basePath={basePath} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
