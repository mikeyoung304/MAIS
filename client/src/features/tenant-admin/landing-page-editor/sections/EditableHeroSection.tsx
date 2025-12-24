/**
 * EditableHeroSection - Editable hero section for landing page editor
 *
 * Features:
 * - Click-to-edit headline and subheadline
 * - Background image placeholder
 * - CTA button text editing
 *
 * Layout Shift Prevention (TODO-255):
 * Uses aspect-[16/9] with min-h-[60vh] fallback for consistent layout.
 * This prevents CLS (Cumulative Layout Shift) when background images load.
 */

import { memo } from 'react';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import { sanitizeBackgroundUrl } from '@/lib/sanitize-url';
import type { HeroSectionConfig } from '@macon/contracts';

interface EditableHeroSectionProps {
  config: HeroSectionConfig;
  onUpdate: (updates: Partial<HeroSectionConfig>) => void;
  disabled?: boolean;
}

export const EditableHeroSection = memo(function EditableHeroSection({
  config,
  onUpdate,
  disabled = false,
}: EditableHeroSectionProps) {
  const backgroundImage = sanitizeBackgroundUrl(config?.backgroundImageUrl);

  return (
    <section
      className="relative min-h-[60vh] aspect-video flex items-center justify-center overflow-hidden bg-neutral-800"
      style={{
        backgroundImage: backgroundImage || undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <Container className="relative z-10 text-center py-16">
        <EditableText
          value={config.headline}
          onChange={(value) => onUpdate({ headline: value })}
          placeholder="Enter headline"
          disabled={disabled}
          className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
          inputClassName="text-4xl md:text-5xl lg:text-6xl font-bold text-center bg-white/20 text-white placeholder:text-white/50"
          aria-label="Hero headline"
        />

        <EditableText
          value={config.subheadline ?? ''}
          onChange={(value) => onUpdate({ subheadline: value || undefined })}
          placeholder="Enter subheadline (optional)"
          disabled={disabled}
          className="text-white/90 text-xl md:text-2xl max-w-3xl mx-auto mb-8"
          inputClassName="text-xl md:text-2xl text-center bg-white/20 text-white placeholder:text-white/50"
          aria-label="Hero subheadline"
        />

        <div className="inline-flex items-center gap-2 bg-sage/80 text-white font-semibold px-8 py-4 rounded-lg text-lg">
          <EditableText
            value={config.ctaText}
            onChange={(value) => onUpdate({ ctaText: value })}
            placeholder="Button text"
            disabled={disabled}
            className="text-white"
            inputClassName="text-center bg-transparent text-white placeholder:text-white/50"
            aria-label="Call to action text"
          />
        </div>

        {/* Background image placeholder */}
        {!backgroundImage && (
          <div className="mt-8 p-4 bg-white/10 rounded-lg border border-dashed border-white/30 text-white/70 text-sm">
            Background image coming in next phase
          </div>
        )}
      </Container>
    </section>
  );
});
