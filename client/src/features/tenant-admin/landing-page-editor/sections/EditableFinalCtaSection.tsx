/**
 * EditableFinalCtaSection - Editable final CTA section for landing page editor
 *
 * Features:
 * - Edit headline and subheadline
 * - Edit CTA button text
 */

import { memo } from 'react';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import type { FinalCtaSectionConfig } from '@macon/contracts';

interface EditableFinalCtaSectionProps {
  config: FinalCtaSectionConfig;
  onUpdate: (updates: Partial<FinalCtaSectionConfig>) => void;
  disabled?: boolean;
}

export const EditableFinalCtaSection = memo(function EditableFinalCtaSection({
  config,
  onUpdate,
  disabled = false,
}: EditableFinalCtaSectionProps) {
  return (
    <section className="py-20 bg-sage">
      <Container className="text-center">
        <EditableText
          value={config.headline}
          onChange={(value) => onUpdate({ headline: value })}
          placeholder="Enter headline"
          disabled={disabled}
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
          inputClassName="text-3xl md:text-4xl lg:text-5xl font-bold text-center bg-white/20 text-white placeholder:text-white/50"
          aria-label="Final CTA headline"
        />

        <EditableText
          value={config.subheadline ?? ''}
          onChange={(value) => onUpdate({ subheadline: value || undefined })}
          placeholder="Enter subheadline (optional)"
          disabled={disabled}
          className="text-xl text-white/90 max-w-2xl mx-auto mb-8"
          inputClassName="text-xl text-center bg-white/20 text-white placeholder:text-white/50"
          aria-label="Final CTA subheadline"
        />

        <div className="inline-flex items-center gap-2 bg-white text-sage font-semibold px-8 py-4 rounded-lg text-lg hover:bg-white/90 transition-colors cursor-pointer">
          <EditableText
            value={config.ctaText}
            onChange={(value) => onUpdate({ ctaText: value })}
            placeholder="Button text"
            disabled={disabled}
            className="text-sage font-semibold"
            inputClassName="text-center bg-transparent text-sage placeholder:text-sage/50"
            aria-label="Final CTA button text"
          />
        </div>
      </Container>
    </section>
  );
});
