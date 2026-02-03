---
status: ready
priority: p1
issue_id: '5196'
tags: [code-review, testing, e2e, flakiness]
dependencies: []
---

# waitForTimeout Anti-Pattern (17 Occurrences)

## Problem Statement

17 instances of `waitForTimeout()` cause flaky tests and add ~10-15s per run.

## Findings

| File                            | Occurrences | Wait Time   |
| ------------------------------- | ----------- | ----------- |
| `auth.fixture.ts`               | 1           | 500ms       |
| `tenant-signup.spec.ts`         | 3           | 500-1000ms  |
| `tenant-multi-page.spec.ts`     | 3           | 300-500ms   |
| `build-mode.spec.ts`            | 4           | 500-1000ms  |
| `early-access-waitlist.spec.ts` | 2           | 1000-2000ms |
| Others                          | 4           | Various     |

**Note:** Commit `b24a0208` claimed to remove these but they remain.

## Proposed Solutions

### Option A: Replace with Proper Waits (Recommended)

```typescript
// Before
await page.waitForTimeout(500);

// After
await expect(page.locator('[data-testid="content"]')).toBeVisible();
```

**Effort:** Medium (3-4 hours) | **Risk:** Low

## Acceptance Criteria

- [ ] Zero `waitForTimeout` calls in E2E tests
- [ ] Test execution time reduced by 10+ seconds
