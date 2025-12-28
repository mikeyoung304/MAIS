import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface ContactPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Contact Page (Domain-based) - Contact information and form
 *
 * Displays contact information and a contact form.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: ContactPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'Contact | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'contact');
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'contact');

  if (!context) {
    notFound();
  }

  return (
    <ContactPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
