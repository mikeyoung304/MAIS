import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { TenantNav } from '@/components/tenant/TenantNav';
import { TenantFooter } from '@/components/tenant/TenantFooter';

interface TenantSiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Shared layout for tenant site pages
 *
 * This layout wraps all pages in the (site) route group with:
 * - TenantNav (sticky header with navigation)
 * - TenantFooter (copyright and attribution)
 *
 * The booking flow (/book/*) does NOT use this layout,
 * keeping its focused checkout experience.
 */
export default async function TenantSiteLayout({ children, params }: TenantSiteLayoutProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <TenantNav tenant={tenant} />
        <div className="flex-1">{children}</div>
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
