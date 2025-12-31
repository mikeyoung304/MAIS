# P2: UI Components - Macon Colors (Shared Components)

## Status

- **Priority:** P2 (Medium - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

Several shared UI components use legacy Macon brand colors. These components are used across both light and dark themes.

**Files and usages:**

### input.tsx (lines 26-28)

```tsx
'hover:border-macon-navy/40',
'focus:border-macon-orange focus:shadow-elevation-2',
'focus-visible:ring-4 focus-visible:ring-macon-orange/30',
```

### input-enhanced.tsx (lines 100-102, 134)

```tsx
('hover:border-macon-navy/40',
  'focus:border-macon-orange focus:shadow-lg',
  'focus-visible:ring-4 focus-visible:ring-macon-orange/30',
  'text-macon-navy'); // floating label
```

### button.tsx (lines 11, 30-32, 43-44, 48)

```tsx
'focus-visible:ring-4 focus-visible:ring-macon-navy/30',
// outline variant
'border-macon-navy/20 text-macon-navy hover:from-macon-navy/5...',
// ghost variant
'text-macon-navy hover:text-macon-navy-dark',
// link variant
'text-macon-orange hover:text-macon-orange-dark',
```

### badge.tsx (line 12)

```tsx
default: 'bg-macon-navy text-white hover:bg-macon-navy/80',
```

### card.tsx (lines 28, 34, 40, 44-46, 50-52)

```tsx
// Multiple colorScheme variants use macon-navy, macon-orange, macon-teal
navy: 'border-macon-navy-dark',
orange: 'border-macon-orange-dark',
teal: 'border-macon-teal-dark',
// Gradient variants
'from-macon-navy to-macon-navy-dark',
'from-macon-teal to-macon-teal-dark',
```

### stepper.tsx (lines 66, 89)

```tsx
isCurrent && 'bg-macon-orange border-macon-orange',
isCurrent && 'text-macon-orange',
```

### star-rating.tsx (line 8)

```tsx
className={`flex gap-1 text-macon-orange ${className}`}
```

## Impact

These are foundational UI components. Changing them affects the entire application. Need careful migration strategy.

## Solution Strategy

### Phase 1: Light Theme Components (Storefronts)

For components primarily used in light theme contexts:

- Replace `macon-orange` with `sage` (primary accent)
- Replace `macon-navy` with `neutral-800` or `text-primary`

### Phase 2: Dark Theme Compatibility

Add theme-aware variants or use CSS custom properties:

```tsx
// Example: theme-aware focus ring
'focus-visible:ring-sage/30 dark:focus-visible:ring-sage/30';
```

### Recommended Replacements:

| Old            | Light Theme   | Dark Theme     |
| -------------- | ------------- | -------------- |
| `macon-orange` | `sage`        | `sage`         |
| `macon-navy`   | `neutral-800` | `text-primary` |
| `macon-teal`   | `sage-light`  | `sage`         |

## Complexity

**High** - These components are used throughout the app. Recommend:

1. Create a migration plan
2. Test each component in both light and dark contexts
3. Consider deprecating unused Card colorScheme variants

## Tags

`ui`, `branding`, `components`, `migration`
