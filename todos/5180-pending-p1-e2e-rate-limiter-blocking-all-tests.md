---
status: pending
priority: p1
issue_id: '5180'
tags: [code-review, e2e-tests, rate-limiting, quick-fix]
dependencies: []
---

# E2E Tests Blocked by Signup Rate Limiter (Quick Fix)

## Problem Statement

**130 out of 169 E2E tests are failing** because they're hitting the signup rate limiter and getting blocked with "Too many signup attempts. Please try again in an hour." This is **Pitfall #21** from CLAUDE.md: rate limiters need `isTestEnvironment` bypass.

**Why it matters:** Entire E2E test suite is blocked by a single missing check. This is a **5-minute fix** that will unblock ~120 tests.

## Findings

**Source:** E2E test error contexts analysis

**Root Cause Pattern (affects ~120 tests):**

```yaml
alert [ref=e21]:
  - img [ref=e22]
  - generic [ref=e24]: Too many signup attempts. Please try again in an hour.
```

**Affected Test Suites:**

- onboarding-flow (7 tests) - Stuck at signup
- landing-page-editor (9 tests) - Stuck at signup
- agent-ui-control (2 tests) - Stuck at signup
- build-mode (11 tests) - Stuck at signup
- visual-editor (2 tests) - Stuck at signup
- early-access-waitlist (~12 tests) - Rate limit errors
- password-reset (10 tests) - Rate limit errors
- **Total:** ~120 tests blocked by rate limiting

**Additional Issues (not rate limiting):**

- Admin login redirect (~5 tests) - Different root cause
- Storefront 404 errors (~5 tests) - Different root cause

## Proposed Solutions

### Solution 1: Add E2E_TEST Bypass to Signup Limiter (Recommended - QUICK FIX)

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts`

**Current Code:**

```typescript
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: 'Too many signup attempts. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Fix:**

```typescript
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnvironment ? 5000 : 5, // ✅ Bypass in E2E tests
  message: 'Too many signup attempts. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Pros:**

- **5-minute fix**
- Unblocks ~120 tests immediately
- Consistent with other rate limiters (publicLimiter, adminLimiter)
- Already documented pattern (Pitfall #21)

**Cons:**

- None

**Effort:** 5 minutes
**Risk:** ZERO - Test-only change

### Solution 2: Set E2E_TEST=1 in Playwright Config

**Location:** `/Users/mikeyoung/CODING/MAIS/playwright.config.ts`

**Verify webServer has E2E_TEST=1:**

```typescript
webServer: {
  command: 'E2E_TEST=1 npm run dev:all',
  port: 3000,
  timeout: 120000,
},
```

**If missing, add it.**

**Pros:**

- Enables all rate limiter bypasses
- Standard E2E pattern

**Cons:**

- Only works if Solution 1 is also implemented

**Effort:** 2 minutes
**Risk:** ZERO

## Recommended Action

**Implement BOTH solutions:**

1. Add `isTestEnvironment` check to `signupLimiter` → 5 min
2. Verify `E2E_TEST=1` in playwright.config.ts → 2 min

**Expected Result:** ~120 tests go from failing → passing (92% → 95%+ pass rate)

## Technical Details

**Affected File:**

- `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts`

**Pattern to Follow:**

```typescript
// Existing pattern from publicLimiter (line ~20):
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const publicLimiter = rateLimit({
  max: isTestEnvironment ? 5000 : 300, // ✅ Already has bypass
});

// Apply same pattern to:
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 5000 : 5, // ❌ Missing bypass
});
```

**Verification:**

```bash
# Run E2E tests after fix
npm run test:e2e

# Expected result:
# Before: 39 passed, 130 failed (23%)
# After:  ~160 passed, <10 failed (95%+)
```

## Acceptance Criteria

- [ ] `signupLimiter` has `isTestEnvironment` bypass
- [ ] `E2E_TEST=1` set in playwright.config.ts webServer command
- [ ] Run E2E test suite → pass rate >90%
- [ ] onboarding-flow tests pass (no longer stuck at signup)
- [ ] build-mode tests pass (no longer stuck at signup)
- [ ] agent-ui-control tests pass (no longer stuck at signup)
- [ ] All tests that were blocked by "Too many signup attempts" now pass

## Work Log

| Date       | Action                                             | Learnings                                              |
| ---------- | -------------------------------------------------- | ------------------------------------------------------ |
| 2026-01-11 | Analyzed error contexts - found rate limit pattern | One root cause (rate limiter) affects 120/130 failures |
| 2026-01-11 | Identified as Pitfall #21 (CLAUDE.md)              | Known pattern, documented solution                     |

## Resources

- **CLAUDE.md Pitfall #21:** "E2E rate limiter misses (ALL need `isTestEnvironment` check)"
- **Existing Pattern:** `publicLimiter` in same file already has bypass
- **Test Contexts:** All show "Too many signup attempts" alert
- **Related Doc:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/testing-gaps/e2e-rate-limiting-bypass-visual-editor.md`
