# MAIS Design System - Design Tokens Guide

## Overview

This design token system follows Apple Human Interface Guidelines and ensures all color combinations meet WCAG AA accessibility standards. The system is built on a foundation of consistent spacing, typography, and semantic color usage.

---

## Core Principles

### 1. Semantic Over Direct

Always use semantic tokens (e.g., `--text-primary`) rather than direct color values (e.g., `--macon-navy-900`).

**Good:**

```css
.my-component {
  color: var(--text-primary);
  background: var(--surface-elevated);
}
```

**Avoid:**

```css
.my-component {
  color: var(--macon-navy-900);
  background: #ffffff;
}
```

### 2. Interactive States

Use the complete interactive state tokens for buttons and controls.

```css
.button {
  background: var(--interactive-primary-default);
  color: var(--text-on-navy);
  transition: var(--transition-base);
}

.button:hover {
  background: var(--interactive-primary-hover);
}

.button:active {
  background: var(--interactive-primary-active);
}

.button:disabled {
  background: var(--interactive-primary-disabled);
}

.button:focus-visible {
  box-shadow: var(--shadow-focus-secondary);
}
```

---

## Color System

### Brand Colors (Macon Palette)

The MAIS platform uses three primary brand colors:

- **Navy (`--macon-navy`)**: Primary brand color - #1a365d
- **Orange (`--macon-orange`)**: Secondary brand color - #fb923c
- **Teal (`--macon-teal`)**: Accent brand color - #38b2ac

Each brand color has a complete scale from 50 (lightest) to 900 (darkest).

#### Usage Examples

```css
/* Primary Button */
.btn-primary {
  background: var(--interactive-primary-default);
  color: var(--text-on-navy);
}

/* Secondary Button */
.btn-secondary {
  background: var(--interactive-secondary-default);
  color: var(--text-on-orange);
}

/* Accent Elements */
.badge-accent {
  background: var(--macon-teal-50);
  color: var(--macon-teal-700);
}
```

### Surface Colors

Use surface tokens for backgrounds and container colors:

- `--surface-primary`: White background (#ffffff)
- `--surface-secondary`: Off-white background (#f9fafb)
- `--surface-tertiary`: Light gray background (#f3f4f6)
- `--surface-elevated`: White with elevation shadow
- `--surface-overlay`: Modal/dialog overlays

```css
.card {
  background: var(--surface-elevated);
  box-shadow: var(--elevation-2);
}

.modal-backdrop {
  background: var(--surface-overlay);
}
```

### Text Colors (Hierarchy)

Text colors create visual hierarchy - use them in order:

1. `--text-primary`: Headings, primary content (#111827) - WCAG AAA
2. `--text-secondary`: Body text, labels (#4b5563) - WCAG AA
3. `--text-tertiary`: Supporting text (#6b7280) - WCAG AA
4. `--text-quaternary`: Disabled/placeholder text (#9ca3af)
5. `--text-inverse`: Text on dark backgrounds (#ffffff)

```css
.heading {
  color: var(--text-primary);
}

.body-text {
  color: var(--text-secondary);
}

.meta-info {
  color: var(--text-tertiary);
}

.placeholder {
  color: var(--text-quaternary);
}
```

### Semantic Colors (Status & Feedback)

Use semantic colors for status indicators and user feedback:

```css
/* Success State */
.alert-success {
  background: var(--semantic-success-50);
  color: var(--semantic-success-700);
  border: 1px solid var(--semantic-success-300);
}

/* Error State */
.alert-error {
  background: var(--semantic-error-50);
  color: var(--semantic-error-700);
  border: 1px solid var(--semantic-error-300);
}

/* Warning State */
.alert-warning {
  background: var(--semantic-warning-50);
  color: var(--semantic-warning-700);
  border: 1px solid var(--semantic-warning-300);
}

/* Info State */
.alert-info {
  background: var(--semantic-info-50);
  color: var(--semantic-info-700);
  border: 1px solid var(--semantic-info-300);
}
```

---

## Typography Scale

### Font Families

```css
/* Headings - Serif Font */
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-heading);
}

/* Body Text - System Font Stack */
body,
p,
span {
  font-family: var(--font-body);
}

/* Code - Monospace */
code,
pre {
  font-family: var(--font-mono);
}
```

### Font Sizes (Modular Scale - 1.250 ratio)

| Token              | Size | Use Case             |
| ------------------ | ---- | -------------------- |
| `--font-size-xs`   | 12px | Fine print, captions |
| `--font-size-sm`   | 14px | Small text, labels   |
| `--font-size-base` | 16px | Body text (default)  |
| `--font-size-md`   | 18px | Large body text      |
| `--font-size-lg`   | 20px | Subheadings          |
| `--font-size-xl`   | 24px | Small headings       |
| `--font-size-2xl`  | 30px | Medium headings      |
| `--font-size-3xl`  | 36px | Large headings       |
| `--font-size-4xl`  | 48px | Extra large headings |
| `--font-size-5xl`  | 60px | Hero headings        |
| `--font-size-6xl`  | 72px | Display text         |

### Line Heights (Readability Optimized)

```css
/* Headings - Tighter spacing */
h1,
h2,
h3 {
  line-height: var(--line-height-tight); /* 1.2 */
}

/* Subheadings */
h4,
h5,
h6 {
  line-height: var(--line-height-snug); /* 1.3 */
}

/* Body Text - Optimal readability */
p,
li {
  line-height: var(--line-height-normal); /* 1.5 */
}

/* Long-form Content */
.article-body {
  line-height: var(--line-height-relaxed); /* 1.6 */
}
```

### Font Weights

```css
.regular {
  font-weight: var(--font-weight-normal);
} /* 400 */
.medium {
  font-weight: var(--font-weight-medium);
} /* 500 */
.semibold {
  font-weight: var(--font-weight-semibold);
} /* 600 */
.bold {
  font-weight: var(--font-weight-bold);
} /* 700 */
.extrabold {
  font-weight: var(--font-weight-extrabold);
} /* 800 */
```

### Letter Spacing

```css
/* Large Display Headings */
.display {
  letter-spacing: var(--letter-spacing-tighter); /* -0.05em */
}

/* Regular Headings */
h1,
h2,
h3 {
  letter-spacing: var(--letter-spacing-tight); /* -0.025em */
}

/* Body Text */
p {
  letter-spacing: var(--letter-spacing-normal); /* 0 */
}

/* Uppercase Labels */
.label {
  letter-spacing: var(--letter-spacing-wider); /* 0.05em */
  text-transform: uppercase;
}
```

### Pre-built Typography Classes

```css
<h1 class="text-heading-1">Hero Heading</h1>
<h2 class="text-heading-2">Section Heading</h2>
<h3 class="text-heading-3">Subsection Heading</h3>
<p class="text-body-large">Large body text</p>
<p class="text-body">Regular body text</p>
<p class="text-body-small">Small supporting text</p>
<span class="text-label">Uppercase Label</span>
```

---

## Spacing System

### Base Unit: 4px

All spacing uses a 4px base unit for perfect alignment.

| Token        | Value   | Pixels |
| ------------ | ------- | ------ |
| `--space-0`  | 0       | 0px    |
| `--space-1`  | 0.25rem | 4px    |
| `--space-2`  | 0.5rem  | 8px    |
| `--space-3`  | 0.75rem | 12px   |
| `--space-4`  | 1rem    | 16px   |
| `--space-5`  | 1.25rem | 20px   |
| `--space-6`  | 1.5rem  | 24px   |
| `--space-8`  | 2rem    | 32px   |
| `--space-10` | 2.5rem  | 40px   |
| `--space-12` | 3rem    | 48px   |
| `--space-16` | 4rem    | 64px   |
| `--space-20` | 5rem    | 80px   |
| `--space-24` | 6rem    | 96px   |
| `--space-32` | 8rem    | 128px  |

### Semantic Spacing

```css
/* Component Gap - Space between related elements */
.flex-container {
  gap: var(--space-component-gap); /* 16px */
}

/* Section Gap - Space between sections */
.section {
  margin-bottom: var(--space-section-gap); /* 48px */
}

/* Page Padding - Edges of the page */
.page {
  padding: var(--space-page-padding); /* 24px */
}

/* Container Padding - Inside containers */
.container {
  padding: var(--space-container-padding); /* 32px */
}
```

---

## Elevation & Shadows

### 4-Level System

The elevation system creates depth and hierarchy:

```css
/* Level 1 - Subtle (Buttons, Input Fields) */
.button {
  box-shadow: var(--elevation-1);
}

/* Level 2 - Low (Cards, Dropdowns) */
.card {
  box-shadow: var(--elevation-2);
}

/* Level 3 - Medium (Popovers, Tooltips) */
.popover {
  box-shadow: var(--elevation-3);
}

/* Level 4 - High (Modals, Drawers) */
.modal {
  box-shadow: var(--elevation-4);
}
```

### Focus Ring Shadows

```css
/* Primary Focus (Navy) */
.input:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus-primary);
}

/* Secondary Focus (Orange) - for primary navy elements */
.navy-button:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus-secondary);
}

/* Error Focus */
.error-input:focus-visible {
  box-shadow: var(--shadow-focus-error);
}

/* Success Focus */
.success-input:focus-visible {
  box-shadow: var(--shadow-focus-success);
}
```

---

## Border Radius

```css
/* Small Elements (badges, tags) */
.badge {
  border-radius: var(--radius-sm); /* 4px */
}

/* Default (buttons, inputs) */
.button {
  border-radius: var(--radius-base); /* 8px */
}

/* Cards */
.card {
  border-radius: var(--radius-lg); /* 12px */
}

/* Large Cards */
.hero-card {
  border-radius: var(--radius-xl); /* 16px */
}

/* Pills & Avatars */
.pill {
  border-radius: var(--radius-full); /* 9999px */
}
```

---

## Borders

```css
/* Default Border */
.card {
  border: var(--border-width-1) solid var(--border-color-default);
}

/* Strong Border */
.emphasized {
  border: var(--border-width-2) solid var(--border-color-strong);
}

/* Subtle Divider */
.divider {
  border-top: var(--border-width-1) solid var(--border-color-subtle);
}

/* Focus Border */
.input:focus {
  border-color: var(--border-color-focus);
}

/* Error Border */
.input-error {
  border-color: var(--border-color-error);
}
```

---

## Transitions & Animations

### Duration

```css
/* Fast - Micro interactions */
.hover-effect {
  transition: color var(--duration-fast); /* 150ms */
}

/* Base - Default transitions */
.button {
  transition: all var(--duration-base); /* 200ms */
}

/* Slow - Complex animations */
.modal-enter {
  transition: transform var(--duration-slow); /* 300ms */
}
```

### Easing Functions (Apple-style)

```css
/* Standard ease in-out */
.smooth-transition {
  transition: all var(--duration-base) var(--ease-in-out);
}

/* Spring effect */
.spring-bounce {
  transition: transform var(--duration-slow) var(--ease-spring);
}

/* Smooth Apple-style */
.apple-smooth {
  transition: all var(--duration-base) var(--ease-smooth);
}
```

### Pre-built Transitions

```css
.transition-all {
  transition: var(--transition-all); /* all 200ms ease-in-out */
}

.transition-fast {
  transition: var(--transition-fast); /* 150ms ease-in-out */
}

.transition-base {
  transition: var(--transition-base); /* 200ms ease-in-out */
}

.transition-slow {
  transition: var(--transition-slow); /* 300ms ease-in-out */
}
```

---

## Utility Classes

### Pre-built Components

```html
<!-- Elevated Card -->
<div class="surface-elevated">Elevated card with shadow</div>

<!-- Status Badges -->
<span class="status-success">Success</span>
<span class="status-error">Error</span>
<span class="status-warning">Warning</span>
<span class="status-info">Info</span>

<!-- Gradients -->
<div class="gradient-navy">Navy gradient background</div>
<div class="gradient-orange">Orange gradient background</div>
<div class="gradient-teal">Teal gradient background</div>

<!-- Glass Morphism -->
<div class="glass">Glass morphism effect</div>

<!-- Elevation Levels -->
<div class="elevation-1">Level 1 shadow</div>
<div class="elevation-2">Level 2 shadow</div>
<div class="elevation-3">Level 3 shadow</div>
<div class="elevation-4">Level 4 shadow</div>
```

---

## Z-Index Scale

Maintain proper layering with the z-index scale:

```css
.dropdown {
  z-index: var(--z-dropdown);
} /* 1000 */
.sticky-header {
  z-index: var(--z-sticky);
} /* 1020 */
.fixed-element {
  z-index: var(--z-fixed);
} /* 1030 */
.modal-backdrop {
  z-index: var(--z-modal-backdrop);
} /* 1040 */
.modal {
  z-index: var(--z-modal);
} /* 1050 */
.popover {
  z-index: var(--z-popover);
} /* 1060 */
.tooltip {
  z-index: var(--z-tooltip);
} /* 1070 */
.notification {
  z-index: var(--z-notification);
} /* 1080 */
```

---

## Accessibility Features

### WCAG AA Compliance

All color combinations meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

### Reduced Motion Support

The system automatically respects user motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* All animations reduced automatically */
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  /* Enhanced contrast automatically applied */
}
```

### Focus Indicators

All interactive elements have visible focus indicators:

```css
.interactive-element:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus-primary);
}
```

---

## Dark Mode Support

Dark mode tokens are included for future tenant customization:

```css
@media (prefers-color-scheme: dark) {
  /* Automatic dark mode based on system preference */
}
```

---

## Best Practices

### ✅ Do's

1. **Use semantic tokens**: `var(--text-primary)` instead of direct colors
2. **Follow the spacing scale**: Use defined spacing tokens
3. **Use elevation system**: Apply appropriate shadow levels
4. **Maintain accessibility**: Ensure proper color contrast
5. **Use pre-built classes**: Leverage utility classes when available
6. **Test with reduced motion**: Ensure animations respect user preferences

### ❌ Don'ts

1. **Avoid hardcoded values**: Don't use `#1a365d` directly
2. **Don't break the spacing scale**: Stick to defined spacing values
3. **Don't create custom shadows**: Use the 4-level elevation system
4. **Don't skip focus states**: Always include focus-visible styles
5. **Don't override accessibility features**: Respect reduced motion and high contrast

---

## Migration from Legacy Tokens

Legacy tokens are mapped for backward compatibility:

```css
/* Legacy → New */
--color-primary → --interactive-primary-default
--color-secondary → --interactive-secondary-default
--shadow-soft → --elevation-2
--shadow-medium → --elevation-3
--shadow-large → --elevation-4
```

Gradually migrate to the new semantic tokens for better maintainability.

---

## Quick Reference

### Common Patterns

```css
/* Primary Button */
.btn-primary {
  background: var(--interactive-primary-default);
  color: var(--text-on-navy);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: var(--transition-base);
  box-shadow: var(--elevation-1);
}

.btn-primary:hover {
  background: var(--interactive-primary-hover);
  box-shadow: var(--elevation-2);
  transform: translateY(-1px);
}

.btn-primary:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus-secondary);
}

/* Card Component */
.card {
  background: var(--surface-elevated);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  transition: var(--transition-base);
}

.card:hover {
  box-shadow: var(--elevation-3);
  transform: translateY(-2px);
}

/* Input Field */
.input {
  background: var(--surface-primary);
  color: var(--text-primary);
  border: var(--border-width-1) solid var(--border-color-default);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  transition: var(--transition-base);
}

.input:focus {
  border-color: var(--border-color-focus);
  box-shadow: var(--shadow-focus-secondary);
  outline: none;
}

.input::placeholder {
  color: var(--text-quaternary);
}
```

---

## Support

For questions or design token requests, please contact the design system team or create an issue in the repository.

**Design System Version**: 1.0
**Last Updated**: November 2025
**Maintained by**: MAIS Platform Team
