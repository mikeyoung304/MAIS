import { MetadataRoute } from 'next';
import { logger } from '@/lib/logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Dynamic Sitemap Generation
 *
 * Generates a sitemap including:
 * - Static marketing pages
 * - All active tenant storefronts (home page only, other pages in per-tenant sitemap)
 *
 * For SEO optimization, we:
 * - Only include verified, active tenants
 * - Include last modified dates where available
 * - Set appropriate change frequencies
 *
 * Note: Each tenant also has a per-tenant sitemap at /t/[slug]/sitemap.xml
 * that includes all their enabled subpages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${APP_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Fetch active tenants from API
  let tenantPages: MetadataRoute.Sitemap = [];

  try {
    const response = await fetch(`${API_URL}/v1/public/tenants`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (response.ok) {
      const slugs = await response.json();
      tenantPages = slugs.map(({ slug, updatedAt }: { slug: string; updatedAt: string }) => ({
        url: `${APP_URL}/t/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch (error) {
    // Log error but don't fail sitemap generation
    // Tenant pages will still be crawlable via internal links
    logger.error('Error fetching tenants for sitemap', error instanceof Error ? error : { error });
    tenantPages = [];
  }

  return [...staticPages, ...tenantPages];
}
