'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { GallerySection as GallerySectionType, TenantPublicDto } from '@macon/contracts';
import { ImageLightbox, type LightboxImage } from '@/components/gallery/ImageLightbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface GallerySectionProps extends GallerySectionType {
  tenant: TenantPublicDto;
}

/**
 * Gallery section component for image showcase with lightbox
 *
 * Features:
 * - Responsive grid of images
 * - Click to open full-screen lightbox
 * - Pinch-to-zoom in lightbox
 * - Swipe navigation between images
 * - Keyboard navigation support
 * - Optional Instagram handle link
 * - Hover zoom effect on images
 * - Loading skeleton states
 */
export function GallerySection({
  headline = 'Our Work',
  images,
  instagramHandle,
  tenant,
}: GallerySectionProps) {
  const safeImages = Array.isArray(images) ? images : [];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  /**
   * Open lightbox at specific image index
   * Note: Hooks must be called before any early returns
   */
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  /**
   * Track when an image finishes loading
   */
  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  }, []);

  // Don't render if no images (early return AFTER all hooks)
  if (safeImages.length === 0) {
    return null;
  }

  // Transform images for lightbox
  const lightboxImages: LightboxImage[] = safeImages.map((image) => ({
    src: image.url,
    alt: image.alt || `Work by ${tenant.name}`,
  }));

  return (
    <>
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold text-text-primary sm:text-4xl">
              {headline}
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {safeImages.map((image, i) => {
              const isLoaded = loadedImages.has(i);

              return (
                <button
                  key={i}
                  onClick={() => openLightbox(i)}
                  className="group relative aspect-square overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  aria-label={`View ${image.alt || `image ${i + 1}`} in fullscreen`}
                >
                  {/* Loading skeleton */}
                  {!isLoaded && <Skeleton rounded="xl" className="absolute inset-0 z-10" />}

                  <Image
                    src={image.url}
                    alt={image.alt || `Work by ${tenant.name}`}
                    fill
                    className={cn(
                      'object-cover transition-all duration-300 group-hover:scale-105',
                      isLoaded ? 'opacity-100' : 'opacity-0'
                    )}
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    onLoad={() => handleImageLoad(i)}
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />

                  {/* Zoom indicator on hover */}
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden="true"
                  >
                    <div className="rounded-full bg-white/90 p-3 shadow-lg">
                      <svg
                        className="h-5 w-5 text-neutral-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {instagramHandle && (
            <div className="mt-8 text-center">
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Follow @{instagramHandle} on Instagram
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox modal */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
