# useVisualEditor.ts Code Review - Executive Summary

**File:** `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
**Status:** ⚠️ 3 bugs found (1 critical, 1 high, 1 medium)
**Review Date:** 2025-12-02

---

## Critical Findings

### 1. ❌ CRITICAL BUG: Stale Closure in `updateDraft` Callback

**Severity:** HIGH
**Impact:** Incorrect original state capture, potential data loss
**Lines:** 225

```typescript
const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
  // ...
  if (!originalStates.current.has(packageId)) {
    const original = packages.find((pkg) => pkg.id === packageId);  // ⚠️ STALE
    if (original) {
      originalStates.current.set(packageId, original);
    }
  }
  // ...
}, [packages, flushPendingChanges]);  // ← PROBLEM: `packages` in deps!
```

**The Problem:**
- `packages` is included in the dependency array
- Every keystroke calls `setPackages()` which updates state
- State change triggers re-render with new `packages` reference
- New `packages` reference creates new callback function
- New callback closes over stale package data

**Why This Breaks:**
1. Rapid edits create multiple closures with different `packages` snapshots
2. Original state capture at line 193 uses stale data
3. If package is edited again during save, wrong version is captured
4. Rollback on error uses incorrect original state
5. **Result:** Data inconsistency or silent data loss

**Example Failure Scenario:**
```
1. User edits Package A → setPackages fires → callback v1 created
2. User edits Package B (before debounce) → setPackages fires → callback v2 created
3. User edits Package B again (before save) → updateDraft(callback v2)
4. flushPendingChanges sends both updates
5. If Package B save fails, rollback uses wrong original state
6. User's first B edit is lost
```

**The Fix:**
```typescript
const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
  // ... implementation unchanged ...
}, [flushPendingChanges]);  // ← Remove `packages`!
```

**Why It Works:**
- Original state is captured in refs (always fresh)
- Callback becomes stable (never recreated)
- No closure over stale `packages` data
- Child components won't re-render unnecessarily

---

### 2. ❌ HIGH BUG: Race Condition in `publishAll`

**Severity:** HIGH
**Impact:** Lost edits, publish failures
**Lines:** 231-242

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
  await flushPendingChanges();  // ← Async, takes 100-500ms typically

  setIsPublishing(true);
  // ... publish call happens here ...
```

**The Problem:**
1. `draftCount` is checked BEFORE async flush completes
2. User can edit while flush is in progress (100-500ms window)
3. New edits are stored in `pendingChanges` map
4. But `saveTimeout` was already cleared
5. When publish API call executes, new edits are NOT included
6. **Result:** Silent data loss, inconsistent state

**Example Failure Scenario:**
```
T0: User has 1 draft (PackageA)
T1: User clicks "Publish All"
    → flushPendingChanges() starts (network latency ~200ms)
T2: While flushing, user edits PackageB (rapid click)
    → New saveTimeout created for PackageB
    → pendingChanges = { PackageB: {...} }
T3: Flush completes (PackageA saved)
    → publishAll continues
T4: publishAll calls API.publishDrafts()
    → Only publishes what's in state.hasDraft
    → PackageB.hasDraft might not be true yet!
    → Or PackageB is published without latest edits
T5: Result: PackageB changes lost or inconsistent
```

**The Fix:**
```typescript
const publishAll = useCallback(async () => {
  // Remove early exit - draftCount may change during async

  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }

  // Flush pending changes
  await flushPendingChanges();

  // RE-CHECK draftCount after async completes
  const currentDraftCount = packages.filter((pkg) => pkg.hasDraft).length;
  if (currentDraftCount === 0) {
    toast.info("No changes to publish");
    return;
  }

  // Now publish (all updates are flushed and draftCount is current)
  setIsPublishing(true);
  // ...
}, [packages, loadPackages, flushPendingChanges]);
```

**Why It Works:**
- Rechecks `draftCount` after async flush completes
- Captures any edits made during the flush window
- Ensures all changes are saved before publishing
- Prevents silent data loss

---

### 3. ⚠️ MEDIUM: Stale `draftCount` in Callbacks

**Severity:** MEDIUM
**Impact:** Potential for stale state access
**Lines:** 231, 273

```typescript
const publishAll = useCallback(async () => {
  if (draftCount === 0) {  // ← Captured at definition time
    // ...
}, [draftCount, ...]);

const discardAll = useCallback(async () => {
  if (draftCount === 0) {  // ← Captured at definition time
    // ...
}, [draftCount, ...]);
```

**The Problem:**
- `draftCount` is computed fresh every render but not memoized
- Callback captures value at definition time
- If user calls these rapidly, stale value is used
- UI buttons prevent clicking, but defensive code should recompute

**The Fix:**
```typescript
const draftCount = useMemo(
  () => packages.filter((pkg) => pkg.hasDraft).length,
  [packages]
);

// Now inside callbacks:
const currentDraftCount = packages.filter((pkg) => pkg.hasDraft).length;
if (currentDraftCount === 0) { ... }
```

**Why It Works:**
- Memoizes the computation
- Recompute from fresh `packages` state when needed
- Consistent with React best practices

---

## Performance Impact

### Current (Broken) Behavior:
```
Single keystroke in EditableText:
├─ updateDraft called
├─ setPackages fired
├─ VisualEditorDashboard re-renders
│  └─ useVisualEditor hook runs again
│     └─ packages changed, so updateDraft recreated
│        └─ handleUpdatePackage recreated
│           └─ All child callbacks recreated
├─ EditablePackageCard re-renders (onUpdatePackage changed)
├─ EditableText re-renders (onUpdate changed)
└─ Total: 6+ component re-renders per keystroke

60-character input = 60+ re-renders (extremely sluggish)
```

### After Fix:
```
Single keystroke in EditableText:
├─ updateDraft called
├─ setPackages fired
├─ VisualEditorDashboard re-renders
│  └─ useVisualEditor hook runs again
│     └─ packages changed, but updateDraft STABLE
│        └─ handleUpdatePackage STABLE (unchanged)
│           └─ Child callbacks STABLE
├─ EditablePackageCard does NOT re-render (React.memo protects)
├─ EditableText does NOT re-render (no prop change)
└─ Total: 1 component re-render per keystroke

60-character input = 1-2 re-renders (smooth typing)
```

---

## Code Quality Assessment

### ✅ Strengths

1. **Excellent cleanup effect** (lines 316-326)
   - Properly clears timeout on unmount
   - Clears refs to prevent memory leaks
   - Empty deps array is correct

2. **Good error handling & rollback** (lines 145-160)
   - Captures original state before mutations
   - Rolls back on error
   - Logs with context
   - Shows appropriate toast messages

3. **Correct sequential processing** (lines 129-161)
   - for...await loop prevents overlapping requests
   - Preserves error handling context
   - Matches expected save semantics

4. **Atomic state updates** (line 142-144)
   - Uses state updater function
   - Creates new array for React immutability
   - Properly targets package to update

5. **Well-documented code** (lines 1-16, 80-183)
   - Clear comments explaining batching strategy
   - Documents race condition prevention intent
   - Good function documentation

### ❌ Weaknesses

1. **Stale closure in updateDraft** - CRITICAL
2. **Race condition in publishAll** - HIGH
3. **No memoization of draftCount** - MEDIUM
4. **Dependency array includes state** - Pattern issue

---

## Testing Recommendations

### 1. Unit Tests (Add)
```typescript
test('updateDraft callback is stable across renders', () => {
  const { result } = renderHook(() => useVisualEditor());
  const cb1 = result.current.updateDraft;

  act(() => result.current.updateDraft('pkg1', { title: 'New' }));

  const cb2 = result.current.updateDraft;
  expect(cb1).toBe(cb2); // Should be same reference
});
```

### 2. Integration Tests (Add)
```typescript
test('edits during publishAll flush are included', async () => {
  // Simulate user editing PackageB while PackageA is being flushed
  // Verify both packages are published
});
```

### 3. E2E Tests (Add)
```typescript
test('rapid edits to multiple packages', async () => {
  // Edit Package A
  // Edit Package B (before debounce)
  // Click Publish
  // Verify both are saved and published
});
```

---

## Impact Summary

| Category | Finding | Severity | Impact |
|----------|---------|----------|--------|
| Correctness | Stale closure | CRITICAL | Data loss, inconsistency |
| Correctness | Race condition | HIGH | Lost edits, publish failure |
| Performance | Callback recreation | MEDIUM | 6+ re-renders per keystroke |
| Code quality | Stale draftCount | MEDIUM | Poor defensive coding |

---

## Recommended Actions

### Priority 1 (CRITICAL - Fix Immediately)
- [ ] Remove `packages` from `updateDraft` dependencies (line 225)
- [ ] Test manually: rapid edits in single and multiple packages
- [ ] Run full test suite

### Priority 2 (HIGH - Fix Before Merge)
- [ ] Add race condition check to `publishAll` (lines 231-266)
- [ ] Add try/catch around flush operation
- [ ] Test: Edit while publish is in progress
- [ ] Run full test suite

### Priority 3 (MEDIUM - Fix in Next Sprint)
- [ ] Memoize `draftCount` with useMemo
- [ ] Add unit tests for callback stability
- [ ] Add integration tests for race conditions
- [ ] Add E2E tests for full publish flow

---

## Code Review Checklist

- [x] Reviewed dependency arrays
- [x] Identified stale closure vulnerabilities
- [x] Checked for race conditions
- [x] Verified cleanup patterns
- [x] Assessed component integration
- [x] Checked error handling
- [x] Reviewed performance implications
- [x] Documented findings

---

## Related Documentation

- `/docs/code-review/useVisualEditor-analysis.md` - Detailed technical analysis
- `/docs/code-review/useVisualEditor-race-conditions.md` - Timeline diagrams and scenarios
- `/docs/code-review/useVisualEditor-fixes.md` - Implementation guide with diffs

---

## Files Affected by Fixes

```
client/src/features/tenant-admin/visual-editor/
├── hooks/
│   └── useVisualEditor.ts (Main file being fixed)
├── components/
│   ├── EditablePackageCard.tsx (Integration testing)
│   ├── EditableText.tsx (Integration testing)
│   ├── EditablePrice.tsx (Integration testing)
│   └── PhotoDropZone.tsx (Integration testing)
└── VisualEditorDashboard.tsx (Integration testing)
```

---

## Estimated Fix Time

- **Fix #1 (Critical):** 5 minutes
- **Fix #2 (High):** 10 minutes
- **Fix #3 (Medium):** 5 minutes
- **Testing:** 10-15 minutes
- **Total:** ~30-40 minutes

---

**Review Status:** Complete ✓
**Approval:** Pending fixes
**Next Step:** Implement all three fixes and re-test
