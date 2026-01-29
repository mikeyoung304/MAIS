import { permanentRedirect } from 'next/navigation';

interface GalleryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Gallery Page - Redirects to landing page #gallery section
 *
 * Issue #6 Fix: Single scrolling landing page is MVP.
 * Multi-page routes are deferred to future work.
 *
 * Uses 301 (permanent) redirect for SEO - tells search engines
 * this content has moved permanently to the single-page anchor.
 */
export default async function GalleryPage({ params }: GalleryPageProps) {
  const { slug } = await params;
  permanentRedirect(`/t/${slug}#gallery`);
}
