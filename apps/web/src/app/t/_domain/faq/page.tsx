import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantByDomain, TenantNotFoundError } from '@/lib/tenant';
import { FAQAccordion } from '../../[slug]/(site)/faq/FAQAccordion';

interface FAQPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: FAQPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  if (!domain) {
    return { title: 'FAQ', robots: { index: false, follow: false } };
  }

  try {
    const tenant = await getTenantByDomain(domain);
    return {
      title: `FAQ | ${tenant.name}`,
      description: `Frequently asked questions about ${tenant.name}.`,
    };
  } catch {
    return { title: 'FAQ | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function FAQPage({ searchParams }: FAQPageProps) {
  const { domain } = await searchParams;

  if (!domain) {
    notFound();
  }

  try {
    const tenant = await getTenantByDomain(domain);
    const faqItems = tenant.branding?.landingPage?.faq?.items || [];

    // For custom domains, contact links need to preserve the domain param
    const basePath = `?domain=${domain}`;

    return (
      <FAQAccordion
        faqItems={faqItems}
        basePath={basePath}
        tenantName={tenant.name}
      />
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
