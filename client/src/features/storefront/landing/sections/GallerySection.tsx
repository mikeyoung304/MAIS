/**
 * GallerySection Component
 *
 * Responsive photo grid with optional Instagram link.
 * Supports variable image counts with automatic grid sizing.
 */

import { Instagram } from 'lucide-react';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';

interface GalleryImage {
  url: string;
  alt?: string;
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

export function GallerySection({ config }: GallerySectionProps) {
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
          {safeImages.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
            >
              <img
                src={image.url}
                alt={image.alt || `Gallery image ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
            </div>
          ))}
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
      </Container>
    </section>
  );
}
