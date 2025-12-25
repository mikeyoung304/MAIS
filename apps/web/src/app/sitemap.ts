import { MetadataRoute } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TenantPublic {
  id: string;
  slug: string;
  name: string;
}

interface Package {
  id: string;
  slug: string;
  active: boolean;
}

/**
 * Dynamic Sitemap Generation
 *
 * Generates a sitemap including:
 * - Static marketing pages
 * - All active tenant storefronts
 * - All active packages for each tenant
 *
 * For SEO optimization, we:
 * - Only include verified, active tenants
 * - Include last modified dates where available
 * - Set appropriate change frequencies
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
    // Note: We'd need a public endpoint that lists active tenant slugs
    // For now, this is a placeholder - in production, you'd have
    // GET /v1/public/tenants/slugs that returns active tenant slugs

    // Placeholder: In production, fetch from API
    // const response = await fetch(`${API_BASE}/v1/public/tenants/slugs`);
    // const tenants: TenantPublic[] = await response.json();

    // For now, we'll skip dynamic tenant pages in the sitemap
    // They'll still be crawlable via internal links
    tenantPages = [];
  } catch (error) {
    console.error('Error fetching tenants for sitemap:', error);
    tenantPages = [];
  }

  return [...staticPages, ...tenantPages];
}

/**
 * Future enhancement: Per-tenant sitemap
 *
 * For high-volume sites, generate per-tenant sitemaps:
 * - /sitemap/[tenantSlug].xml
 *
 * This would require:
 * 1. A sitemap index at /sitemap.xml
 * 2. Individual tenant sitemaps at /sitemap/[slug].xml
 * 3. API endpoint to list all tenant slugs
 */
