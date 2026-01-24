# Mobile UI Improvements for gethandled.ai

## Overview

Improve mobile responsiveness on the marketing homepage (`apps/web/src/app/page.tsx`) based on visual testing at 390x844 viewport (iPhone 14 Pro dimensions).

**Scope:** Marketing homepage only (not tenant landing pages which already have good responsive patterns)

## Problem Statement

Visual testing revealed three issues on mobile:

1. **Features grid is cramped** - Uses `md:grid-cols-2 lg:grid-cols-3` but on narrow mobile (<640px) the single-column cards still feel dense with small icons
2. **Hero buttons are adequate but could be better** - Already stacks with `flex-col sm:flex-row`, but buttons are on the smaller side
3. **Feature card icons are small** - Fixed at `w-6 h-6` regardless of viewport

## Proposed Solution

Apply mobile-first responsive enhancements to three areas:

### 1. Feature Card Icons - Scale Up on Mobile

**Current** (`page.tsx:396-398`):

```tsx
<div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
  <feature.icon className="w-6 h-6 text-sage" />
</div>
```

**Proposed:**

```tsx
<div className="w-14 h-14 sm:w-12 sm:h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
  <feature.icon className="w-8 h-8 sm:w-6 sm:h-6 text-sage" />
</div>
```

**Rationale:**

- Mobile: 56px container, 32px icon (more prominent on small screens)
- Desktop (sm+): 48px container, 24px icon (current, refined)

### 2. Hero Buttons - Larger Touch Targets on Mobile

**Current** (`page.tsx:313-328`):

```tsx
<div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
  <Button
    asChild
    variant="sage"
    className="rounded-full px-8 py-5 text-base shadow-lg hover:shadow-xl transition-all duration-300"
  >
    <Link href="/signup">Get Handled</Link>
  </Button>
  <Button
    asChild
    variant="outline"
    className="rounded-full px-8 py-5 text-base hover:bg-neutral-50 transition-all duration-300"
  >
    <Link href="#features">See What's Included</Link>
  </Button>
</div>
```

**Proposed:**

```tsx
<div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
  <Button
    asChild
    variant="sage"
    className="rounded-full px-8 py-6 sm:py-5 text-lg sm:text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300"
  >
    <Link href="/signup">Get Handled</Link>
  </Button>
  <Button
    asChild
    variant="outline"
    className="rounded-full px-8 py-6 sm:py-5 text-lg sm:text-base font-medium hover:bg-neutral-50 transition-all duration-300"
  >
    <Link href="#features">See What's Included</Link>
  </Button>
</div>
```

**Rationale:**

- Mobile: `py-6` + `text-lg` = ~56px height (excellent touch target)
- Desktop: `py-5` + `text-base` = current sizing
- Added `font-medium` for better legibility
- Increased gap from `gap-3` to `gap-4` for breathing room

### 3. Features Grid - Add Explicit Single-Column for Tiny Screens

**Current** (`page.tsx:381`):

```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
```

This is already single-column below `md` (768px) which is correct. However, the gap could be slightly larger on mobile.

**Proposed:**

```tsx
<div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
```

**Rationale:**

- Mobile: `gap-6` (24px) - slightly tighter to fit more cards in viewport
- Desktop: `gap-8` (32px) - more breathing room with multi-column layout

## Acceptance Criteria

- [ ] Feature card icons are 32px on mobile, 24px on desktop
- [ ] Feature card icon backgrounds are 56px on mobile, 48px on desktop
- [ ] Hero buttons have `py-6` on mobile, `py-5` on desktop
- [ ] Hero buttons have `text-lg` on mobile, `text-base` on desktop
- [ ] Button gap is 16px (`gap-4`)
- [ ] Features grid gap is 24px on mobile, 32px on desktop
- [ ] No horizontal overflow at 320px viewport
- [ ] Touch targets meet 44px minimum (buttons exceed this at ~56px)
- [ ] Visual regression test passes at 390x844 viewport

## Test Scenarios

### Manual Testing

1. Open https://gethandled.ai in Chrome DevTools
2. Set viewport to 390x844 (iPhone 14 Pro)
3. Verify:
   - Hero buttons are visually prominent and easy to tap
   - Feature card icons are clearly visible
   - No horizontal scrolling
4. Set viewport to 320x568 (iPhone SE)
5. Verify no overflow or cramped layout

### Playwright E2E (optional)

```typescript
test('mobile touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const heroButton = page.locator('a[href="/signup"]').first();
  const box = await heroButton.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
```

## Implementation

### Files to Modify

| File                        | Lines   | Change                              |
| --------------------------- | ------- | ----------------------------------- |
| `apps/web/src/app/page.tsx` | 313     | Update button container gap         |
| `apps/web/src/app/page.tsx` | 314-320 | Update primary button classes       |
| `apps/web/src/app/page.tsx` | 321-327 | Update secondary button classes     |
| `apps/web/src/app/page.tsx` | 381     | Update grid gap classes             |
| `apps/web/src/app/page.tsx` | 396-398 | Update icon container and icon size |

### Estimated Changes

~15 lines modified in 1 file.

## Dependencies

None - pure CSS/Tailwind changes.

## Risks

**Low risk:**

- Changes are additive responsive classes (mobile-first)
- No breaking changes to desktop layout
- Tailwind purging will include new classes automatically

## References

- **Brand Guide:** `docs/design/BRAND_VOICE_GUIDE.md` (spacing patterns)
- **Button Component:** `apps/web/src/components/ui/button.tsx` (size variants reference)
- **WCAG Touch Targets:** Minimum 44x44px for touch targets
