# P1: Macon Colors in Dark Theme (Brand Mixing)

## Status

- **Priority:** P1 (High)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Frontend Design Reviewer

## Problem

The tenant dashboard still references `macon-*` colors which are the legacy brand palette, creating brand identity mixing with the HANDLED brand.

**File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

```tsx
color: 'text-macon-teal',    // Line 128
color: 'text-macon-orange',  // Line 134
className="border-macon-orange/20 bg-macon-orange/10"  // Line 284
color: stats?.hasStripeConnected ? 'text-green-600' : 'text-macon-orange',  // Line 141
```

## Impact

Brand identity mixing between old Macon brand and new HANDLED brand. The Brand Voice Guide specifies sage as the primary accent color.

## Solution

Replace Macon colors with HANDLED palette:

- `macon-teal` → `sage`
- `macon-orange` → `amber-400` (for warnings) or `text-muted` (for secondary)
- `green-600` → `sage` (for success/connected states)

## Tags

`ui`, `dark-mode`, `branding`, `dashboard`
