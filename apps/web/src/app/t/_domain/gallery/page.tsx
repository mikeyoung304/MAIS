import { permanentRedirect, notFound } from 'next/navigation';

interface GalleryPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Gallery Page (Domain-based) - Redirects to landing page #gallery section
 *
 * Issue #6 Fix: Single scrolling landing page is MVP.
 * Multi-page routes are deferred to future work.
 *
 * Uses 301 (permanent) redirect for SEO - tells search engines
 * this content has moved permanently to the single-page anchor.
 */
export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  permanentRedirect(`/?domain=${encodeURIComponent(domain)}#gallery`);
}
