# useVisualEditor.ts - Quick Fix Guide

## TL;DR

3 bugs found in `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`:

1. **CRITICAL (Line 225):** Remove `packages` from `updateDraft` useCallback deps
2. **HIGH (Line 231-242):** Add draftCount re-check after `flushPendingChanges`
3. **MEDIUM (Line 78):** Memoize `draftCount` with useMemo

---

## Fix #1: Line 225 (1 line change)

**Current:**

```typescript
}, [packages, flushPendingChanges]);
```

**Change to:**

```typescript
}, [flushPendingChanges]);
```

**Reason:** `packages` in deps causes callback recreation on every keystroke, leading to stale closures.

---

## Fix #2: Lines 231-266 (Restructure function body)

**Current:**

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

  setIsPublishing(true);
  // ... rest of function ...
```

**Change to:**

```typescript
const publishAll = useCallback(async () => {
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }

  try {
    await flushPendingChanges();

    // Re-check after flush - user may have edited during flush
    const currentDraftCount = packages.filter((pkg) => pkg.hasDraft).length;
    if (currentDraftCount === 0) {
      toast.info("No changes to publish");
      return;
    }
  } catch (err) {
    toast.error("Failed to prepare changes", { description: "Please try again" });
    return;
  }

  setIsPublishing(true);
  try {
    // ... rest of function (unchanged) ...
```

**Also update deps** (same line as before, now includes `packages`):

```typescript
}, [packages, loadPackages, flushPendingChanges]);
```

**Reason:** Prevents race condition where user edits during flush are not published.

---

## Fix #3: Line 78 (Add memoization)

**Current:**

```typescript
const draftCount = packages.filter((pkg) => pkg.hasDraft).length;
```

**Change to:**

```typescript
const draftCount = useMemo(() => packages.filter((pkg) => pkg.hasDraft).length, [packages]);
```

**Reason:** Prevents stale closure over draftCount in callbacks.

---

## Testing After Fixes

```bash
# Type check
npm run typecheck

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Manual test:
# 1. Navigate to visual editor
# 2. Type quickly in one package (should be smooth)
# 3. Edit another package while first is auto-saving
# 4. Click Publish while edits are in progress
# 5. Verify all changes are saved and published
```

---

## Expected Results

✅ Smooth typing (1-2 re-renders instead of 6+)
✅ No lost edits during publish
✅ No stale closures
✅ All tests pass

---

## Files Modified

- `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`

---

## Rollback Plan

Each fix is independent:

```bash
git revert <commit-hash>
npm test
```

---

## Questions?

See detailed documentation:

- `useVisualEditor-SUMMARY.md` - Executive summary
- `useVisualEditor-analysis.md` - Technical deep dive
- `useVisualEditor-race-conditions.md` - Timeline diagrams
- `useVisualEditor-fixes.md` - Complete fix guide with diffs
