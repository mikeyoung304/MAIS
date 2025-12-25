import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { FAQAccordion } from './FAQAccordion';

interface FAQPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * FAQ Page - Server component for SSR and metadata
 *
 * Fetches FAQ data and renders the accessible accordion.
 */

export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

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
    const faqItems = tenant.branding?.landingPage?.faq?.items || [];
    const basePath = `/t/${slug}`;

    return (
      <FAQAccordion
        faqItems={faqItems}
        basePath={basePath}
      />
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
