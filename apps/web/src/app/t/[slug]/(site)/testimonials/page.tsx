import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestimonialsSection } from '@/components/tenant';
import {
  getTenantStorefrontData,
  TenantNotFoundError,
  isPageEnabled,
  normalizeToPages,
} from '@/lib/tenant';
import type {
  LandingPageConfig,
  TestimonialsSection as TestimonialsSectionType,
} from '@macon/contracts';

interface TestimonialsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Testimonials Page - Customer reviews and ratings
 *
 * Displays testimonials with ratings and author info.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: TestimonialsPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // If page is disabled, return noindex metadata
    if (!isPageEnabled(config, 'testimonials')) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `Testimonials | ${tenant.name}`,
      description: `Read what our clients say about ${tenant.name}. See reviews and testimonials from happy customers.`,
      openGraph: {
        title: `Testimonials | ${tenant.name}`,
        description: `Read what our clients say about ${tenant.name}. See reviews and testimonials from happy customers.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Testimonials | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function TestimonialsPage({ params }: TestimonialsPageProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Check if testimonials page is enabled
    if (!isPageEnabled(config, 'testimonials')) {
      notFound();
    }

    // Get testimonials section using centralized format conversion
    const pages = normalizeToPages(config);
    const testimonialsSection = pages.testimonials.sections[0];
    const testimonialsData =
      testimonialsSection?.type === 'testimonials'
        ? (testimonialsSection as TestimonialsSectionType)
        : null;

    return (
      <div id="main-content">
        {testimonialsData && testimonialsData.items.length > 0 ? (
          <TestimonialsSection {...testimonialsData} tenant={tenant} />
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
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
