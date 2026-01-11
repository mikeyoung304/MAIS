---
status: pending
priority: p2
issue_id: 744
tags: [code-review, testing, e2e, flaky-tests, pr-27]
dependencies: []
---

# P2: E2E Test Hardcoded Timing May Cause Flakes

## Problem Statement

The mobile E2E tests use hardcoded `waitForTimeout(500)` for keyboard animation timing. On slow CI runners, animations may take longer, causing intermittent test failures.

**Impact:** Flaky tests in CI, false negatives, developer frustration.

## Findings

**Reviewer:** julik-frontend-races-reviewer

**Location:** `e2e/tests/build-mode-mobile.spec.ts:138-170`

**Current Implementation:**

```typescript
await input.focus();
await page.waitForTimeout(500); // Hardcoded timing

const positionWithKeyboard = await drawer.boundingBox();
```

## Proposed Solutions

### Solution A: Wait for Animation Completion (Recommended)

- **Pros:** Reliable, adapts to actual animation duration
- **Cons:** Slightly more complex
- **Effort:** Small (15 minutes)
- **Risk:** Low

```typescript
await input.focus();

// Wait for CSS transition to complete
await page.waitForFunction(() => {
  const drawer = document.querySelector('[role="dialog"]');
  if (!drawer) return true;
  const style = getComputedStyle(drawer);
  return (
    style.transition === 'none' ||
    style.transitionDuration === '0s' ||
    parseFloat(style.transitionDuration) === 0
  );
});

const positionWithKeyboard = await drawer.boundingBox();
```

### Solution B: Increase Timeout with Margin

- **Pros:** Simple fix
- **Cons:** Still fragile, slows down tests
- **Effort:** Minimal
- **Risk:** Medium (may still flake on very slow runners)

```typescript
await page.waitForTimeout(1000); // Increased from 500ms
```

### Solution C: Use Playwright's Built-in Stability

- **Pros:** Uses Playwright best practices
- **Cons:** May not work for all animation types
- **Effort:** Small
- **Risk:** Low

```typescript
await input.focus();
await expect(drawer).toBeVisible(); // Waits for stable state
await drawer.waitForElementState('stable');
```

## Recommended Action

Solution A or C - Use animation-aware waiting instead of hardcoded timeouts.

## Technical Details

**Affected Files:**

- `e2e/tests/build-mode-mobile.spec.ts` (lines 138-170)

## Acceptance Criteria

- [ ] No hardcoded `waitForTimeout` for animation timing
- [ ] Tests pass reliably on slow CI runners
- [ ] Tests still complete in reasonable time

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-01-11 | Created | From PR #27 multi-agent review |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- Playwright waiting strategies: https://playwright.dev/docs/actionability
