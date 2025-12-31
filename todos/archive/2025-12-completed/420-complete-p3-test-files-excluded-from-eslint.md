---
status: done
priority: p3
issue_id: '420'
tags: [code-review, eslint, testing, tech-debt]
dependencies: ['419']
resolved_date: 2025-12-26
---

# Re-enable ESLint for Test Files

## Problem Statement

All server test files are excluded from ESLint via `.eslintignore`. This means ~250 lint warnings (mostly `any` types) are hidden, and new test code is not validated for quality or security patterns.

```
# .eslintignore lines 17-19
# Test files (to be cleaned up separately - ~250 warnings for any types)
# TODO: Remove this and fix test file lint errors
server/test/
```

## Findings

- **Current state:** `server/test/` entirely excluded from linting
- **Acknowledged tech debt:** Comment indicates intent to fix
- **Risk:** Tests may contain type-unsafe patterns, unused variables, or security anti-patterns
- **Scale:** ~250 warnings to address

## Proposed Solutions

### Option 1: Phased Re-enablement (Recommended)

**Approach:**

1. Create ESLint config override for tests with relaxed `any` rules
2. Fix 20-30 errors per sprint
3. Gradually tighten rules as files are cleaned

```javascript
// .eslintrc.cjs overrides
overrides: [
  {
    files: ['server/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // Warn, don't error
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
```

**Pros:**

- Enables linting immediately (catches new errors)
- Existing warnings visible but non-blocking
- Progress can be tracked

**Cons:**

- Requires ongoing effort to fix warnings

**Effort:** 2 hours initial + 2-4 hours per sprint

**Risk:** Low

---

### Option 2: Fix All Warnings At Once

**Approach:** Dedicate time to fix all ~250 warnings, then remove exclusion.

**Pros:**

- Clean slate immediately
- No ongoing maintenance

**Cons:**

- Large time investment (8-16 hours)
- May introduce regressions if done hastily

**Effort:** 8-16 hours

**Risk:** Medium

## Recommended Action

**DEFERRED: Option 1 - Phased re-enablement (future sprint)**

This is a larger effort (~250 warnings). For now:

1. Keep the exclusion in place
2. Create tracking comment with issue reference
3. Address incrementally in future sprints

**Rationale:** The immediate code review findings (418, 419, 421, 422) provide more value per effort. Test linting is tech debt to address later.

**Effort:** 8+ hours total | **Risk:** Low | **Priority downgraded to P3**

## Technical Details

**Affected files:**

- `.eslintignore` - remove `server/test/` line
- `.eslintrc.cjs` - add test file overrides

## Acceptance Criteria

- [x] Test files linted (with relaxed rules)
- [x] Existing warnings don't break CI
- [x] New test code is validated
- [ ] Tracking issue created for fixing warnings (deferred - 468 warnings to address)

## Work Log

### 2025-12-26 - Resolution

**By:** Claude Code

**Actions:**

- Removed `server/test/` exclusion from `.eslintignore`
- Updated `server/.eslintrc.json` with relaxed test file rules:
  - `@typescript-eslint/no-unused-vars`: changed to 'warn' for test files
  - `@typescript-eslint/consistent-type-imports`: disabled for test files
- Result: 0 errors, 468 warnings (lint passes CI, warnings are visible)
- Note: Server has its own `.eslintrc.json` with `root: true`, so root config overrides don't apply

### 2025-12-26 - Discovery via Code Review

**By:** Claude Code (Security Sentinel, Code Simplicity agents)

**Actions:**

- Identified exclusion pattern during commit 21a9b3a review
- Documented scope of warnings (~250)

## Resources

- **Commit:** 21a9b3a
- **Review agents:** Security Sentinel, Code Simplicity Reviewer
