---
status: completed
priority: p2
issue_id: "422"
tags: [code-review, ci-cd, eslint, tech-debt]
dependencies: []
completed_at: "2025-12-26"
---

# Add Lint Regression Detection to CI

## Problem Statement

ESLint in CI uses `continue-on-error: true` which masks regressions. New lint errors in PRs go unnoticed.

```yaml
# .github/workflows/main-pipeline.yml lines 94-96
- name: Run ESLint
  run: npm run lint
  # TODO: Remove continue-on-error after fixing pre-existing lint errors
  continue-on-error: true
```

Current state: 305 lint problems (251 errors, 54 warnings) - down from 612.

## Findings

- **Current behavior:** Lint always "succeeds" regardless of error count
- **Impact:** New lint errors can be merged without detection
- **Documented as temporary:** TODO indicates intent to remove
- **Progress:** Reduced from 612 to 305 errors in commit 21a9b3a

## Proposed Solutions

### Option 1: Add Delta Check (Recommended)

**Approach:** Keep `continue-on-error` but add a step that fails if error count increases from baseline.

```yaml
- name: Run ESLint
  id: lint
  run: |
    npm run lint 2>&1 | tee lint-output.txt
    ERROR_COUNT=$(grep -c "error" lint-output.txt || echo "0")
    echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT
  continue-on-error: true

- name: Check lint regression
  if: github.event_name == 'pull_request'
  run: |
    CURRENT=${{ steps.lint.outputs.error_count }}
    BASELINE=305
    if [ "$CURRENT" -gt "$BASELINE" ]; then
      echo "Lint errors increased: $CURRENT > $BASELINE"
      exit 1
    fi
```

**Pros:**
- Prevents regression while allowing existing errors
- Clear baseline to track progress
- Can be updated as errors are fixed

**Cons:**
- Requires maintaining baseline number

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Fix All Errors, Remove continue-on-error

**Approach:** Dedicate time to fix remaining 305 errors.

**Pros:**
- Clean slate
- True quality gate

**Cons:**
- Large effort
- May take multiple sprints

**Effort:** 8-16 hours

**Risk:** Low

## Recommended Action

**APPROVED: Option 1 - Add delta check**

Add lint regression detection to CI:
1. Capture error count from lint output
2. Compare against baseline (305)
3. Fail if count increases

This prevents NEW errors while allowing existing tech debt to be fixed incrementally.

**Effort:** 30 minutes | **Risk:** Low | **Priority upgraded to P2** (high value/effort ratio)

## Technical Details

**Affected files:**
- `.github/workflows/main-pipeline.yml` - add delta check step

## Acceptance Criteria

- [x] Lint regression fails CI (delta check against baseline 305)
- [x] Existing errors don't block builds
- [x] Baseline documented and tracked

## Work Log

### 2025-12-26 - Discovery via Code Review

**By:** Claude Code (DevOps Harmony Analyst)

**Actions:**
- Identified continue-on-error pattern during commit 21a9b3a review
- Proposed delta check solution

## Resources

- **Commit:** 21a9b3a
- **Review agents:** DevOps Harmony Analyst
