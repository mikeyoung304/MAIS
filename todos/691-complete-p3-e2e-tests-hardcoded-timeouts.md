---
status: complete
priority: p3
issue_id: '691'
tags: [code-review, agent-first-architecture, testing, flaky-tests]
dependencies: []
---

# P3: E2E Tests Rely on Hardcoded Timeouts

## Problem Statement

Multiple E2E tests use `waitForTimeout(500)` instead of proper state assertions, creating potentially flaky tests.

**Affected Lines (original):**

- Line 212: `await authenticatedPage.waitForTimeout(500);` (highlighting section test)
- Line 429: `await authenticatedPage.waitForTimeout(500);` (page tab switching test)

## Resolution

**Replaced arbitrary timeouts with proper Playwright state assertions:**

### Test 1: "updates store when highlighting section"

- **Before:** `waitForTimeout(500)` after `highlightSection` action
- **After:**
  1. Wait for preview panel to become visible (`toBeVisible` assertion)
  2. Poll store state with retry loop until expected values are present
  - Max 20 attempts with 100ms interval (2 seconds max vs arbitrary 500ms)
  - Returns current state for better error messages if assertion fails

### Test 2: "page tabs switch preview to different pages"

- **Before:** `waitForTimeout(500)` after clicking About tab
- **After:**
  1. Wait for tab CSS class change (`toHaveClass(/bg-sage/)` - active tab indicator)
  2. Poll store state with retry loop until `currentPage === 'about'`

## Technical Details

**Key Improvements:**

1. **Proper UI assertions:** Using Playwright's built-in `expect().toBeVisible()` and `expect().toHaveClass()` which auto-retry
2. **Store state polling:** Custom polling function with configurable max attempts and interval, providing deterministic wait behavior
3. **Better error messages:** If polling times out, returns current state so test assertion shows actual vs expected values

**Files Modified:**

- `e2e/tests/agent-ui-control.spec.ts`

## Verification

All 9 runnable tests pass (2 skipped due to no draft state - expected):

```
  9 passed (39.4s)
  2 skipped
```

## Acceptance Criteria

- [x] No `waitForTimeout` calls with arbitrary values in `agent-ui-control.spec.ts`
- [x] Tests use proper state assertions (CSS classes, visibility, store polling)
- [x] Tests remain reliable (verified passing)

## Work Log

| Date       | Action                     | Outcome                                                         |
| ---------- | -------------------------- | --------------------------------------------------------------- |
| 2026-01-09 | Created during code review | Initial filing                                                  |
| 2026-01-10 | **Triage: APPROVED**       | 19 hardcoded waits found. Flaky tests undermine CI reliability. |
| 2026-01-10 | **RESOLVED**               | Replaced 2 `waitForTimeout` calls with proper state assertions  |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
