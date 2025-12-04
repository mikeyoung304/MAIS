import { memo } from 'react';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';

interface AboutConfig {
  headline: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
}

interface AboutSectionProps {
  config: AboutConfig;
}

/**
 * About section for landing pages
 *
 * Displays a two-column layout featuring business information with an optional image.
 * The image position (left or right) is configurable, and content supports multi-paragraph
 * text by splitting on double newlines. Gracefully adapts to single-column layout on mobile.
 *
 * If no image is provided, the content expands to full width. All images are lazy-loaded
 * for performance and URLs are sanitized for security.
 *
 * @example
 * ```tsx
 * <AboutSection
 *   config={{
 *     headline: "Our Story",
 *     content: "Founded in 2010...\n\nToday we serve...",
 *     imageUrl: "https://example.com/farm.jpg",
 *     imageAlt: "View of our farm at sunrise",
 *     imagePosition: "right"
 *   }}
 * />
 * ```
 *
 * @param props.config - About section configuration from tenant branding
 * @param props.config.headline - Section headline (required)
 * @param props.config.content - Multi-paragraph content text, use \n\n to separate paragraphs (required)
 * @param props.config.imageUrl - Image URL, sanitized before rendering (optional)
 * @param props.config.imageAlt - Alt text for the image, defaults to "About our business" (optional)
 * @param props.config.imagePosition - Position of image: 'left' or 'right', defaults to 'right' (optional)
 *
 * @see AboutSectionConfigSchema in @macon/contracts for Zod validation
 */
export const AboutSection = memo(function AboutSection({ config }: AboutSectionProps) {
  const imagePosition = config.imagePosition || 'right';

  // Sanitize image URL (defense-in-depth)
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const hasImage = !!safeImageUrl;

  // Split content into paragraphs for better rendering (with defensive coding)
  const paragraphs = config?.content?.split('\n\n').filter(Boolean) || [];

  return (
    <section className="py-16 md:py-24 bg-neutral-50">
      <Container>
        <div className={`grid grid-cols-1 ${hasImage ? 'lg:grid-cols-2' : ''} gap-12 items-center`}>
          {/* Image - Left position */}
          {hasImage && imagePosition === 'left' && (
            <div className="order-1">
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                <img
                  src={safeImageUrl}
                  alt={config.imageAlt || 'About our business'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div
            className={`order-2 ${hasImage && imagePosition === 'left' ? 'lg:order-2' : 'lg:order-1'}`}
          >
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
              {config.headline}
            </h2>
            <div className="prose prose-lg prose-neutral max-w-none">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="text-neutral-600 leading-relaxed mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Image - Right position */}
          {hasImage && imagePosition === 'right' && (
            <div className="order-1 lg:order-2">
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                <img
                  src={safeImageUrl}
                  alt={config.imageAlt || 'About our business'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
});
