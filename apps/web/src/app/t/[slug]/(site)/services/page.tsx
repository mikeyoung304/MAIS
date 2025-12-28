import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicesPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessibleWithStorefront,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

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
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'services');
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
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
    />
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
