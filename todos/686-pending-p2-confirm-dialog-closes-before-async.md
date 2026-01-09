---
status: pending
priority: p2
issue_id: '686'
tags: [code-review, agent-first-architecture, ux, async-handling]
dependencies: []
---

# P2: ConfirmDialog Closes Before Async Operation Completes

## Problem Statement

The `ConfirmDialog` component immediately closes after `onConfirm()` is called, but `onConfirm` from `PreviewPanel` is async. If the async operation fails AFTER the dialog closes, user has no context of what failed.

**Why This Matters:**

- User clicks "Publish" → dialog closes → publish fails → generic error with no context
- Poor UX for error recovery
- User may think operation succeeded when it hasn't

## Findings

**Agent:** Data Integrity Guardian

**Location:** `apps/web/src/components/build-mode/ConfirmDialog.tsx` (lines 53-55)

**The Flow:**

1. User clicks Confirm button
2. `handleConfirm` calls `onConfirm()` (async)
3. Immediately calls `onOpenChange(false)` - dialog closes
4. Async operation may still be running
5. If it fails, error appears but dialog is gone

## Proposed Solutions

### Option A: Keep dialog open until async completes (Recommended)

```typescript
const handleConfirm = async () => {
  setIsLoading(true);
  try {
    await onConfirm();
    onOpenChange(false); // Only close on success
  } catch (error) {
    // Show error in dialog or let caller handle
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

- **Pros:** Better UX, clear feedback
- **Cons:** Requires `onConfirm` to return Promise
- **Effort:** Small
- **Risk:** Low

### Option B: Show loading state in dialog

- Keep dialog open, show spinner
- Close only on success
- **Pros:** Visual feedback during operation
- **Cons:** Similar to Option A
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Wait for async completion before closing. This is standard UX for confirmation dialogs.

## Technical Details

**Affected Files:**

- `apps/web/src/components/build-mode/ConfirmDialog.tsx`
- Possibly `apps/web/src/components/preview/PreviewPanel.tsx`

## Acceptance Criteria

- [ ] Dialog stays open during async operation
- [ ] Loading state shown while operation in progress
- [ ] Dialog closes only on success
- [ ] Errors show in context (in or near dialog)

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
