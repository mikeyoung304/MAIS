import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestimonialsSection } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  normalizeToPages,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';
import type { TestimonialsSection as TestimonialsSectionType } from '@macon/contracts';

interface TestimonialsPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Testimonials Page (Domain-based) - Customer reviews and ratings
 *
 * Displays testimonials with ratings and author info.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: TestimonialsPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'Testimonials | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'testimonials');
}

export default async function TestimonialsPage({ searchParams }: TestimonialsPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'testimonials');

  if (!context) {
    notFound();
  }

  // Get testimonials section using centralized format conversion
  const pages = normalizeToPages(context.config);
  const testimonialsSection = pages.testimonials.sections[0];
  const testimonialsData =
    testimonialsSection?.type === 'testimonials'
      ? (testimonialsSection as TestimonialsSectionType)
      : null;

  return (
    <div id="main-content">
      {testimonialsData && testimonialsData.items.length > 0 ? (
        <TestimonialsSection {...testimonialsData} tenant={context.tenant} />
      ) : (
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl">
              What Clients Say
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
              Testimonials coming soon. Check back later to read what our clients say about us!
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export const revalidate = 60;
