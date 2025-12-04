---
status: complete
priority: p3
issue_id: '117'
tags: [code-review, architecture, duplication, ui-redesign]
dependencies: []
completed_date: 2025-12-03
---

# Section Header Pattern Duplicated in BrandingForm and BrandingPreview

## Problem Statement

The section header pattern (icon + title + description in a flex container) is duplicated across components.

**Why it matters:** Code duplication, inconsistent if styling changes.

## Solution Implemented

Created reusable `SectionHeader` component at `client/src/components/ui/SectionHeader.tsx`

### Implementation Details

**Component signature:**

```tsx
interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps);
```

**Features:**

- Accepts any Lucide icon via `icon` prop
- Title is always displayed
- Description is optional (conditionally rendered)
- Consistent styling with sage accent color
- Proper accessibility: `aria-hidden="true"` on decorative icon

### Files Updated

1. **Created:** `client/src/components/ui/SectionHeader.tsx`
2. **Updated:** `client/src/features/tenant-admin/branding/components/BrandingForm/index.tsx`
   - Added import for `SectionHeader`
   - Replaced 9-line header markup with single component call
3. **Updated:** `client/src/features/tenant-admin/branding/components/BrandingPreview.tsx`
   - Added import for `SectionHeader`
   - Replaced 9-line header markup with single component call

## Verification

- TypeScript type check: ✅ PASSED
- Visual appearance: ✅ UNCHANGED (same CSS classes and structure)
- Component reusability: ✅ Ready for future use across admin panels

## Acceptance Criteria

- [x] SectionHeader component created
- [x] All instances refactored to use it
- [x] Visual appearance unchanged
- [x] TypeScript passes

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2025-11-30 | Created from code review | Pattern duplication                      |
| 2025-12-03 | Implemented solution     | Component created and refactored 2 files |
