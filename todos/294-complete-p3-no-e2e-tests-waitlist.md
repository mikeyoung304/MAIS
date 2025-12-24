---
status: resolved
priority: p3
issue_id: '294'
tags: [code-review, testing, e2e, early-access]
dependencies: ['291']
resolved_at: 2025-12-06
resolution: 'Created e2e/tests/early-access-waitlist.spec.ts with 12 comprehensive test cases covering form visibility, success, errors, rate limiting, accessibility'
---

# No E2E Tests for Waitlist Form

## Problem Statement

The waitlist form has no Playwright E2E test coverage. Other auth flows (signup: 12 tests, password-reset: 9 tests) have comprehensive E2E coverage.

**Why it matters:** Frontend integration untested, can't verify form submission works end-to-end.

## Findings

**Current E2E coverage:**

- `e2e/tests/tenant-signup.spec.ts` - 12 tests
- `e2e/tests/password-reset.spec.ts` - 9 tests
- `e2e/tests/early-access-waitlist.spec.ts` - ❌ Does not exist

## Proposed Solutions

### Option A: Add E2E Test Suite

**Pros:** Complete coverage, catches integration issues
**Cons:** Time to write
**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// e2e/tests/early-access-waitlist.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Early Access Waitlist', () => {
  test('should submit valid email and show success', async ({ page }) => {
    await page.goto('/');
    await page.locator('#waitlist-cta').scrollIntoViewIfNeeded();
    await page.fill('#waitlist-cta input[type="email"]', 'test@example.com');
    await page.click('#waitlist-cta button[type="submit"]');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should show loading state during submission', async ({ page }) => {
    await page.goto('/');
    await page.locator('#waitlist-cta').scrollIntoViewIfNeeded();
    await page.fill('#waitlist-cta input[type="email"]', 'test@example.com');
    await page.click('#waitlist-cta button[type="submit"]');
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('**/v1/auth/early-access', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    });
    // ... verify error message displays
  });
});
```

## Recommended Action

Create E2E test suite after frontend error handling is added (depends on #290).

## Technical Details

**Files to create:**

- `e2e/tests/early-access-waitlist.spec.ts`

**Pattern reference:**

- `e2e/tests/tenant-signup.spec.ts`

## Acceptance Criteria

- [x] E2E test for happy path (email → success)
- [x] E2E test for loading state
- [x] E2E test for error handling (500, 429, network errors)
- [x] E2E tests for accessibility attributes
- [x] Tests ready for CI (12 test cases)

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2025-12-06 | Created from code review | Testing agent identified missing E2E coverage |

## Resources

- PR commit: 9548fc3
- Depends on: #290 (error handling UI)
