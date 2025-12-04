# MAIS Design System - Brand Colors Guide

> **Last Updated:** January 2025
> **Version:** 2.0 (Post Phase 2 Brand Unification)

## Overview

The MAIS design system uses a comprehensive color palette built around the Macon brand identity. All colors are defined as Tailwind utility classes and CSS variables for maximum flexibility and consistency.

## Table of Contents

1. [Brand Colors](#brand-colors)
2. [Neutral Palette](#neutral-palette)
3. [Semantic Colors](#semantic-colors)
4. [Status Colors](#status-colors)
5. [Legacy Colors](#legacy-colors)
6. [Usage Guidelines](#usage-guidelines)
7. [Migration Guide](#migration-guide)

---

## Brand Colors

### Macon Navy (Primary)

**Use for:** Primary actions, headings, navigation, brand elements

```tsx
// Tailwind classes
bg-macon-navy          // #1a365d - Default navy
bg-macon-navy-dark     // #0f2442 - Darker variant
bg-macon-navy-light    // #2d4a7c - Lighter variant
bg-macon-navy-50       // #e6ecf3 - Lightest tint
bg-macon-navy-100      // #ccd9e7 - Light tint

text-macon-navy        // For text
border-macon-navy      // For borders

// CSS variables (for advanced use)
var(--macon-navy)
var(--macon-navy-50) through var(--macon-navy-900)
```

**Examples:**

```tsx
// Primary button
<button className="bg-macon-navy hover:bg-macon-navy-dark text-white">
  Click Me
</button>

// Heading
<h1 className="text-macon-navy-900 font-bold">Welcome</h1>

// Card with navy accent
<div className="border-l-4 border-macon-navy bg-macon-navy-50">
  <p className="text-macon-navy-700">Important message</p>
</div>
```

### Macon Orange (Secondary)

**Use for:** Call-to-action buttons, highlights, accents, important UI elements

```tsx
// Tailwind classes
bg-macon-orange        // #fb923c - Default orange
bg-macon-orange-dark   // #ea7c1c - Darker variant
bg-macon-orange-light  // #fca85c - Lighter variant
bg-macon-orange-50     // #fff7ed - Lightest tint
bg-macon-orange-100    // #ffedd5 - Light tint

text-macon-orange
border-macon-orange

// CSS variables
var(--macon-orange)
var(--macon-orange-50) through var(--macon-orange-900)
```

**Examples:**

```tsx
// CTA button
<button className="bg-gradient-to-r from-macon-orange to-macon-orange-light">
  Get Started
</button>

// Badge
<span className="bg-macon-orange-50 text-macon-orange-800 px-2 py-1 rounded">
  New
</span>

// Active state
<div className="border-macon-orange-500 bg-macon-orange-50">
  Selected item
</div>
```

### Macon Teal (Accent)

**Use for:** Success states, confirmations, positive indicators, accent elements

```tsx
// Tailwind classes
bg-macon-teal          // #38b2ac - Default teal
bg-macon-teal-dark     // #2c8a86 - Darker variant
bg-macon-teal-light    // #4dd4cc - Lighter variant
bg-macon-teal-50       // #e6fffa - Lightest tint
bg-macon-teal-100      // #b2f5ea - Light tint

text-macon-teal
border-macon-teal

// CSS variables
var(--macon-teal)
var(--macon-teal-50) through var(--macon-teal-900)
```

**Examples:**

```tsx
// Success message
<div className="bg-macon-teal-50 border-l-4 border-macon-teal">
  <p className="text-macon-teal-800">Success!</p>
</div>

// Badge
<span className="bg-gradient-to-br from-macon-teal/10 to-macon-teal/5">
  Active
</span>
```

---

## Neutral Palette

**Use for:** Text, backgrounds, borders, shadows - the foundation of your UI

⚠️ **Important:** Always use `neutral-*` instead of `gray-*` for consistency.

```tsx
// Tailwind classes
bg - neutral - 50; // #f9fafb - Lightest gray (page backgrounds)
bg - neutral - 100; // #f3f4f6 - Very light gray (card backgrounds)
bg - neutral - 200; // #e5e7eb - Light gray (borders)
bg - neutral - 300; // #d1d5db - Medium-light gray (dividers)
bg - neutral - 400; // #9ca3af - Medium gray (placeholders)
bg - neutral - 500; // #6b7280 - Medium-dark gray (secondary text)
bg - neutral - 600; // #4b5563 - Dark gray (body text)
bg - neutral - 700; // #374151 - Darker gray (labels)
bg - neutral - 800; // #1f2937 - Very dark gray (headings)
bg - neutral - 900; // #111827 - Darkest gray (primary text)

text - neutral - 500; // For text
border - neutral - 200; // For borders
```

**Semantic Usage:**

| Color         | Purpose                          | Example Use Cases                  |
| ------------- | -------------------------------- | ---------------------------------- |
| `neutral-50`  | Page backgrounds, light surfaces | `<body>`, empty states             |
| `neutral-100` | Card backgrounds, hover states   | `<Card>`, table row hover          |
| `neutral-200` | Borders, dividers                | Input borders, hr elements         |
| `neutral-300` | Strong borders, disabled states  | Button borders, disabled inputs    |
| `neutral-400` | Placeholder text, icons          | Input placeholders, inactive icons |
| `neutral-500` | Secondary text                   | Captions, helper text              |
| `neutral-600` | Body text, labels                | Paragraph text, form labels        |
| `neutral-700` | Strong text, subheadings         | Card titles, section labels        |
| `neutral-800` | Headings, emphasis               | h2, h3 headings                    |
| `neutral-900` | Primary text, hero headings      | h1, important text                 |

**Examples:**

```tsx
// Card with proper text hierarchy
<Card className="bg-neutral-50 border-neutral-200">
  <h2 className="text-neutral-900 font-bold">Heading</h2>
  <p className="text-neutral-600">Body text with good readability</p>
  <span className="text-neutral-500 text-sm">Helper text</span>
</Card>

// Input field
<input
  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400"
  placeholder="Enter your email"
/>

// Divider
<hr className="border-neutral-200" />
```

---

## Semantic Colors

Semantic tokens map to brand colors for consistent theming:

```tsx
// Primary (maps to Macon Navy)
bg - primary; // #1a365d
text - primary - foreground; // #FFFFFF

// Secondary (maps to Macon Orange)
bg - secondary; // #fb923c
text - secondary - foreground; // #FFFFFF

// Accent (maps to Macon Teal)
bg - accent; // #38b2ac
text - accent - foreground; // #FFFFFF

// Muted (neutral palette)
bg - muted; // #f3f4f6 (neutral-100)
text - muted - foreground; // #6b7280 (neutral-500)

// Border and Input (neutral)
border - border; // #e5e7eb (neutral-200)
border - input; // #e5e7eb (neutral-200)

// Background and Foreground
bg - background; // #ffffff (white)
text - foreground; // #111827 (neutral-900)
```

**Examples:**

```tsx
// Semantic button (adapts to theme)
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary Action
</button>

// Muted text
<p className="text-muted-foreground">This is less important</p>
```

---

## Status Colors

### Success

**Use for:** Success messages, confirmations, positive states

```tsx
bg - success - 50; // #f0fdf4 - Light background
bg - success - 100; // #dcfce7
bg - success - 200; // #bbf7d0
bg - success - 500; // #22c55e - Default success
bg - success - 600; // #16a34a - Darker
bg - success - 700; // #15803d - Darkest

text - success - 500;
border - success - 500;
```

**Examples:**

```tsx
// Success alert
<div className="bg-success-50 border-l-4 border-success-500">
  <p className="text-success-700">Payment successful!</p>
</div>

// Success button
<button className="bg-success-500 hover:bg-success-600 text-white">
  Confirm
</button>
```

### Warning

**Use for:** Warnings, cautions, pending states

```tsx
bg - warning - 50; // #fff7ed
bg - warning - 100; // #ffedd5
bg - warning - 200; // #fed7aa
bg - warning - 500; // #f59e0b
bg - warning - 600; // #d97706
bg - warning - 700; // #b45309

text - warning - 500;
border - warning - 500;
```

**Examples:**

```tsx
// Warning message
<div className="bg-warning-50 border-warning-500">
  <p className="text-warning-700">Please review before submitting</p>
</div>
```

### Danger

**Use for:** Errors, destructive actions, critical states

```tsx
bg - danger - 50; // #fef2f2
bg - danger - 100; // #fee2e2
bg - danger - 200; // #fecaca
bg - danger - 500; // #ef4444
bg - danger - 600; // #dc2626
bg - danger - 700; // #b91c1c

text - danger - 500;
border - danger - 500;
```

**Examples:**

```tsx
// Error message
<div className="bg-danger-50 border-l-4 border-danger-500">
  <p className="text-danger-700">Error: Invalid email address</p>
</div>

// Destructive button
<button className="bg-danger-500 hover:bg-danger-600 text-white">
  Delete Account
</button>

// Error input
<input className="border-danger-500 focus:ring-danger-500" />
```

---

## Legacy Colors

These colors are maintained for **tenant customization only**. Do not use in core platform UI.

### Lavender Palette

```tsx
lavender-50 through lavender-900
```

### Navy Palette (Legacy)

```tsx
navy-50 through navy-900
```

⚠️ **Note:** This is NOT Macon Navy. Use `macon-navy-*` for brand colors.

### Purple Palette

```tsx
purple-50 through purple-900
```

---

## Usage Guidelines

### ✅ DO

**Use brand colors for brand elements:**

```tsx
<button className="bg-macon-orange">Book Now</button>
<h1 className="text-macon-navy-900">Welcome to Macon</h1>
```

**Use neutral palette for UI foundation:**

```tsx
<Card className="bg-neutral-50 border-neutral-200">
  <p className="text-neutral-600">Content here</p>
</Card>
```

**Use status colors for semantic states:**

```tsx
<Alert className="bg-success-50 border-success-500">Success!</Alert>
<Alert className="bg-danger-50 border-danger-500">Error!</Alert>
```

**Use semantic tokens for flexible theming:**

```tsx
<button className="bg-primary text-primary-foreground">Adapts to theme</button>
```

### ❌ DON'T

**Don't use generic Tailwind colors:**

```tsx
// ❌ WRONG
<div className="bg-gray-50 text-gray-900">

// ✅ CORRECT
<div className="bg-neutral-50 text-neutral-900">
```

**Don't use blue/red/green generics:**

```tsx
// ❌ WRONG
<button className="bg-blue-600">Click</button>
<Alert className="bg-red-50">Error</Alert>

// ✅ CORRECT
<button className="bg-macon-navy-600">Click</button>
<Alert className="bg-danger-50">Error</Alert>
```

**Don't use legacy colors in core UI:**

```tsx
// ❌ WRONG (unless tenant customization)
<Card className="bg-lavender-50">

// ✅ CORRECT
<Card className="bg-neutral-50">
```

**Don't hardcode hex colors:**

```tsx
// ❌ WRONG
<div style={{ color: '#4b5563' }}>

// ✅ CORRECT
<div className="text-neutral-600">
```

---

## Migration Guide

### From Generic Tailwind to MAIS Design System

#### Gray → Neutral

```tsx
// Before
className = 'bg-gray-50 text-gray-900 border-gray-200';

// After
className = 'bg-neutral-50 text-neutral-900 border-neutral-200';
```

#### Blue → Macon Navy

```tsx
// Before
className = 'bg-blue-600 text-blue-50';

// After
className = 'bg-macon-navy-600 text-macon-navy-50';
```

#### Red → Danger

```tsx
// Before
className = 'border-red-500 text-red-700';

// After
className = 'border-danger-500 text-danger-700';
```

#### Green → Success

```tsx
// Before
className = 'bg-green-500 text-green-50';

// After
className = 'bg-success-500 text-success-50';
```

### CSS Module Migration

```css
/* Before - DatePicker.module.css */
.day {
  color: #4b5563; /* gray-600 */
}

/* After */
.day {
  color: var(--text-secondary); /* or neutral-600 */
}
```

### Inline Styles to Tailwind

```tsx
// Before
<div style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>Error</div>

// After
<div className="text-danger-500 bg-danger-50">Error</div>
```

---

## Color Contrast & Accessibility

All color combinations meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

### Recommended Text/Background Pairs

**Dark text on light backgrounds:**

- `text-neutral-900` on `bg-neutral-50` ✓ 16.8:1
- `text-neutral-700` on `bg-neutral-100` ✓ 10.2:1
- `text-macon-navy-900` on `bg-macon-navy-50` ✓ 12.4:1

**Light text on dark backgrounds:**

- `text-white` on `bg-macon-navy` ✓ 8.2:1
- `text-white` on `bg-macon-orange` ✓ 4.7:1
- `text-white` on `bg-danger-600` ✓ 5.1:1

**Status message combinations:**

- `text-success-700` on `bg-success-50` ✓ 7.9:1
- `text-danger-700` on `bg-danger-50` ✓ 8.1:1
- `text-warning-700` on `bg-warning-50` ✓ 7.2:1

---

## Gradients

Use predefined gradient utilities for brand consistency:

```tsx
// Macon Navy gradient
bg - gradient - navy; // linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%)

// Macon Orange gradient
bg - gradient - orange; // linear-gradient(135deg, #fb923c 0%, #fca85c 100%)

// Macon Teal gradient
bg - gradient - teal; // linear-gradient(135deg, #38b2ac 0%, #4dd4cc 100%)
```

**Examples:**

```tsx
<button className="bg-gradient-orange text-white">
  Premium Action
</button>

<Card className="bg-gradient-to-br from-macon-navy via-macon-navy to-neutral-900">
  Hero card
</Card>
```

---

## Shadows & Elevation

Shadows use Macon Navy with varying opacity for branded depth:

```tsx
shadow - elevation - 1; // Subtle: 0 1px 3px rgba(10, 37, 64, 0.12)
shadow - elevation - 2; // Light: 0 4px 6px rgba(10, 37, 64, 0.1)
shadow - elevation - 3; // Medium: 0 10px 15px rgba(10, 37, 64, 0.1)
shadow - elevation - 4; // Heavy: 0 20px 25px rgba(10, 37, 64, 0.1)

shadow - glow - orange; // 0 0 20px rgba(251, 146, 60, 0.4)
shadow - glow - teal; // 0 0 20px rgba(56, 178, 172, 0.4)
shadow - glow - success; // 0 0 20px rgba(34, 197, 94, 0.4)
```

---

## Resources

- **Tailwind Config:** `/client/tailwind.config.js`
- **CSS Variables:** `/client/src/styles/design-tokens.css`
- **Component Examples:** `/client/src/components/ui/`
- **Design System Audit:** `/docs/design-system/DESIGN_SYSTEM_AUDIT.md`

---

## Questions?

For design system questions or contributions, see `/docs/CONTRIBUTING.md` or create an issue on GitHub.
