import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FAQPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';
import type { LandingPageConfig } from '@macon/contracts';

interface FAQPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * FAQ Page (Domain-based) - Frequently asked questions
 *
 * Displays FAQ items in an accessible accordion.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: FAQPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'FAQ | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'faq');
}

export default async function FAQPage({ searchParams }: FAQPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'faq');

  if (!context) {
    notFound();
  }

  const config = context.config as LandingPageConfig | undefined;
  const faqItems = config?.faq?.items || [];

  return (
    <FAQPageContent
      faqItems={faqItems}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
