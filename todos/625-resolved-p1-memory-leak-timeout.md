---
status: resolved
priority: p1
issue_id: '625'
tags: [code-review, bug, build-mode, react, memory-leak]
dependencies: []
---

# Memory Leak: Timeout Not Cleared in useDraftAutosave

## Problem Statement

Multiple `setTimeout` calls in the `saveDraft` function are not tracked or cleaned up. If the component unmounts while the timeout is pending, these will attempt to call `setSaveStatus` on an unmounted component.

**What's broken:** Potential memory leak and React warnings
**Why it matters:** State updates on unmounted components cause memory leaks

## Findings

### Source: TypeScript Reviewer (Kieran)

**File:** `/apps/web/src/hooks/useDraftAutosave.ts` (lines 113-115, 122-124)

**Current Code:**

```typescript
// Line 113-115 - Not tracked, not cleaned up
setTimeout(() => {
  setSaveStatus('idle'); // Could fire on unmounted component
}, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);

// Line 122-124 - Same issue for error state
setTimeout(() => {
  setSaveStatus('idle');
}, BUILD_MODE_CONFIG.timing.errorStatusResetDelay);
```

**Impact:**

- React warning: "Can't perform a React state update on an unmounted component"
- Memory leak in long-running sessions with many saves
- Multiple rapid saves create orphaned timeouts

## Proposed Solutions

### Option A: Track timeouts with ref (Recommended)

**Description:** Use a ref to track and clear status reset timeouts

```typescript
// Add ref at top of hook
const statusResetRef = useRef<ReturnType<typeof setTimeout>>();

// In saveDraft, clear previous and set new
if (statusResetRef.current) {
  clearTimeout(statusResetRef.current);
}
statusResetRef.current = setTimeout(() => {
  setSaveStatus('idle');
}, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);

// In cleanup effect (update existing)
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (statusResetRef.current) clearTimeout(statusResetRef.current);
  };
}, []);
```

- **Pros:** Proper cleanup, matches existing debounceRef pattern
- **Cons:** None
- **Effort:** Small (10 minutes)
- **Risk:** None

## Technical Details

**Affected Files:**

- `apps/web/src/hooks/useDraftAutosave.ts`

## Acceptance Criteria

- [ ] Status reset timeout tracked in ref
- [ ] Previous timeout cleared before setting new one
- [ ] Cleanup effect clears status reset timeout
- [ ] No React warnings about unmounted components

## Work Log

| Date       | Action                               | Learnings                                            |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| 2026-01-05 | Created from multi-agent code review | All timeouts must be tracked and cleaned up in React |

## Resources

- Hook file: `apps/web/src/hooks/useDraftAutosave.ts`
- Existing pattern: `debounceRef` in same file
