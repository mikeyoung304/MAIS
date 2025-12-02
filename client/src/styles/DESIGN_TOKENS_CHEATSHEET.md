# Design Tokens Cheat Sheet

Quick reference for the most commonly used design tokens in the MAIS platform.

---

## Colors - Most Used

```css
/* Text */
--text-primary         /* #111827 - Headings, primary content */
--text-secondary       /* #4b5563 - Body text, labels */
--text-tertiary        /* #6b7280 - Supporting text */
--text-inverse         /* #ffffff - Text on dark backgrounds */

/* Backgrounds */
--surface-primary      /* #ffffff - White background */
--surface-secondary    /* #f9fafb - Off-white background */
--surface-elevated     /* #ffffff - Cards with shadow */

/* Interactive States - Primary (Navy) */
--interactive-primary-default   /* #1a365d */
--interactive-primary-hover     /* #0f2442 */
--interactive-primary-active    /* #0a1929 */
--interactive-primary-disabled  /* #a5b9d9 */

/* Interactive States - Secondary (Orange) */
--interactive-secondary-default  /* #fb923c */
--interactive-secondary-hover    /* #f97316 */
--interactive-secondary-active   /* #ea7c1c */

/* Semantic Colors */
--semantic-success-default  /* #22c55e - Green */
--semantic-error-default    /* #ef4444 - Red */
--semantic-warning-default  /* #f59e0b - Amber */
--semantic-info-default     /* #3b82f6 - Blue */
```

---

## Typography

```css
/* Font Families */
--font-heading   /* Playfair Display - for headings */
--font-body      /* System font stack - for body text */

/* Font Sizes (Most Used) */
--font-size-xs     /* 12px - Fine print */
--font-size-sm     /* 14px - Small text */
--font-size-base   /* 16px - Body text */
--font-size-lg     /* 20px - Subheadings */
--font-size-xl     /* 24px - Headings */
--font-size-3xl    /* 36px - Large headings */

/* Font Weights */
--font-weight-normal     /* 400 */
--font-weight-medium     /* 500 */
--font-weight-semibold   /* 600 */
--font-weight-bold       /* 700 */

/* Line Heights */
--line-height-tight    /* 1.2 - Headings */
--line-height-normal   /* 1.5 - Body text */
--line-height-relaxed  /* 1.6 - Long-form content */
```

---

## Spacing (4px base)

```css
--space-1    /* 4px */
--space-2    /* 8px */
--space-3    /* 12px */
--space-4    /* 16px */  ⭐ Most common
--space-6    /* 24px */  ⭐ Most common
--space-8    /* 32px */  ⭐ Most common
--space-12   /* 48px */  ⭐ Sections
--space-16   /* 64px */

/* Semantic Spacing */
--space-component-gap     /* 16px - Between components */
--space-section-gap       /* 48px - Between sections */
--space-page-padding      /* 24px - Page edges */
--space-container-padding /* 32px - Container padding */
```

---

## Shadows & Elevation

```css
--elevation-1   /* Subtle - Buttons, inputs */
--elevation-2   /* Low - Cards, dropdowns */
--elevation-3   /* Medium - Popovers, tooltips */
--elevation-4   /* High - Modals, drawers */

/* Focus Rings */
--shadow-focus-primary     /* Navy focus */
--shadow-focus-secondary   /* Orange focus */
--shadow-focus-error       /* Red focus */
```

---

## Border Radius

```css
--radius-sm    /* 4px - Small elements */
--radius-base  /* 8px - Default */
--radius-lg    /* 12px - Cards */
--radius-xl    /* 16px - Large cards */
--radius-full  /* 9999px - Pills, avatars */
```

---

## Transitions

```css
--duration-fast   /* 150ms */
--duration-base   /* 200ms */  ⭐ Most common
--duration-slow   /* 300ms */

--ease-in-out     /* Standard easing */
--ease-smooth     /* Apple-style smooth */
--ease-spring     /* Spring bounce effect */

/* Combined */
--transition-fast /* 150ms ease-in-out */
--transition-base /* 200ms ease-in-out */  ⭐ Most common
--transition-slow /* 300ms ease-in-out */
```

---

## Borders

```css
--border-width-1  /* 1px - Default */
--border-width-2  /* 2px - Emphasized */

--border-color-default  /* #e5e7eb - Standard border */
--border-color-focus    /* #fb923c - Focus state */
--border-color-error    /* #ef4444 - Error state */
```

---

## Common Component Patterns

### Primary Button
```css
.btn-primary {
  background: var(--interactive-primary-default);
  color: var(--text-on-navy);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-base);
  font-weight: var(--font-weight-semibold);
  transition: var(--transition-base);
  box-shadow: var(--elevation-1);
}
```

### Card
```css
.card {
  background: var(--surface-elevated);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}
```

### Input Field
```css
.input {
  background: var(--surface-primary);
  color: var(--text-primary);
  border: var(--border-width-1) solid var(--border-color-default);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
}

.input:focus {
  border-color: var(--border-color-focus);
  box-shadow: var(--shadow-focus-secondary);
}
```

### Success Badge
```css
.badge-success {
  background: var(--semantic-success-50);
  color: var(--semantic-success-700);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}
```

---

## Pre-built Utility Classes

```html
<!-- Typography -->
<h1 class="text-heading-1">Large Heading</h1>
<p class="text-body">Body text</p>
<span class="text-label">Label Text</span>

<!-- Status Badges -->
<span class="status-success">Success</span>
<span class="status-error">Error</span>
<span class="status-warning">Warning</span>
<span class="status-info">Info</span>

<!-- Surfaces -->
<div class="surface-elevated">Elevated card</div>

<!-- Gradients -->
<div class="gradient-navy">Navy gradient</div>
<div class="gradient-orange">Orange gradient</div>

<!-- Elevation -->
<div class="elevation-2">Card with shadow</div>

<!-- Transitions -->
<div class="transition-base">Smooth transition</div>
```

---

## Z-Index Scale

```css
--z-dropdown   /* 1000 */
--z-sticky     /* 1020 */
--z-modal      /* 1050 */  ⭐ Most common
--z-popover    /* 1060 */
--z-tooltip    /* 1070 */
```

---

## Quick Tips

1. **Always use semantic tokens** (`--text-primary`) over direct values (`#111827`)
2. **Stick to the spacing scale** - use multiples of 4px
3. **Use proper elevation levels** - don't create custom shadows
4. **Include focus states** - use `--shadow-focus-*` tokens
5. **Test accessibility** - all combinations meet WCAG AA

---

## WCAG AA Contrast Ratios (Verified)

✅ `--text-primary` on `--surface-primary` = 16.1:1 (AAA)
✅ `--text-secondary` on `--surface-primary` = 7.5:1 (AAA)
✅ `--text-tertiary` on `--surface-primary` = 5.9:1 (AA)
✅ `--text-on-navy` on `--macon-navy` = 12.6:1 (AAA)
✅ `--text-on-orange` on `--macon-orange` = 4.8:1 (AA)
✅ `--text-on-teal` on `--macon-teal` = 4.5:1 (AA)

All semantic status colors (success, error, warning, info) meet WCAG AA standards in their recommended usage patterns.
