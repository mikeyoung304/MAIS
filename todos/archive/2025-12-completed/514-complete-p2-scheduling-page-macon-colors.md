# P2: Scheduling Page - Macon Colors (Dark Theme)

## Status

- **Priority:** P2 (Medium - Brand Consistency)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** Extended code review - grep for macon-\*

## Problem

The tenant scheduling page uses `macon-orange` for blackout date indicators instead of the established amber warning pattern.

**File:** `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`

**Lines:** 140-141, 225-226, 244-245

```tsx
// Blackout indicator card
<div className="rounded-xl bg-macon-orange/10 p-3">
  <CalendarX className="h-6 w-6 text-macon-orange" />

// Empty state
<div className="mb-4 rounded-full bg-macon-orange/10 p-4">
  <CalendarX className="h-8 w-8 text-macon-orange" />

// List item
<div className="rounded-lg bg-macon-orange/10 p-2">
  <CalendarX className="h-5 w-5 text-macon-orange" />
```

## Impact

Inconsistent with the amber warning pattern used elsewhere in the dark theme (e.g., dashboard "Setup Required" card).

## Solution

Replace with amber pattern for dark theme warnings:

```tsx
// Before
bg-macon-orange/10 text-macon-orange

// After
bg-amber-950/30 text-amber-400
```

## Verification

```bash
grep -r "macon-" apps/web/src/app/\(protected\)/tenant/scheduling/
```

## Tags

`ui`, `branding`, `dark-theme`, `scheduling`
