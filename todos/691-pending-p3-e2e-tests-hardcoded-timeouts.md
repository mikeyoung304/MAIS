---
status: pending
priority: p3
issue_id: '691'
tags: [code-review, agent-first-architecture, testing, flaky-tests]
dependencies: []
---

# P3: E2E Tests Rely on Hardcoded Timeouts

## Problem Statement

Multiple E2E tests use `waitForTimeout(500)` instead of proper state assertions, creating potentially flaky tests.

**Affected Lines:**

- Line 138: `await authenticatedPage.waitForTimeout(500);`
- Line 165: `await authenticatedPage.waitForTimeout(500);`
- Line 420: `await authenticatedPage.waitForTimeout(200);`
- Line 447: `await authenticatedPage.waitForTimeout(500);`

## Findings

**Agent:** Test Coverage Reviewer

**Location:** `e2e/tests/agent-ui-control.spec.ts`

## Proposed Solutions

### Option A: Replace with state assertions (Recommended)

```typescript
// Instead of:
await authenticatedPage.waitForTimeout(500);

// Use:
await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible();
```

- **Pros:** Faster, more reliable
- **Cons:** Requires identifying correct assertions
- **Effort:** Small
- **Risk:** Low

### Option B: Use network idle

- Wait for network requests to complete
- **Pros:** More reliable than arbitrary timeout
- **Cons:** May not cover all state changes
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Replace with proper Playwright assertions.

## Technical Details

**Affected Files:**

- `e2e/tests/agent-ui-control.spec.ts`

## Acceptance Criteria

- [ ] No `waitForTimeout` calls with arbitrary values
- [ ] Tests use proper state assertions
- [ ] Tests remain reliable in CI

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
