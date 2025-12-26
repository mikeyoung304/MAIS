import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestimonialsSection } from '@/components/tenant';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
  isPageEnabled,
} from '@/lib/tenant';
import type { LandingPageConfig, TestimonialsSection as TestimonialsSectionType } from '@macon/contracts';

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

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
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

export default async function TestimonialsPage({ searchParams }: TestimonialsPageProps) {
  const { domain } = await searchParams;

  // Validate domain parameter
  let validatedDomain: string;
  try {
    validatedDomain = validateDomain(domain);
  } catch (error) {
    if (error instanceof InvalidDomainError) {
      notFound();
    }
    throw error;
  }

  try {
    const tenant = await getTenantByDomain(validatedDomain);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Check if testimonials page is enabled
    if (!isPageEnabled(config, 'testimonials')) {
      notFound();
    }

    // Get testimonials section from pages config or legacy config
    let testimonialsData: TestimonialsSectionType | null = null;

    if (config?.pages?.testimonials?.sections?.[0]?.type === 'testimonials') {
      testimonialsData = config.pages.testimonials.sections[0] as TestimonialsSectionType;
    } else if (config?.testimonials) {
      // Legacy format - convert to new format
      testimonialsData = {
        type: 'testimonials',
        headline: config.testimonials.headline,
        items: config.testimonials.items.map((item) => ({
          quote: item.quote,
          authorName: item.author,
          authorRole: item.role,
          authorPhotoUrl: item.imageUrl,
          rating: item.rating,
        })),
      };
    }

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
