---
status: complete
priority: p2
issue_id: '105'
tags: [code-review, architecture, duplication, hooks, ui-redesign]
dependencies: ['104']
---

# useSuccessMessage Hook Duplicated - Memory Leak Risk

## Problem Statement

A proper `useSuccessMessage` hook exists with timeout cleanup, but 5+ components re-implement this pattern manually without cleanup, causing memory leaks.

**Why it matters:** Memory leak risk from uncleared timeouts on component unmount.

## Findings

### From architecture-strategist agent:

**Proper implementation exists at:**

- `client/src/features/admin/packages/hooks/useSuccessMessage.ts`

**Manual implementations (no cleanup) at:**

- `client/src/features/tenant-admin/BrandingEditor.tsx` (lines 42, 56-59)
- `client/src/features/tenant-admin/packages/hooks/usePackageManager.ts`
- `client/src/features/tenant-admin/BlackoutsManager/hooks/useBlackoutsManager.ts`

**Bug in manual implementation:**

```typescript
// BUG: No timeout cleanup!
const showSuccess = useCallback((message: string) => {
  setSuccessMessage(message);
  setTimeout(() => setSuccessMessage(null), 3000);
}, []);
```

## Proposed Solutions

### Solution 1: Move Hook to Shared Location (Recommended)

**Pros:** Fixes memory leak, DRY
**Cons:** Requires migration
**Effort:** Small (1 hour)
**Risk:** Low

Move to `client/src/hooks/useSuccessMessage.ts` and replace all manual implementations.

## Acceptance Criteria

- [ ] Hook moved to client/src/hooks/
- [ ] All manual implementations replaced
- [ ] Cleanup on unmount verified
- [ ] No memory leaks in React DevTools

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2025-11-30 | Created from code review | Memory leak risk identified |
