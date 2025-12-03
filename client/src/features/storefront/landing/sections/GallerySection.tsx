import { memo, useState } from 'react';
import { Instagram, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';

interface GalleryImage {
  url: string;
  alt?: string;
  caption?: string;
}

interface GalleryConfig {
  headline: string;
  images: GalleryImage[];
  instagramHandle?: string;
}

interface GallerySectionProps {
  config: GalleryConfig;
}

/**
 * Sanitizes Instagram handle to prevent URL injection attacks.
 * Only allows alphanumeric characters, underscores, and periods.
 * @see https://help.instagram.com/370452623149242 (Instagram username rules)
 */
function sanitizeInstagramHandle(handle: string | undefined): string | undefined {
  if (!handle) return undefined;
  // Remove @ prefix and strip any characters not allowed in Instagram usernames
  const sanitized = handle.replace('@', '').replace(/[^a-zA-Z0-9._]/g, '');
  // Instagram usernames are 1-30 characters
  if (sanitized.length === 0 || sanitized.length > 30) return undefined;
  return sanitized;
}

/**
 * Gallery section for landing pages
 *
 * Displays a responsive photo grid showcasing business images. The grid layout
 * automatically adjusts based on the number of images (1-3: 3 columns, 4: 2 columns,
 * 5-6: 3 columns, 7-8: 4 columns, 9+: 4 columns). Each image has a hover effect
 * with subtle zoom animation.
 *
 * Optionally includes Instagram integration with a clickable handle link and a
 * follow button at the bottom. Instagram handles are sanitized to prevent injection
 * attacks and must follow Instagram's username rules (alphanumeric, underscore, period).
 *
 * All images are lazy-loaded for performance and URLs are sanitized for security.
 * Images without alt text fall back to using the caption or a generic description.
 *
 * @example
 * ```tsx
 * <GallerySection
 *   config={{
 *     headline: "Gallery",
 *     images: [
 *       {
 *         url: "https://example.com/photo1.jpg",
 *         alt: "Farm at sunset",
 *         caption: "Beautiful evening view"
 *       },
 *       {
 *         url: "https://example.com/photo2.jpg",
 *         alt: "Fresh vegetables"
 *       }
 *     ],
 *     instagramHandle: "mountainviewfarm"
 *   }}
 * />
 * ```
 *
 * @param props.config - Gallery section configuration from tenant branding
 * @param props.config.headline - Section headline (required)
 * @param props.config.images - Array of gallery images to display (required)
 * @param props.config.images[].url - Image URL, sanitized before rendering (required)
 * @param props.config.images[].alt - Alt text for accessibility (optional, uses caption or generic fallback)
 * @param props.config.images[].caption - Image caption (optional)
 * @param props.config.instagramHandle - Instagram username without @ symbol, creates clickable link (optional)
 *
 * @see GallerySectionConfigSchema in @macon/contracts for Zod validation
 */
export const GallerySection = memo(function GallerySection({ config }: GallerySectionProps) {
  // Lightbox state
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  // Filter and sanitize images (defense-in-depth)
  const safeImages = (config?.images ?? [])
    .map(image => ({
      ...image,
      url: sanitizeImageUrl(image.url),
    }))
    .filter(image => image.url !== undefined);

  // Sanitize Instagram handle to prevent URL injection
  const safeInstagramHandle = sanitizeInstagramHandle(config?.instagramHandle);

  // Early return if no valid images
  if (safeImages.length === 0) return null;

  // Determine grid layout based on image count
  const getGridClass = (count: number) => {
    if (count <= 3) return 'grid-cols-1 sm:grid-cols-3';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 8) return 'grid-cols-2 sm:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <Container>
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">
            {config.headline}
          </h2>
          {safeInstagramHandle && (
            <a
              href={`https://instagram.com/${safeInstagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              <Instagram className="w-5 h-5" />
              <span className="font-medium">@{safeInstagramHandle}</span>
            </a>
          )}
        </div>

        {/* Photo Grid */}
        <div className={`grid ${getGridClass(safeImages.length)} gap-4`}>
          {safeImages.map((image, index) => {
            const imageAlt = image.alt || image.caption || `Gallery image ${index + 1}`;
            return (
              <button
                key={index}
                onClick={() => setSelectedImage({ url: image.url!, alt: imageAlt })}
                className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`View full size: ${imageAlt}`}
              >
                <img
                  src={image.url}
                  alt={imageAlt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </button>
            );
          })}
        </div>

        {/* Instagram CTA */}
        {safeInstagramHandle && (
          <div className="text-center mt-8">
            <a
              href={`https://instagram.com/${safeInstagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold px-6 py-3 rounded-lg transition-all hover:scale-105"
            >
              <Instagram className="w-5 h-5" />
              Follow us on Instagram
            </a>
          </div>
        )}

        {/* Lightbox Dialog */}
        <Dialog.Root open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content
              className="fixed inset-0 z-50 flex items-center justify-center p-4 focus-visible:outline-none"
              aria-describedby={undefined}
            >
              {selectedImage && (
                <div className="relative max-w-7xl max-h-full">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.alt}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                  <Dialog.Close
                    className="absolute -top-2 -right-2 sm:top-4 sm:right-4 text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    aria-label="Close lightbox"
                  >
                    <X className="w-6 h-6" />
                    <span className="sr-only">Close</span>
                  </Dialog.Close>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Container>
    </section>
  );
});
