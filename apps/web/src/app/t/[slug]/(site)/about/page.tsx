import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * About Page - Tenant story and mission
 *
 * Displays the tenant's about content with optional image.
 * Falls back to default content when not configured.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) {
    notFound();
  }

  return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
