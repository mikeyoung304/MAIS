# P3: Loading Skeletons - Macon Colors

## Status

- **Priority:** P3 (Low - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

The LoadingSkeletons component uses Macon orange for loading spinners.

**File:** `apps/web/src/components/tenant/LoadingSkeletons.tsx`

**Lines 326, 341:**

```tsx
<Loader2 className="mx-auto h-12 w-12 animate-spin text-macon-orange" />
```

## Impact

Minor - loading states briefly show legacy branding before content loads.

## Solution

Replace with sage:

```tsx
// Before
text - macon - orange;

// After
text - sage;
```

## Tags

`ui`, `branding`, `loading-states`
