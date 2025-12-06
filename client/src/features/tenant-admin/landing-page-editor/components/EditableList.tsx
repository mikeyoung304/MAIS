/**
 * EditableList - Generic reusable list editor component
 *
 * Features:
 * - Generic typing for different item structures
 * - Add/remove/update operations
 * - Custom rendering via renderItem prop
 * - Max items limit support
 * - Empty state message
 * - Disabled state support
 *
 * Usage:
 * - Testimonials: { quote, author, role?, imageUrl?, rating }
 * - FAQ: { question, answer }
 * - SocialProofBar: { icon, text }
 * - Accommodation highlights: string[]
 *
 * Design pattern:
 * - Render prop pattern for flexibility
 * - Parent component provides item structure via renderItem
 * - List handles add/remove/update logic uniformly
 */

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableListProps<T> {
  items: T[];
  onUpdate: (items: T[]) => void;
  renderItem: (item: T, index: number, onChange: (updated: T) => void) => React.ReactNode;
  createNewItem: () => T;
  maxItems?: number;
  emptyMessage?: string;
  disabled?: boolean;
}

/**
 * Generic list editor component with add/remove/update operations
 *
 * @template T - Type of items in the list
 * @param items - Current list of items
 * @param onUpdate - Callback when list is updated
 * @param renderItem - Render prop for individual items
 * @param createNewItem - Factory function for creating new items
 * @param maxItems - Maximum number of items allowed (default: 20)
 * @param emptyMessage - Message to show when list is empty (default: 'No items yet')
 * @param disabled - Whether editing is disabled (default: false)
 */
export function EditableList<T>({
  items,
  onUpdate,
  renderItem,
  createNewItem,
  maxItems = 20,
  emptyMessage = 'No items yet',
  disabled = false,
}: EditableListProps<T>) {
  const handleAdd = () => {
    if (items.length >= maxItems) return;
    onUpdate([...items, createNewItem()]);
  };

  const handleRemove = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, updated: T) => {
    onUpdate(items.map((item, i) => (i === index ? updated : item)));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">{emptyMessage}</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="border rounded-lg p-4 relative group">
          {renderItem(item, idx, (updated) => handleChange(idx, updated))}
          {!disabled && (
            <Button
              onClick={() => handleRemove(idx)}
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
              title="Remove item"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!disabled && items.length < maxItems && (
        <div className="text-center">
          <Button onClick={handleAdd} variant="outline" size="sm" className="border-dashed">
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      )}
    </div>
  );
}
