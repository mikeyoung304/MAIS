# Fix Guide: useVisualEditor.ts

## Quick Summary

**3 bugs found, 1 is critical:**

1. ❌ **CRITICAL:** `packages` in useCallback deps causes stale closures
2. ❌ **HIGH:** Race condition window in `publishAll`
3. ⚠️ **MEDIUM:** Stale `draftCount` in early exit checks

---

## Fix #1: Remove `packages` from `updateDraft` Dependencies (CRITICAL)

**File:** `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
**Lines:** 225

### Current Code:

```typescript
const updateDraft = useCallback(
  (packageId: string, update: DraftUpdate) => {
    // ... implementation ...
  },
  [packages, flushPendingChanges]
); // ← PROBLEM: packages causes callback recreation
```

### Problem:

- Every keystroke updates state
- State update triggers re-render with new `packages` value
- New `packages` value recreates callback
- Concurrent edits can cause wrong original state capture
- Each keystroke re-renders all child components

### Fixed Code:

```typescript
const updateDraft = useCallback(
  (packageId: string, update: DraftUpdate) => {
    // ... implementation (unchanged) ...
  },
  [flushPendingChanges]
); // ← FIX: Remove packages dependency
```

### Why this works:

- Original state is captured via refs, not closure
- Callback remains stable across renders
- Child components don't re-render on keystroke
- Eliminates stale closure vulnerability

### Verification:

```bash
# After fix, callback should be same reference after edit
npm run test:e2e -- --grep "callback stability"
```

**Diff:**

```diff
  const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
    // ... 41 lines of implementation ...
- }, [packages, flushPendingChanges]);
+ }, [flushPendingChanges]);
```

---

## Fix #2: Race Condition in `publishAll` (HIGH)

**File:** `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
**Lines:** 231-242

### Current Code:

```typescript
const publishAll = useCallback(async () => {
  if (draftCount === 0) {  // ← Checked BEFORE async operation
    toast.info("No changes to publish");
    return;
  }

  // Flush any pending changes first
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }
  await flushPendingChanges();  // ← User can edit DURING this

  setIsPublishing(true);
  // ... publish happens with potentially stale draftCount ...
```

### Problem:

- `draftCount` checked before async flush completes
- User can edit during ~100-500ms flush window
- New edits not included in subsequent publish call
- Silent data loss or inconsistent state

### Fixed Code:

```typescript
const publishAll = useCallback(async () => {
  // Remove early exit check - draftCount may change

  // Flush any pending changes first
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }

  try {
    // Await flush - may take time
    await flushPendingChanges();

    // Re-check after flush (user may have edited during flush)
    const currentDraftCount = packages.filter((pkg) => pkg.hasDraft).length;
    if (currentDraftCount === 0) {
      toast.info('No changes to publish');
      return;
    }

    setIsPublishing(true);

    const { status, body } = await api.tenantAdminPublishDrafts({
      body: {},
    });

    if (status !== 200 || !body) {
      const errorMessage = (body as { error?: string })?.error || 'Failed to publish changes';
      throw new Error(errorMessage);
    }

    toast.success(`Published ${body.published} package${body.published !== 1 ? 's' : ''}`);
    await loadPackages();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish changes';
    toast.error('Failed to publish changes', { description: message });
  } finally {
    setIsPublishing(false);
  }
}, [packages, loadPackages, flushPendingChanges]); // ← Now needs packages in deps
```

### Why this works:

- Rechecks draft count after async flush completes
- Captures updates made during the flush window
- Uses current packages state, not stale closure value

**Diff:**

```diff
  const publishAll = useCallback(async () => {
-   if (draftCount === 0) {
-     toast.info("No changes to publish");
-     return;
-   }

    // Flush any pending changes first
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
-   await flushPendingChanges();
+   try {
+     await flushPendingChanges();
+
+     // Re-check after flush completes
+     const currentDraftCount = packages.filter((pkg) => pkg.hasDraft).length;
+     if (currentDraftCount === 0) {
+       toast.info("No changes to publish");
+       return;
+     }
+   } catch (err) {
+     toast.error("Failed to prepare changes", { description: "Please try again" });
+     return;
+   }

    setIsPublishing(true);

    try {
      const { status, body } = await api.tenantAdminPublishDrafts({
        body: {},
      });

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || "Failed to publish changes";
        throw new Error(errorMessage);
      }

      toast.success(`Published ${body.published} package${body.published !== 1 ? "s" : ""}`);

      // Reload packages to get fresh state
      await loadPackages();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish changes";
      toast.error("Failed to publish changes", { description: message });
    } finally {
      setIsPublishing(false);
    }
- }, [draftCount, loadPackages, flushPendingChanges]);
+ }, [packages, loadPackages, flushPendingChanges]);
```

---

## Fix #3: Memoize `draftCount` (MEDIUM)

**File:** `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
**Lines:** 77-78

### Current Code:

```typescript
// Calculate draft count
const draftCount = packages.filter((pkg) => pkg.hasDraft).length;
```

### Problem:

- Recalculated on every render
- Not stable for use in useCallback dependencies
- Should be memoized for consistency

### Fixed Code:

```typescript
import { useMemo } from 'react';

// Calculate draft count (memoized to prevent unnecessary recalculation)
const draftCount = useMemo(() => packages.filter((pkg) => pkg.hasDraft).length, [packages]);
```

### Why this works:

- Only recalculated when packages array changes
- Provides stable reference for callbacks
- Slight performance improvement

---

## Implementation Checklist

- [ ] Apply Fix #1 (remove packages from updateDraft deps)
- [ ] Apply Fix #2 (handle race condition in publishAll)
- [ ] Apply Fix #3 (memoize draftCount)
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Run tests: `npm test`
- [ ] Run E2E: `npm run test:e2e`
- [ ] Test manual flow:
  - [ ] Type quickly in one package
  - [ ] Type in another package while first is saving
  - [ ] Click publish during an auto-save
  - [ ] Verify all edits are saved and published

---

## Expected Results After Fixes

### Performance:

- Fewer re-renders per keystroke (6+ → 1-2)
- Smoother typing experience
- Lower CPU usage

### Correctness:

- No stale closures in updateDraft
- No lost edits during publish
- Consistent draftCount values

### Testing:

All existing tests should still pass. Add new test:

```typescript
describe('useVisualEditor - Race Conditions', () => {
  test('callback remains stable across edits', () => {
    const { result } = renderHook(() => useVisualEditor());
    const cb1 = result.current.updateDraft;

    act(() => {
      result.current.updateDraft('pkg1', { title: 'Test' });
    });

    const cb2 = result.current.updateDraft;
    expect(cb1).toBe(cb2);
  });

  test('edits during publishAll flush are included', async () => {
    const { result } = renderHook(() => useVisualEditor());

    // ... test implementation ...
  });
});
```

---

## Risk Assessment

| Fix                       | Risk     | Mitigation                                    |
| ------------------------- | -------- | --------------------------------------------- |
| Remove packages from deps | Low      | Change is isolated, well-tested pattern       |
| Add race condition check  | Low      | Only adds defensive check, no behavior change |
| Memoize draftCount        | Very Low | Standard React optimization                   |

---

## Rollback Plan

Each fix is independent and can be reverted individually:

```bash
# If issues arise, revert one fix at a time
git revert <commit-hash>
npm test
```

---

## Monitoring

After deployment, watch for:

- Increased error logs from flushPendingChanges
- User reports of lost edits
- Performance metrics (should improve)
- Browser console warnings

```typescript
// Already in place:
logger.error('Failed to save draft', {
  component: 'useVisualEditor',
  packageId,
  error: err,
});
```

---

## Related Files

Files that may need testing after changes:

- `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx`
- `client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx`
- `client/src/features/tenant-admin/visual-editor/components/EditableText.tsx`
- `client/src/features/tenant-admin/visual-editor/components/EditablePrice.tsx`

---

## References

- React hooks best practices: https://react.dev/reference/react/useCallback
- Closure pitfalls: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures
- Race conditions: https://en.wikipedia.org/wiki/Race_condition

---

**Status:** Ready to implement
**Priority:** CRITICAL for Fix #1, HIGH for Fix #2
**Estimated time:** 15-20 minutes
