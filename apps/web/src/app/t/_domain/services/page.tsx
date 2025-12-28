import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicesPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessibleWithStorefront,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface ServicesPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Services Page (Domain-based) - Full package listing with details
 *
 * Displays all active packages grouped by segment (if segments exist).
 * Shows package details including add-ons and pricing.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: ServicesPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'Services | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'services');
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessibleWithStorefront(identifier, 'services');

  if (!context) {
    notFound();
  }

  return (
    <ServicesPageContent
      data={{
        tenant: context.tenant,
        packages: context.packages,
        segments: context.segments,
      }}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
