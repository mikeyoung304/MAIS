# P2: Storefront Booking Pages - Macon Colors

## Status

- **Priority:** P2 (Medium - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

The storefront booking pages use legacy `macon-orange` colors instead of the HANDLED brand palette. These are customer-facing pages on light theme.

**Files:**

- `apps/web/src/app/t/_domain/book/success/page.tsx:205`
- `apps/web/src/app/t/_domain/book/[packageSlug]/page.tsx:100,121,144,160`
- `apps/web/src/app/t/[slug]/book/success/page.tsx:207`
- `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx:89,113,138,155`

**Current usage:**

```tsx
// Links
className = 'text-macon-orange hover:underline';

// Primary CTA button
className = 'bg-macon-orange text-white hover:bg-macon-orange/90';

// Back navigation
className = 'text-neutral-600 hover:text-macon-orange';
```

## Impact

Brand identity mixing on customer-facing storefront pages. Visitors see legacy Macon branding instead of HANDLED brand.

## Solution

Replace with HANDLED palette for light theme:

- Primary accent/CTA: `bg-sage text-white hover:bg-sage-hover`
- Link color: `text-sage hover:underline`
- Hover states: `hover:text-sage`

**Replacement mapping:**
| Old | New (Light Theme) |
|-----|-------------------|
| `text-macon-orange` | `text-sage` |
| `bg-macon-orange` | `bg-sage` |
| `hover:bg-macon-orange/90` | `hover:bg-sage-hover` |
| `hover:text-macon-orange` | `hover:text-sage` |

## Verification

```bash
# Verify no macon colors remain in storefront booking
grep -r "macon-" apps/web/src/app/t/
```

## Tags

`ui`, `branding`, `storefront`, `light-theme`
