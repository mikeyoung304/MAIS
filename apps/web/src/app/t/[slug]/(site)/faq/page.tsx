import { permanentRedirect } from 'next/navigation';

interface FAQPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * FAQ Page - Redirects to landing page #faq section
 *
 * Issue #6 Fix: Single scrolling landing page is MVP.
 * Multi-page routes are deferred to future work.
 *
 * Uses 301 (permanent) redirect for SEO - tells search engines
 * this content has moved permanently to the single-page anchor.
 */
export default async function FAQPage({ params }: FAQPageProps) {
  const { slug } = await params;
  permanentRedirect(`/t/${slug}#faq`);
}
