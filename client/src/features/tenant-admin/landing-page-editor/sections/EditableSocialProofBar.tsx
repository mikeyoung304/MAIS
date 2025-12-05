/**
 * EditableSocialProofBar - Editable social proof bar for landing page editor
 *
 * Features:
 * - Add/remove proof items
 * - Edit icon selection and text
 */

import { memo } from 'react';
import { Plus, Trash2, Star, Calendar, Users, Award, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Container } from '@/ui/Container';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SocialProofBarConfig, SocialProofIcon } from '@macon/contracts';

interface EditableSocialProofBarProps {
  config: SocialProofBarConfig;
  onUpdate: (updates: Partial<SocialProofBarConfig>) => void;
  disabled?: boolean;
}

const ICON_OPTIONS: { value: SocialProofIcon; label: string; Icon: typeof Star }[] = [
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'calendar', label: 'Calendar', Icon: Calendar },
  { value: 'users', label: 'Users', Icon: Users },
  { value: 'award', label: 'Award', Icon: Award },
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'check', label: 'Check', Icon: Check },
];

const getIconComponent = (icon: SocialProofIcon) => {
  const iconOption = ICON_OPTIONS.find((opt) => opt.value === icon);
  return iconOption?.Icon || Star;
};

export const EditableSocialProofBar = memo(function EditableSocialProofBar({
  config,
  onUpdate,
  disabled = false,
}: EditableSocialProofBarProps) {
  const handleUpdateItem = (index: number, updates: { icon?: SocialProofIcon; text?: string }) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ items: newItems });
  };

  const handleAddItem = () => {
    if (config.items.length >= 6) return;
    onUpdate({
      items: [...config.items, { icon: 'star', text: 'New Item' }],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (config.items.length <= 1) return;
    const newItems = config.items.filter((_, i) => i !== index);
    onUpdate({ items: newItems });
  };

  return (
    <section className="bg-sage/10 py-6">
      <Container>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {config.items.map((item, index) => {
            const IconComponent = getIconComponent(item.icon);
            return (
              <div
                key={index}
                className="group flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm"
              >
                <Select
                  value={item.icon}
                  onValueChange={(value: SocialProofIcon) =>
                    handleUpdateItem(index, { icon: value })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="w-10 h-10 p-0 border-0 [&>svg]:hidden">
                    <SelectValue>
                      <IconComponent className="w-5 h-5 text-sage" />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.Icon className="w-4 h-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <EditableText
                  value={item.text}
                  onChange={(value) => handleUpdateItem(index, { text: value })}
                  placeholder="Proof text"
                  disabled={disabled}
                  className="text-neutral-700 font-medium whitespace-nowrap"
                  aria-label={`Social proof item ${index + 1}`}
                />
                {!disabled && config.items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
          {!disabled && config.items.length < 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="border-dashed"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          )}
        </div>
      </Container>
    </section>
  );
});
