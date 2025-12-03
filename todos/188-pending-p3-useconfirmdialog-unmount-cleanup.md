---
status: pending
priority: p3
issue_id: "188"
tags: [code-review, react, memory-leak]
dependencies: []
---

# useConfirmDialog Missing Unmount Cleanup

## Problem Statement

The `useConfirmDialog` hook stores a Promise resolve function in a ref, but doesn't clean up on unmount. If the component unmounts while a confirm dialog is pending, the Promise hangs forever and the resolve function remains in memory.

## Findings

**Location:** `client/src/hooks/useConfirmDialog.tsx`

**Current Code:**
```typescript
const resolveRef = useRef<((value: boolean) => void) | null>(null);

// No cleanup effect for unmount
```

**Risk Assessment:**
- Impact: Low (minor memory leak, unlikely scenario)
- Likelihood: Very Low (component usually stays mounted)

## Proposed Solutions

### Solution 1: Add useEffect cleanup (Recommended)
- Add cleanup effect to resolve Promise on unmount
- Standard React pattern
- **Pros:** Prevents memory leak, clean pattern
- **Cons:** Minor code addition
- **Effort:** Small (5 minutes)
- **Risk:** None

## Recommended Action

Implement **Solution 1** for completeness.

## Technical Details

**Affected Files:**
- `client/src/hooks/useConfirmDialog.tsx`

**Proposed Change:**
```typescript
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Resolve with false on unmount to prevent memory leak
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  // ... rest of implementation unchanged
}
```

## Acceptance Criteria

- [ ] useEffect cleanup added
- [ ] Promise resolves false on unmount
- [ ] No TypeScript errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced Promise resolution fix)
- Related: TODO-176 (completed - fixed Promise not resolving false)
