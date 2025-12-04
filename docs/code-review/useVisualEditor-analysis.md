# Code Review: useVisualEditor.ts - React Patterns & Potential Bugs

**File:** `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
**Lines:** 347 (complete hook implementation)
**Status:** ✅ Good patterns overall with **ONE critical stale closure issue**

## Summary

The hook demonstrates solid React patterns with proper dependency injection, cleanup, and error handling. However, there is a **critical stale closure vulnerability** in the `updateDraft` callback that could cause concurrent updates to race. The implementation uses refs correctly for debouncing and request batching, but the memoization strategy is flawed.

---

## Critical Issues

### 1. ❌ CRITICAL: Stale Closure in `updateDraft` (Line 184-225)

**Severity:** HIGH - Can cause race conditions and incorrect optimistic updates

**Problem:**

```typescript
const updateDraft = useCallback(
  (packageId: string, update: DraftUpdate) => {
    // ...
    // Capture original state BEFORE first change for this package
    if (!originalStates.current.has(packageId)) {
      const original = packages.find((pkg) => pkg.id === packageId); // ⚠️ STALE CLOSURE
      if (original) {
        originalStates.current.set(packageId, original);
      }
    }
    // ...
  },
  [packages, flushPendingChanges]
); // Line 225
```

**Why this is problematic:**

- The dependency array includes `packages`, but `packages` is derived from state that gets updated by this same callback
- When `setPackages()` is called on line 204, it triggers a re-render
- This re-render causes `packages` to change, which creates a NEW version of `updateDraft`
- If a user rapidly edits Package A, then Package B, the closure for Package B might capture a stale `packages` array
- Example scenario:
  ```
  1. Initial: packages = [PkgA(v1), PkgB(v1)]
  2. User edits PkgA → setPackages([PkgA(v2), PkgB(v1)])
  3. New `updateDraft` created with updated packages
  4. User edits PkgB → tries to find original state from updated packages
  5. Concurrent saves could try to rollback PkgB to wrong version
  ```

**Root Cause:**
The hook captures `packages` in the closure at line 193, but this value changes on every optimistic update. This means:

- Every keystroke creates a new callback function
- If there are pending changes while a new keystroke arrives, the timing is non-deterministic
- The original state capture is unreliable if done during rapid edits

**Correct Fix:**
Don't depend on `packages` for capturing original state. Use only the ref-based approach:

```typescript
const updateDraft = useCallback(
  (packageId: string, update: DraftUpdate) => {
    // ... existing code ...

    // Capture original state BEFORE first change for this package
    if (!originalStates.current.has(packageId)) {
      // Instead: reconstruct from refs if needed, OR
      // Better: compute original from current packages AT SAVE TIME, not here
      // This avoids closure over packages entirely
    }

    // ... rest of code ...
  },
  [flushPendingChanges]
); // Remove `packages` from deps!
```

**Why this works:**

- `flushPendingChanges` is already memoized (line 173) and stable
- Original state is captured in refs, which are always fresh
- The callback itself becomes stable (not recreated on each render)
- This prevents unnecessary re-renders of `EditablePackageCard`

---

### 2. ⚠️ MODERATE: Race Condition in `publishAll` (Line 231-266)

**Severity:** MEDIUM - Can cause user confusion and redundant requests

**Problem:**

```typescript
const publishAll = useCallback(async () => {
  if (draftCount === 0) {
    toast.info("No changes to publish");
    return;
  }

  // Flush any pending changes first
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }
  await flushPendingChanges();  // ⚠️ Async operation

  setIsPublishing(true);

  try {
    const { status, body } = await api.tenantAdminPublishDrafts({
      body: {},
    });
    // ...
  }
}, [draftCount, loadPackages, flushPendingChanges]);
```

**Why this is problematic:**

- `flushPendingChanges` is async, but `draftCount` check happens BEFORE awaiting
- Between `flushPendingChanges()` call and the actual API call, a user could trigger another `updateDraft`
- This new update could be missed if it arrives during the publish request
- Timing window: ~100-500ms typically (network latency for flushPendingChanges)

**Scenario:**

```
1. User edits Package A (updateDraft called)
2. User clicks Publish
3. publishAll awaits flushPendingChanges() - sends Package A
4. While waiting for response, user edits Package B
5. flushPendingChanges returns, saveTimeout was cleared
6. publishAll sends publishDrafts() - Package B is NOT in drafts yet
7. Package B update fails silently (pending changes lost)
```

**Root Cause:**
The race window between clearing `saveTimeout` and the completion of the async flush operation.

---

## Design Pattern Issues

### 3. ⚠️ MODERATE: Dependency Array Anti-Pattern (Line 225)

**Current:**

```typescript
const updateDraft = useCallback(
  (packageId: string, update: DraftUpdate) => {
    // ...
  },
  [packages, flushPendingChanges]
);
```

**Problem:**

- Including `packages` in deps causes the callback to be recreated on EVERY state update
- This means `EditablePackageCard` gets a new `onUpdate` prop on every keystroke
- Even though `EditablePackageCard` uses `useCallback`, the dep reference itself changes
- This defeats memoization and causes unnecessary re-renders

**Impact:**

- Performance: O(n) re-renders where n = number of packages
- Potential parent re-renders if using `React.memo` on components receiving this callback
- Cache invalidation in TanStack Query if used

---

## Minor Issues

### 4. ⚠️ MINOR: Stale `draftCount` in Callbacks (Lines 231, 273)

**Code:**

```typescript
const publishAll = useCallback(async () => {
  if (draftCount === 0) {
    // ⚠️ Captured at definition time
    toast.info('No changes to publish');
    return;
  }
  // ...
}, [draftCount, loadPackages, flushPendingChanges]);

const discardAll = useCallback(async () => {
  if (draftCount === 0) {
    // ⚠️ Captured at definition time
    toast.info('No changes to discard');
    return;
  }
  // ...
}, [draftCount, loadPackages]);
```

**Problem:**

- `draftCount` is computed fresh on every render (line 78), not memoized
- If a user calls `publishAll` twice rapidly, the second call might have stale `draftCount`
- The UI buttons are properly disabled (`disabled={draftCount === 0}`) but the closure value might differ

**Risk Level:** Low - UI buttons prevent clicking, but defensive programming suggests using a ref or computing from `packages.length` inside the callback

---

## Positive Patterns

### ✅ Excellent: Ref-Based Batching Strategy (Lines 68-75)

```typescript
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const pendingChanges = useRef<Map<string, DraftUpdate>>(new Map());
const originalStates = useRef<Map<string, PackageWithDraft>>(new Map());
const saveInProgress = useRef<boolean>(false);
```

**Why this works:**

- Refs don't cause re-renders
- Map structure allows merging updates for the same package
- Single `saveTimeout` prevents multiple concurrent saves
- `saveInProgress` flag gates multiple flushes

**Good aspects:**

- Atomic capture and clear (lines 118-121)
- Early exit if already saving (line 113)
- Clear separation of concerns between optimistic and server updates

---

### ✅ Good: Cleanup Effect (Lines 316-326)

```typescript
useEffect(() => {
  return () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    pendingChanges.current.clear();
    originalStates.current.clear();
  };
}, []);
```

**Why this is correct:**

- Empty dependency array = runs only on mount/unmount ✓
- Clears timeout to prevent memory leaks ✓
- Clears refs to prevent holding stale data ✓
- Doesn't try to flush pending changes (correct - component is unmounting) ✓

---

### ✅ Good: Error Handling & Rollback (Lines 145-160)

```typescript
catch (err) {
  logger.error("Failed to save draft", {
    component: "useVisualEditor",
    packageId,
    error: err,
  });
  failedPackages.push(packageId);

  // Rollback this package to original state
  const original = originalsToRestore.get(packageId);
  if (original) {
    setPackages((prev) =>
      prev.map((pkg) => (pkg.id === packageId ? original : pkg))
    );
  }
}
```

**Strengths:**

- Captures original state before mutation
- Rolls back on error
- Logs with context
- Shows appropriate toast message

---

### ✅ Good: Atomic State Changes (Line 142-144)

```typescript
setPackages((prev) => prev.map((pkg) => (pkg.id === packageId ? body : pkg)));
```

**Why this works:**

- Uses state updater function (not stale closure)
- Creates new array (React batching safety)
- Properly identifies the package to update

---

## Verification: No Issues with `flushPendingChanges` Sequential Processing

The for...of loop with await is correct for this use case:

```typescript
for (const [packageId, mergedUpdate] of changesToSave) {
  try {
    const { status, body } = await api.tenantAdminUpdatePackageDraft({...});
    // ...
  } catch (err) {
    // ...
  }
}
```

**Why sequential is correct:**

- Prevents overlapping requests for the same package ✓
- Allows rollback strategy to work properly ✓
- Preserves error handling context ✓
- User expects sequential saves (last-write-wins semantics) ✓

**Note:** This is intentionally sequential, not concurrent. If concurrency was desired, this would need Promise.all() and different rollback logic.

---

## Component Integration Analysis

### EditablePackageCard Integration (VisualEditorDashboard.tsx:58-63)

```typescript
const handleUpdatePackage = useCallback(
  (packageId: string, update: DraftUpdate) => {
    updateDraft(packageId, update);
  },
  [updateDraft] // ⚠️ Will change on every packages update
);
```

**Impact:**

- Since `updateDraft` changes frequently, `handleUpdatePackage` is recreated frequently
- This is passed to `EditablePackageCard` as `onUpdatePackage` prop
- Even though `EditablePackageCard` has its own callbacks, the prop reference changes
- If `EditablePackageCard` uses `React.memo`, it won't prevent re-renders
- Inside `EditablePackageCard.handleTitleChange`:
  ```typescript
  const handleTitleChange = useCallback(
    (title: string) => {
      onUpdate({ title });
    },
    [onUpdate]
  ); // ← onUpdate is updateDraft indirectly
  ```

---

## Recommendations

### 1. FIX CRITICAL: Remove `packages` from `updateDraft` dependencies

**Current (Line 225):**

```typescript
}, [packages, flushPendingChanges]);
```

**Change to:**

```typescript
}, [flushPendingChanges]);
```

**Justification:**

- Original state is captured in refs before the first change
- `packages` should not be accessed in this callback
- This makes the callback stable across renders
- Prevents closure over stale package data

**Testing:**

```typescript
// Add test to verify callback stability
const callback1 = getCallbackReference();
updateDraft('pkg1', { title: 'New title' });
const callback2 = getCallbackReference();
expect(callback1).toBe(callback2); // Should be same reference
```

---

### 2. FIX MODERATE: Add debouncing before `publishAll` check

**Current (Line 231-242):**

```typescript
const publishAll = useCallback(async () => {
  if (draftCount === 0) {
    toast.info("No changes to publish");
    return;
  }

  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }
  await flushPendingChanges();
  // ...
```

**Change to:**

```typescript
const publishAll = useCallback(async () => {
  // Don't early exit on draftCount - it might change during async

  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }

  // Wait for any pending changes to flush
  await flushPendingChanges();

  // Re-check after flush completes
  if (packages.filter(p => p.hasDraft).length === 0) {
    toast.info("No changes to publish");
    return;
  }

  setIsPublishing(true);
  try {
    // ...
```

**Justification:**

- Accounts for updates arriving during the flush
- Rechecks after async operation completes
- Handles the case where user edits during flush

---

### 3. REFACTOR: Memoize `draftCount`

**Current (Line 78):**

```typescript
const draftCount = packages.filter((pkg) => pkg.hasDraft).length;
```

**Change to:**

```typescript
const draftCount = useMemo(() => packages.filter((pkg) => pkg.hasDraft).length, [packages]);
```

**Justification:**

- Prevents recomputation on every render
- Makes draftCount referentially stable for callbacks
- Needed if using draftCount in useCallback deps

---

### 4. ADD: Defensive check in `updateDraft`

**Add after line 183:**

```typescript
const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
  // Early exit if package not found (race condition protection)
  const package = originalStates.current.has(packageId)
    ? originalStates.current.get(packageId)
    : null;

  if (!package && !pendingChanges.current.has(packageId)) {
    logger.warn("updateDraft called for unknown package", { packageId });
    return; // Silently ignore - package might have been deleted
  }

  // ... rest of existing code ...
```

**Justification:**

- Handles case where package is deleted before save completes
- Prevents errors from accessing non-existent package
- Logs for debugging

---

## Test Coverage Recommendations

### 1. Verify Callback Stability

```typescript
test('updateDraft callback is stable across renders', () => {
  const { result, rerender } = renderHook(() => useVisualEditor());
  const callback1 = result.current.updateDraft;

  // Trigger a state update
  act(() => {
    result.current.updateDraft('pkg1', { title: 'New' });
  });

  rerender();
  const callback2 = result.current.updateDraft;

  expect(callback1).toBe(callback2); // Should be same reference
});
```

### 2. Verify Race Condition Prevention

```typescript
test('publishAll flushes pending changes before publishing', async () => {
  const { result } = renderHook(() => useVisualEditor());

  // Make a draft change
  act(() => {
    result.current.updateDraft('pkg1', { title: 'New' });
  });

  // Call publishAll immediately
  const publishPromise = act(() => result.current.publishAll());

  // Verify flushPendingChanges was called before publish
  await publishPromise;
  expect(flushPendingChanges).toHaveBeenCalledBefore(api.tenantAdminPublishDrafts);
});
```

### 3. Verify Rollback on Error

```typescript
test('rolls back package on save error', async () => {
  api.tenantAdminUpdatePackageDraft.mockRejectedValueOnce(new Error('Network error'));

  const { result } = renderHook(() => useVisualEditor(), {
    initialProps: { packages: [{ id: 'pkg1', title: 'Original' }] },
  });

  act(() => {
    result.current.updateDraft('pkg1', { title: 'Modified' });
  });

  jest.advanceTimersByTime(1000); // Wait for debounce
  await waitFor(() => expect(result.current.isSaving).toBe(false));

  // Should rollback to original
  expect(result.current.packages[0].title).toBe('Original');
});
```

---

## Summary Table

| Issue                              | Severity | Type    | Location      | Status       |
| ---------------------------------- | -------- | ------- | ------------- | ------------ |
| Stale closure in updateDraft       | HIGH     | Bug     | Line 225      | ❌ NEEDS FIX |
| Race condition in publishAll       | MEDIUM   | Bug     | Line 231-242  | ❌ NEEDS FIX |
| Dependency array includes packages | MEDIUM   | Pattern | Line 225      | ⚠️ REFACTOR  |
| Stale draftCount in callbacks      | LOW      | Pattern | Line 231, 273 | ⚠️ OPTIONAL  |
| Cleanup effect                     | -        | Pattern | Line 316-326  | ✅ GOOD      |
| Error handling & rollback          | -        | Pattern | Line 145-160  | ✅ GOOD      |
| Sequential save processing         | -        | Pattern | Line 129-161  | ✅ GOOD      |
| Ref-based batching                 | -        | Pattern | Line 68-75    | ✅ GOOD      |

---

## Priority Action Items

1. **CRITICAL (fix immediately):** Remove `packages` from `updateDraft` dependencies
2. **HIGH (fix before merge):** Add race condition handling to `publishAll`
3. **MEDIUM (fix in next iteration):** Add defensive checks in `updateDraft`
4. **LOW (nice to have):** Add test coverage for race conditions
