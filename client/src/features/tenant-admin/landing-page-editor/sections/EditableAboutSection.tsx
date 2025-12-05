/**
 * EditableAboutSection - Editable about section for landing page editor
 *
 * Features:
 * - Click-to-edit headline
 * - Multiline content editing
 * - Image placeholder
 * - Image position toggle
 */

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';
import { MoveLeft, MoveRight } from 'lucide-react';
import type { AboutSectionConfig } from '@macon/contracts';

interface EditableAboutSectionProps {
  config: AboutSectionConfig;
  onUpdate: (updates: Partial<AboutSectionConfig>) => void;
  disabled?: boolean;
}

export const EditableAboutSection = memo(function EditableAboutSection({
  config,
  onUpdate,
  disabled = false,
}: EditableAboutSectionProps) {
  const imagePosition = config.imagePosition || 'right';
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const hasImage = !!safeImageUrl;

  const toggleImagePosition = () => {
    onUpdate({ imagePosition: imagePosition === 'right' ? 'left' : 'right' });
  };

  return (
    <section className="py-16 bg-neutral-50">
      <Container>
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}>
          {/* Image - Left position */}
          {imagePosition === 'left' && (
            <div className="order-1">
              {hasImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                  <img
                    src={safeImageUrl}
                    alt="About section"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-neutral-200 aspect-[4/3] flex items-center justify-center text-neutral-500">
                  <div className="text-center p-4">
                    <p>Image placeholder</p>
                    <p className="text-sm mt-1">Upload coming in next phase</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className={`order-2 ${imagePosition === 'left' ? 'lg:order-2' : 'lg:order-1'}`}>
            <EditableText
              value={config.headline}
              onChange={(value) => onUpdate({ headline: value })}
              placeholder="Enter headline"
              disabled={disabled}
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 mb-6"
              inputClassName="text-3xl md:text-4xl lg:text-5xl font-bold"
              aria-label="About section headline"
            />
            <EditableText
              value={config.content}
              onChange={(value) => onUpdate({ content: value })}
              placeholder="Tell your story here..."
              disabled={disabled}
              multiline
              rows={6}
              className="text-neutral-600 leading-relaxed prose prose-lg max-w-none"
              inputClassName="leading-relaxed"
              aria-label="About section content"
            />

            {/* Image position toggle */}
            <div className="mt-6 flex items-center gap-2">
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
          </div>

          {/* Image - Right position */}
          {imagePosition === 'right' && (
            <div className="order-1 lg:order-2">
              {hasImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                  <img
                    src={safeImageUrl}
                    alt="About section"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-neutral-200 aspect-[4/3] flex items-center justify-center text-neutral-500">
                  <div className="text-center p-4">
                    <p>Image placeholder</p>
                    <p className="text-sm mt-1">Upload coming in next phase</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
});
