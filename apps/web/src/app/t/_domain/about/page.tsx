import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface AboutPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * About Page (Domain-based) - Tenant story and mission
 *
 * Displays the tenant's about content with optional image.
 * Falls back to default content when not configured.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) {
    notFound();
  }

  return (
    <AboutPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
