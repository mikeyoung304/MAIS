# P3: Native confirm() Dialog Doesn't Match Dark Theme

## Status

- **Priority:** P3 (Low - UX)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer, Architecture Strategist

## Problem

The deactivate tenant action uses native `confirm()` which:

- Blocks the main thread
- Doesn't match the dark theme UI
- May have accessibility issues with screen readers

**File:** `apps/web/src/app/(protected)/admin/tenants/[id]/EditTenantForm.tsx` (line 73)

```typescript
if (!confirm('Are you sure you want to deactivate this tenant?...')) {
  return;
}
```

## Impact

Low - functional but inconsistent with the polished UI elsewhere.

## Solution

Use a proper modal/dialog component:

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, ... } from '@/components/ui/alert-dialog';

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Deactivate</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Deactivate Tenant?</AlertDialogTitle>
      <AlertDialogDescription>
        This will immediately disable their site...
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDeactivate}>
        Deactivate
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Tags

`ux`, `accessibility`, `dialog`
