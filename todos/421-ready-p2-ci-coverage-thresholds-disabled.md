---
status: completed
priority: p2
issue_id: "421"
tags: [code-review, ci-cd, testing, coverage]
dependencies: []
completed_at: "2025-12-26"
---

# Enable Coverage Thresholds in CI

## Problem Statement

Coverage thresholds are disabled in CI, allowing coverage to regress without detection.

```typescript
// server/vitest.config.ts lines 57-64
thresholds: process.env.CI
  ? undefined  // Disabled in CI!
  : { lines: 43, branches: 75, functions: 46, statements: 43 },
```

The rationale is that unit/integration tests run separately and neither alone meets the threshold. However, this creates a gap where coverage can regress silently.

## Findings

- **Current thresholds:** lines 43%, branches 75%, functions 46%, statements 43%
- **CI behavior:** Thresholds completely disabled, no enforcement
- **Local behavior:** Thresholds enforced only locally
- **Risk:** Developers can merge code that reduces coverage with no gate

## Proposed Solutions

### Option 1: Combined Coverage Report in CI (Recommended)

**Approach:** Add a CI step that merges unit and integration coverage, then checks combined thresholds.

```yaml
- name: Merge coverage reports
  run: npx nyc merge coverage/ coverage/combined.json

- name: Check combined coverage thresholds
  run: npx nyc check-coverage --lines 43 --branches 75 ...
```

**Pros:**
- Accurate enforcement of total coverage
- Catches regressions

**Cons:**
- Adds CI time
- Requires coverage artifact merging

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Per-Suite Thresholds

**Approach:** Set lower thresholds that each suite can independently meet.

**Pros:**
- Simpler to implement
- Each test run is self-contained

**Cons:**
- May not catch overall coverage regression
- Thresholds may be too low to be meaningful

**Effort:** 1 hour

**Risk:** Medium

## Recommended Action

**APPROVED: Option 2 - Per-suite thresholds (simpler)**

Rather than complex coverage merging, set realistic thresholds each suite can meet independently:
1. Update `vitest.config.ts` to use lower thresholds in CI that unit tests alone can pass
2. Consider: lines 30%, branches 60%, functions 35%
3. This prevents regression while acknowledging split test runs

**Alternative:** If combined coverage is preferred, implement nyc merge step.

**Effort:** 30 minutes | **Risk:** Low

## Technical Details

**Affected files:**
- `.github/workflows/main-pipeline.yml` - add coverage merge step
- `server/vitest.config.ts` - potentially adjust threshold logic

## Acceptance Criteria

- [x] CI enforces per-suite thresholds (lines 30%, branches 60%, functions 35%, statements 30%)
- [x] Coverage regression blocks PR
- [x] Unit tests pass thresholds independently

## Work Log

### 2025-12-26 - Discovery via Code Review

**By:** Claude Code (Performance Oracle, DevOps Harmony agents)

**Actions:**
- Identified disabled thresholds during commit 21a9b3a review
- Documented rationale and risk

## Resources

- **Commit:** 21a9b3a
- **Review agents:** Performance Oracle, DevOps Harmony Analyst
