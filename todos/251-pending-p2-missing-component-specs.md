---
status: pending
priority: p2
issue_id: '251'
tags: [code-review, landing-page, plan, components]
dependencies: ['246']
source: 'plan-review-2025-12-04'
---

# TODO-251: Missing EditableImage and EditableList Component Specifications

## Priority: P2 (Important - Blocks Implementation)

## Status: Pending

## Source: Plan Review - Architecture + Simplicity Reviews

## Problem Statement

The plan references `EditableImage` and `EditableList` components (line 266) but provides no implementation specification. Without these, Phase 2 implementation is blocked.

**Why It Matters:**

- `EditableImage` needed for: Hero background, About image, Gallery images, Accommodation image
- `EditableList` needed for: Testimonials items, FAQ items, SocialProofBar items, Accommodation highlights
- No guidance on whether to reuse PhotoDropZone or create new components
- No specification for array editing UX (inline? modal? accordion?)

## Findings

### EditableImage Requirements

1. **Single image selection** (not multi-photo grid like PhotoDropZone)
2. **Different aspect ratios**: Hero (16:9), About (1:1), Gallery (varies)
3. **URL validation**: SafeImageUrlSchema protocol check
4. **Upload flow**: blob → Storage → https URL

### EditableList Requirements

Different structures for different sections:
- **Testimonials**: `{ quote, author, role?, imageUrl?, rating }`
- **FAQ**: `{ question, answer }`
- **SocialProofBar**: `{ icon, text }`
- **Accommodation highlights**: `string[]`

### Existing PhotoDropZone Coupling

```typescript
// PhotoDropZone.tsx:96 - Coupled to package photos API
const { url } = await packagePhotoApi.uploadPhoto(packageId, file);
```

Cannot reuse as-is for landing page images.

## Proposed Solutions

### Option A: Define Concrete Component Specs (Recommended)
- **Effort:** 1-2 hours documentation, 4-6 hours implementation
- **Risk:** Low
- Add detailed component specifications to plan
- Define props interfaces
- Document upload flow
- **Pros:** Clear implementation path
- **Cons:** Plan gets longer

### Option B: Use Generic Patterns
- **Effort:** 30 minutes documentation
- **Risk:** Medium
- Reference existing patterns without full specs
- Let implementer decide details
- **Pros:** Shorter plan
- **Cons:** Inconsistent implementation risk

## Recommended Action

**Execute Option A:** Add component specs to plan:

### EditableImage Specification

```typescript
// client/src/features/tenant-admin/landing-page-editor/components/EditableImage.tsx
interface EditableImageProps {
  currentUrl: string | undefined;
  onUpload: (url: string) => void;
  onRemove: () => void;
  aspectRatio?: 'auto' | '16/9' | '1/1' | '4/3';
  placeholder?: string;
  disabled?: boolean;
}

export function EditableImage({
  currentUrl,
  onUpload,
  onRemove,
  aspectRatio = 'auto',
  placeholder = 'Click or drag to upload image',
  disabled = false,
}: EditableImageProps) {
  const handleFileSelect = async (file: File) => {
    // 1. Validate file type/size
    // 2. Upload to storage API
    // 3. Call onUpload with https URL
  };

  return (
    <div className="relative group" style={{ aspectRatio }}>
      {currentUrl ? (
        <>
          <img src={currentUrl} alt="" className="w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button onClick={() => /* show file picker */}>Change</Button>
            <Button onClick={onRemove} variant="destructive">Remove</Button>
          </div>
        </>
      ) : (
        <DropZone onFileSelect={handleFileSelect} disabled={disabled}>
          {placeholder}
        </DropZone>
      )}
    </div>
  );
}
```

### EditableList Specification

```typescript
// client/src/features/tenant-admin/landing-page-editor/components/EditableList.tsx
interface EditableListProps<T> {
  items: T[];
  onUpdate: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    onChange: (updated: T) => void
  ) => React.ReactNode;
  createNewItem: () => T;
  maxItems?: number;
  emptyMessage?: string;
  disabled?: boolean;
}

export function EditableList<T>({
  items,
  onUpdate,
  renderItem,
  createNewItem,
  maxItems = 20,
  emptyMessage = 'No items yet',
  disabled = false,
}: EditableListProps<T>) {
  const handleAdd = () => onUpdate([...items, createNewItem()]);
  const handleRemove = (index: number) => onUpdate(items.filter((_, i) => i !== index));
  const handleChange = (index: number, updated: T) => {
    onUpdate(items.map((item, i) => (i === index ? updated : item)));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="border rounded-lg p-4 relative">
          {renderItem(item, idx, (updated) => handleChange(idx, updated))}
          <Button
            onClick={() => handleRemove(idx)}
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {items.length < maxItems && (
        <Button onClick={handleAdd} variant="outline" size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      )}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] EditableImage component spec added to plan
- [ ] EditableList component spec added to plan
- [ ] Upload flow documented (blob → Storage → URL)
- [ ] Aspect ratio handling defined
- [ ] Array editing UX defined (inline with remove buttons)

## Work Log

| Date       | Action  | Notes                                              |
|------------|---------|---------------------------------------------------|
| 2025-12-04 | Created | Plan review identified missing component specs    |

## Tags

code-review, landing-page, plan, components
