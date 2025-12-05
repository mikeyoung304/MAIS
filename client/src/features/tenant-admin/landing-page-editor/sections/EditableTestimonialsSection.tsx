/**
 * EditableTestimonialsSection - Editable testimonials for landing page editor
 *
 * Features:
 * - Add/remove testimonials
 * - Edit quote, author, role
 * - Star rating selection
 */

import { memo } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import type { TestimonialsSectionConfig, TestimonialItem } from '@macon/contracts';

interface EditableTestimonialsSectionProps {
  config: TestimonialsSectionConfig;
  onUpdate: (updates: Partial<TestimonialsSectionConfig>) => void;
  disabled?: boolean;
}

function StarRating({
  rating,
  onRatingChange,
  disabled,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onRatingChange(star)}
          disabled={disabled}
          className={`p-0 ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
        >
          <Star
            className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

export const EditableTestimonialsSection = memo(function EditableTestimonialsSection({
  config,
  onUpdate,
  disabled = false,
}: EditableTestimonialsSectionProps) {
  const handleUpdateItem = (index: number, updates: Partial<TestimonialItem>) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ items: newItems });
  };

  const handleAddItem = () => {
    if (config.items.length >= 10) return;
    const newItem: TestimonialItem = {
      quote: 'Enter testimonial quote...',
      author: 'Customer Name',
      role: 'Verified Client',
      rating: 5,
    };
    onUpdate({ items: [...config.items, newItem] });
  };

  const handleRemoveItem = (index: number) => {
    if (config.items.length <= 1) return;
    const newItems = config.items.filter((_, i) => i !== index);
    onUpdate({ items: newItems });
  };

  return (
    <section className="py-16 bg-white">
      <Container>
        <EditableText
          value={config.headline}
          onChange={(value) => onUpdate({ headline: value })}
          placeholder="Section headline"
          disabled={disabled}
          className="text-3xl md:text-4xl font-bold text-neutral-900 text-center mb-12"
          inputClassName="text-3xl md:text-4xl font-bold text-center"
          aria-label="Testimonials headline"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {config.items.map((item, index) => (
            <Card key={index} className="group relative">
              {!disabled && config.items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                  onClick={() => handleRemoveItem(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <CardContent className="p-6">
                <StarRating
                  rating={item.rating}
                  onRatingChange={(rating) => handleUpdateItem(index, { rating })}
                  disabled={disabled}
                />
                <EditableText
                  value={item.quote}
                  onChange={(value) => handleUpdateItem(index, { quote: value })}
                  placeholder="Testimonial quote"
                  disabled={disabled}
                  multiline
                  rows={3}
                  className="text-neutral-600 italic mt-4 mb-4"
                  aria-label={`Testimonial ${index + 1} quote`}
                />
                <div className="border-t pt-4">
                  <EditableText
                    value={item.author}
                    onChange={(value) => handleUpdateItem(index, { author: value })}
                    placeholder="Author name"
                    disabled={disabled}
                    className="font-semibold text-neutral-900"
                    aria-label={`Testimonial ${index + 1} author`}
                  />
                  <EditableText
                    value={item.role ?? ''}
                    onChange={(value) =>
                      handleUpdateItem(index, { role: value || undefined })
                    }
                    placeholder="Role (optional)"
                    disabled={disabled}
                    className="text-sm text-neutral-500"
                    aria-label={`Testimonial ${index + 1} role`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!disabled && config.items.length < 10 && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={handleAddItem} className="border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Add Testimonial
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
});
