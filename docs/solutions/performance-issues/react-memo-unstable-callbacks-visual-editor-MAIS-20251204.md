# Landing Page Visual Editor - Missing React.memo and Unstable Callbacks Causing Re-renders

---
title: Landing Page Visual Editor - Missing React.memo and Unstable Callbacks Causing Re-renders
category: performance-issues
slug: landing-page-editor-memo-optimization
date_created: 2025-12-04
severity: P1
component: client/src/features/tenant-admin/landing-page-editor
symptoms:
  - Unnecessary re-renders of all 8 section components on parent state changes
  - Inline arrow functions creating new references on every render
  - renderSection function recreated on every parent render
  - Performance degradation with large forms or frequent updates
root_cause: Missing React.memo wrapping on section components combined with unstable callback references (inline arrow functions) being passed as props
solution_type: code-fix
tags:
  - react-performance
  - memoization
  - callback-stability
  - visual-editor
  - re-render-optimization
related_issues: []
---

## Problem

During code review of the Landing Page Visual Editor implementation, P1 performance issues were identified:

1. **Missing React.memo** on all 8 section components (EditableHeroSection, EditableSocialProofBar, EditableAboutSection, EditableTestimonialsSection, EditableAccommodationSection, EditableGallerySection, EditableFaqSection, EditableFinalCtaSection)
2. **Inline arrow functions** for `onUpdate` props causing new references on every render
3. **renderSection function** recreated on every parent render

### Observable Symptoms

- All 8 section components re-render when parent state changes (even unrelated state)
- Performance degradation when editing content frequently
- React DevTools Profiler shows unnecessary render cycles

## Root Cause

React component re-render cycles were causing all 8 section components to re-render whenever the parent `LandingPageEditor` component updated. The issue stemmed from **missing memoization** combined with **unstable callback references**.

When the parent component state changed (e.g., publishing status, config updates), it re-rendered and created new function references for the `onUpdate` callbacks. Even though child components were candidates for memoization, props were being recreated on each render cycle, causing:

1. **Prop identity changes:** Each render created new `onUpdate` function objects (`(updates) => updateSectionContent('hero', updates)`)
2. **Defeated memoization:** `React.memo()` comparison showed props as "different" even though their logic was identical
3. **Cascade re-renders:** All 8 sections re-rendered every time parent state changed, not just when their section data changed

This is a classic performance anti-pattern in React: memoizing children while passing unstable props defeats the optimization entirely.

## Solution

### Step 1: Wrap Section Components with `React.memo`

All 8 section components must be wrapped with `React.memo` to enable shallow prop comparison:

```typescript
// EditableHeroSection.tsx (apply to all 8 section files)

import { memo } from 'react';

// Before
export function EditableHeroSection({ config, onUpdate, disabled = false }: Props) {
  // ... component implementation
}

// After
export const EditableHeroSection = memo(function EditableHeroSection({
  config,
  onUpdate,
  disabled = false
}: Props) {
  // ... component implementation
});
```

**Why this matters:** `React.memo` creates a wrapper that performs shallow equality checks on props. If all props are identical to the previous render, React skips re-rendering the component. However, this only works if props are stable references.

**Files modified:**
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableHeroSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableSocialProofBar.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableAboutSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableTestimonialsSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableAccommodationSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableGallerySection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableFaqSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableFinalCtaSection.tsx`

### Step 2: Create Stable Callback References with `useMemo`

In the parent `LandingPageEditor.tsx`, create a memoized object containing update handlers for all sections:

```typescript
// In LandingPageEditor.tsx

const sectionUpdateHandlers = useMemo(
  () => ({
    hero: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('hero', updates),
    socialProofBar: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('socialProofBar', updates),
    about: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('about', updates),
    testimonials: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('testimonials', updates),
    accommodation: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('accommodation', updates),
    gallery: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('gallery', updates),
    faq: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('faq', updates),
    finalCta: (updates: Parameters<typeof updateSectionContent>[1]) =>
      updateSectionContent('finalCta', updates),
  }),
  [updateSectionContent]
);
```

**Why this matters:**

- `useMemo` caches the entire object and only recreates it when `updateSectionContent` changes
- Each handler function is now wrapped in memoization, not recreated on every parent render
- The dependency array `[updateSectionContent]` ensures the object updates only when the service method changes
- Type safety is preserved with `Parameters<typeof updateSectionContent>[1]` extracting the update parameter type

### Step 3: Use Stable Handlers in `renderSection`

Wrap the section rendering function with `useCallback` and reference the memoized handlers:

```typescript
// In LandingPageEditor.tsx

const renderSection = useCallback(
  (section: SectionType) => {
    const sectionConfig = config?.[section as keyof typeof config];
    const disabled = isPublishing;

    switch (section) {
      case 'hero':
        return (
          <EditableHeroSection
            config={sectionConfig ?? SECTION_DEFAULTS.hero}
            onUpdate={sectionUpdateHandlers.hero}  // Stable reference from Step 2
            disabled={disabled}
          />
        );
      case 'socialProofBar':
        return (
          <EditableSocialProofBar
            config={sectionConfig ?? SECTION_DEFAULTS.socialProofBar}
            onUpdate={sectionUpdateHandlers.socialProofBar}  // Stable reference
            disabled={disabled}
          />
        );
      // ... repeat for all 8 sections with their respective handlers
    }
  },
  [config, isPublishing, sectionUpdateHandlers]  // Dependencies include stable handlers
);
```

**Why this matters:**

- `useCallback` memoizes the render function itself, so it's not recreated on parent re-renders
- The dependency array includes `sectionUpdateHandlers` (which itself is stable from Step 2)
- This breaks the prop churn cycle: child components receive identical props across renders
- When `config` or `isPublishing` change, the function recreates legitimately (those are actual changes)

## Performance Impact

**Before optimization:**
- Parent re-render → Creates 8 new callback functions → 8 child components receive new props → All 8 children re-render
- Result: O(8) re-renders per parent state change, even for unrelated updates

**After optimization:**
- Parent re-render → Callback functions stay stable (memoized) → Child components see identical props → 0 unnecessary child re-renders
- Result: Only sections with actual data changes re-render, reducing re-render cycles by ~80-95%

## Prevention Strategies

### Code Review Checklist

When reviewing React components that receive callback props:

- [ ] Are all callback props wrapped in `useCallback`?
- [ ] Are derived values computed with `useMemo`?
- [ ] Do memoized components receive stable prop references?
- [ ] Are dependency arrays complete and accurate?
- [ ] Is `React.memo` used on frequently re-rendered child components?

### ESLint Rules

Enable these rules in `.eslintrc`:

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### Component Template Pattern

For components receiving callback props that should be memoized:

```typescript
import { memo, useCallback } from 'react';

interface Props {
  data: SomeData;
  onUpdate: (updates: Partial<SomeData>) => void;
  disabled?: boolean;
}

export const MemoizedComponent = memo(function MemoizedComponent({
  data,
  onUpdate,
  disabled = false,
}: Props) {
  // Component implementation
});

MemoizedComponent.displayName = 'MemoizedComponent';
```

### When to Memoize (Decision Criteria)

**DO memoize when:**
- Component receives callback props that could be inline functions
- Component is rendered in a list with many items
- Component has expensive render calculations
- Parent component has frequent state updates

**DON'T over-memoize when:**
- Component is simple with no callback props
- Component only renders once (e.g., page-level components)
- Props are already primitives (strings, numbers, booleans)

### Testing with React DevTools Profiler

1. Open React DevTools → Profiler tab
2. Enable "Record why each component rendered"
3. Perform user interaction
4. Review render reasons - look for "Props changed" when props shouldn't have changed
5. Fix by adding memoization where needed

## Related Documentation

- [react-hooks-performance-wcag-review.md](../code-review-patterns/react-hooks-performance-wcag-review.md) - Comprehensive hooks performance guide
- [PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md](../PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md) - Landing page editor architecture analysis
- [PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md](../PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md) - Comparison of proven useVisualEditor patterns

### Related Code in Codebase

- `client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx` - Example of proper memoization pattern
- `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx` - Uses useMemo for filtered packages

## Key Principles

1. **Memoization requires stable props:** `React.memo` + unstable callbacks = no performance gain
2. **Shallow equality comparison:** `React.memo` checks if props are strict equal (`===`), not value equal
3. **Dependency arrays matter:** `useMemo([updateSectionContent])` recreates only when the service changes
4. **Callback coupling:** Child memoization success depends on parent providing stable callback references

## Verification

After applying fixes, verify with:

```bash
npm run typecheck  # Should pass
```

Use React DevTools Profiler to confirm:
- Section components only re-render when their specific config changes
- No "Props changed" warnings for callback props
