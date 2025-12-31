# P0: Undefined `text-sage-dark` Token in Billing Page

## Status

- **Priority:** P0 (Critical - Blocks Merge)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Frontend Design Reviewer

## Problem

The billing page uses `text-sage-dark` which is not defined in tailwind.config.js:

**File:** `apps/web/src/app/(protected)/tenant/billing/page.tsx:208`

```tsx
<p className="text-sage-dark">
```

**Available sage tokens in tailwind.config.js:**

- `sage` (#45B37F)
- `sage-hover` (#5CC98F)
- `sage-light` (#6BC495)
- `sage-text` (#45B37F)

**NOT defined:**

- `sage-dark` ❌

## Impact

Text will render with no color or fall back to default, causing visual regression on the billing page.

## Solution

Replace `text-sage-dark` with `text-sage` (the standard sage token):

```tsx
// Before
<p className="text-sage-dark">

// After
<p className="text-sage">
```

## Verification

```bash
# Verify fix
grep -r "sage-dark" apps/web/src/
# Should return 0 results after fix
```

## Tags

`ui`, `dark-mode`, `billing`, `blocking`
