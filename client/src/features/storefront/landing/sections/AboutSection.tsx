import { memo } from 'react';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Button } from '@/components/ui/button';
import { MoveLeft, MoveRight } from 'lucide-react';

interface AboutConfig {
  headline: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
}

interface AboutSectionProps {
  config: AboutConfig;
  editable?: boolean;
  onUpdate?: (updates: Partial<AboutConfig>) => void;
  disabled?: boolean;
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
 * Editable Mode (TODO-256):
 * When editable={true}, wraps text in EditableText components and adds image position toggle.
 * This eliminates the need for duplicate "EditableAboutSection" components.
 *
 * @example
 * ```tsx
 * // Display mode
 * <AboutSection
 *   config={{
 *     headline: "Our Story",
 *     content: "Founded in 2010...\n\nToday we serve...",
 *     imageUrl: "https://example.com/farm.jpg",
 *     imageAlt: "View of our farm at sunrise",
 *     imagePosition: "right"
 *   }}
 * />
 *
 * // Editable mode
 * <AboutSection
 *   config={config}
 *   editable={true}
 *   onUpdate={(updates) => handleUpdate(updates)}
 *   disabled={isSaving}
 * />
 * ```
 *
 * @param props.config - About section configuration from tenant branding
 * @param props.config.headline - Section headline (required)
 * @param props.config.content - Multi-paragraph content text, use \n\n to separate paragraphs (required)
 * @param props.config.imageUrl - Image URL, sanitized before rendering (optional)
 * @param props.config.imageAlt - Alt text for the image, defaults to "About our business" (optional)
 * @param props.config.imagePosition - Position of image: 'left' or 'right', defaults to 'right' (optional)
 * @param props.editable - Enable inline editing mode (default: false)
 * @param props.onUpdate - Callback when content is updated in editable mode
 * @param props.disabled - Disable editing in editable mode (e.g., during save)
 *
 * @see AboutSectionConfigSchema in @macon/contracts for Zod validation
 */
export const AboutSection = memo(function AboutSection({
  config,
  editable = false,
  onUpdate,
  disabled = false
}: AboutSectionProps) {
  const imagePosition = config.imagePosition || 'right';

  // Sanitize image URL (defense-in-depth)
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const hasImage = !!safeImageUrl;

  // Split content into paragraphs for better rendering (with defensive coding)
  const paragraphs = config?.content?.split('\n\n').filter(Boolean) || [];

  const toggleImagePosition = () => {
    onUpdate?.({ imagePosition: imagePosition === 'right' ? 'left' : 'right' });
  };

  return (
    <section className="py-16 md:py-24 bg-neutral-50">
      <Container>
        <div className={`grid grid-cols-1 ${hasImage ? 'lg:grid-cols-2' : ''} gap-12 items-center`}>
          {/* Image - Left position */}
          {imagePosition === 'left' && (
            <div className="order-1">
              {hasImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                  <img
                    src={safeImageUrl}
                    alt={config.imageAlt || 'About our business'}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : editable ? (
                <div className="rounded-2xl bg-neutral-200 aspect-[4/3] flex items-center justify-center text-neutral-500">
                  <div className="text-center p-4">
                    <p>Image placeholder</p>
                    <p className="text-sm mt-1">Upload coming in next phase</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Content */}
          <div
            className={`order-2 ${hasImage && imagePosition === 'left' ? 'lg:order-2' : 'lg:order-1'}`}
          >
            {editable ? (
              <>
                <EditableText
                  value={config.headline}
                  onChange={(value) => onUpdate?.({ headline: value })}
                  placeholder="Enter headline"
                  disabled={disabled}
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 mb-6"
                  inputClassName="text-3xl md:text-4xl lg:text-5xl font-bold"
                  aria-label="About section headline"
                />
                <EditableText
                  value={config.content}
                  onChange={(value) => onUpdate?.({ content: value })}
                  placeholder="Tell your story here..."
                  disabled={disabled}
                  multiline
                  rows={6}
                  className="text-neutral-600 leading-relaxed prose prose-lg max-w-none mb-6"
                  inputClassName="leading-relaxed"
                  aria-label="About section content"
                />
                {/* Image position toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-500">Image position:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleImagePosition}
                    disabled={disabled}
                    className="gap-1"
                  >
                    {imagePosition === 'left' ? (
                      <>
                        <MoveRight className="h-4 w-4" />
                        Move Right
                      </>
                    ) : (
                      <>
                        <MoveLeft className="h-4 w-4" />
                        Move Left
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Image - Right position */}
          {imagePosition === 'right' && (
            <div className="order-1 lg:order-2">
              {hasImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                  <img
                    src={safeImageUrl}
                    alt={config.imageAlt || 'About our business'}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : editable ? (
                <div className="rounded-2xl bg-neutral-200 aspect-[4/3] flex items-center justify-center text-neutral-500">
                  <div className="text-center p-4">
                    <p>Image placeholder</p>
                    <p className="text-sm mt-1">Upload coming in next phase</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
});
