import { notFound } from 'next/navigation';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { TenantSiteShell } from '@/components/tenant';

interface DomainLayoutProps {
  children: React.ReactNode;
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Shared layout for custom domain tenant pages
 *
 * Same shell as [slug]/(site)/layout.tsx but resolves tenant by domain.
 * Uses empty basePath with domainParam for proper navigation link construction.
 */
export default async function DomainLayout({ children, searchParams }: DomainLayoutProps) {
  const { domain } = await searchParams;

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

    return (
      <TenantSiteShell tenant={tenant} basePath="" domainParam={domainParam}>
        {children}
      </TenantSiteShell>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}
