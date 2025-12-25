import { notFound } from 'next/navigation';
import { getTenantByDomain, TenantNotFoundError } from '@/lib/tenant';
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
 */
export default async function DomainLayout({
  children,
  searchParams,
}: DomainLayoutProps) {
  const { domain } = await searchParams;

  if (!domain) {
    notFound();
  }

  try {
    const tenant = await getTenantByDomain(domain);

    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <TenantNav tenant={tenant} />
        <main className="flex-1">{children}</main>
        <TenantFooter tenant={tenant} />
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}
