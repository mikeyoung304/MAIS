import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactPageContent } from '@/components/tenant';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';

interface ContactPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: ContactPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    return {
      title: `Contact | ${tenant.name}`,
      description: `Get in touch with ${tenant.name}.`,
    };
  } catch {
    return { title: 'Contact | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
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
    const domainParam = `?domain=${validatedDomain}`;

    return <ContactPageContent tenant={tenant} basePath="" domainParam={domainParam} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
