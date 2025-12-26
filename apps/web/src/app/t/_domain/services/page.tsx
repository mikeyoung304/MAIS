import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicesPageContent } from '@/components/tenant';
import {
  getTenantByDomain,
  getTenantPackages,
  getTenantSegments,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';

interface ServicesPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: ServicesPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    return {
      title: `Services | ${tenant.name}`,
      description: `Explore our services and packages at ${tenant.name}.`,
    };
  } catch {
    return { title: 'Services | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
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
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);

    const domainParam = `?domain=${validatedDomain}`;

    return (
      <ServicesPageContent
        data={{ tenant, packages, segments }}
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
