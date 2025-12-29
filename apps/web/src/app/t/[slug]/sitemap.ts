import { MetadataRoute } from 'next';
import { getTenantBySlug, isPageEnabled, TenantNotFoundError } from '@/lib/tenant';
import type { LandingPageConfig, PageName } from '@macon/contracts';

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
 * Benefits:
 * - Better SEO for multi-tenant sites
 * - Google discovers all tenant pages efficiently
 * - Custom domains can reference their own sitemap
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export async function generateSitemaps() {
  // This function enables the /t/[slug]/sitemap.xml route
  // Returns an array of { id } objects for each slug
  // The actual IDs come from the API call in the sitemap function
  return [{ id: 0 }]; // Placeholder - Next.js handles dynamic generation
}

interface SitemapParams {
  slug: string;
}

export default async function sitemap({
  params,
}: {
  params: Promise<SitemapParams>;
}): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;

  try {
    const tenant = await getTenantBySlug(slug);
    const baseUrl = `${APP_URL}/t/${slug}`;
    const landingConfig = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Define all possible tenant pages
    const pages: Array<{
      path: string;
      pageName: Exclude<PageName, 'home'> | null;
      priority: number;
    }> = [
      { path: '', pageName: null, priority: 1.0 }, // Home page (always enabled)
      { path: '/about', pageName: 'about', priority: 0.7 },
      { path: '/services', pageName: 'services', priority: 0.8 },
      { path: '/gallery', pageName: 'gallery', priority: 0.6 },
      { path: '/testimonials', pageName: 'testimonials', priority: 0.6 },
      { path: '/faq', pageName: 'faq', priority: 0.5 },
      { path: '/contact', pageName: 'contact', priority: 0.7 },
    ];

    // Filter to only enabled pages
    const enabledPages = pages.filter(
      (page) => page.pageName === null || isPageEnabled(landingConfig, page.pageName)
    );

    // Generate sitemap entries
    return enabledPages.map((page) => ({
      url: `${baseUrl}${page.path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page.priority,
    }));
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      // Return empty sitemap for non-existent tenants
      return [];
    }
    throw error;
  }
}
