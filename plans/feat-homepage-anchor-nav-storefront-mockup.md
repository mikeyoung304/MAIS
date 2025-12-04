# feat: Fix Broken "How It Works" Anchor Navigation

## Overview

Fix the broken "How It Works" navigation link by adding the missing anchor ID and enabling smooth scroll behavior.

## Problem Statement

- "How It Works" in header links to `#how-it-works` but no element has that ID
- Page jumps are jarring (no smooth scroll)
- Fixed header covers content when scrolling to anchors

## Proposed Solution

Minimal fix: Add the ID to existing `StorefrontSection`, enable smooth scroll with header offset.

## Files to Modify

| File                                          | Change                                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| `client/src/index.css`                        | Add `scroll-behavior: smooth` and `scroll-padding-top` |
| `client/src/pages/Home/StorefrontSection.tsx` | Add `id="how-it-works"` to section element             |

## Technical Changes

### 1. CSS Scroll Behavior

**File**: `client/src/index.css`

```css
html {
  scroll-behavior: smooth;
  scroll-padding-top: 120px; /* Fixed header offset (~96px + buffer) */
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

### 2. Add Anchor ID to Existing Section

**File**: `client/src/pages/Home/StorefrontSection.tsx`

Change the section's `id` from `"storefront"` to `"how-it-works"`:

```tsx
<section
  id="how-it-works"  // Changed from "storefront"
  aria-labelledby="storefront-heading"
  className="py-24 sm:py-32 bg-surface"
>
```

## Acceptance Criteria

- [ ] Clicking "How It Works" in header scrolls to storefront section
- [ ] Smooth scroll animation works
- [ ] Content not hidden behind fixed header after scroll
- [ ] `prefers-reduced-motion` disables smooth scroll

## Estimated Time

**10 minutes**

## What This Does NOT Include

- Navigation restructure (removing Pricing, changing CTA) - separate task
- New demo section with fictional company - deferred
- New components - not needed

---

## Summary

Two-line fix:

1. Add CSS smooth scroll with header offset
2. Add `id="how-it-works"` to existing StorefrontSection
