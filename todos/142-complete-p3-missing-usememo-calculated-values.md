---
status: complete
priority: p3
issue_id: "142"
tags: [code-review, visual-editor, performance, react]
dependencies: []
---

# Missing useMemo for Calculated Values in EditablePackageCard

## Problem Statement

Effective values and draft status booleans are recalculated on every render without memoization. With many packages, this causes unnecessary recalculations.

**Why it matters**: Minor performance issue that compounds with large datasets.

## Findings

### Discovery Source
Performance Review Agent - Code Review

### Evidence
Location: `client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx` lines 34-47

```typescript
// These are recalculated on every render
const effectiveTitle = pkg.draftTitle ?? pkg.title;
const effectiveDescription = pkg.draftDescription ?? pkg.description ?? "";
const effectivePriceCents = pkg.draftPriceCents ?? pkg.priceCents;
const effectivePhotos = pkg.draftPhotos ?? pkg.photos ?? [];

const hasTitleDraft = pkg.draftTitle !== null && pkg.draftTitle !== pkg.title;
const hasDescriptionDraft = pkg.draftDescription !== null && pkg.draftDescription !== pkg.description;
const hasPriceDraft = pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents;
const hasPhotoDraft = pkg.draftPhotos !== null;
```

## Proposed Solutions

### Option 1: Add useMemo (Recommended)
Memoize calculated values.

```typescript
const effectiveValues = useMemo(() => ({
  title: pkg.draftTitle ?? pkg.title,
  description: pkg.draftDescription ?? pkg.description ?? "",
  priceCents: pkg.draftPriceCents ?? pkg.priceCents,
  photos: pkg.draftPhotos ?? pkg.photos ?? [],
}), [pkg.draftTitle, pkg.title, pkg.draftDescription, pkg.description, pkg.draftPriceCents, pkg.priceCents, pkg.draftPhotos, pkg.photos]);

const draftFlags = useMemo(() => ({
  hasTitle: pkg.draftTitle !== null && pkg.draftTitle !== pkg.title,
  hasDescription: pkg.draftDescription !== null && pkg.draftDescription !== pkg.description,
  hasPrice: pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents,
  hasPhotos: pkg.draftPhotos !== null,
}), [pkg.draftTitle, pkg.title, pkg.draftDescription, pkg.description, pkg.draftPriceCents, pkg.priceCents, pkg.draftPhotos]);
```

**Pros**: Prevents unnecessary recalculations
**Cons**: Slightly more complex code
**Effort**: Small
**Risk**: Low

### Option 2: Add React.memo to Component
Wrap entire component with React.memo to prevent re-renders.

```typescript
export const EditablePackageCard = React.memo(function EditablePackageCard({
  package: pkg,
  onUpdate,
  onPhotosChange,
  disabled = false,
}: EditablePackageCardProps) {
  // ...
});
```

**Pros**: Prevents re-render if props unchanged
**Cons**: Need custom comparison for complex props
**Effort**: Small
**Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx`

### Database Changes Required
None

## Acceptance Criteria
- [ ] Calculated values are memoized
- [ ] No unnecessary re-renders on parent state changes
- [ ] Component still updates correctly when package data changes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
