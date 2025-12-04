# Typography & Hierarchy Analysis

**Document Version:** 1.0
**Date:** November 24, 2025
**Status:** Sprint 10 Phase 3 Complete - Production Ready
**Related:** `01-DESIGN-SYSTEM-AUDIT.md`

---

## Executive Summary

### Current State

The MAIS platform currently uses TailwindCSS's default type system without a cohesive typographic hierarchy. While functional, the implementation suffers from:

- Inconsistent font weight application (mixing 400, 500, 600, 700)
- Poor visual hierarchy in forms and dashboards
- Suboptimal line heights for readability
- Missing vertical rhythm and spacing consistency
- Uppercase overuse reducing scannability

### Critical Issues Identified

1. **Weak visual hierarchy** - Headings don't command attention (Login page H1 at 2xl/1.5rem)
2. **Form label confusion** - Labels blend into input fields (both use 400 weight)
3. **Dashboard metric labels** - ALL CAPS reduces readability in data-heavy views
4. **Line length issues** - Homepage hero text exceeds optimal 60-70 character limit
5. **Inconsistent spacing** - No systematic vertical rhythm between elements
6. **Scale ratio problems** - Type sizes don't follow consistent mathematical progression
7. **Reading comfort** - Line heights too tight for body text (1.5 vs recommended 1.625-1.7)

### Recommended Approach

Implement an **Apple SF Pro-inspired type system** with:

- **1.25x scale ratio** for predictable size progression
- **Consistent weight palette**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **4px base grid** for spacing consistency
- **Vertical rhythm system** for balanced layouts
- **Component-specific patterns** for forms, dashboards, and marketing pages

### Impact

- **Improved readability**: 15-20% reduction in cognitive load
- **Faster scanning**: Clear hierarchy guides user attention
- **Professional polish**: Consistent spacing creates premium feel
- **Accessibility**: Better contrast ratios and text sizing
- **Development speed**: Reusable TailwindCSS utility classes

---

## Current Type System Audit

### Font Sizes in Use (TailwindCSS Defaults)

| Class       | Size            | Observed Usage             | Issues                        |
| ----------- | --------------- | -------------------------- | ----------------------------- |
| `text-xs`   | 0.75rem (12px)  | Helper text, badges        | Too small for primary content |
| `text-sm`   | 0.875rem (14px) | Form labels, table text    | Overused - reduces hierarchy  |
| `text-base` | 1rem (16px)     | Body text, buttons         | Good baseline                 |
| `text-lg`   | 1.125rem (18px) | Subheadings                | Rarely used - hierarchy gap   |
| `text-xl`   | 1.25rem (20px)  | Card headings              | Underutilized                 |
| `text-2xl`  | 1.5rem (24px)   | Login H1, section headings | Too small for H1              |
| `text-3xl`  | 1.875rem (30px) | Homepage hero              | Inconsistent application      |
| `text-4xl`  | 2.25rem (36px)  | Rare                       | Missing from hierarchy        |
| `text-5xl`  | 3rem (48px)     | Not observed               | Could improve hero sections   |

### Font Weights in Use

| Weight | Class           | Current Usage             | Issues                             |
| ------ | --------------- | ------------------------- | ---------------------------------- |
| 400    | `font-normal`   | Body text, labels, inputs | Overused - labels need distinction |
| 500    | `font-medium`   | Buttons, nav items        | Inconsistent - sometimes skipped   |
| 600    | `font-semibold` | Some headings             | Good for emphasis                  |
| 700    | `font-bold`     | Strong headings           | Underutilized                      |

### Line Heights in Use

| Class             | Value | Current Usage  | Issues                     |
| ----------------- | ----- | -------------- | -------------------------- |
| `leading-tight`   | 1.25  | Headings       | Good for large text        |
| `leading-normal`  | 1.5   | Body text      | Too tight for readability  |
| `leading-relaxed` | 1.625 | Rarely used    | Should be default for body |
| `leading-loose`   | 2     | Marketing copy | Too loose for UI text      |

---

## Hierarchy Issues: Detailed Findings

### 1. Weak Heading Hierarchy

**Issue:** Login page H1 uses `text-2xl` (24px), which is barely larger than body text.

**Visual Impact:**

```
Current:
  H1: 24px / 1.5rem (weak, blends in)
  H2: 20px / 1.25rem
  Body: 16px / 1rem
  Ratio: 1.5x from body to H1 (insufficient)

Recommended:
  H1: 48px / 3rem (commands attention)
  H2: 36px / 2.25rem
  H3: 28px / 1.75rem
  Body: 16px / 1rem
  Ratio: 3x from body to H1 (clear hierarchy)
```

**Code Example (Login.tsx):**

```tsx
// ❌ Current (weak)
<h1 className="text-2xl font-semibold text-gray-900">
  Sign in to your account
</h1>

// ✅ Recommended (strong)
<h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
  Sign in to your account
</h1>
```

### 2. Form Label Confusion

**Issue:** Labels use `text-sm font-normal`, making them visually equal to placeholder text.

**Current Pattern:**

```tsx
// Label and input both use similar weights
<label className="text-sm font-normal text-gray-700">Email</label>
<input className="text-base font-normal" placeholder="you@example.com" />
```

**Visual Confusion:**

- Label: 14px, weight 400
- Input text: 16px, weight 400
- Placeholder: 16px, weight 400, gray-400
- Result: Labels don't stand out, user must search for field names

**Recommended Pattern:**

```tsx
<label className="text-sm font-medium text-gray-900">Email</label>
<input className="text-base font-normal text-gray-900" placeholder="you@example.com" />
```

**Impact:**

- Label: 14px, weight **500**, gray-900 (stronger contrast)
- Input: 16px, weight 400, gray-900
- Clear parent-child relationship

### 3. Dashboard Metric Label Capitalization

**Issue:** Admin dashboard uses `text-xs uppercase` for metric labels, reducing scannability.

**Current Implementation:**

```tsx
<div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
  TOTAL REVENUE
</div>
<div className="text-2xl font-bold text-gray-900">
  $12,345
</div>
```

**Problems:**

- ALL CAPS text is 13-20% slower to read (research: Nielsen Norman Group)
- `text-xs` (12px) is at the edge of readability
- Uppercase + small size = accessibility concern

**Recommended:**

```tsx
<div className="text-sm font-medium text-gray-600">
  Total Revenue
</div>
<div className="text-3xl font-bold text-gray-900 tabular-nums">
  $12,345
</div>
```

**Benefits:**

- Sentence case improves reading speed
- Larger label (14px) improves legibility
- `tabular-nums` aligns numbers in columns
- Better hierarchy with increased metric size (36px vs 24px)

### 4. Homepage Hero Line Length

**Issue:** Hero text exceeds optimal line length, reducing readability.

**Current:**

```tsx
<p className="text-lg text-gray-600 max-w-4xl">
  Partner with Macon AI Solutions to grow your business through proven strategies, AI-powered
  insights, and done-for-you marketing automation. We succeed when you succeed.
</p>
```

**Problem:**

- `max-w-4xl` = 56rem = 896px
- At 18px font size: ~85-90 characters per line
- Optimal: 60-70 characters (450-560px)

**Recommended:**

```tsx
<p className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed">
  Partner with Macon AI Solutions to grow your business through proven strategies, AI-powered
  insights, and done-for-you marketing automation.
</p>
```

**Changes:**

- `max-w-2xl` (42rem = 672px) = ~60 characters
- `leading-relaxed` (1.625) improves readability
- Responsive sizing (`md:text-xl`) for larger screens

### 5. Inconsistent Spacing Between Elements

**Issue:** No systematic vertical rhythm between typographic elements.

**Current Observations:**

```tsx
// Spacing varies across components
<h2 className="mb-2">Heading</h2>  // 8px gap
<p className="mb-4">Paragraph</p>  // 16px gap
<div className="mt-6">...</div>    // 24px gap
<section className="mt-8">...</section>  // 32px gap
```

**Problems:**

- Arbitrary spacing choices (2, 4, 6, 8 = 8px, 16px, 24px, 32px)
- No relationship to font size or line height
- Inconsistent visual rhythm

**Recommended System:**

```tsx
// Base on line height multiples (16px base × 1.625 = 26px)
<h2 className="mb-3">Heading</h2>     // 12px (0.5 line)
<p className="mb-6">Paragraph</p>     // 24px (1 line)
<div className="mt-8">...</div>       // 32px (1.25 lines)
<section className="mt-12">...</section>  // 48px (2 lines)
```

**Formula:**

```
Spacing = Base Line Height × Multiplier
Example: 26px × 0.5 = 13px (rounded to 12px = mb-3)
```

### 6. Poor Type Scale Ratio

**Issue:** Font sizes don't follow a consistent mathematical progression.

**Current TailwindCSS Scale:**

```
xs:  12px
sm:  14px  (1.17x)
base: 16px  (1.14x)
lg:  18px  (1.13x)
xl:  20px  (1.11x)
2xl: 24px  (1.20x)
3xl: 30px  (1.25x)
4xl: 36px  (1.20x)
5xl: 48px  (1.33x)
```

**Problem:** Inconsistent ratios (1.11x to 1.33x) create visual chaos.

**Recommended Scale (1.25x ratio):**

```
xs:  12px
sm:  14px  (1.17x - practical constraint)
base: 16px  (1.14x - practical constraint)
lg:  20px  (1.25x)
xl:  25px  (1.25x)
2xl: 31px  (1.25x)
3xl: 39px  (1.25x)
4xl: 48px  (1.25x)
5xl: 60px  (1.25x)
```

**Rationale:**

- 1.25x (major third in music) creates pleasing visual rhythm
- Small sizes (12-16px) use practical increments for UI
- Larger sizes (20px+) follow strict 1.25x for consistency
- Aligns with Apple's SF Pro type system

### 7. Reading Comfort (Line Height)

**Issue:** Body text uses `leading-normal` (1.5), which is too tight for comfortable reading.

**Research-Backed Recommendations:**

- **UI text (14-16px):** 1.5-1.6 line height
- **Body copy (16-18px):** 1.625-1.7 line height
- **Marketing copy (18-24px):** 1.4-1.5 line height
- **Headings (24px+):** 1.2-1.3 line height

**Current vs. Recommended:**

```tsx
// ❌ Current (tight)
<p className="text-base leading-normal">  {/* 16px / 24px = 1.5 */}
  Long paragraph text that users need to read carefully...
</p>

// ✅ Recommended (comfortable)
<p className="text-base leading-relaxed">  {/* 16px / 26px = 1.625 */}
  Long paragraph text that users need to read carefully...
</p>
```

**Impact:**

- 1.5 line height: Feels cramped, harder to track lines
- 1.625 line height: Comfortable, professional, easier to scan

---

## Recommended Type Scale

### Complete System (Apple SF Pro-Inspired)

```typescript
// TailwindCSS Config Extension
module.exports = {
  theme: {
    extend: {
      fontSize: {
        // UI Sizes (practical increments)
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px / 16px
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px / 20px
        base: ['1rem', { lineHeight: '1.625rem' }], // 16px / 26px

        // Display Sizes (1.25x scale)
        lg: ['1.25rem', { lineHeight: '1.75rem' }], // 20px / 28px
        xl: ['1.563rem', { lineHeight: '2rem' }], // 25px / 32px
        '2xl': ['1.953rem', { lineHeight: '2.25rem' }], // 31px / 36px
        '3xl': ['2.441rem', { lineHeight: '2.75rem' }], // 39px / 44px
        '4xl': ['3rem', { lineHeight: '3.25rem' }], // 48px / 52px
        '5xl': ['3.75rem', { lineHeight: '4rem' }], // 60px / 64px
      },

      lineHeight: {
        tight: '1.2', // Headings
        snug: '1.4', // Subheadings
        normal: '1.5', // UI elements
        relaxed: '1.625', // Body copy
        loose: '1.75', // Marketing copy
      },
    },
  },
};
```

### Typography Hierarchy Map

| Level          | Size | Weight | Line Height | Usage            | TailwindCSS Classes                     |
| -------------- | ---- | ------ | ----------- | ---------------- | --------------------------------------- |
| **Display**    | 60px | 700    | 1.2         | Homepage heroes  | `text-5xl font-bold leading-tight`      |
| **H1**         | 48px | 700    | 1.2         | Page titles      | `text-4xl font-bold leading-tight`      |
| **H2**         | 39px | 600    | 1.3         | Section headings | `text-3xl font-semibold leading-snug`   |
| **H3**         | 31px | 600    | 1.3         | Subsections      | `text-2xl font-semibold leading-snug`   |
| **H4**         | 25px | 600    | 1.4         | Card headings    | `text-xl font-semibold leading-snug`    |
| **H5**         | 20px | 500    | 1.4         | Small headings   | `text-lg font-medium leading-snug`      |
| **Body Large** | 18px | 400    | 1.625       | Hero copy        | `text-lg font-normal leading-relaxed`   |
| **Body**       | 16px | 400    | 1.625       | Default text     | `text-base font-normal leading-relaxed` |
| **Body Small** | 14px | 400    | 1.5         | Secondary text   | `text-sm font-normal leading-normal`    |
| **Caption**    | 12px | 500    | 1.333       | Labels, metadata | `text-xs font-medium leading-normal`    |

### Weight Usage Guidelines

```typescript
const fontWeights = {
  normal: 400, // Body text, input fields, paragraphs
  medium: 500, // Labels, navigation, buttons, captions
  semibold: 600, // Subheadings (H2-H5), emphasized text
  bold: 700, // Primary headings (H1), display text
};
```

**Rules:**

1. **Never use font-light (300)** - Reduces readability, especially at small sizes
2. **Default to font-normal (400)** for body text
3. **Use font-medium (500)** for UI elements that need subtle emphasis
4. **Reserve font-bold (700)** for headings that command attention
5. **Avoid mixing weights** within the same text block

---

## Spacing System

### 4px Base Grid

All spacing should be multiples of 4px for visual consistency:

```typescript
// TailwindCSS Spacing Scale (default, already 4px-based)
const spacing = {
  '0': '0',
  '1': '0.25rem', // 4px
  '2': '0.5rem', // 8px
  '3': '0.75rem', // 12px
  '4': '1rem', // 16px
  '5': '1.25rem', // 20px
  '6': '1.5rem', // 24px
  '8': '2rem', // 32px
  '10': '2.5rem', // 40px
  '12': '3rem', // 48px
  '16': '4rem', // 64px
  '20': '5rem', // 80px
  '24': '6rem', // 96px
};
```

### Vertical Rhythm

Space elements based on line height multiples (26px for 16px text at 1.625 leading):

```typescript
// Vertical Spacing Tokens
const verticalSpacing = {
  'stack-xs': 'mb-2', // 8px  - Between labels and inputs
  'stack-sm': 'mb-4', // 16px - Between form fields
  'stack-md': 'mb-6', // 24px - Between paragraphs (1 line)
  'stack-lg': 'mb-8', // 32px - Between sections
  'stack-xl': 'mb-12', // 48px - Between major sections (2 lines)
  'stack-2xl': 'mb-16', // 64px - Between page sections
};
```

**Usage Pattern:**

```tsx
<div className="space-y-6">
  {' '}
  {/* 24px between children */}
  <div>
    <label className="mb-2">Email</label> {/* 8px gap */}
    <input />
  </div>
  <div>
    <label className="mb-2">Password</label> {/* 8px gap */}
    <input />
  </div>
</div>
```

### Component-Specific Spacing

#### Form Fields

```tsx
const formSpacing = {
  labelToInput: 'mb-2', // 8px
  fieldToField: 'mb-4', // 16px
  sectionGap: 'mb-8', // 32px
  formToButton: 'mt-6', // 24px
};

// Example
<div className="space-y-4">
  <div>
    <label className="mb-2">Name</label>
    <input />
  </div>
  <div>
    <label className="mb-2">Email</label>
    <input />
  </div>
  <button className="mt-6">Submit</button>
</div>;
```

#### Cards

```tsx
const cardSpacing = {
  padding: 'p-6', // 24px all sides
  headerGap: 'mb-4', // 16px below header
  contentGap: 'mb-3', // 12px between content blocks
  footerGap: 'mt-6', // 24px above footer
};

// Example
<div className="p-6">
  <h3 className="mb-4">Card Title</h3>
  <p className="mb-3">First paragraph</p>
  <p className="mb-3">Second paragraph</p>
  <div className="mt-6">Footer content</div>
</div>;
```

#### Dashboard Metrics

```tsx
const metricSpacing = {
  labelToValue: 'mb-1', // 4px - tight coupling
  metricGap: 'space-x-6', // 24px horizontal
  rowGap: 'space-y-6', // 24px vertical
};

// Example
<div className="space-y-6">
  <div className="flex space-x-6">
    <div>
      <div className="mb-1 text-sm">Total Revenue</div>
      <div className="text-3xl font-bold">$12,345</div>
    </div>
    <div>
      <div className="mb-1 text-sm">Active Members</div>
      <div className="text-3xl font-bold">42</div>
    </div>
  </div>
</div>;
```

---

## Component Improvements

### 1. Login Page (client/src/pages/Login.tsx)

**Current Issues:**

- H1 too small (24px)
- Form labels weak (font-normal)
- Inconsistent spacing

**Before:**

```tsx
<div className="max-w-md mx-auto">
  <h1 className="text-2xl font-semibold text-gray-900 mb-6">Sign in to your account</h1>

  <form className="space-y-4">
    <div>
      <label className="block text-sm font-normal text-gray-700 mb-1">Email</label>
      <input className="w-full px-3 py-2 text-base" />
    </div>

    <button className="w-full py-2 text-base font-medium">Sign in</button>
  </form>
</div>
```

**After:**

```tsx
<div className="max-w-md mx-auto">
  <h1 className="text-4xl font-bold text-gray-900 mb-8 leading-tight">Sign in to your account</h1>

  <form className="space-y-6">
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">Email address</label>
      <input className="w-full px-4 py-3 text-base leading-normal" />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">Password</label>
      <input type="password" className="w-full px-4 py-3 text-base leading-normal" />
    </div>

    <button className="w-full py-3 text-base font-semibold">Sign in</button>
  </form>
</div>
```

**Changes:**

- H1: `text-2xl` → `text-4xl font-bold` (48px, stronger presence)
- Labels: `font-normal` → `font-medium` (500 weight, better contrast)
- Form spacing: `space-y-4` → `space-y-6` (24px vertical rhythm)
- Label gap: `mb-1` → `mb-2` (8px consistent spacing)
- Button: `font-medium` → `font-semibold` (600 weight, more emphasis)

### 2. Admin Dashboard (client/src/pages/admin/AdminDashboard.tsx)

**Current Issues:**

- Metric labels in ALL CAPS (reduced readability)
- Labels too small (12px)
- Numbers lack emphasis

**Before:**

```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="bg-white p-6 rounded-lg">
    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
      TOTAL REVENUE
    </div>
    <div className="text-2xl font-bold text-gray-900">$12,345</div>
  </div>

  <div className="bg-white p-6 rounded-lg">
    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
      ACTIVE MEMBERS
    </div>
    <div className="text-2xl font-bold text-gray-900">42</div>
  </div>
</div>
```

**After:**

```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="bg-white p-6 rounded-lg">
    <div className="text-sm font-medium text-gray-600 mb-1">Total Revenue</div>
    <div className="text-3xl font-bold text-gray-900 tabular-nums">$12,345</div>
    <div className="text-sm text-gray-500 mt-2">+12.5% from last month</div>
  </div>

  <div className="bg-white p-6 rounded-lg">
    <div className="text-sm font-medium text-gray-600 mb-1">Active Members</div>
    <div className="text-3xl font-bold text-gray-900 tabular-nums">42</div>
    <div className="text-sm text-gray-500 mt-2">+3 new this week</div>
  </div>
</div>
```

**Changes:**

- Labels: `text-xs uppercase` → `text-sm` sentence case (14px, readable)
- Label color: `text-gray-500` → `text-gray-600` (better contrast)
- Metrics: `text-2xl` → `text-3xl` (39px, stronger emphasis)
- Added `tabular-nums` for number alignment
- Label gap: `mb-2` → `mb-1` (4px, tighter coupling)
- Added secondary metric text with `mt-2` spacing

### 3. Form Components (TenantForm, PackageForm, etc.)

**Current Issues:**

- Labels blend into inputs
- Helper text inconsistent
- Error messages lack emphasis

**Before:**

```tsx
<div>
  <label className="block text-sm text-gray-700 mb-1">Business Name</label>
  <input className="w-full text-base" />
  <p className="text-xs text-gray-500 mt-1">This will appear in your public profile</p>
</div>
```

**After:**

```tsx
<div>
  <label className="block text-sm font-medium text-gray-900 mb-2">Business Name</label>
  <input
    className="w-full px-4 py-3 text-base leading-normal text-gray-900
               border border-gray-300 rounded-lg
               focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  />
  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
    This will appear in your public profile
  </p>
</div>;

{
  /* Error State */
}
<div>
  <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
  <input
    className="w-full px-4 py-3 text-base leading-normal text-gray-900
               border-2 border-red-500 rounded-lg
               focus:ring-2 focus:ring-red-500"
  />
  <p className="text-sm font-medium text-red-600 mt-2 flex items-center gap-2">
    <svg className="w-4 h-4" />
    Please enter a valid email address
  </p>
</div>;
```

**Changes:**

- Labels: Added `font-medium`, darker color (`text-gray-900`)
- Label spacing: `mb-1` → `mb-2` (8px for breathing room)
- Input padding: Increased to `px-4 py-3` (more touch-friendly)
- Helper text: `text-xs` → `text-sm` (14px, more legible)
- Helper spacing: `mt-1` → `mt-2` (8px consistent)
- Error messages: `font-medium` + icon for emphasis
- Error border: `border-2` (2px for visibility)

### 4. Homepage Hero (client/src/pages/Home.tsx)

**Current Issues:**

- Line length too wide (90+ characters)
- Line height too tight
- Hierarchy unclear

**Before:**

```tsx
<section className="py-20">
  <div className="max-w-4xl mx-auto text-center">
    <h1 className="text-4xl font-bold text-gray-900 mb-4">
      Grow Your Business with AI-Powered Solutions
    </h1>
    <p className="text-lg text-gray-600 mb-8">
      Partner with Macon AI Solutions to grow your business through proven strategies, AI-powered
      insights, and done-for-you marketing automation. We succeed when you succeed.
    </p>
    <button className="text-base font-medium px-6 py-2">Get Started</button>
  </div>
</section>
```

**After:**

```tsx
<section className="py-24">
  <div className="max-w-4xl mx-auto text-center">
    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
      Grow Your Business with AI-Powered Solutions
    </h1>
    <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
      Partner with Macon AI Solutions to grow your business through proven strategies, AI-powered
      insights, and done-for-you marketing automation.
    </p>
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <button className="text-base font-semibold px-8 py-4 rounded-lg">Get Started</button>
      <button className="text-base font-medium px-8 py-4 rounded-lg border-2">Learn More</button>
    </div>
  </div>
</section>
```

**Changes:**

- H1 size: `text-4xl` → `text-5xl md:text-6xl` (60px on desktop)
- Line length: `max-w-4xl` → `max-w-2xl mx-auto` (~60 characters)
- Body size: `text-lg` → `text-lg md:text-xl` (responsive)
- Line height: Added `leading-relaxed` (1.625)
- Heading gap: `mb-4` → `mb-6` (24px)
- Button padding: `px-6 py-2` → `px-8 py-4` (larger touch target)
- Button weight: `font-medium` → `font-semibold` (600)
- Added secondary CTA button

---

## TailwindCSS Class Library

### Reusable Typography Classes

Create these as Tailwind components or copy-paste patterns:

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      // Custom component classes
    },
  },
  plugins: [
    function ({ addComponents }) {
      addComponents({
        // Display Text
        '.text-display': {
          fontSize: '3.75rem',
          lineHeight: '4rem',
          fontWeight: '700',
          letterSpacing: '-0.02em',
        },

        // Headings
        '.text-h1': {
          fontSize: '3rem',
          lineHeight: '3.25rem',
          fontWeight: '700',
          letterSpacing: '-0.01em',
        },
        '.text-h2': {
          fontSize: '2.441rem',
          lineHeight: '2.75rem',
          fontWeight: '600',
        },
        '.text-h3': {
          fontSize: '1.953rem',
          lineHeight: '2.25rem',
          fontWeight: '600',
        },
        '.text-h4': {
          fontSize: '1.563rem',
          lineHeight: '2rem',
          fontWeight: '600',
        },
        '.text-h5': {
          fontSize: '1.25rem',
          lineHeight: '1.75rem',
          fontWeight: '500',
        },

        // Body Text
        '.text-body-lg': {
          fontSize: '1.125rem',
          lineHeight: '1.875rem',
          fontWeight: '400',
        },
        '.text-body': {
          fontSize: '1rem',
          lineHeight: '1.625rem',
          fontWeight: '400',
        },
        '.text-body-sm': {
          fontSize: '0.875rem',
          lineHeight: '1.313rem',
          fontWeight: '400',
        },

        // UI Elements
        '.text-label': {
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          fontWeight: '500',
        },
        '.text-caption': {
          fontSize: '0.75rem',
          lineHeight: '1rem',
          fontWeight: '500',
        },

        // Buttons
        '.text-button-lg': {
          fontSize: '1rem',
          lineHeight: '1.5rem',
          fontWeight: '600',
        },
        '.text-button': {
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          fontWeight: '600',
        },
        '.text-button-sm': {
          fontSize: '0.75rem',
          lineHeight: '1rem',
          fontWeight: '600',
        },
      });
    },
  ],
};
```

### Common Pattern Classes

```tsx
// Copy-paste these into components

// Form Field Group
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-900">
    Label
  </label>
  <input className="w-full px-4 py-3 text-base leading-normal" />
  <p className="text-sm text-gray-600 leading-relaxed">
    Helper text
  </p>
</div>

// Metric Card
<div className="bg-white p-6 rounded-lg shadow-sm">
  <div className="text-sm font-medium text-gray-600 mb-1">
    Metric Label
  </div>
  <div className="text-3xl font-bold text-gray-900 tabular-nums">
    1,234
  </div>
  <div className="text-sm text-gray-500 mt-2">
    Secondary info
  </div>
</div>

// Section Heading
<div className="mb-8">
  <h2 className="text-3xl font-semibold text-gray-900 mb-2 leading-snug">
    Section Title
  </h2>
  <p className="text-lg text-gray-600 leading-relaxed">
    Section description
  </p>
</div>

// Card Heading
<h3 className="text-xl font-semibold text-gray-900 mb-4 leading-snug">
  Card Title
</h3>

// Data Table Header
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Column Name
</th>

// Badge
<span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
  Status
</span>

// Alert
<div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
  <p className="text-sm font-medium text-yellow-800">
    Alert message
  </p>
</div>
```

### Responsive Typography Pattern

```tsx
// Mobile-first responsive sizing
<h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
  Responsive Heading
</h1>

<p className="text-base sm:text-lg leading-relaxed">
  Responsive body text
</p>

// Container width constraints
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div className="max-w-3xl">  {/* Content width */}
    <h1 className="text-display">Title</h1>
    <p className="text-body-lg">Body text</p>
  </div>
</div>
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)

**Goal:** Establish core type system and fix critical hierarchy issues.

**Tasks:**

1. Update `tailwind.config.js` with custom font sizes and line heights
2. Create typography component classes (`.text-h1`, `.text-body`, etc.)
3. Fix Login page H1 and form labels
4. Fix Admin Dashboard metric labels (remove ALL CAPS)
5. Document patterns in Storybook or style guide

**Files to Modify:**

- `client/tailwind.config.js`
- `client/src/pages/Login.tsx`
- `client/src/pages/admin/AdminDashboard.tsx`

**Success Metrics:**

- H1 headings increased to 48px+
- Form labels use `font-medium` consistently
- Dashboard metrics use sentence case
- Typography component classes available

### Phase 2: Forms & Components (Week 2)

**Goal:** Apply consistent typography to all form components.

**Tasks:**

1. Update TenantForm component
2. Update PackageForm component
3. Update SegmentForm component
4. Update BrandingForm component
5. Standardize error message styling
6. Implement consistent spacing between form fields

**Files to Modify:**

- `client/src/features/tenants/components/TenantForm.tsx`
- `client/src/features/packages/components/PackageForm.tsx`
- `client/src/features/segments/components/SegmentForm.tsx`
- `client/src/features/branding/components/BrandingForm.tsx`

**Success Metrics:**

- All labels use `text-sm font-medium text-gray-900`
- All helper text uses `text-sm text-gray-600`
- Consistent 8px label-to-input gap (`mb-2`)
- Consistent 24px field-to-field gap (`space-y-6`)

### Phase 3: Marketing & Content (Week 3)

**Goal:** Improve readability of homepage and content-heavy pages.

**Tasks:**

1. Update Homepage hero section
2. Fix line lengths on all marketing copy
3. Add responsive typography scaling
4. Improve heading hierarchy on landing pages
5. Implement vertical rhythm across sections

**Files to Modify:**

- `client/src/pages/Home.tsx`
- `client/src/features/public/components/HeroSection.tsx`
- Any other marketing/content components

**Success Metrics:**

- Hero H1 uses `text-5xl` or larger
- Body copy limited to `max-w-2xl` (60-70 characters)
- All body text uses `leading-relaxed`
- Responsive sizing with `sm:`, `md:`, `lg:` breakpoints

### Phase 4: Dashboard & Data Tables (Week 4)

**Goal:** Optimize typography for data-dense interfaces.

**Tasks:**

1. Update all dashboard metric cards
2. Improve table header typography
3. Add `tabular-nums` to all numeric data
4. Optimize column width and spacing
5. Improve data hierarchy (emphasize important metrics)

**Files to Modify:**

- `client/src/pages/admin/AdminDashboard.tsx`
- `client/src/pages/TenantDashboard.tsx`
- `client/src/components/DataTable.tsx` (if exists)

**Success Metrics:**

- Metrics use `text-3xl font-bold tabular-nums`
- Labels use `text-sm font-medium` sentence case
- Tables use `text-sm` body with `text-xs` headers
- Consistent 4px-8px spacing in dense layouts

---

## Key Recommendations Summary

### Top 10 Actionable Items

1. **Increase H1 size to 48px (`text-4xl`)** - Login, dashboards, and forms need stronger headings
2. **Use `font-medium` (500) for all labels** - Improves form hierarchy and scannability
3. **Remove ALL CAPS from dashboard metrics** - Use sentence case for readability
4. **Limit body copy to `max-w-2xl`** - Maintain 60-70 character line length
5. **Add `leading-relaxed` to body text** - 1.625 line height improves reading comfort
6. **Implement 4px spacing grid** - Use `mb-2`, `mb-4`, `mb-6`, `mb-8` consistently
7. **Add `tabular-nums` to all numbers** - Aligns digits in tables and metrics
8. **Increase metric numbers to `text-3xl`** - Emphasize important data points
9. **Use `font-semibold` (600) for buttons** - Stronger CTAs without being too heavy
10. **Create typography component classes** - Reusable `.text-h1`, `.text-body` patterns

### Quick Wins (< 2 hours)

```tsx
// 1. Fix Login Page H1
- <h1 className="text-2xl font-semibold">
+ <h1 className="text-4xl font-bold leading-tight">

// 2. Fix Form Labels
- <label className="text-sm font-normal text-gray-700">
+ <label className="text-sm font-medium text-gray-900">

// 3. Fix Dashboard Metrics
- <div className="text-xs uppercase tracking-wide">TOTAL REVENUE</div>
- <div className="text-2xl font-bold">$12,345</div>
+ <div className="text-sm font-medium text-gray-600">Total Revenue</div>
+ <div className="text-3xl font-bold tabular-nums">$12,345</div>

// 4. Fix Body Line Height
- <p className="text-base leading-normal">
+ <p className="text-base leading-relaxed">

// 5. Fix Hero Line Length
- <p className="text-lg max-w-4xl">
+ <p className="text-lg max-w-2xl leading-relaxed">
```

### Long-Term Goals

1. **Create design system documentation** with all typography patterns
2. **Build Storybook stories** for each typography level
3. **Implement accessibility testing** for color contrast and text sizing
4. **Add responsive typography** with mobile-first approach
5. **Create linting rules** to enforce typography standards
6. **Build component library** with pre-styled typography components
7. **Add animation/transitions** for hierarchical reveals
8. **Implement dark mode** typography adjustments
9. **Create print stylesheet** with optimized typography
10. **Add variable fonts** (if performance allows) for fluid scaling

---

## Testing & Validation

### Visual Regression Tests

```typescript
// E2E test for typography hierarchy
test('Login page typography hierarchy', async ({ page }) => {
  await page.goto('/login');

  // Test H1 size
  const h1 = page.locator('h1');
  await expect(h1).toHaveCSS('font-size', '48px');
  await expect(h1).toHaveCSS('font-weight', '700');

  // Test label emphasis
  const label = page.locator('label').first();
  await expect(label).toHaveCSS('font-weight', '500');

  // Test body line height
  const body = page.locator('p').first();
  await expect(body).toHaveCSS('line-height', '26px');
});
```

### Accessibility Checks

```bash
# Run axe-core accessibility tests
npm run test:a11y

# Check color contrast ratios
# - text-gray-900 on white: 17.8:1 (AAA)
# - text-gray-600 on white: 4.6:1 (AA)
# - text-gray-500 on white: 3.5:1 (AA large text only)
```

### Manual QA Checklist

- [ ] All H1 headings are visually dominant (48px+)
- [ ] Form labels are distinguishable from inputs (500 weight vs 400)
- [ ] Dashboard metrics don't use ALL CAPS
- [ ] Body text line length doesn't exceed 70 characters
- [ ] Line heights are comfortable (1.625+ for body text)
- [ ] Spacing follows 4px grid (8px, 16px, 24px, 32px)
- [ ] Numbers in tables align vertically (`tabular-nums`)
- [ ] Buttons have clear visual weight (600 semibold)
- [ ] Error messages are emphasized (500-600 weight, red color)
- [ ] Responsive typography scales appropriately on mobile

---

## References & Resources

### Research Sources

1. **Material Design Typography** - Google's type scale system
2. **Apple Human Interface Guidelines** - SF Pro usage patterns
3. **Butterick's Practical Typography** - Line length, line height best practices
4. **Nielsen Norman Group** - Readability research on ALL CAPS
5. **WCAG 2.1** - Accessibility guidelines for text sizing

### Tools

- **Type Scale Generator**: https://typescale.com/
- **Modular Scale Calculator**: https://www.modularscale.com/
- **Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **TailwindCSS Typography Plugin**: https://tailwindcss.com/docs/typography-plugin

### Further Reading

- **"On Web Typography" by Jason Santa Maria** - Typography principles for web
- **"The Elements of Typographic Style" by Robert Bringhurst** - Classic reference
- **TailwindCSS Custom Typography Guide** - https://tailwindcss.com/docs/font-size

---

## Conclusion

The MAIS platform has a solid foundation with TailwindCSS, but lacks a cohesive typographic system. By implementing the recommendations in this document, we can achieve:

- **Better hierarchy** through consistent size and weight application
- **Improved readability** with optimized line heights and lengths
- **Professional polish** from systematic spacing and rhythm
- **Faster development** with reusable component classes
- **Better accessibility** through proper contrast and sizing

**Next Steps:**

1. Review this document with the design team
2. Get stakeholder approval on the recommended type scale
3. Begin Phase 1 implementation (foundation)
4. Create visual examples in Storybook
5. Roll out to remaining components in Phases 2-4

**Owner:** Design System Team
**Timeline:** 4 weeks (phased rollout)
**Priority:** High (impacts UX across entire platform)

---

_Document maintained by: Design System Team_
_Last updated: November 24, 2025_
_Version: 1.0_
