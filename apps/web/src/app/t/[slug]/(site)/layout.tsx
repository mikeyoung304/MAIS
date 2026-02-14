import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { getPublishedSections, SectionsNotFoundError } from '@/lib/sections-api';
import { sectionsToPages } from '@/lib/storefront-utils';
import { TenantSiteShell } from '@/components/tenant';
import type { SectionContentDto } from '@macon/contracts';
import { logger } from '@/lib/logger';

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
 * Fetches sections to derive PagesConfig for navigation.
 * React cache() deduplicates with page.tsx — zero extra API calls.
 */
export default async function TenantSiteLayout({ children, params }: TenantSiteLayoutProps) {
  const { slug } = await params;

  try {
    const [{ tenant }, sections] = await Promise.all([
      getTenantStorefrontData(slug),
      getPublishedSections(slug).catch((err) => {
        if (!(err instanceof SectionsNotFoundError)) {
          logger.warn('Failed to fetch sections for layout', { slug, error: err.message });
        }
        return [] as SectionContentDto[];
      }),
    ]);

    const pages = sectionsToPages(sections);

    return (
      <TenantSiteShell tenant={tenant} pages={pages} basePath={`/t/${slug}`}>
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
