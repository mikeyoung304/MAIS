---
status: ready
priority: p2
issue_id: '5200'
tags: [code-review, testing, e2e, performance]
dependencies: []
---

# networkidle Overuse (120+ Occurrences)

## Problem Statement

120+ uses of `waitForLoadState('networkidle')` which waits 500ms after ALL network activity ceases. This is slow and flaky with WebSocket/polling.

## Findings

**High-use files:**

- `segment-browsing.spec.ts`: 44 occurrences
- `storefront.spec.ts`: 27 occurrences
- `tenant-multi-page.spec.ts`: 25 occurrences

**Impact:** Each occurrence adds 500ms+ delay = 60+ seconds per test run.

## Proposed Solutions

### Option A: Replace with Specific Waits (Recommended)

```typescript
// Before
await page.waitForLoadState('networkidle');

// After
await page.waitForLoadState('domcontentloaded');
await expect(page.locator('[data-testid="content"]')).toBeVisible();
```

**Effort:** Large (1-2 days) | **Risk:** Low

### Option B: Gradual Replacement

Replace in highest-occurrence files first, measure improvement.

**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] networkidle usage reduced by 80%
- [ ] No increase in test failures
- [ ] Test runtime reduced by 30+ seconds
