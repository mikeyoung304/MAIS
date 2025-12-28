import Image from 'next/image';
import type { GallerySection as GallerySectionType, TenantPublicDto } from '@macon/contracts';

interface GallerySectionProps extends GallerySectionType {
  tenant: TenantPublicDto;
}

/**
 * Gallery section component for image showcase
 *
 * Features:
 * - Responsive grid of images
 * - Optional Instagram handle link
 * - Hover zoom effect on images
 */
export function GallerySection({
  headline = 'Our Work',
  images = [],
  instagramHandle,
  tenant,
}: GallerySectionProps) {
  // Don't render if no images
  if (images.length === 0) {
    return null;
  }

  return (
    <section className="bg-surface-alt py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
            {headline}
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-2xl">
              <Image
                src={image.url}
                alt={image.alt || `Work by ${tenant.name}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </div>
          ))}
        </div>

        {instagramHandle && (
          <div className="mt-8 text-center">
            <a
              href={`https://instagram.com/${instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sage hover:underline"
            >
              Follow @{instagramHandle} on Instagram
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
