/**
 * EditableFaqSection - Editable FAQ section for landing page editor
 *
 * Features:
 * - Edit headline
 * - Add/remove FAQ items
 * - Edit question and answer
 */

import { memo, useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import { cn } from '@/lib/utils';
import type { FaqSectionConfig, FaqItem } from '@macon/contracts';

interface EditableFaqSectionProps {
  config: FaqSectionConfig;
  onUpdate: (updates: Partial<FaqSectionConfig>) => void;
  disabled?: boolean;
}

export const EditableFaqSection = memo(function EditableFaqSection({
  config,
  onUpdate,
  disabled = false,
}: EditableFaqSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleUpdateItem = (index: number, updates: Partial<FaqItem>) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ items: newItems });
  };

  const handleAddItem = () => {
    if (config.items.length >= 20) return;
    const newItem: FaqItem = {
      question: 'Enter your question',
      answer: 'Enter your answer here...',
    };
    onUpdate({ items: [...config.items, newItem] });
    setExpandedIndex(config.items.length);
  };

  const handleRemoveItem = (index: number) => {
    if (config.items.length <= 1) return;
    const newItems = config.items.filter((_, i) => i !== index);
    onUpdate({ items: newItems });
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  return (
    <section className="py-16 bg-neutral-50">
      <Container className="max-w-3xl">
        <EditableText
          value={config.headline}
          onChange={(value) => onUpdate({ headline: value })}
          placeholder="FAQ headline"
          disabled={disabled}
          className="text-3xl md:text-4xl font-bold text-neutral-900 text-center mb-12"
          inputClassName="text-3xl md:text-4xl font-bold text-center"
          aria-label="FAQ headline"
        />

        <div className="space-y-3">
          {config.items.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <Card key={index} className="group overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-neutral-400 transition-transform flex-shrink-0',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                    <EditableText
                      value={item.question}
                      onChange={(value) => handleUpdateItem(index, { question: value })}
                      placeholder="Enter question"
                      disabled={disabled}
                      className="font-medium text-neutral-900"
                      aria-label={`FAQ question ${index + 1}`}
                    />
                  </div>
                  {!disabled && config.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 pl-12">
                    <EditableText
                      value={item.answer}
                      onChange={(value) => handleUpdateItem(index, { answer: value })}
                      placeholder="Enter answer"
                      disabled={disabled}
                      multiline
                      rows={3}
                      className="text-neutral-600"
                      aria-label={`FAQ answer ${index + 1}`}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {!disabled && config.items.length < 20 && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={handleAddItem} className="border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
});
