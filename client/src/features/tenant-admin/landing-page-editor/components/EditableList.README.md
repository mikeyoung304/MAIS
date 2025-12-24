# EditableList Component

## Overview

A generic, reusable list editor component that provides add/remove/update operations for various item types. Built with TypeScript generics for type safety across different data structures.

## Features

- **Generic typing**: Supports any item structure via TypeScript generics
- **CRUD operations**: Add, remove, and update items with a simple API
- **Custom rendering**: Flexible render prop pattern for item display
- **Limits**: Configurable max items limit
- **Empty state**: Customizable empty state message
- **Disabled state**: Full component can be disabled for read-only mode
- **Smooth UX**: Hover-to-reveal remove buttons, dashed add button

## Component API

```typescript
interface EditableListProps<T> {
  items: T[]; // Current list of items
  onUpdate: (items: T[]) => void; // Callback when list changes
  renderItem: (
    // Custom render function for each item
    item: T,
    index: number,
    onChange: (updated: T) => void
  ) => React.ReactNode;
  createNewItem: () => T; // Factory for creating new items
  maxItems?: number; // Max items allowed (default: 20)
  emptyMessage?: string; // Empty state text (default: 'No items yet')
  disabled?: boolean; // Disable editing (default: false)
}
```

## Usage Examples

### Example 1: Testimonials

```typescript
import { EditableList } from './components/EditableList';
import type { TestimonialItem } from '@macon/contracts';

function TestimonialsEditor() {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);

  return (
    <EditableList
      items={testimonials}
      onUpdate={setTestimonials}
      maxItems={10}
      emptyMessage="No testimonials yet. Add your first testimonial."
      createNewItem={() => ({
        quote: 'Enter testimonial quote...',
        author: 'Customer Name',
        role: 'Verified Client',
        rating: 5,
      })}
      renderItem={(item, index, onChange) => (
        <div className="space-y-3">
          <StarRating
            rating={item.rating}
            onChange={(rating) => onChange({ ...item, rating })}
          />
          <EditableText
            value={item.quote}
            onChange={(quote) => onChange({ ...item, quote })}
            multiline
            rows={3}
          />
          <EditableText
            value={item.author}
            onChange={(author) => onChange({ ...item, author })}
          />
        </div>
      )}
    />
  );
}
```

### Example 2: FAQ Items

```typescript
import type { FaqItem } from '@macon/contracts';

function FaqEditor() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  return (
    <EditableList
      items={faqs}
      onUpdate={setFaqs}
      maxItems={20}
      createNewItem={() => ({
        question: 'Enter your question',
        answer: 'Enter your answer here...',
      })}
      renderItem={(item, index, onChange) => (
        <div className="space-y-3">
          <EditableText
            value={item.question}
            onChange={(question) => onChange({ ...item, question })}
            className="font-medium"
          />
          <EditableText
            value={item.answer}
            onChange={(answer) => onChange({ ...item, answer })}
            multiline
            rows={3}
          />
        </div>
      )}
    />
  );
}
```

### Example 3: Simple String Array

```typescript
function HighlightsEditor() {
  const [highlights, setHighlights] = useState<string[]>([]);

  return (
    <EditableList
      items={highlights}
      onUpdate={setHighlights}
      maxItems={8}
      createNewItem={() => 'New highlight'}
      renderItem={(item, index, onChange) => (
        <EditableText
          value={item}
          onChange={(value) => onChange(value)}
          placeholder="Enter highlight"
        />
      )}
    />
  );
}
```

### Example 4: Complex Object with Icon Selection

```typescript
interface SocialProofItem {
  icon: string;
  text: string;
}

function SocialProofEditor() {
  const [items, setItems] = useState<SocialProofItem[]>([]);

  return (
    <EditableList
      items={items}
      onUpdate={setItems}
      maxItems={5}
      createNewItem={() => ({
        icon: 'star',
        text: 'Social proof text',
      })}
      renderItem={(item, index, onChange) => (
        <div className="flex gap-3">
          <select
            value={item.icon}
            onChange={(e) => onChange({ ...item, icon: e.target.value })}
          >
            <option value="star">Star</option>
            <option value="users">Users</option>
            <option value="award">Award</option>
          </select>
          <EditableText
            value={item.text}
            onChange={(text) => onChange({ ...item, text })}
            className="flex-1"
          />
        </div>
      )}
    />
  );
}
```

## Design Patterns

### Render Prop Pattern

The component uses the render prop pattern via `renderItem`, which provides maximum flexibility:

- Parent component controls item structure and layout
- List component handles CRUD operations uniformly
- Type safety maintained via generics

### Immutable Updates

All updates create new arrays rather than mutating existing ones:

```typescript
// Add: Creates new array with item appended
onUpdate([...items, createNewItem()]);

// Remove: Filters out item at index
onUpdate(items.filter((_, i) => i !== index));

// Update: Maps over items, replacing updated one
onUpdate(items.map((item, i) => (i === index ? updated : item)));
```

### Factory Function Pattern

The `createNewItem` prop is a factory function that ensures:

- Consistent default values
- Type safety for new items
- Flexibility for different initialization logic

## Styling & UX

### Remove Button

- Positioned absolutely in top-right corner
- Hidden by default, shown on hover via `group-hover:opacity-100`
- Red color scheme for destructive action
- Icon-only for minimal visual noise

### Add Button

- Centered below list
- Dashed border to indicate "add zone"
- Hidden when max items reached
- Plus icon with label for clarity

### Empty State

- Centered text with muted color
- Generous padding for visual balance
- Customizable message for context

## Integration with Landing Page Editor

This component is designed to work seamlessly with:

- **EditableText**: For text field editing within items
- **useLandingPageEditor**: Hook provides `updateSectionContent` for persistence
- **Autosave**: Changes are debounced and batched automatically
- **Type contracts**: Uses types from `@macon/contracts` for consistency

## Performance Considerations

- Items use array index as key (stable for non-reorderable lists)
- No virtualization needed (max 20 items keeps DOM manageable)
- Renders only when items array reference changes
- Consider `memo()` wrapping for item renderers if expensive

## Accessibility

- Remove buttons have `title` attribute for tooltip
- Parent should provide `aria-label` for EditableText fields
- Keyboard navigation works via native button/input elements

## Testing Recommendations

```typescript
// Unit test: Add item
const handleUpdate = vi.fn();
render(<EditableList items={[]} onUpdate={handleUpdate} {...props} />);
fireEvent.click(screen.getByText('Add Item'));
expect(handleUpdate).toHaveBeenCalledWith([expect.objectContaining(...)]);

// Unit test: Remove item
const handleUpdate = vi.fn();
render(<EditableList items={[item1, item2]} onUpdate={handleUpdate} {...props} />);
fireEvent.click(screen.getAllByTitle('Remove item')[0]);
expect(handleUpdate).toHaveBeenCalledWith([item2]);

// Unit test: Update item
const handleUpdate = vi.fn();
const renderItem = (item, idx, onChange) => (
  <button onClick={() => onChange({ ...item, text: 'updated' })}>Update</button>
);
render(<EditableList items={[item1]} onUpdate={handleUpdate} renderItem={renderItem} {...props} />);
fireEvent.click(screen.getByText('Update'));
expect(handleUpdate).toHaveBeenCalledWith([{ ...item1, text: 'updated' }]);
```

## File Location

```
client/src/features/tenant-admin/landing-page-editor/components/
├── EditableList.tsx          // Component implementation
├── EditableList.example.tsx  // Usage examples (documentation only)
└── EditableList.README.md    // This file
```

## Related Components

- **EditableImage**: For single image editing (TODO-251)
- **EditableText**: For inline text editing (from visual-editor)
- **SectionCard**: For section toggling in sidebar
- **EditorSidebar**: Main sidebar containing section cards

## Future Enhancements

Potential improvements for future consideration:

- **Drag-and-drop reordering**: Add react-beautiful-dnd for item reordering
- **Validation**: Pass validation schema and show errors
- **Undo/redo**: Track change history for item edits
- **Copy/duplicate**: Add duplicate button alongside remove
- **Collapsible items**: Option to collapse long items (like FAQ accordion)
