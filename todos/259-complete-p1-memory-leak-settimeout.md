---
status: resolved
priority: p1
issue_id: "259"
tags: [code-review, performance, memory-leak, tenant-dashboard]
dependencies: []
resolved_at: "2025-12-23"
resolved_by: "already fixed in useDepositSettingsManager.ts with ref-based timeout cleanup"
---

# Memory Leak: Uncleaned setTimeout in DepositSettingsCard

## Problem Statement

DepositSettingsCard uses `setTimeout` to clear a "saved" indicator after 3 seconds, but the timeout is not cleaned up if the component unmounts before it fires. This causes memory leaks and React warnings.

**Why it matters:**
- Memory leak in production
- React warnings: "Can't perform a React state update on an unmounted component"
- Potential crashes in Strict Mode or during hot reloads

## Findings

### Agent: performance-oracle
- **Location:** `DepositSettingsCard.tsx:143`
- **Evidence:** `setTimeout(() => setSaved(false), 3000);` with no cleanup
- **Impact:** CRITICAL - Memory leak, unmounted component updates

### Agent: code-quality-reviewer
- **Location:** Same
- **Evidence:** Missing cleanup function in setTimeout usage
- **Impact:** HIGH - Causes React warnings, potential crashes

## Proposed Solutions

### Option A: Use Ref for Cleanup (Recommended)
**Description:** Store timeout ID in a ref and clear on unmount

```typescript
const savedTimeoutRef = useRef<number | null>(null);

useEffect(() => {
  return () => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }
  };
}, []);

// In handleSave:
savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 3000);
```

**Pros:**
- Clean, standard React pattern
- Minimal code change

**Cons:**
- Adds a ref

**Effort:** Small (15 min)
**Risk:** Low

### Option B: Remove Saved Indicator Entirely
**Description:** Remove the `saved` state and timeout, rely on button state for feedback

**Pros:**
- Simplifies component
- No timeout to manage

**Cons:**
- Less explicit user feedback

**Effort:** Small (10 min)
**Risk:** Low - but changes UX

### Option C: Use useEffect with Dependency
**Description:** Use `saveCompletedAt` timestamp state and useEffect for cleanup

**Pros:**
- More React-idiomatic
- Automatic cleanup

**Cons:**
- More state to manage

**Effort:** Small (20 min)
**Risk:** Low

## Recommended Action

**Choose Option A** - Add ref-based cleanup. Minimal change, fixes the bug.

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/TenantDashboard/DepositSettingsCard.tsx`

### Components
- DepositSettingsCard

### Database Changes
None

## Acceptance Criteria

- [ ] setTimeout has corresponding cleanup on unmount
- [ ] No React warnings about unmounted components
- [ ] Save indicator still works (shows for 3 seconds after save)
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from code review | Always cleanup timeouts in React components |

## Resources

- **React Docs:** https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
