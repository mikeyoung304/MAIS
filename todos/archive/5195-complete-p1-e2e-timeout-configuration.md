---
status: ready
priority: p1
issue_id: '5195'
tags: [code-review, testing, ci, e2e, performance]
dependencies: []
---

# E2E Timeout Configuration Causes CI Failures

## Problem Statement

The E2E test configuration makes CI timeout failures mathematically inevitable. With 196 tests, 2 workers, 30s timeout, and 2 retries, the worst-case runtime is 142 minutes - far exceeding the 20-minute job timeout.

## Findings

1. **Worst-case:** 196 tests ÷ 2 workers × 90s (30s × 3 attempts) = 147 minutes
2. **Happy path:** ~18-20 minutes (no buffer for retries)
3. **CI timeout:** 20 minutes (`main-pipeline.yml` line 409)

**Config locations:**

- `e2e/playwright.config.ts`: timeout=30s, retries=2, workers=2
- `.github/workflows/main-pipeline.yml`: timeout-minutes=20

## Proposed Solutions

### Option A: Quick Fix (Recommended)

```typescript
// playwright.config.ts
retries: process.env.CI ? 1 : 0,  // 2 → 1
workers: process.env.CI ? 4 : undefined,  // 2 → 4
```

```yaml
# main-pipeline.yml
timeout-minutes: 30 # 20 → 30
```

**Effort:** Small | **Risk:** Low

### Option B: Test Sharding

Split into `e2e-critical` (every push) and `e2e-full` (PRs to main).
**Effort:** Medium | **Risk:** Medium

## Acceptance Criteria

- [ ] E2E tests complete within job timeout consistently
- [ ] Happy path runtime under 10 minutes
