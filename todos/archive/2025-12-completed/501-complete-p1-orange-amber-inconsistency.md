# P1: Orange vs Amber Inconsistency in ImpersonationBanner

## Status

- **Priority:** P1 (High)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Frontend Design Reviewer

## Problem

The ImpersonationBanner uses `orange` tokens instead of the established `amber` warning pattern used elsewhere in the codebase.

**File:** `apps/web/src/components/layouts/ImpersonationBanner.tsx`

```tsx
// Current (inconsistent)
className = 'bg-orange-950/50 border-b border-orange-800';
className = 'text-orange-400';
className = 'border-orange-700 text-orange-400 hover:bg-orange-950/50';
```

**Established amber pattern (from theme.ts and other components):**

```tsx
className = 'bg-amber-950/50 border-b border-amber-800';
className = 'text-amber-400';
className = 'border-amber-700 text-amber-400 hover:bg-amber-950/50';
```

## Impact

Visual inconsistency between warning states across the application. Impersonation banner looks different from other warning UI elements.

## Solution

Replace all `orange-*` tokens with `amber-*` in ImpersonationBanner.tsx:

- `orange-950/50` → `amber-950/50`
- `orange-800` → `amber-800`
- `orange-700` → `amber-700`
- `orange-400` → `amber-400`

## Tags

`ui`, `dark-mode`, `consistency`, `warning-states`
