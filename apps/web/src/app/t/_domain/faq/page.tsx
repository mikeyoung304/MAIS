import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FAQPageContent } from '@/components/tenant';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';

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
    const domainParam = `?domain=${validatedDomain}`;

    return (
      <FAQPageContent
        faqItems={faqItems}
        basePath=""
        domainParam={domainParam}
      />
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
