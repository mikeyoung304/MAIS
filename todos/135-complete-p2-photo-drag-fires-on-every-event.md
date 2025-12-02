---
status: completed
priority: p2
issue_id: "135"
tags: [code-review, visual-editor, performance, react]
dependencies: []
completed_date: 2025-12-01
---

# Photo Drag-and-Drop Fires Reorder on Every Drag Event

## Problem Statement

The PhotoDropZone drag-over handler calls `handlePhotoReorder` on EVERY drag event (which fires 50-100+ times per second while dragging). This continuously recreates the photos array and triggers state updates and debounced saves.

**Why it matters**: Performance degrades significantly when reordering photos, causing jank and unnecessary API calls.

## Findings

### Discovery Source
Performance Review Agent - Code Review

### Evidence
Location: `client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx` lines 206-214

```typescript
onDragOver={(e) => {
  e.preventDefault();
  if (draggedIndex !== null && draggedIndex !== index) {
    handlePhotoReorder(draggedIndex, index);  // Fires on EVERY drag event!
    setDraggedIndex(index);
  }
}}
```

The `handlePhotoReorder` function (lines 181-195) creates new arrays and calls `onPhotosChange`:
```typescript
const handlePhotoReorder = useCallback((fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return;
  const newPhotos = [...photos];  // New array created
  const [removed] = newPhotos.splice(fromIndex, 1);
  newPhotos.splice(toIndex, 0, removed);
  const reorderedPhotos = newPhotos.map((photo, i) => ({
    ...photo,
    order: i,
  }));
  onPhotosChange(reorderedPhotos);  // Triggers state update + debounced save
}, [photos, onPhotosChange]);
```

## Proposed Solutions

### Option 1: Only Reorder on Drop (Recommended)
Move reordering logic to `onDrop` instead of `onDragOver`.

```typescript
// Track intended drop position without immediately reordering
const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

onDragOver={(e) => {
  e.preventDefault();
  if (draggedIndex !== null && draggedIndex !== index) {
    setDropTargetIndex(index);  // Just track position, don't reorder
  }
}}

onDrop={(e) => {
  if (draggedIndex !== null && dropTargetIndex !== null) {
    handlePhotoReorder(draggedIndex, dropTargetIndex);  // Reorder once on drop
  }
  setDraggedIndex(null);
  setDropTargetIndex(null);
}}
```

**Pros**: Only one reorder per drag operation
**Cons**: Visual feedback requires showing drop indicator instead of live reorder
**Effort**: Medium
**Risk**: Low

### Option 2: Debounce the Reorder Call
Add debouncing to prevent rapid-fire reorders.

```typescript
const debouncedReorder = useMemo(
  () => debounce(handlePhotoReorder, 100),
  [handlePhotoReorder]
);

onDragOver={(e) => {
  e.preventDefault();
  if (draggedIndex !== null && draggedIndex !== index) {
    debouncedReorder(draggedIndex, index);
    setDraggedIndex(index);
  }
}}
```

**Pros**: Reduces frequency, maintains live reorder feel
**Cons**: Still more reorders than necessary
**Effort**: Small
**Risk**: Low

### Option 3: Use React DnD Library
Replace custom drag implementation with react-beautiful-dnd or similar.

```typescript
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Library handles performance optimization internally
```

**Pros**: Battle-tested performance, better accessibility
**Cons**: New dependency, significant refactor
**Effort**: Large
**Risk**: Medium

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx`

### Affected Components
- PhotoDropZone component
- Photo reordering in visual editor

### Database Changes Required
None

## Acceptance Criteria
- [ ] Photo reordering doesn't cause visible lag/jank
- [ ] Only one reorder operation per complete drag action
- [ ] Debounced save is triggered once per reorder, not many times
- [ ] Visual feedback still indicates where photo will drop
- [ ] Keyboard accessibility for reordering (if applicable)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- react-beautiful-dnd: https://github.com/atlassian/react-beautiful-dnd
