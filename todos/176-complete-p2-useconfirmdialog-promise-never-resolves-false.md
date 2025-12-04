---
status: complete
priority: p2
issue_id: '176'
tags: [todo]
dependencies: []
---

# TODO-176: useConfirmDialog Promise Never Resolves False on Cancel

**Priority:** P2 (Code Quality)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Code Simplicity Reviewer)

## Issue

The `useConfirmDialog` hook's `openDialog` function returns a Promise that resolves to `true` on confirm but **never resolves on cancel**. This creates a Promise that hangs forever, leading to:

1. Potential memory leaks (unresolved Promise callbacks stay in memory)
2. Callers expecting `await openDialog()` to return `false` on cancel get stuck
3. Inconsistent API contract

## Location

- `client/src/hooks/useConfirmDialog.tsx`

## Current Behavior

```typescript
const openDialog = useCallback((config: DialogConfig): Promise<boolean> => {
  return new Promise((resolve) => {
    setDialogConfig(config);
    setIsOpen(true);
    resolveRef.current = resolve; // Only set up for resolve(true)
  });
}, []);

const handleConfirm = useCallback(() => {
  setIsOpen(false);
  resolveRef.current?.(true); // Resolves true
  resolveRef.current = null;
}, []);

const handleCancel = useCallback(() => {
  setIsOpen(false);
  // Never calls resolve(false)!
  resolveRef.current = null;
}, []);
```

## Expected Behavior

```typescript
const handleCancel = useCallback(() => {
  setIsOpen(false);
  resolveRef.current?.(false); // Should resolve false on cancel
  resolveRef.current = null;
}, []);
```

## Impact

Any code pattern like:

```typescript
const confirmed = await openDialog({ title: 'Delete?', message: '...' });
if (!confirmed) {
  // This code never runs if user cancels
  console.log('User cancelled');
}
```

## Recommendation

1. Add `resolveRef.current?.(false)` to `handleCancel`
2. Review all usages of `openDialog` to ensure they handle the `false` case correctly
3. Add unit tests for both confirm and cancel scenarios

## Acceptance Criteria

- [ ] `handleCancel` calls `resolveRef.current?.(false)`
- [ ] Unit test verifies Promise resolves `true` on confirm
- [ ] Unit test verifies Promise resolves `false` on cancel
- [ ] All usages of `openDialog` handle both outcomes

## Related

- Commit: 928b6a8 (removed unused variables but missed the core Promise issue)
- TODO-166: Completed removal of unused variables in this hook
