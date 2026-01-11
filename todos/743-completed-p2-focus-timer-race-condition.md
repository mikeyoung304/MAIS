---
status: completed
priority: p2
issue_id: 743
tags: [code-review, race-condition, accessibility, react, pr-27]
dependencies: []
---

# P2: Focus Management Timer Race Condition

## Problem Statement

The Vaul drawer uses multiple uncancelled timers for focus management. Rapid open/close can cause focus thrashing where both `onOpenAutoFocus` and `onCloseAutoFocus` timers execute, causing unpredictable focus behavior.

**Impact:** WCAG 2.4.3 (Focus Order) violation if focus lands in wrong place. Accessibility issues for keyboard and screen reader users.

## Findings

**Reviewer:** julik-frontend-races-reviewer

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:406-419`

**Current Implementation:**

```tsx
onOpenAutoFocus={(e) => {
  e.preventDefault();
  setTimeout(() => {
    inputRef.current?.focus();
  }, 100);  // Timer 1 - never cancelled
}}
onCloseAutoFocus={(e) => {
  e.preventDefault();
  setTimeout(() => {
    fabRef.current?.focus();
  }, 100);  // Timer 2 - never cancelled
}}
```

**Scenario:**

1. Drawer opens, Timer 1 scheduled at +100ms
2. User immediately closes drawer (e.g., presses Escape)
3. Timer 2 scheduled at +100ms
4. Both timers fire, focus jumps unpredictably

## Proposed Solutions

### Solution A: Shared Timer Ref with Cancellation (Recommended)

- **Pros:** Guarantees only one focus operation, clean cleanup
- **Cons:** Slightly more code
- **Effort:** Small (15 minutes)
- **Risk:** Low

```tsx
const focusTimerRef = useRef<number | null>(null);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }
  };
}, []);

onOpenAutoFocus={(e) => {
  e.preventDefault();
  if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  focusTimerRef.current = window.setTimeout(() => {
    inputRef.current?.focus();
    focusTimerRef.current = null;
  }, 100);
}}
onCloseAutoFocus={(e) => {
  e.preventDefault();
  if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  focusTimerRef.current = window.setTimeout(() => {
    fabRef.current?.focus();
    focusTimerRef.current = null;
  }, 100);
}}
```

### Solution B: Use requestAnimationFrame Instead

- **Pros:** Syncs with browser repaint
- **Cons:** Less predictable timing
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution A - Add shared timer ref with proper cancellation.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 406-419)

## Acceptance Criteria

- [x] Single timer ref shared between open/close focus handlers
- [x] Previous timer cancelled before scheduling new one
- [x] Cleanup on component unmount
- [x] Focus behavior predictable on rapid open/close

## Work Log

| Date       | Action    | Notes                                                         |
| ---------- | --------- | ------------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                                |
| 2026-01-11 | Completed | Added focusTimerRef with cleanup to prevent race conditions ✓ |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- WCAG 2.4.3 Focus Order: https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html
