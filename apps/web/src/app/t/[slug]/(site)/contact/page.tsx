import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface ContactPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Contact Page - Server component for SSR and metadata
 *
 * Displays contact information and a contact form.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'contact');
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'contact');

  if (!context) {
    notFound();
  }

  return <ContactPageContent tenant={context.tenant} basePath={context.basePath} />;
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
