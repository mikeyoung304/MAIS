import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GallerySection } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  normalizeToPages,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';
import type { GallerySection as GallerySectionType } from '@macon/contracts';

interface GalleryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Gallery Page - Showcase tenant's work
 *
 * Displays gallery images with optional Instagram link.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'gallery');
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'gallery');

  if (!context) {
    notFound();
  }

  // Get gallery section using centralized format conversion
  const pages = normalizeToPages(context.config);
  const gallerySection = pages.gallery.sections[0];
  const galleryData =
    gallerySection?.type === 'gallery' ? (gallerySection as GallerySectionType) : null;

  return (
    <>
      {galleryData ? (
        <GallerySection {...galleryData} tenant={context.tenant} />
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
    </>
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
