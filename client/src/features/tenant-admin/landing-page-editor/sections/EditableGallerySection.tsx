/**
 * EditableGallerySection - Editable gallery section for landing page editor
 *
 * Features:
 * - Edit headline
 * - Display gallery images
 * - Instagram handle input
 * - Image upload coming in next phase
 */

import { memo } from 'react';
import { Instagram } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';
import type { GallerySectionConfig } from '@macon/contracts';

interface EditableGallerySectionProps {
  config: GallerySectionConfig;
  onUpdate: (updates: Partial<GallerySectionConfig>) => void;
  disabled?: boolean;
}

export const EditableGallerySection = memo(function EditableGallerySection({
  config,
  onUpdate,
  disabled = false,
}: EditableGallerySectionProps) {
  return (
    <section className="py-16 bg-white">
      <Container>
        <EditableText
          value={config.headline}
          onChange={(value) => onUpdate({ headline: value })}
          placeholder="Gallery headline"
          disabled={disabled}
          className="text-3xl md:text-4xl font-bold text-neutral-900 text-center mb-8"
          inputClassName="text-3xl md:text-4xl font-bold text-center"
          aria-label="Gallery headline"
        />

        {/* Instagram Handle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Instagram className="h-5 w-5 text-pink-500" />
          <Label htmlFor="instagram" className="text-sm text-neutral-500">
            @
          </Label>
          <Input
            id="instagram"
            type="text"
            value={config.instagramHandle ?? ''}
            onChange={(e) => onUpdate({ instagramHandle: e.target.value || undefined })}
            placeholder="yourhandle"
            disabled={disabled}
            className="max-w-[200px]"
          />
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {config.images.map((image, index) => {
            const safeUrl = sanitizeImageUrl(image.url);
            return (
              <div
                key={index}
                className="group relative aspect-square rounded-lg overflow-hidden bg-neutral-100"
              >
                {safeUrl ? (
                  <img
                    src={safeUrl}
                    alt={image.alt || `Gallery image ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400">
                    No image
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Placeholder for image upload */}
        <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 text-center text-neutral-500 text-sm">
          Image upload and management coming in next phase
        </div>
      </Container>
    </section>
  );
});
