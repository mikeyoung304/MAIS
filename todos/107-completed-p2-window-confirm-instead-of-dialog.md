---
status: completed
priority: p2
issue_id: "107"
tags: [code-review, ux, accessibility, ui-redesign]
dependencies: []
completed_date: 2025-12-02
---

# window.confirm() Used Instead of Confirmation Dialog

## Problem Statement

`usePackageManager` uses native `window.confirm()` while `BlackoutsManager` properly uses a styled `DeleteConfirmationDialog` component. Inconsistent UX and accessibility.

**Why it matters:** Native confirm is not accessible (no ARIA), cannot be styled, no "cannot undo" warnings.

## Findings

### From architecture-strategist agent:

**File:** `client/src/features/tenant-admin/packages/hooks/usePackageManager.ts`
**Line:** 42

```typescript
const handleDelete = async (packageId: string) => {
  if (!window.confirm("Are you sure you want to delete this package?")) {
    return;
  }
  // Delete logic
}
```

**Good pattern exists at:** BlackoutsManager DeleteConfirmationDialog

## Implemented Solution

### Approach: Enhanced useUnsavedChanges Hook
Rather than replacing individual `window.confirm` calls (which were already using `useConfirmDialog` for delete actions), the primary issue was in the `useUnsavedChanges` hook used for navigation blocking.

**Implementation:**
1. Enhanced `useUnsavedChanges` hook to accept optional `confirmFn` parameter
2. Updated all three consumers to use `ConfirmDialog` component
3. Maintained backwards compatibility with fallback to `window.confirm`

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/client/src/hooks/useUnsavedChanges.ts`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/PackageForm.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/packages/PackageForm/index.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/BlackoutsManager/index.tsx`

**Pattern:**
```typescript
const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

useUnsavedChanges({
  isDirty,
  message: "You have unsaved changes. Are you sure you want to leave?",
  enabled: true,
  confirmFn: (msg) => confirm({
    title: "Unsaved Changes",
    description: msg,
    confirmLabel: "Leave",
    cancelLabel: "Stay",
    variant: "destructive"
  })
});
```

## Acceptance Criteria

- [x] No `window.confirm` in user-facing components (only backwards-compatible fallback)
- [x] Consistent confirmation dialog across all forms
- [x] Dialog is keyboard accessible (Radix UI AlertDialog)
- [x] Screen reader announces dialog properly (ARIA labels from Radix)
- [x] TypeScript compilation passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | UX inconsistency found |
| 2025-12-02 | Resolved | Enhanced hook pattern better than per-component solution |
