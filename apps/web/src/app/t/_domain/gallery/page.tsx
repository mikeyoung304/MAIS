import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GallerySection } from '@/components/tenant';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
  isPageEnabled,
} from '@/lib/tenant';
import type { LandingPageConfig, GallerySection as GallerySectionType } from '@macon/contracts';

interface GalleryPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Gallery Page (Domain-based) - Showcase tenant's work
 *
 * Displays gallery images with optional Instagram link.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ searchParams }: GalleryPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // If page is disabled, return noindex metadata
    if (!isPageEnabled(config, 'gallery')) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    return {
      title: `Gallery | ${tenant.name}`,
      description: `View our portfolio and work at ${tenant.name}. See examples of what we can do for you.`,
      openGraph: {
        title: `Gallery | ${tenant.name}`,
        description: `View our portfolio and work at ${tenant.name}. See examples of what we can do for you.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Gallery | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
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

    // Check if gallery page is enabled
    if (!isPageEnabled(config, 'gallery')) {
      notFound();
    }

    // Get gallery section from pages config or legacy config
    let galleryData: GallerySectionType | null = null;

    if (config?.pages?.gallery?.sections?.[0]?.type === 'gallery') {
      galleryData = config.pages.gallery.sections[0] as GallerySectionType;
    } else if (config?.gallery) {
      // Legacy format - convert to new format
      galleryData = {
        type: 'gallery',
        headline: config.gallery.headline,
        images: config.gallery.images.map((img) => ({
          url: img.url,
          alt: img.alt || '',
        })),
        instagramHandle: config.gallery.instagramHandle,
      };
    }

    return (
      <div id="main-content">
        {galleryData ? (
          <GallerySection {...galleryData} tenant={tenant} />
        ) : (
          <section className="py-32 md:py-40">
            <div className="mx-auto max-w-6xl px-6 text-center">
              <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl">
                Our Gallery
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
                Gallery coming soon. Check back later for examples of our work!
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
