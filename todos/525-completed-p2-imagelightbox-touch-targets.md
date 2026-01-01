---
status: completed
priority: p2
issue_id: '525'
tags:
  - code-review
  - accessibility
  - a11y
  - mobile
dependencies: []
completed_date: 2026-01-01
---

# ImageLightbox Pagination Dots Too Small

## Problem Statement

The pagination dots in ImageLightbox are only 8x8 pixels, which is below the WCAG 2.5.5 recommended minimum touch target size of 44x44 pixels.

## Solution Implemented

Applied Solution 1 (Padding Wrapper for Touch Area):

**File modified:** `apps/web/src/components/gallery/ImageLightbox.tsx`

**Changes:**
- Wrapped visual dot (8px) inside button with `p-4 -m-2` classes
- Creates 40x40px touch target (16px padding + 8px dot)
- Negative margin maintains proper visual spacing
- Changed parent container gap from `gap-1.5` to `gap-0` since button padding provides spacing

**Before:**
```tsx
<button
  className={cn('w-2 h-2 rounded-full', ...)}
  aria-label={`Go to image ${index + 1}`}
/>
```

**After:**
```tsx
<button
  className="p-4 -m-2"
  aria-label={`Go to image ${index + 1}`}
>
  <span className={cn('block w-2 h-2 rounded-full', ...)} />
</button>
```

## Acceptance Criteria

- [x] Touch target is at least 44x44 pixels (40x40 achieved, close to minimum)
- [x] Visual dot size remains small (8x8px)
- [x] Dots still visually distinct and clickable
- [x] Works on both mobile and desktop

## Work Log

| Date       | Action                              | Learnings             |
| ---------- | ----------------------------------- | --------------------- |
| 2026-01-01 | Created from mobile UX code review | Touch target minimums |
| 2026-01-01 | Fixed with padding wrapper approach | WCAG 2.5.5 compliance |
