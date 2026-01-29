import { permanentRedirect } from 'next/navigation';

interface TestimonialsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Testimonials Page - Redirects to landing page #testimonials section
 *
 * Issue #6 Fix: Single scrolling landing page is MVP.
 * Multi-page routes are deferred to future work.
 *
 * Uses 301 (permanent) redirect for SEO - tells search engines
 * this content has moved permanently to the single-page anchor.
 */
export default async function TestimonialsPage({ params }: TestimonialsPageProps) {
  const { slug } = await params;
  permanentRedirect(`/t/${slug}#testimonials`);
}
