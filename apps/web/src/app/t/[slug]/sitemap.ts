import { MetadataRoute } from 'next';
import { getTenantBySlug, TenantNotFoundError } from '@/lib/tenant';
import { getPublishedSections } from '@/lib/sections-api';
import { sectionsToPages } from '@/lib/storefront-utils';
import type { SectionContentDto, PageName } from '@macon/contracts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ISR: Revalidate sitemap every hour (tenant page config doesn't change frequently)
export const revalidate = 3600;

/**
 * Per-tenant sitemap generation.
 *
 * Each tenant gets their own sitemap at /t/[slug]/sitemap.xml that includes:
 * - Home page (always enabled)
 * - All enabled subpages (about, services, gallery, testimonials, faq, contact)
 *
 * Page enablement is derived from SectionContent — if a page has sections,
 * it's included in the sitemap.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export async function generateSitemaps() {
  return [{ id: 0 }];
}

interface SitemapParams {
  slug: string;
}

/** Priority by page type for SEO weighting */
const PAGE_PRIORITY: Record<string, number> = {
  home: 1.0,
  services: 0.8,
  about: 0.7,
  contact: 0.7,
  gallery: 0.6,
  testimonials: 0.6,
  faq: 0.5,
};

export default async function sitemap({
  params,
}: {
  params: Promise<SitemapParams>;
}): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;

  try {
    const [tenant, sections] = await Promise.all([
      getTenantBySlug(slug),
      getPublishedSections(slug).catch(() => [] as SectionContentDto[]),
    ]);

    const baseUrl = `${APP_URL}/t/${slug}`;
    const pages = sectionsToPages(sections);

    // Home is always included
    const entries: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
    ];

    // Add enabled subpages (pages with sections)
    const subpages: Array<Exclude<PageName, 'home'>> = [
      'about',
      'services',
      'gallery',
      'testimonials',
      'faq',
      'contact',
    ];

    for (const pageName of subpages) {
      if (pages[pageName]?.enabled) {
        entries.push({
          url: `${baseUrl}/${pageName}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: PAGE_PRIORITY[pageName] ?? 0.5,
        });
      }
    }

    // Suppress unused variable warning — tenant fetched to validate slug exists
    void tenant;

    return entries;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return [];
    }
    throw error;
  }
}
