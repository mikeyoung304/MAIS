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
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'faq');
}

export default async function FAQPage({ params }: FAQPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'faq');

  if (!context) {
    notFound();
  }

  const config = context.config as LandingPageConfig | undefined;
  const faqItems = config?.faq?.items || [];

  return <FAQPageContent faqItems={faqItems} basePath={context.basePath} />;
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
