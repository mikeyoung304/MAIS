/**
 * AboutSection Component
 *
 * Two-column layout with image and rich text content.
 * Image position is configurable (left or right).
 * Supports markdown in content.
 */

import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';

interface AboutConfig {
  headline: string;
  content: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
}

interface AboutSectionProps {
  config: AboutConfig;
}

export function AboutSection({ config }: AboutSectionProps) {
  const imagePosition = config.imagePosition || 'right';

  // Sanitize image URL (defense-in-depth)
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const hasImage = !!safeImageUrl;

  // Split content into paragraphs for better rendering (with defensive coding)
  const paragraphs = config?.content?.split('\n\n').filter(Boolean) || [];

  return (
    <section className="py-16 md:py-24 bg-neutral-50">
      <Container>
        <div
          className={`grid grid-cols-1 ${hasImage ? 'lg:grid-cols-2' : ''} gap-12 items-center`}
        >
          {/* Image - Left position */}
          {hasImage && imagePosition === 'left' && (
            <div className="order-1">
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                <img
                  src={safeImageUrl}
                  alt={config.headline}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className={`order-2 ${hasImage && imagePosition === 'left' ? 'lg:order-2' : 'lg:order-1'}`}>
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
                  alt={config.headline}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
