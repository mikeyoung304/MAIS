import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { FAQAccordion } from '../../[slug]/(site)/faq/FAQAccordion';

interface FAQPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: FAQPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
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

  // Validate domain parameter
  let validatedDomain: string;
  try {
    validatedDomain = validateDomain(domain);
  } catch (error) {
    if (error instanceof InvalidDomainError) {
      notFound();
    }
    throw error;
  }

  try {
    const tenant = await getTenantByDomain(validatedDomain);
    const faqItems = tenant.branding?.landingPage?.faq?.items || [];

    // For custom domains, links need domain param appended
    // Empty basePath + domainParam results in paths like /contact?domain=example.com
    const basePath = '';
    const domainParam = `?domain=${validatedDomain}`;

    return (
      <FAQAccordion
        faqItems={faqItems}
        basePath={basePath}
        domainParam={domainParam}
      />
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
