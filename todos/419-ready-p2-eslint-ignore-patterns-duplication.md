---
status: completed
priority: p2
issue_id: "419"
tags: [code-review, eslint, configuration, maintainability]
dependencies: []
completed_at: "2025-12-26"
---

# Consolidate Duplicate ESLint Ignore Patterns

## Problem Statement

ESLint ignore patterns are duplicated between `.eslintrc.cjs` (ignorePatterns) and `.eslintignore` file. This creates maintenance burden, potential drift, and confusion about which is authoritative.

## Findings

- **`.eslintrc.cjs` ignorePatterns (lines 23-35):**
  ```javascript
  ignorePatterns: [
    'dist', 'node_modules', 'coverage', '*.cjs', '*.js',
    'generated', 'apps/web', '**/test/templates/**',
    'server/scripts/**', '**/update-tenant-passwords.ts', 'tests/**',
  ],
  ```

- **`.eslintignore` (32 lines):** Contains all the above plus additional patterns like `server/test/`, `e2e/`, `docs/examples/`

- **Overlap:** `dist`, `node_modules`, `coverage`, `*.cjs`, `*.js`, `generated`, `apps/web`, `server/scripts`, `tests` appear in both

- **Drift risk:** If patterns are added to one but not the other, behavior becomes inconsistent

## Proposed Solutions

### Option 1: Use Only .eslintignore (Recommended)

**Approach:** Remove `ignorePatterns` from `.eslintrc.cjs`, rely solely on `.eslintignore`.

**Pros:**
- `.eslintignore` is ESLint's standard mechanism
- Easier to read (one file vs embedded in config)
- `.eslintignore` already has more comprehensive patterns

**Cons:**
- Requires verifying all patterns are in `.eslintignore`

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use Only ignorePatterns in Config

**Approach:** Delete `.eslintignore`, move all patterns to `.eslintrc.cjs`.

**Pros:**
- All configuration in one file

**Cons:**
- `.eslintignore` is more readable for long lists
- Can't be shared across multiple ESLint configs easily

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**APPROVED: Option 1 - Use only .eslintignore**

1. Remove `ignorePatterns` array from `.eslintrc.cjs` (lines 23-35)
2. Verify `.eslintignore` has all patterns (it does - more comprehensive)
3. Run `npm run lint` to verify same behavior

**Effort:** 15 minutes | **Risk:** Low

## Technical Details

**Affected files:**
- `.eslintrc.cjs` - remove ignorePatterns array
- `.eslintignore` - verify complete

## Acceptance Criteria

- [x] `ignorePatterns` removed from `.eslintrc.cjs`
- [x] `.eslintignore` contains all previously ignored patterns
- [x] `npm run lint` produces same results (305 errors)

## Work Log

### 2025-12-26 - Discovery via Code Review

**By:** Claude Code (Architecture Strategist agent)

**Actions:**
- Identified duplication during commit 21a9b3a review
- Documented overlap between files

## Resources

- **Commit:** 21a9b3a
- **Review agents:** Architecture Strategist, Code Simplicity Reviewer
