---
status: complete
priority: p2
issue_id: '254'
tags: [code-review, landing-page, data-integrity, ux]
dependencies: ['247']
source: 'plan-review-2025-12-04'
---

# TODO-254: Flush Auto-Save on Tab Blur/Close to Prevent Data Loss

## Priority: P2 (Important - Data Loss Prevention)

## Status: Pending

## Source: Plan Review - Data Integrity Guardian

## Problem Statement

The plan specifies 1-2s debounce on auto-save but doesn't specify "flush on blur" behavior. If the user types, then immediately switches browser tabs, the debounce hasn't fired yet and edits may be lost.

**Why It Matters:**

- User types headline (takes 3 seconds)
- Auto-save debounce set to 2s after last keystroke
- User gets phone call, switches to Zoom tab at t=2.5s
- Auto-save would have fired at t=5s (3s typing + 2s debounce)
- User returns 10 minutes later, sees old headline

## Findings

### Missing Event Handlers

Current plan's hook specification doesn't include:

- `beforeunload` event handler (page close/refresh)
- `visibilitychange` event handler (tab switch)
- Flush mechanism for pending debounced saves

### Proven Pattern Exists

```typescript
// useVisualEditor uses this pattern but doesn't handle tab blur
// Need to extend it
```

## Proposed Solutions

### Option A: Add Tab Blur + Unload Handlers (Recommended)

- **Effort:** 1-2 hours
- **Risk:** Low
- Add `visibilitychange` listener to flush on tab background
- Add `beforeunload` listener to warn on unsaved changes
- **Pros:** Handles common data loss scenarios
- **Cons:** Slight complexity

### Option B: Accept Data Loss Risk

- **Effort:** 0 hours
- **Risk:** High
- Document as known limitation
- **Pros:** No work
- **Cons:** User frustration

## Recommended Action

**Execute Option A:** Add event handlers to hook:

```typescript
// In useLandingPageEditor.ts

// Flush pending saves when tab loses focus or page closes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      // Attempt to flush (may not complete if page is closing)
      flushPendingSave();

      // Show browser warning
      e.preventDefault();
      e.returnValue = '';
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && hasUnsavedChanges) {
      // Tab backgrounded - flush immediately
      flushPendingSave();
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [hasUnsavedChanges, flushPendingSave]);

// Add synchronous flush function
const flushPendingSave = useCallback(() => {
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }

  if (Object.keys(pendingChanges.current).length > 0) {
    // Use sendBeacon for page unload reliability
    const payload = JSON.stringify(mergePendingChanges());
    navigator.sendBeacon(
      `/api/v1/tenant-admin/landing-page/draft`,
      new Blob([payload], { type: 'application/json' })
    );
  }
}, []);
```

## Acceptance Criteria

- [ ] `visibilitychange` listener flushes pending saves when tab hidden
- [ ] `beforeunload` listener shows warning and flushes on page close
- [ ] `sendBeacon` used for reliable save during page unload
- [ ] Event listeners cleaned up on unmount
- [ ] Test: Edit → switch tab → return → changes preserved

## Work Log

| Date       | Action  | Notes                                          |
| ---------- | ------- | ---------------------------------------------- |
| 2025-12-04 | Created | Data integrity review identified tab blur risk |

## Tags

code-review, landing-page, data-integrity, ux
