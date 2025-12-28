import { notFound } from 'next/navigation';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { TenantNav } from '@/components/tenant/TenantNav';
import { TenantFooter } from '@/components/tenant/TenantFooter';

interface DomainLayoutProps {
  children: React.ReactNode;
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Shared layout for custom domain tenant pages
 *
 * Same as (site)/layout.tsx but resolves tenant by domain instead of slug.
 * Uses empty basePath with domainParam for proper navigation link construction.
 */
export default async function DomainLayout({ children, searchParams }: DomainLayoutProps) {
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

    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <TenantNav tenant={tenant} basePath="" domainParam={domainParam} />
        <div className="flex-1">{children}</div>
        <TenantFooter tenant={tenant} basePath="" domainParam={domainParam} />
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}
