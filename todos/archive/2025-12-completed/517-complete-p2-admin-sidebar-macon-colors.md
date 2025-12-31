# P2: AdminSidebar Impersonation - Macon Colors

## Status

- **Priority:** P2 (Medium - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

The AdminSidebar component uses Macon orange for the impersonation indicator in the sidebar.

**File:** `apps/web/src/components/layouts/AdminSidebar.tsx`

**Line 191:**

```tsx
<div className="border-b border-macon-orange/20 bg-macon-orange/10 p-3">
  ...
  <p className="text-xs font-medium text-macon-orange">Impersonating</p>
```

## Impact

Inconsistent with the ImpersonationBanner which now uses amber colors (fixed in earlier PR). The sidebar impersonation indicator should match.

## Solution

Replace with amber pattern to match ImpersonationBanner:

```tsx
// Before
border-macon-orange/20 bg-macon-orange/10 text-macon-orange

// After
border-amber-700/30 bg-amber-950/30 text-amber-400
```

## Related

This should match the ImpersonationBanner styling (already fixed to use amber).

## Tags

`ui`, `branding`, `dark-theme`, `sidebar`
