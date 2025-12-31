# P2: DateBookingWizard - Macon Colors

## Status

- **Priority:** P2 (Medium - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

The DateBookingWizard component (customer-facing booking flow) uses hardcoded Macon orange colors.

**File:** `apps/web/src/components/booking/DateBookingWizard.tsx`

**Lines and usages:**

```tsx
// Line 73 - React Day Picker styling
backgroundColor: '#F97316', // macon-orange (hardcoded hex!)

// Line 109 - Price display
<p className="text-3xl font-bold text-macon-orange mt-2">

// Line 146 - Calendar icon
<Calendar className="inline-block w-6 h-6 mr-2 text-macon-orange" />

// Line 155 - Loading spinner
<Loader2 className="w-8 h-8 text-macon-orange animate-spin" />

// Line 246 - Textarea focus
focus:border-macon-orange focus:ring-macon-orange/30

// Line 301 - Final price
<span className="text-3xl font-bold text-macon-orange">
```

## Impact

Customer-facing booking wizard shows legacy branding. The hardcoded hex color `#F97316` is particularly problematic as it won't respond to theme changes.

## Solution

Replace with HANDLED sage palette:

```tsx
// Hardcoded hex → CSS variable or Tailwind token
backgroundColor: '#F97316' → Use CSS variable or Tailwind class

// Class replacements
text-macon-orange → text-sage
focus:border-macon-orange → focus:border-sage
focus:ring-macon-orange/30 → focus:ring-sage/30
```

**For the hardcoded hex color (line 73):**
Option A: Use Tailwind theme value

```tsx
import resolveConfig from 'tailwindcss/resolveConfig';
const config = resolveConfig(tailwindConfig);
const sageColor = config.theme.colors.sage;
```

Option B: Use CSS variable

```tsx
backgroundColor: 'var(--sage)',
```

## Tags

`ui`, `branding`, `storefront`, `booking`
