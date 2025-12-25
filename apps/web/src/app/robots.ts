import { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Dynamic Robots.txt Generation
 *
 * Controls search engine crawling behavior:
 * - Allow crawling of public pages
 * - Block admin/protected routes
 * - Reference sitemap for discovery
 *
 * For multi-tenant SEO:
 * - Tenant storefronts are indexable
 * - Tenant admin dashboards are blocked
 * - API routes are blocked
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/t/*', // Tenant storefronts
          '/login',
          '/signup',
        ],
        disallow: [
          '/tenant/*', // Tenant admin dashboard
          '/admin/*', // Platform admin
          '/api/*', // API routes
          '/t/_domain/*', // Internal domain rewrite routes
          '/_next/*', // Next.js internals
        ],
      },
      {
        // Block AI crawlers from internal routes (optional)
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: ['/'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
