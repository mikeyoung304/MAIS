import { permanentRedirect, notFound } from 'next/navigation';

interface ServicesPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Services Page (Domain-based) - Redirects to landing page #services section
 *
 * Issue #6 Fix: Single scrolling landing page is MVP.
 * Multi-page routes are deferred to future work.
 *
 * Uses 301 (permanent) redirect for SEO - tells search engines
 * this content has moved permanently to the single-page anchor.
 */
export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  permanentRedirect(`/?domain=${encodeURIComponent(domain)}#services`);
}
