import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { TenantSiteShell } from '@/components/tenant';

interface TenantSiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Shared layout for tenant site pages (slug-based routes)
 *
 * Wraps all pages in the (site) route group with nav, footer,
 * chat widget, sticky CTA, and edit mode support.
 *
 * The booking flow (/book/*) does NOT use this layout,
 * keeping its focused checkout experience.
 */
export default async function TenantSiteLayout({ children, params }: TenantSiteLayoutProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

    return (
      <TenantSiteShell tenant={tenant} basePath={`/t/${slug}`}>
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
