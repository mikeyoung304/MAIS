/**
 * EditableAccommodationSection - Editable accommodation section for landing page editor
 *
 * Features:
 * - Edit headline and description
 * - Edit CTA button text and URL
 * - Add/remove highlight chips
 * - Image placeholder
 */

import { memo } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';
import type { AccommodationSectionConfig } from '@macon/contracts';

interface EditableAccommodationSectionProps {
  config: AccommodationSectionConfig;
  onUpdate: (updates: Partial<AccommodationSectionConfig>) => void;
  disabled?: boolean;
}

export const EditableAccommodationSection = memo(function EditableAccommodationSection({
  config,
  onUpdate,
  disabled = false,
}: EditableAccommodationSectionProps) {
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const hasImage = !!safeImageUrl;

  const handleAddHighlight = () => {
    if (config.highlights.length >= 8) return;
    onUpdate({ highlights: [...config.highlights, 'New Highlight'] });
  };

  const handleRemoveHighlight = (index: number) => {
    const newHighlights = config.highlights.filter((_, i) => i !== index);
    onUpdate({ highlights: newHighlights });
  };

  const handleUpdateHighlight = (index: number, value: string) => {
    const newHighlights = [...config.highlights];
    newHighlights[index] = value;
    onUpdate({ highlights: newHighlights });
  };

  return (
    <section className="py-16 bg-sage/5">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <div>
            {hasImage ? (
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                <img
                  src={safeImageUrl}
                  alt="Accommodation"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-neutral-200 aspect-[4/3] flex items-center justify-center text-neutral-500">
                <div className="text-center p-4">
                  <p>Accommodation image</p>
                  <p className="text-sm mt-1">Upload coming in next phase</p>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <EditableText
              value={config.headline}
              onChange={(value) => onUpdate({ headline: value })}
              placeholder="Section headline"
              disabled={disabled}
              className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4"
              inputClassName="text-3xl md:text-4xl font-bold"
              aria-label="Accommodation headline"
            />

            <EditableText
              value={config.description}
              onChange={(value) => onUpdate({ description: value })}
              placeholder="Describe the accommodations..."
              disabled={disabled}
              multiline
              rows={3}
              className="text-neutral-600 leading-relaxed mb-6"
              aria-label="Accommodation description"
            />

            {/* Highlights */}
            <div className="flex flex-wrap gap-2 mb-6">
              {config.highlights.map((highlight, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="group pl-3 pr-1 py-1.5 bg-sage/10 text-sage-dark border-sage/20"
                >
                  <input
                    type="text"
                    value={highlight}
                    onChange={(e) => handleUpdateHighlight(index, e.target.value)}
                    disabled={disabled}
                    className="bg-transparent border-0 p-0 text-sm focus:outline-none w-auto min-w-[60px]"
                    style={{ width: `${Math.max(60, highlight.length * 8)}px` }}
                  />
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                      onClick={() => handleRemoveHighlight(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
              {!disabled && config.highlights.length < 8 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddHighlight}
                  className="h-8 border-dashed"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {/* CTA URL Input */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="cta-url" className="text-sm text-neutral-500">
                Booking Link URL
              </Label>
              <Input
                id="cta-url"
                type="url"
                value={config.ctaUrl}
                onChange={(e) => onUpdate({ ctaUrl: e.target.value })}
                placeholder="https://airbnb.com/..."
                disabled={disabled}
                className="max-w-md"
              />
            </div>

            {/* CTA Button */}
            <a
              href={config.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-sage hover:bg-sage-hover text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <EditableText
                value={config.ctaText}
                onChange={(value) => onUpdate({ ctaText: value })}
                placeholder="Button text"
                disabled={disabled}
                className="text-white"
                inputClassName="text-center bg-transparent text-white placeholder:text-white/50"
                aria-label="Accommodation CTA text"
              />
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
});
