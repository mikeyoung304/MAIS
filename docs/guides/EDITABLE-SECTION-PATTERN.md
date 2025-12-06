# Editable Section Pattern Guide

## Overview

This guide documents the pattern for adding `editable` mode to landing page section components, eliminating the need for duplicate "Editable" section components (TODO-256).

## Pattern Summary

Instead of creating separate `EditableHeroSection`, `EditableAboutSection`, etc., we add optional `editable`, `onUpdate`, and `disabled` props to the existing display components.

## Implementation Pattern

### 1. Update Component Props

Add three optional props to the existing section component:

```typescript
interface SectionProps {
  config: SectionConfig;
  editable?: boolean;           // Enable inline editing mode
  onUpdate?: (updates: Partial<SectionConfig>) => void;  // Callback for updates
  disabled?: boolean;           // Disable editing during save operations
}
```

### 2. Import Required Dependencies

```typescript
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
// Add other dependencies as needed (Button, icons, etc.)
```

### 3. Update Component Signature

```typescript
export const SectionComponent = memo(function SectionComponent({
  config,
  editable = false,
  onUpdate,
  disabled = false
}: SectionProps) {
  // Component logic...
});
```

### 4. Conditional Rendering Pattern

For each editable field, use this pattern:

```typescript
{editable ? (
  <EditableText
    value={config.fieldName}
    onChange={(value) => onUpdate?.({ fieldName: value })}
    placeholder="Enter text..."
    disabled={disabled}
    className="display-mode-classes"
    inputClassName="edit-mode-classes"
    aria-label="Field description"
  />
) : (
  <h1 className="display-mode-classes">
    {config.fieldName}
  </h1>
)}
```

### 5. Update JSDoc Comments

Document the new props and add examples for both modes:

```typescript
/**
 * Section description...
 *
 * Editable Mode (TODO-256):
 * When editable={true}, wraps text in EditableText components for inline editing.
 * This eliminates the need for duplicate "EditableSection" components.
 *
 * @example
 * ```tsx
 * // Display mode
 * <SectionComponent config={config} />
 *
 * // Editable mode
 * <SectionComponent
 *   config={config}
 *   editable={true}
 *   onUpdate={(updates) => handleUpdate(updates)}
 *   disabled={isSaving}
 * />
 * ```
 *
 * @param props.editable - Enable inline editing mode (default: false)
 * @param props.onUpdate - Callback when content is updated in editable mode
 * @param props.disabled - Disable editing in editable mode (e.g., during save)
 */
```

## Complete Examples

### Example 1: HeroSection

**File**: `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx`

#### Props Interface
```typescript
interface HeroSectionProps {
  config: HeroConfig;
  editable?: boolean;
  onUpdate?: (updates: Partial<HeroConfig>) => void;
  disabled?: boolean;
}
```

#### Editable Headline
```typescript
{editable ? (
  <EditableText
    value={config.headline}
    onChange={(value) => onUpdate?.({ headline: value })}
    placeholder="Enter headline"
    disabled={disabled}
    className="text-white text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight"
    inputClassName="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-center bg-white/20 text-white placeholder:text-white/50"
    aria-label="Hero headline"
  />
) : (
  <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight">
    {config.headline}
  </h1>
)}
```

#### Optional Field (Subheadline)
```typescript
{editable ? (
  <EditableText
    value={config.subheadline ?? ''}
    onChange={(value) => onUpdate?.({ subheadline: value || undefined })}
    placeholder="Enter subheadline (optional)"
    disabled={disabled}
    className="text-white/90 text-xl md:text-2xl max-w-3xl mx-auto mb-10"
    inputClassName="text-xl md:text-2xl text-center bg-white/20 text-white placeholder:text-white/50"
    aria-label="Hero subheadline"
  />
) : (
  config.subheadline && (
    <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-10">
      {config.subheadline}
    </p>
  )
)}
```

### Example 2: AboutSection

**File**: `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/AboutSection.tsx`

#### Multiline Content
```typescript
{editable ? (
  <EditableText
    value={config.content}
    onChange={(value) => onUpdate?.({ content: value })}
    placeholder="Tell your story here..."
    disabled={disabled}
    multiline
    rows={6}
    className="text-neutral-600 leading-relaxed prose prose-lg max-w-none mb-6"
    inputClassName="leading-relaxed"
    aria-label="About section content"
  />
) : (
  <div className="prose prose-lg prose-neutral max-w-none">
    {paragraphs.map((paragraph, index) => (
      <p key={index} className="text-neutral-600 leading-relaxed mb-4 last:mb-0">
        {paragraph}
      </p>
    ))}
  </div>
)}
```

#### Interactive Controls (Image Position Toggle)
```typescript
{editable && (
  <div className="flex items-center gap-2">
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
)}
```

## EditableText Component API

The `EditableText` component provides the inline editing functionality:

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current text value |
| `onChange` | `(value: string) => void` | Yes | Callback when value changes |
| `placeholder` | `string` | No | Placeholder text |
| `disabled` | `boolean` | No | Disable editing |
| `className` | `string` | No | Classes for display mode |
| `inputClassName` | `string` | No | Classes for edit mode input |
| `multiline` | `boolean` | No | Use textarea instead of input |
| `rows` | `number` | No | Rows for textarea (default: 3) |
| `maxLength` | `number` | No | Maximum character length |
| `aria-label` | `string` | No | Accessibility label |

### Behavior

- **Display mode**: Shows text with hover indicator (pencil icon)
- **Edit mode**: Auto-focuses input, cursor moves to end
- **Save**: Blur or Enter key (single-line only)
- **Cancel**: Escape key restores original value
- **Keyboard navigation**: Tab to navigate between fields

## Remaining Sections to Update

The following sections still need the editable prop pattern:

1. **FaqSection.tsx** - FAQ accordion
2. **AccommodationSection.tsx** - Accommodation listings
3. **FinalCtaSection.tsx** - Final call-to-action
4. **GallerySection.tsx** - Photo gallery
5. **SocialProofBar.tsx** - Social proof badges
6. **TestimonialsSection.tsx** - Customer testimonials

## Migration Steps

For each remaining section:

1. Add the three props to the interface: `editable?`, `onUpdate?`, `disabled?`
2. Import `EditableText` and any needed UI components (Button, icons)
3. Update the component signature with default values
4. Wrap each text field in conditional rendering (editable vs display)
5. Add interactive controls if needed (image position, order, etc.)
6. Update JSDoc with examples and new props documentation
7. Test both display and editable modes

## Benefits

1. **Code reduction**: ~50% less code by eliminating duplicate components
2. **Maintainability**: Single source of truth for section layout/styling
3. **Consistency**: Display and edit modes are guaranteed to match
4. **Type safety**: Shared config interfaces prevent drift
5. **Testing**: Test once, covers both display and editable modes

## Future Enhancements

Once all sections use this pattern, the duplicate "Editable" components in `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/landing-page-editor/sections/` can be deleted:

- `EditableHeroSection.tsx` ❌ (can be deleted)
- `EditableAboutSection.tsx` ❌ (can be deleted)
- `EditableFaqSection.tsx` ❌ (can be deleted)
- `EditableAccommodationSection.tsx` ❌ (can be deleted)
- `EditableFinalCtaSection.tsx` ❌ (can be deleted)
- `EditableGallerySection.tsx` ❌ (can be deleted)
- `EditableSocialProofBar.tsx` ❌ (can be deleted)
- `EditableTestimonialsSection.tsx` ❌ (can be deleted)

## References

- **TODO-256**: Original implementation task
- **EditableText component**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/components/EditableText.tsx`
- **HeroSection example**: `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx`
- **AboutSection example**: `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/AboutSection.tsx`
