---
status: pending
priority: p3
issue_id: "140"
tags: [code-review, visual-editor, performance, scalability]
dependencies: []
---

# No Pagination or Virtual Scrolling for Large Package Lists

## Problem Statement

The EditablePackageGrid renders ALL packages at once without pagination or virtual scrolling. With 200+ packages, this creates 200+ DOM nodes even if only 12 are visible on screen.

**Why it matters**: Performance degrades as package count grows - slow initial load, janky scrolling, high memory usage.

## Findings

### Discovery Source
Performance Review Agent - Code Review

### Evidence
Location: `client/src/features/tenant-admin/visual-editor/components/EditablePackageGrid.tsx` lines 35-45

```typescript
return (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {packages.map((pkg) => (
      <EditablePackageCard
        key={pkg.id}
        package={pkg}
        onUpdate={(update) => onUpdatePackage(pkg.id, update)}
        onPhotosChange={(photos) => onPhotosChange(pkg.id, photos)}
        disabled={disabled}
      />
    ))}
  </div>
);
```

Each `EditablePackageCard` contains:
- Image element
- Multiple editable text inputs
- Photo drop zone (hidden in collapsed mode)
- Several state hooks

With 200 packages: ~200 images loaded, ~800 text inputs, significant memory footprint.

## Proposed Solutions

### Option 1: Pagination (Recommended for MVP)
Add simple pagination with page controls.

```typescript
const PACKAGES_PER_PAGE = 20;
const [page, setPage] = useState(0);

const paginatedPackages = packages.slice(
  page * PACKAGES_PER_PAGE,
  (page + 1) * PACKAGES_PER_PAGE
);

return (
  <>
    <div className="grid ...">
      {paginatedPackages.map(pkg => <EditablePackageCard ... />)}
    </div>
    <Pagination
      current={page}
      total={Math.ceil(packages.length / PACKAGES_PER_PAGE)}
      onPageChange={setPage}
    />
  </>
);
```

**Pros**: Simple implementation, works well for editing
**Cons**: User needs to navigate pages
**Effort**: Small
**Risk**: Low

### Option 2: Virtual Scrolling
Use react-window or similar for virtualized rendering.

```typescript
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={4}
  columnWidth={300}
  rowCount={Math.ceil(packages.length / 4)}
  rowHeight={400}
  height={800}
  width={1200}
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 4 + columnIndex;
    const pkg = packages[index];
    if (!pkg) return null;
    return <EditablePackageCard style={style} package={pkg} ... />;
  }}
</FixedSizeGrid>
```

**Pros**: Best performance, handles thousands of items
**Cons**: More complex, fixed row heights can be tricky
**Effort**: Medium
**Risk**: Medium

### Option 3: Lazy Loading with Intersection Observer
Load packages as they scroll into view.

```typescript
const [visiblePackages, setVisiblePackages] = useState<Set<string>>(new Set());

// Intersection observer to track visible packages
// Only render full card for visible ones
```

**Pros**: Progressive enhancement
**Cons**: Still creates DOM nodes, just delays rendering
**Effort**: Medium
**Risk**: Medium

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/components/EditablePackageGrid.tsx`
- `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx`

### Affected Components
- Package grid display
- Visual editor performance

### Database Changes Required
None

## Acceptance Criteria
- [ ] Visual editor handles 500+ packages without lag
- [ ] Initial load time < 2 seconds for large datasets
- [ ] Scrolling is smooth at 60fps
- [ ] Memory usage scales linearly, not exponentially
- [ ] Search/filter works with pagination (if implemented)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- react-window: https://github.com/bvaughn/react-window
- react-virtualized: https://github.com/bvaughn/react-virtualized
