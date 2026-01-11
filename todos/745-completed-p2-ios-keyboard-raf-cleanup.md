---
status: completed
priority: p2
issue_id: 745
tags: [code-review, race-condition, ios, react, pr-27]
dependencies: []
---

# P2: iOS Keyboard visualViewport rAF Cleanup Missing

## Problem Statement

The iOS keyboard handling uses `requestAnimationFrame` but doesn't cancel it in the cleanup function. If the component unmounts while the rAF is pending, it may attempt to scroll a null ref.

**Impact:** Potential "Can't perform a React state update on unmounted component" warning. Minor - optional chaining prevents crash.

## Findings

**Reviewer:** julik-frontend-races-reviewer

**Location:** `apps/web/src/components/agent/PanelAgentChat.tsx:163-186`

**Current Implementation:**

```typescript
useEffect(() => {
  if (!isMobile || !isIOS) return;

  const handleViewportChange = () => {
    if (!window.visualViewport) return;
    const vh = window.visualViewport.height;
    const keyboardHeight = window.innerHeight - vh;

    if (keyboardHeight > 150) {
      requestAnimationFrame(() => {
        // Not tracked or cancelled
        inputRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  };

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  return () => {
    window.visualViewport?.removeEventListener('resize', handleViewportChange);
    // Missing: cancelAnimationFrame
  };
}, [isMobile, isAndroid, isIOS, inputRef]);
```

## Proposed Solutions

### Solution A: Track and Cancel rAF (Recommended)

- **Pros:** Proper cleanup, prevents stale callbacks
- **Cons:** Slightly more code
- **Effort:** Small (10 minutes)
- **Risk:** Low

```typescript
useEffect(() => {
  if (!isMobile || !isIOS) return;

  let rafId: number | null = null;

  const handleViewportChange = () => {
    if (!window.visualViewport) return;

    // Cancel any pending rAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }

    const vh = window.visualViewport.height;
    const keyboardHeight = window.innerHeight - vh;

    if (keyboardHeight > 150) {
      rafId = requestAnimationFrame(() => {
        inputRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        rafId = null;
      });
    }
  };

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  return () => {
    window.visualViewport?.removeEventListener('resize', handleViewportChange);
    if (rafId !== null) {
      cancelAnimationFrame(rafId); // Critical: cancel pending rAF
    }
  };
}, [isMobile, isIOS, inputRef]);
```

## Recommended Action

Solution A - Track rAF ID and cancel in cleanup.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/PanelAgentChat.tsx` (lines 163-186)

## Acceptance Criteria

- [x] rAF ID tracked in local variable
- [x] Cleanup function calls cancelAnimationFrame
- [x] No React warnings about unmounted components
- [x] iOS keyboard behavior unchanged

## Work Log

| Date       | Action    | Notes                                                       |
| ---------- | --------- | ----------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                              |
| 2026-01-11 | Completed | Added rafId tracking with cleanup in iOS keyboard handler ✓ |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
